// web/src/lib/apolloClient.ts
import {
  ApolloClient,
  InMemoryCache,
  HttpLink,
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
  // Add credentials if needed
  credentials: "include",
});

// Auth link (removed for development - no API key needed)
const authLink = setContext((_, { headers }) => {
  return {
    headers: {
      ...headers,
      // No authorization header needed in development
    },
  };
});

const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => {
      return !!error && Boolean(error).toString() === "[object NetworkError]";
    },
  },
});


const errorLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path, extensions }) => {
        console.error(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
        );
        
        // Handle specific error codes
        if (extensions?.code === "UNAUTHENTICATED") {
          console.warn("User authentication failed");
        }
      });
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError.message}`);
      
      // Check if server is reachable
      if (networkError.message.includes("Failed to fetch")) {
        console.error("Server is not reachable. Please check if the backend is running.");
      }
    }
  }
);

// Create Apollo Client
const client = new ApolloClient({
  link: from([retryLink, errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  // Add these options for better debugging
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
