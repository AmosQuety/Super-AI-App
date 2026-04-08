/* eslint-disable react-refresh/only-export-components */

import { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { SignInFormData, SignUpFormData } from '../types/auth';
import { LOGIN_WITH_FACE, LOGIN_WITH_VOICE } from '../graphql/users';
import client from '../lib/apolloClient';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (data: SignInFormData) => Promise<void>;
  signUp: (data: SignUpFormData) => Promise<void>;
  signOut: () => Promise<void>;
  loginWithFace: (file: File) => Promise<string>;
  loginWithVoice: (email: string, challengeCode: string, audio: File) => Promise<string>;
}

interface LoginWithFaceResult {
  loginWithFace: {
    success: boolean;
    token: string;
    user: User;
    message?: string;
  };
}

interface LoginWithVoiceResult {
  loginWithVoice: {
    token: string;
    user: User;
  };
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4001/graphql';
  const aiEngineUrl = import.meta.env.VITE_AI_ENGINE_URL;

  const wakeUpAIEngine = () => {
    if (!aiEngineUrl) return;

    console.log('🚀 Pinging AI Engine for wake-up...');
    fetch(aiEngineUrl, { mode: 'no-cors' }).catch(() => {}); // Fire and forget
  };

  // Check for existing session on app start
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');

    if (storedToken && userData) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(userData) as User);
        // Wake up engine if we have a session
        wakeUpAIEngine();
      } catch (error) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        console.log("somethng went wrong parsing user data from storage", error);
      }
    }

    setIsLoading(false);
  }, []);

  const signIn = async (data: SignInFormData) => {
    try {
      setIsLoading(true);

      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation Login($email: String!, $password: String!) {
              login(email: $email, password: $password) {
                user {
                  id
                  email
                  name
                }
                token
              }
            }
          `,
          variables: data,
        }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const { user: userData, token: authToken } = result.data.login;

      // 1. Store auth data FIRST
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userData', JSON.stringify(userData));

      // 2. Update state
      setToken(authToken);
      setUser(userData);

      // 3. Wake up AI Engine
      wakeUpAIEngine();

      // 4. Reset Apollo cache LAST
      await client.resetStore();

      console.log('Token starts with:', authToken.substring(0, 5) + '...');
      
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message || 'Login failed');
      }
      throw new Error('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (data: SignUpFormData) => {
    try {
      setIsLoading(true);

      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation Register($email: String!, $password: String!, $name: String) {
              register(email: $email, password: $password, name: $name) {
                user {
                  id
                  email
                  name
                }
                token
              }
            }
          `,
          variables: data,
        }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const { user: userData, token: authToken } = result.data.register;

      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userData', JSON.stringify(userData));

      setToken(authToken);
      setUser(userData);
      
      // 3. Wake up AI Engine
      wakeUpAIEngine();
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new Error(error.message || 'Registration failed');
      }
      throw new Error('Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');

    await client.clearStore();

    setToken(null);
    setUser(null);
  };

  const loginWithFace = async (file: File): Promise<string> => {
    try {
      setIsLoading(true);

      const result = await client.mutate<LoginWithFaceResult>({
        mutation: LOGIN_WITH_FACE,
        variables: { image: file },
        context: {
          headers: {
            'apollo-require-preflight': 'true',
          },
        },
      });

      const { success, token: authToken, user: userData, message } =
        result.data!.loginWithFace;

      if (!success) {
        throw new Error(message || 'Face login failed');
      }

      // 1. Store auth data
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userData', JSON.stringify(userData));

      // 2. Update state
      setToken(authToken);
      setUser(userData);

      // 3. Reset Apollo cache
      await client.resetStore();

      return message || 'Login successful';
    } catch (error: unknown) {
      console.error('Face Login Error:', error);
      if (error instanceof Error) {
        throw new Error(error.message || 'Face login failed');
      }
      throw new Error('Face login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithVoice = async (email: string, challengeCode: string, audio: File): Promise<string> => {
    try {
      setIsLoading(true);

      const result = await client.mutate<LoginWithVoiceResult>({
        mutation: LOGIN_WITH_VOICE,
        variables: { email, challengeCode, audio },
        context: {
          headers: {
            'apollo-require-preflight': 'true',
          },
        },
      });

      const { token: authToken, user: userData } = result.data!.loginWithVoice;

      // 1. Store auth data
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userData', JSON.stringify(userData));

      // 2. Update state
      setToken(authToken);
      setUser(userData);

      // 3. Reset Apollo cache
      await client.resetStore();

      return 'Voice login successful';
    } catch (error: unknown) {
      console.error('Voice Login Error:', error);
      if (error instanceof Error) {
        throw new Error(error.message || 'Voice login failed');
      }
      throw new Error('Voice login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    signIn,
    signUp,
    signOut,
    loginWithFace,
    loginWithVoice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
