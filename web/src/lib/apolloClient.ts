// src/lib/apolloClient.ts

import {
  ApolloClient,
  InMemoryCache,
  from,
  ApolloLink,
  Observable,
  HttpLink,
  split,
  type Operation,
} from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { setContext } from "@apollo/client/link/context";
import { RetryLink } from "@apollo/client/link/retry";
import { ErrorLink } from "@apollo/client/link/error";
import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
  ServerParseError,
  LocalStateError,
  UnconventionalError,
} from "@apollo/client/errors";
import ErrorMonitor from "./ErrorMonitor";
import { createUploadLink } from "./uploadLink";

// Extend Vite's ImportMeta type
declare global {
  interface ImportMetaEnv {
    VITE_GRAPHQL_URL?: string;
    MODE: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// phone IP address
// const GRAPHQL_URL = "http://172.16.0.78:4001/graphql";
// const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || "http://localhost:4001/graphql";


const GRAPHQL_URL = "https://super-ai-app.onrender.com/graphql";


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
    retryIf: (error, operation: Operation) => {
      // Explicitly mark operation parameter to avoid unused warning
      console.log('Retry attempt for operation:', operation.operationName);
      return !!error && (
        error.toString().includes('NetworkError') ||
        error.toString().includes('Failed to fetch')
      );
    },
  },
});



// Error handling
const errorLink = new ErrorLink(({ error, operation }) => {
  decrementRequest();

  console.log("❌ GraphQL Operation:", operation.operationName);

  // 1. Capture Network Errors
  if (error && 'networkError' in error && error.networkError) {
      console.error(`[Network error]:`, error.networkError);
      
      // 👇 SEND TO SENTRY
      ErrorMonitor.capture(error.networkError as Error, {
          type: 'NetworkError',
          operation: operation.operationName,
          url: import.meta.env.VITE_GRAPHQL_URL
      });
  }

  //  GraphQL execution errors
  if (CombinedGraphQLErrors.is(error)) {
    error.errors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(
          locations
        )}, Path: ${path}`
      );
      ErrorMonitor.capture(new Error(message), {
            type: 'GraphQLError',
            path: path?.join('.'),
            code: extensions?.code
        });

      if (extensions?.code === "UNAUTHENTICATED") {
        console.warn("User authentication failed");

        if (typeof window !== "undefined") {
          if (!localStorage.getItem("authToken")) {
            const currentPath = window.location.pathname;
            if (currentPath !== "/login") {
              window.location.href = `/login?returnTo=${encodeURIComponent(
                currentPath
              )}`;
            }
          }
        }
      }
    });

    return;
  }

  //  Multipart / protocol errors
  if (CombinedProtocolErrors.is(error)) {
    error.errors.forEach(({ message, extensions }) => {
      console.error(
        `[Protocol error]: ${message}, Extensions: ${JSON.stringify(extensions)}`
      );
    });
    return;
  }

  //  Server returned non-200
  if (ServerError.is(error)) {
    console.error(
      `[Server error]: ${error.statusCode} - ${error.message}`
    );
    return;
  }

  //  JSON parse error
  if (ServerParseError.is(error)) {
    console.error("[Parse error]:", error.message);
    return;
  }

  //  Local cache/state errors
  if (LocalStateError.is(error)) {
    console.error("[Local state error]:", error.message);
    return;
  }

  // Anything weird
  if (UnconventionalError.is(error)) {
    console.error("[Unconventional error]:", error.message);
    return;
  }

  //  Fallback
  console.error("[Unknown error]:", error);
});


    
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