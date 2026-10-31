// app/features/_layout.tsx
import { Stack } from 'expo-router';
import { ProtectedRoute } from '../../components/auth/protected-route';

// Every feature screen needs a signed-in user. Without this guard, a session that ends
// while the user is on one of these screens would leave them there with a dead screen.
export default function FeaturesLayout() {
  return (
    <ProtectedRoute>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </ProtectedRoute>
  );
}
