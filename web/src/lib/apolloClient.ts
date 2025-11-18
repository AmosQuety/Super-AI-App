// web/src/lib/apolloClient.ts
import {
  ApolloClient,
  InMemoryCache,
  from,
  createHttpLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";

// GraphQL endpoint
const GRAPHQL_URL = "http://localhost:4001/graphql";

// Create HTTP link
const httpLink = createHttpLink({
  uri: GRAPHQL_URL,
  credentials: "include",
});

// Auth link - Get token from localStorage
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('authToken');
  
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }
  };
});

// REFACTOR: Enhanced retry logic with exponential backoff
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 3000,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => {
      // Retry on network errors and specific server errors
      return !!error && (
        error.toString().includes('NetworkError') ||
        error.toString().includes('Failed to fetch')
      );
    },
  },
});

// REFACTOR: Enhanced error handling with user feedback
const errorLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path, extensions }) => {
        console.error(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
        );
        
        // Enhanced authentication error handling
        if (extensions?.code === "UNAUTHENTICATED") {
          console.warn("User authentication failed - redirecting to login");
          
          // Show user feedback before redirecting
          if (typeof window !== 'undefined') {
            // You can integrate with a toast notification system here
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            
            // Use gentle redirect that preserves current path for return
            const currentPath = window.location.pathname;
            if (currentPath !== '/login') {
              window.location.href = `/login?returnTo=${encodeURIComponent(currentPath)}`;
            }
          }
        }
      });
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError.message}`);
      
      // Enhanced network error feedback
      if (networkError.message.includes("Failed to fetch")) {
        console.error("Server is not reachable. Please check if the backend is running.");
        // Could trigger a global offline state here
      }
    }
  }
);

// Create Apollo Client
const client = new ApolloClient({
  link: from([retryLink, errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: "ignore",
    },
    query: {
      errorPolicy: "all",
    },
  },
});

export default client;