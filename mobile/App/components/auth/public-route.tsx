import { Redirect } from 'expo-router';
import { Loading } from '../ui/loading';
import { useAuth } from '../../hooks/use-auth';

interface PublicRouteProps {
  children: React.ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loading fullScreen message="Checking authentication..." />;
  }

  if (isAuthenticated) {
    // If user is already authenticated, redirect to the main app
    return <Redirect href="/(tabs)" />;
  }

  // If user is not authenticated, show the public content (sign-in/sign-up)
  return <>{children}</>;
}