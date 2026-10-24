// app/features/voice/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import { renderScreenHeader } from '../../../components/ui/screen-header';

const VoiceLayout: React.FC = () => {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#10B981' },
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: 'bold' },
        headerShown: true,
        title: 'Voice AI Tools',
        // Draws its own status-bar inset (see components/ui/screen-header.tsx).
        header: renderScreenHeader({ background: '#10B981', foreground: '#064E3B' }),
      }}
    />
  );
};

export default VoiceLayout;
