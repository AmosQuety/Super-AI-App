import {  useCallback } from 'react';
import confetti from 'canvas-confetti';

export const useDelight = () => {
  const triggerSuccess = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#a855f7', '#ec4899'] // Your brand colors
    });
  }, []);

  return { triggerSuccess };
};