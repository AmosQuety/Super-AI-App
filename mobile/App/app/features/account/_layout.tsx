// app/features/account/_layout.tsx
import { Stack } from 'expo-router';
import { renderScreenHeader } from '../../../components/ui/screen-header';

export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        // Draws its own status-bar inset (see components/ui/screen-header.tsx).
        header: renderScreenHeader(),
      }}>
      <Stack.Screen name="change-password" options={{ title: 'Change password' }} />
      <Stack.Screen name="edit-name" options={{ title: 'Edit name' }} />
      <Stack.Screen name="assistant-settings" options={{ title: 'Assistant settings' }} />
    </Stack>
  );
}
