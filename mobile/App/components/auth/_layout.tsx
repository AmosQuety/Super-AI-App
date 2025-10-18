import { Stack } from 'expo-router';
import { PublicRoute } from './public-route';

export default function AuthLayout() {
  return (
    <PublicRoute>
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: 'Sign In' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Sign Up' }} />
    </Stack>
    </PublicRoute>
  );
}