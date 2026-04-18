/**
 * useNetworkQuality.ts
 *
 * Centralised hook for network quality detection.
 * Replaces the duplicated inline connection-check logic in:
 *   InputArea, VoiceTools, DocumentUploader, ImageGenerator, apolloClient
 *
 * Uses the Network Information API (navigator.connection) where available,
 * falling back to navigator.onLine. Updates reactively when connection changes.
 */

import { useState, useEffect } from 'react';

export type EffectiveConnectionType = '2g' | '3g' | '4g' | 'slow-2g' | 'unknown';

export interface NetworkQuality {
  /** Raw effectiveType string from the browser API, or 'unknown' */
  effectiveType: EffectiveConnectionType;
  /** True if the user has enabled data-saver mode */
  saveData: boolean;
  /** Round-trip time estimate in ms (0 if unavailable) */
  rtt: number;
  /** True for 2G, slow-2G, or rtt > 500ms — primary "constrained" flag */
  isSlowNetwork: boolean;
  /** True on the East Africa first-class constraint tier (2G / slow-2G / saveData) */
  is2G: boolean;
  /** True for 3G connections */
  is3G: boolean;
  /** True when navigator.onLine is false */
  isOffline: boolean;
}

const DEFAULT_STATE: NetworkQuality = {
  effectiveType: 'unknown',
  saveData: false,
  rtt: 0,
  isSlowNetwork: false,
  is2G: false,
  is3G: false,
  isOffline: false,
};

function readConnection(): NetworkQuality {
  const conn = (navigator as any).connection;
  const effectiveType: EffectiveConnectionType = conn?.effectiveType ?? 'unknown';
  const saveData: boolean = conn?.saveData ?? false;
  const rtt: number = conn?.rtt ?? 0;

  const is2G = effectiveType === '2g' || effectiveType === 'slow-2g' || saveData;
  const is3G = effectiveType === '3g';
  const isSlowNetwork = is2G || rtt > 500;

  return {
    effectiveType,
    saveData,
    rtt,
    isSlowNetwork,
    is2G,
    is3G,
    isOffline: !navigator.onLine,
  };
}

export function useNetworkQuality(): NetworkQuality {
  const [quality, setQuality] = useState<NetworkQuality>(() => {
    // SSR / test safety: navigator may not exist
    if (typeof navigator === 'undefined') return DEFAULT_STATE;
    return readConnection();
  });

  useEffect(() => {
    const update = () => setQuality(readConnection());

    // Network Information API change event
    const conn = (navigator as any).connection;
    conn?.addEventListener('change', update);

    // Online/offline events (always available)
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    // Initial sync in case state changed between render and effect
    update();

    return () => {
      conn?.removeEventListener('change', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return quality;
}
