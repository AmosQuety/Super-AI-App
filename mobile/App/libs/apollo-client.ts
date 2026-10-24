// libs/apollo-client.ts
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from,
  split,
  type ErrorLike,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { storageService } from '../services/storage';
import { config } from './environment';
import { notifySessionEnded } from './session-events';

// Create HTTP link
const httpLink = createHttpLink({
  uri: config.GRAPHQL_URL,
  credentials: 'include',
});

// Auth link to add token to requests
const authLink = setContext(async (_, { headers }) => {
  const token = await storageService.getAuthToken();

  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

// WebSocket link for subscriptions (only if enabled)
let wsLink: any = null;
let usePollingFallback = false;

if (config.FEATURE_FLAGS.enableSubscriptions) {
  try {
    const wsUrl = config.GRAPHQL_URL.replace('http', 'ws').replace('https', 'wss');

    wsLink = new GraphQLWsLink(
      createClient({
        url: wsUrl,
        connectionParams: async () => {
          const token = await storageService.getAuthToken();
          return {
            authToken: token,
          };
        },
        on: {
          connected: () => {
            console.log('🔄 WebSocket connected');
            usePollingFallback = false;
          },
          error: (error) => {
            console.error('WebSocket failed, will use polling fallback:', error);
            usePollingFallback = true;
          },
          closed: () => {
            console.log('WebSocket closed, will use polling fallback');
            usePollingFallback = true;
          },
        },
        // Retry logic
        retryAttempts: 3,
        shouldRetry: () => true,
      })
    );
    console.log('✅ WebSocket link initialized');
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket link, using polling fallback:', error);
    usePollingFallback = true;
  }
} else {
  usePollingFallback = true;
}

// Failed sign-in attempts legitimately answer UNAUTHENTICATED, so they must not end the session.
const SIGN_IN_OPERATION_NAMES = new Set(['Login', 'Register', 'LoginWithFace', 'LoginWithVoice']);

let isEndingSession = false;

// The server no longer accepts this session (expired, revoked, account disabled):
// drop the stored login and cached data, then tell the app to show sign-in.
async function endRejectedSession() {
  if (isEndingSession) return;
  isEndingSession = true;
  try {
    await storageService.clearAuth();
    await apolloClient?.clearStore();
  } catch (error) {
    // Still sign the user out; a stale cache must not keep them on protected screens.
    console.error('Failed to fully clear the rejected session:', error);
  } finally {
    isEndingSession = false;
    notifySessionEnded();
  }
}

function isSessionRejection(error: ErrorLike, operationName: string): boolean {
  if (SIGN_IN_OPERATION_NAMES.has(operationName)) return false;
  return (
    CombinedGraphQLErrors.is(error) &&
    error.errors.some(({ extensions }) => extensions?.code === 'UNAUTHENTICATED')
  );
}

// Only an explicit UNAUTHENTICATED ends the session; network and server errors
// (including 'Account verification is temporarily unavailable') keep the user signed in.
const errorLink = new ErrorLink(({ error, operation }) => {
  const operationName = operation.operationName || 'AnonymousOperation';

  if (CombinedGraphQLErrors.is(error)) {
    error.errors.forEach(({ message, path, extensions }) => {
      console.error(
        `[GraphQL error] ${operationName}: ${message}, Path: ${path?.join('.')}, Code: ${extensions?.code}`
      );
    });
  } else {
    console.error(`[Network error] ${operationName}: ${error.message}`);
  }

  if (isSessionRejection(error, operationName)) {
    console.warn(`Session rejected by the server during ${operationName}; signing out`);
    void endRejectedSession();
  }
});

// Create the main link
let link;

if (wsLink && !usePollingFallback) {
  // Use split link for subscriptions + HTTP when WebSocket is available
  link = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
    },
    wsLink,
    from([errorLink, authLink, httpLink]) // HTTP operations
  );
  console.log('🔌 Using WebSocket for subscriptions');
} else {
  // Fallback to HTTP only (polling)
  link = from([errorLink, authLink, httpLink]);
  console.log('📡 Using HTTP polling (WebSocket unavailable)');
}

// Helper to check if we should use polling in components
export const shouldUsePolling = () => usePollingFallback;

// Create Apollo Client instance
export const createApolloClient = () => {
  if (!config.FEATURE_FLAGS.enableGraphQL) {
    console.warn('GraphQL is disabled in feature flags');
    return null;
  }

  return new ApolloClient({
    link: link,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
        errorPolicy: 'all',
      },
      query: {
        fetchPolicy: 'cache-first',
        errorPolicy: 'all',
      },
    },
  });
};

export const apolloClient = createApolloClient();
export default apolloClient;
