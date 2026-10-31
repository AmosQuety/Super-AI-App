import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { useToast } from '../components/ui/toast';
import { ApiError, toUserFacingError } from '../services/api';

// Whether this screen is still the one on show. A save can finish after the user has left, and
// then it must not navigate again.
export function useScreenFocusRef() {
  const isFocused = useRef(true);
  useFocusEffect(
    useCallback(() => {
      isFocused.current = true;
      return () => {
        isFocused.current = false;
      };
    }, [])
  );
  return isFocused;
}

// One way to report a failed save on every account screen. A rejected session is already taking
// the user to Sign In, so it gets no toast.
export function useSaveFailureToast() {
  const { showError } = useToast();
  return useCallback(
    (title: string, error: unknown) => {
      const failure = error instanceof ApiError ? error : toUserFacingError(error);
      if (failure.code === 'UNAUTHENTICATED') return;
      showError(title, failure.message);
    },
    [showError]
  );
}
