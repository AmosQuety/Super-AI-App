// app/features/chats/_layout.tsx - PROFESSIONAL STYLED VERSION
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { renderScreenHeader } from '../../../components/ui/screen-header';

export default function ChatsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerTintColor: '#1f2937',
        headerShadowVisible: true,
        animation: 'slide_from_right',
        // Draws its own status-bar inset (see components/ui/screen-header.tsx).
        header: renderScreenHeader(),
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: 'Chats',
          headerShown: false, // We use custom header in the screen
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Conversation',
          headerShown: true,
          headerBackTitle: 'Back',
          headerTitleAlign: 'center',
        }}
      />
      <Stack.Screen
        name="new"
        options={{
          title: 'New Chat',
          headerShown: true,
          headerBackTitle: 'Cancel',
          presentation: Platform.OS === 'ios' ? 'modal' : 'card',
        }}
      />
    </Stack>
  );
}
