// src/components/ui/ErrorBoundary.tsx
import  { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorMonitor from "../../../lib/ErrorMonitor";
import ErrorDisplay from "../ErrorBoundary/ErrorDisplay";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Send to our monitor
    const errorId = ErrorMonitor.capture(error, {
      componentStack: errorInfo.componentStack
    });
    
    this.setState({ errorId });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload(); // Hard reload to clear bad state
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorDisplay 
          error={this.state.error} 
          resetErrorBoundary={this.handleReset}
          errorId={this.state.errorId}
        />
      );
    }

    return this.props.children;
  }
}