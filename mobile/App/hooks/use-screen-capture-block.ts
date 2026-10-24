import { useFocusEffect } from 'expo-router';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { useCallback } from 'react';

// Blocks screenshots, screen recording and the app-switcher preview (Android FLAG_SECURE)
// while the screen is focused, for screens where a password can be on display.
// Each screen passes its own key: when one screen blurs and the next focuses, the shared
// protection is only released once every key is released, so there is no unprotected gap.
// A failure to apply the block must not stop the user from signing in, so it is only logged.
export function useScreenCaptureBlock(screenKey: string) {
  useFocusEffect(
    useCallback(() => {
      preventScreenCaptureAsync(screenKey).catch((error) =>
        console.warn('Could not block screen capture:', error)
      );
      return () => {
        allowScreenCaptureAsync(screenKey).catch((error) =>
          console.warn('Could not restore screen capture:', error)
        );
      };
    }, [screenKey])
  );
}
