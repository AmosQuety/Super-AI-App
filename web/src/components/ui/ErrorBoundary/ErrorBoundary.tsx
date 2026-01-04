// src/components/ui/ErrorBoundary.tsx
import  { Component,  type ReactNode } from "react";
import ErrorMonitor from "../../../lib/ErrorMonitor";
import ErrorDisplay from "./ErrorDisplay";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string; // Always a string from ErrorMonitor.capture()
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorId: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true, 
      error, 
      errorId: '' 
    };
  }

  public componentDidCatch(error: Error) {
    // Send to our monitor
    const errorId = ErrorMonitor.capture(error, {
      // componentStack: errorInfo.componentStack
    });
    
    this.setState({ errorId });
  }

  private handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorId: '' 
    });
    window.location.reload(); // Hard reload to clear bad state
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorDisplay 
          error={this.state.error} 
          resetErrorBoundary={this.handleReset}
          errorId={this.state.errorId || undefined}
        />
      );
    }

    return this.props.children;
  }
}