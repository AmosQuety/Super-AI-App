// src/lib/apolloClient.ts

import {
  ApolloClient,
  InMemoryCache,
  from,
  ApolloLink,
  Observable,
  HttpLink, // Import HttpLink
  split,    // Import split
} from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities"; // Import utility
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { createUploadLink } from "./uploadLink"; // Ensure this path is correct for your project

// phone IP address
// const GRAPHQL_URL = "http://172.16.0.78:4001/graphql";
const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || "http://localhost:4001/graphql";

console.log('🔧 Apollo Client Configuration:', {
  graphqlUrl: GRAPHQL_URL,
  environment: import.meta.env.MODE,
});

// 1. Create the Upload Link (For mutations with files)
const uploadLink = createUploadLink({
  uri: GRAPHQL_URL,
  headers: {
    "apollo-require-preflight": "true",
  },
}) as unknown as ApolloLink;

// 2. Create the Standard HTTP Link (For everything else - sends application/json)
const httpLink = new HttpLink({
  uri: GRAPHQL_URL,
});

// 3. Create a Split Link
// This routes requests: If it's a mutation with files, use uploadLink. Otherwise, use httpLink.
const terminalLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'mutation' 
      // You can add more logic here if needed, but usually 
      // separating mutations is enough to catch file uploads 
      // if you assume only mutations have files.
    );
  },
  uploadLink,
  httpLink
);

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
const authLink = setContext(async (_, { headers }) => {
  // Read token fresh from localStorage every time
  const token = localStorage.getItem('authToken');
  
  // Debug log to ensure token exists when query fires
  if (!token) console.warn('⚠️ No auth token found in localStorage');
  
  return {
    headers: {
      ...headers,
      "apollo-require-preflight": "true",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }
  };
});

// Retry logic
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: 3000,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => {
      return !!error && (
        error.toString().includes('NetworkError') ||
        error.toString().includes('Failed to fetch')
      );
    },
  },
});

// Error handling
const errorLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    decrementRequest();
    
    console.log('❌ GraphQL Operation:', operation.operationName);
    
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path, extensions }) => {
        console.error(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
        );
        
        if (extensions?.code === "UNAUTHENTICATED") {
          console.warn("User authentication failed - redirecting to login");
          
          if (typeof window !== 'undefined') {
            // Only clear and redirect if we are SURE it's not a temporary glitch
            // Checks if the token is actually missing before nuking session
            if (!localStorage.getItem('authToken')) {
                const currentPath = window.location.pathname;
                if (currentPath !== '/login') {
                  window.location.href = `/login?returnTo=${encodeURIComponent(currentPath)}`;
                }
            }
          }
        }
      });
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError.message}`);
    }
  }
);

// Tracking link
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
        observer.next(response);
      },
      error: (error) => {
        decrementRequest();
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
  // CHAIN: Track -> Retry -> Error -> Auth -> (Split: HTTP vs Upload)
  link: from([trackingLink, retryLink, errorLink, authLink, terminalLink]),
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