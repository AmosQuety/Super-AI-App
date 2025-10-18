
// types/user.ts
export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  avatarUrl?: string;
  lastLoginAt?: string;
  isActive: boolean;
  hasFaceRegistered?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  name: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// types/chat.ts
export interface Message {
  id: string;
  role: string;
  content: string;
  imageUrl?: string;
  fileName?: string;
  fileUri?: string;
  fileMimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  title?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface MessagesPayload {
  messages: Message[];
  hasMore: boolean;
}

export interface SendMessageResponse {
  userMessage: Message;
  aiMessage: Message;
  usedCustomResponse: boolean;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Require<T, K extends keyof T> = T & Required<Pick<T, K>>;