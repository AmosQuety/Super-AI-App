// web/src/lib/apolloClient.ts

import {
  ApolloClient,
  InMemoryCache,
  from,
  ApolloLink,
  Observable,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import createUploadLink from "apollo-upload-client";

// GraphQL endpoint
const GRAPHQL_URL = "http://localhost:4001/graphql";

console.log('🔧 Apollo Client Configuration:', {
  graphqlUrl: GRAPHQL_URL,
  environment: import.meta.env.MODE,
});

// --- FIX IS HERE ---
// 1. We cast the result to 'unknown' first, then 'ApolloLink'.
// This tells TypeScript: "I know this library returns a link, trust me."
const httpLink = createUploadLink({
  uri: GRAPHQL_URL,
  headers: {
    "apollo-require-preflight": "true",
  }
}) as unknown as ApolloLink; 
// -------------------

// Add loading state tracking
let activeRequests = 0;

const incrementRequest = () => {
  activeRequests++;
  console.log(`📡 Active GraphQL requests: ${activeRequests}`);
};

const decrementRequest = () => {
  activeRequests = Math.max(0, activeRequests - 1);
  console.log(`📡 Active GraphQL requests: ${activeRequests}`);
};

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
    decrementRequest();
    
    console.log('❌ GraphQL Operation:', operation.operationName);
    
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path, extensions }) => {
        console.error(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
        );
        console.error('Extensions:', extensions);
        
        if (extensions?.code === "UNAUTHENTICATED") {
          console.warn("User authentication failed - redirecting to login");
          
          if (typeof window !== 'undefined') {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            
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
      
      if (networkError.message.includes("Failed to fetch")) {
        console.error("🔴 Server is not reachable. Please check if the backend is running.");
      }
    }
  }
);

// Create a custom link to track requests and log them
const trackingLink = new ApolloLink((operation, forward) => {
  incrementRequest();
  
  console.log('🚀 GraphQL Operation:', {
    name: operation.operationName,
    variables: operation.variables,
  });
  
  const observable = forward(operation);
  
  return new Observable((observer) => {
    const subscription = observable.subscribe({
      next: (response) => {
        decrementRequest();
        console.log('✅ GraphQL Response:', {
          name: operation.operationName,
          data: response.data,
          errors: response.errors,
        });
        observer.next(response);
      },
      error: (error) => {
        decrementRequest();
        console.error('❌ GraphQL Error in tracking link:', error);
        observer.error(error);
      },
      complete: () => {
        observer.complete();
      },
    });
    
    return () => subscription.unsubscribe();
  });
});

// Create Apollo Client
const client = new ApolloClient({
  link: from([trackingLink, retryLink, errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: "all",
      fetchPolicy: "cache-and-network",
    },
    query: {
      errorPolicy: "all",
      fetchPolicy: "network-only",
    },
  },
});

console.log('✅ Apollo Client initialized');

export default client;