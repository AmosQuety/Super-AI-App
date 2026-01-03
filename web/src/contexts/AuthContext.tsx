// src/contexts/AuthContext.tsx
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { SignInFormData, SignUpFormData } from '../types/auth';
import { LOGIN_WITH_FACE } from '../graphql/users';
import client from '../lib/apolloClient';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: { id: string; email: string; name: string } | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (data: SignInFormData) => Promise<void>;
  signUp: (data: SignUpFormData) => Promise<void>;
  signOut: () => void;
  loginWithFace: (file: File) => Promise<string>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on app start
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (storedToken && userData) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(userData));
      } catch (error) {
        // Clear corrupted data
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
      }
    }
    setIsLoading(false);
  }, []);

  const signIn = async (data: SignInFormData) => {
    try {
      setIsLoading(true);
      //  const response = await fetch('http://172.16.0.78:4001/graphql', {
      const response = await fetch('https://super-ai-backend.onrender.com/graphql', {
        // const response = await fetch('http://localhost:4001/graphql', {
       
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

       // 1. Set LocalStorage FIRST
      // Store auth data
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userData', JSON.stringify(userData));

      // 2. Update React State
      setToken(authToken);
      setUser(userData);

      // 3. Reset Apollo Client Store LAST
      await client.resetStore();

      setToken(authToken);
      setUser(userData);

      console.log('✅ Login successful, token stored:', authToken);
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (data: SignUpFormData) => {
    try {
      setIsLoading(true);
      // const response = await fetch('http://10.117.54.213:4001/graphql', {
      const response = await fetch('https://super-ai-backend.onrender.com/graphql', {
        // const response = await fetch('http://localhost:4001/graphql', {
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

      // Store auth data
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userData', JSON.stringify(userData));

      setToken(authToken);
      setUser(userData);
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    // 1. Clear LocalStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
    // 2. Clear Apollo Cache completely
    await client.clearStore();

    // 3. Update State
    setToken(null);
    setUser(null);
  };

  const loginWithFace = async (file: File): Promise<string> => {
    try {
      setIsLoading(true);
      const result = await client.mutate({
        mutation: LOGIN_WITH_FACE,
        variables: { image: file },
        context: {
          headers: {
            "apollo-require-preflight": "true",
          },
        },
      });

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const { success, token: authToken, user: userData, message } = result.data.loginWithFace;

      if (!success) {
        throw new Error(message || "Face login failed");
      }

       // 1. Set Storage
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('userData', JSON.stringify(userData));

      // 2. Set State
      setToken(authToken);
      setUser(userData);

      // 3. CRITICAL: Reset Apollo Store here too!
      await client.resetStore();

      return message || "Login successful";
    } catch (error: any) {
      console.error("Face Login Error:", error);
      throw new Error(error.message || 'Face login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    signIn,
    signUp,
    signOut,
    isLoading,
    loginWithFace,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};