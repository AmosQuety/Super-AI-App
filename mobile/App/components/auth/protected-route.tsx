import { Redirect } from 'expo-router';
import { Loading } from '../ui/loading';
import { useAuth } from '../../hooks/use-auth';
interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Loading fullScreen message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/sign-in" />;
  }

  return <>{children}</>;
}