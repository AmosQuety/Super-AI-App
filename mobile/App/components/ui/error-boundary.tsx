import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { RefreshCw, AlertTriangle } from 'lucide-react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
  resetOnNavigate?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 ErrorBoundary caught an error:', error, errorInfo);

    this.setState({ errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.props.resetOnNavigate &&
      this.state.hasError &&
      this.props.children !== prevProps.children
    ) {
      this.resetError();
    }
  }

  resetError = () => {
    console.log('🔄 Resetting error boundary');
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  showErrorDetails = () => {
    const { error, errorInfo } = this.state;

    Alert.alert(
      'Error Details',
      `Error: ${error?.message}\n\nComponent Stack: ${errorInfo?.componentStack || 'N/A'}`,
      [
        { text: 'OK', style: 'default' },
        { text: 'Copy', onPress: this.copyErrorToClipboard },
      ]
    );
  };

  copyErrorToClipboard = async () => {
    const errorText = `Error: ${this.state.error?.message}\nStack: ${this.state.error?.stack}\nComponent Stack: ${this.state.errorInfo?.componentStack}`;
    console.log('📋 Error details copied:', errorText);
    Alert.alert('Copied!', 'Error details copied to console');
  };

  renderFallback() {
    if (this.props.fallback) {
      return (
        <View>
          {this.props.fallback}
          <TouchableOpacity
            className="mx-4 mt-4 rounded-lg bg-red-600 px-6 py-4"
            onPress={this.resetError}>
            <Text className="text-center text-lg font-semibold text-white">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <SafeAreaView className="flex-1 bg-white">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          className="flex-1">
          <View className="flex-1 items-center justify-center px-6 py-8">
            {/* Error Icon */}
            <View className="mb-6 rounded-full bg-red-50 p-4">
              <AlertTriangle size={64} color="#DC2626" />
            </View>

            {/* Error Title */}
            <Text className="mb-3 text-center text-2xl font-bold text-gray-900">
              Oops! Something went wrong
            </Text>

            {/* Error Message */}
            <Text className="mb-8 text-center text-base leading-6 text-gray-600">
              {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
            </Text>

            {/* Action Buttons */}
            <View className="w-full gap-3">
              <TouchableOpacity
                className="flex-row items-center justify-center gap-3 rounded-xl bg-red-600 px-6 py-4 shadow-lg"
                onPress={this.resetError}>
                <RefreshCw size={20} color="#FFFFFF" />
                <Text className="text-lg font-semibold text-white">Try Again</Text>
              </TouchableOpacity>

              {this.props.showDetails && (
                <TouchableOpacity
                  className="rounded-xl border border-gray-300 bg-gray-100 px-6 py-4"
                  onPress={this.showErrorDetails}>
                  <Text className="text-center text-base font-medium text-gray-700">
                    View Details
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Debug Info (only in development) */}
            {__DEV__ && this.state.errorInfo && (
              <TouchableOpacity
                className="mt-8 rounded-lg border border-amber-300 bg-amber-100 p-4"
                onPress={this.showErrorDetails}>
                <Text className="text-center text-sm text-amber-800">
                  Tap to view technical details
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

// Convenience hook for using error boundary
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    console.error('Custom error handler:', error);
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    clearError,
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
      <ErrorBoundary
        onError={handleError}
        fallback={
          error ? (
            <View className="flex-1 items-center justify-center bg-white p-6">
              <View className="mb-4 rounded-full bg-red-50 p-4">
                <AlertTriangle size={48} color="#DC2626" />
              </View>
              <Text className="mb-2 text-center text-xl font-bold text-gray-900">Custom Error</Text>
              <Text className="mb-6 text-center text-gray-600">{error.message}</Text>
              <TouchableOpacity className="rounded-xl bg-red-600 px-6 py-3" onPress={clearError}>
                <Text className="text-base font-semibold text-white">Clear Error</Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }>
        {children}
      </ErrorBoundary>
    ),
  };
};

export default ErrorBoundary;
