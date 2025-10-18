// app/_layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from 'hooks/use-auth';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppToast } from '../components/ui/toast';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from '../libs/apollo-client';
import '../global.css';
import ErrorBoundary from 'components/ui/error-boundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    console.log('App initialized with Apollo Client');
  }, []);

  return (
    <ApolloProvider client={apolloClient}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ErrorBoundary 
              onError={(error) => {
                console.log('Root error:', error);
              }}
              resetOnNavigate={true}
              showDetails={__DEV__}
            >
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="features" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
                
              </Stack>
              <AppToast />
            </ErrorBoundary>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ApolloProvider>
  );
}