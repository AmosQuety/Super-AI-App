// libs/apollo-client.ts - FIXED VERSION
import { ApolloClient, InMemoryCache, createHttpLink, from, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { storageService } from '../services/storage';
import { config } from './environment';

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
    }
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

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      if (extensions?.code === 'UNAUTHENTICATED') {
        console.warn('User authentication failed');
        storageService.clearAuth().catch(console.error);
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError.message}`);
  }
});

// Create the main link
let link;

if (wsLink && !usePollingFallback) {
  // Use split link for subscriptions + HTTP when WebSocket is available
  link = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
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