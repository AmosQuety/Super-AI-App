// app/features/voice/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

const VoiceLayout: React.FC = () => {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: '#10B981' },
                headerTintColor: 'white',
                headerTitleStyle: { fontWeight: 'bold' },
                headerShown: true,
                title: 'Voice AI Tools',
            }}
        />
    );
};

export default VoiceLayout;