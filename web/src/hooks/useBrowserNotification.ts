import { useCallback, useState, useEffect } from 'react';

/**
 * Hook to manage native browser notifications. Allows the app to notify
 * the user when a long-running AI task completes, specifically if they 
 * have navigated away from the active tab.
 */
export function useBrowserNotification() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Check initial permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  /**
   * Request permission from the user to send notifications.
   * Call this when the user initiates a long-running action.
   */
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications.');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const newPermission = await Notification.requestPermission();
      setPermission(newPermission);
      return newPermission === 'granted';
    }

    return false;
  }, []);

  /**
   * Send a notification ONLY if the user is currently looking at another tab
   * or the browser is minimized.
   */
  const notifyWhenReady = useCallback((title: string, options?: NotificationOptions) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    if (document.visibilityState !== 'visible') {
      try {
        const notif = new Notification(title, {
          icon: '/favicon.ico', // Default icon, can be overridden via options
          badge: '/favicon.ico',
          vibrate: [200, 100, 200], // Haptic feedback for mobile
          requireInteraction: false, // Don't force them to explicitly dismiss it
          ...options,
        } as any);

        // Clicking the notification should focus the window
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.error('Failed to dispatch background notification', err);
      }
    }
  }, []);

  return { permission, requestPermission, notifyWhenReady };
}
