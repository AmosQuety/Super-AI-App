// app/features/image/_layout.tsx
import { Stack } from 'expo-router';
import { renderScreenHeader } from '../../../components/ui/screen-header';

export default function ImageLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerTintColor: '#1f2937',
        headerShadowVisible: true,
        animation: 'slide_from_right',
        // Draws its own status-bar inset (see components/ui/screen-header.tsx).
        header: renderScreenHeader(),
      }}>
      <Stack.Screen
        name="index"
        options={{ title: 'AI images', headerShown: true, headerTitleAlign: 'center' }}
      />
    </Stack>
  );
}
