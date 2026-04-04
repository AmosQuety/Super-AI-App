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
    // Detect stale-cache chunk loading failures (e.g. after a Vercel redeployment).
    // These look like: "Failed to fetch dynamically imported module: .../assets/SomePage-[hash].js"
    const isChunkLoadError =
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Importing a module script failed") ||
      error.message?.includes("error loading dynamically imported module") ||
      error.name === "ChunkLoadError";

    if (isChunkLoadError) {
      // Auto-recover: hard reload once to pick up the fresh build
      console.warn("🔄 Stale chunk detected — reloading to fetch fresh build...");
      window.location.reload();
      return;
    }

    // Send all other errors to the monitor
    const errorId = ErrorMonitor.capture(error, {});
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