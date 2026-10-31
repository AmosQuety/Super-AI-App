// hooks/use-auth.tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { AuthCredentials, User } from '../libs/types';
import { isExpectedFailureCode } from '../libs/error-codes';
import { isSessionExpired, msUntilExpiry } from '../libs/session';
import { onSessionEnded } from '../libs/session-events';
import type { TokenSwapResult } from '../libs/token-swap';
import { ApiError, apiService } from '../services/api';
import { storageService } from '../services/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signUp: (credentials: AuthCredentials & { name: string }) => Promise<void>;
  signOut: () => Promise<void>;
  // Resolves true when the update was applied to the current session, false when the user
  // signed out (or switched accounts) while it was in flight.
  updateProfile: (updates: { name?: string; email?: string }) => Promise<boolean>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean; message: string }>;
  // Ends every other session; this device stays signed in.
  // Resolves to what happened to this device's own session; see replaceTokenIfSessionUnchanged.
  signOutOtherSessions: () => Promise<TokenSwapResult>;
  refreshUser: () => Promise<void>;
}

// A failure the server explained (wrong password, validation) is shown to the user by the
// caller; only unexpected errors are logged, because console.error raises a banner in development.
function logUnexpected(action: string, error: unknown) {
  if (error instanceof ApiError && isExpectedFailureCode(error.code)) return;
  console.error(`${action} failed:`, error);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ends a session the app knows is no longer valid; clears storage and the Apollo cache.
  const endExpiredSession = useCallback(async () => {
    await apiService.logout();
    setUser(null);
  }, []);

  // The server rejected the session (see libs/apollo-client.ts), which already cleared storage.
  useEffect(() => onSessionEnded(() => setUser(null)), []);

  useEffect(() => {
    checkAuthStatus();
    // Runs once on launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSignOutAtExpiry(user, endExpiredSession);

  const checkAuthStatus = async () => {
    try {
      const token = await storageService.getAuthToken();
      if (!token) return;

      // An expired token must never be sent: sign out before any query runs.
      if (isSessionExpired(token)) {
        await endExpiredSession();
        return;
      }

      const userData = await apiService.getCurrentUser();
      setUser(userData);
      await storageService.setUser(userData);
    } catch (error) {
      logUnexpected('Auth check', error);
      await restoreCachedUserAfterOutage(error);
    } finally {
      setIsLoading(false);
    }
  };

  // A network or server failure is not proof the session is invalid, so an unexpired login
  // stays usable from the cached user. A real rejection (UNAUTHENTICATED) was already
  // handled by the Apollo error link, which cleared the stored login.
  const restoreCachedUserAfterOutage = async (error: unknown) => {
    if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') return;

    const token = await storageService.getAuthToken();
    if (!token || isSessionExpired(token)) return;

    const cachedUser = await storageService.getUser();
    if (cachedUser) setUser(cachedUser);
  };

  const signIn = async (credentials: AuthCredentials) => {
    try {
      setIsLoading(true);
      const response = await apiService.login(credentials);
      setUser(response.user);
      await storageService.setUser(response.user);
    } catch (error) {
      logUnexpected('Sign in', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (credentials: AuthCredentials & { name: string }) => {
    try {
      setIsLoading(true);
      const response = await apiService.register(credentials);
      setUser(response.user);
      await storageService.setUser(response.user);
    } catch (error) {
      logUnexpected('Sign up', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await apiService.logout();
      setUser(null);
    } catch (error) {
      logUnexpected('Sign out', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: { name?: string; email?: string }) => {
    try {
      const tokenBefore = await storageService.getAuthToken();
      const updatedUser = await apiService.updateProfile(updates);
      // Signing out during a slow request must not bring the signed-out user back.
      if ((await storageService.getAuthToken()) !== tokenBefore) return false;
      setUser(updatedUser);
      await storageService.setUser(updatedUser);
      return true;
    } catch (error) {
      logUnexpected('Profile update', error);
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      return await apiService.changePassword(currentPassword, newPassword);
    } catch (error) {
      logUnexpected('Password change', error);
      throw error;
    }
  };

  const signOutOtherSessions = async () => {
    try {
      return await apiService.signOutOtherSessions();
    } catch (error) {
      logUnexpected('Sign out other sessions', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      if (await apiService.isAuthenticated()) {
        const userData = await apiService.getCurrentUser();
        setUser(userData);
      }
    } catch (error) {
      logUnexpected('User refresh', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    updateProfile,
    changePassword,
    signOutOtherSessions,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// setTimeout cannot wait longer than this (about 24.8 days).
const MAX_TIMER_MS = 2_147_483_647;

// While signed in, signs out when the token expires and re-checks when the app returns
// to the foreground (timers do not run reliably while the app is in the background).
function useSignOutAtExpiry(user: User | null, endExpiredSession: () => Promise<void>) {
  useEffect(() => {
    if (!user) return;

    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const signOutIfExpired = async () => {
      const token = await storageService.getAuthToken();
      if (isSessionExpired(token)) await endExpiredSession();
    };

    const scheduleExpiryCheck = async () => {
      const token = await storageService.getAuthToken();
      // The user may have changed while the token was being read.
      if (cancelled) return;
      clearTimeout(expiryTimer);
      // The callback re-checks, so a capped (early) timer never signs out a valid session.
      expiryTimer = setTimeout(signOutIfExpired, Math.min(msUntilExpiry(token), MAX_TIMER_MS));
    };

    scheduleExpiryCheck();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') signOutIfExpired();
    });

    return () => {
      cancelled = true;
      clearTimeout(expiryTimer);
      appStateSubscription.remove();
    };
  }, [user, endExpiredSession]);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
