// services/api.ts
import axios from 'axios';
import { Config } from '../libs/config';
import { ApiResponse, AuthCredentials, AuthResponse, User } from '../libs/types';
import { storageService } from './storage';
import { apolloClient } from '../libs/apollo-client';
import { 
  GET_USERS, 
  CREATE_USER, 
  GET_CHATS, 
  CREATE_CHAT,
  GENERATE_GEMINI_CONTENT,
  LOGIN_MUTATION,
  REGISTER_MUTATION,
  ME_QUERY,
  UPDATE_PROFILE_MUTATION,
  CHANGE_PASSWORD_MUTATION,
  FACE_SERVICE_STATUS,
  LOGIN_WITH_FACE
} from './graphql/operations';

class ApiService {
  private client;
  private useMock = false;

  constructor() {
    this.client = axios.create({
      baseURL: Config.API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      async (config) => {
        const token = await storageService.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  private async handleUnauthorized() {
    await storageService.clearAuth();
    console.warn('User unauthorized, redirect to login');
  }

  // GraphQL Operations with better error handling
  private async executeGraphQL(operation: any, variables?: any, isMutation = false) {
    if (!apolloClient) {
      throw new Error('GraphQL client is not available');
    }

    console.log('Executing GraphQL operation:', {
      operationName: operation.definitions[0]?.name?.value,
      variables,
      isMutation
    });

    try {
      if (isMutation) {
        const result = await apolloClient.mutate({
          mutation: operation,
          variables,
        });
        
        console.log('Mutation result:', result);
        
        if (!result.data) {
          throw new Error('No data returned from mutation');
        }
        
        return result.data;
      } else {
        const result = await apolloClient.query({
          query: operation,
          variables,
          fetchPolicy: 'network-only',
        });
        
        console.log('Query result:', result);
        
        if (!result.data) {
          throw new Error('No data returned from query');
        }
        
        return result.data;
      }
    } catch (error: any) {
      console.error('GraphQL operation failed:', {
        operationName: operation.definitions[0]?.name?.value,
        error: error.message,
        graphQLErrors: error.graphQLErrors,
        networkError: error.networkError,
      });
      
      // Provide more specific error messages
      if (error.networkError) {
        throw new Error(`Network error: Unable to connect to server. Please check your connection.`);
      }
      
      if (error.graphQLErrors && error.graphQLErrors.length > 0) {
        const firstError = error.graphQLErrors[0];
        throw new Error(firstError.message || 'GraphQL query failed');
      }
      
      throw error;
    }
  }

  // Auth Methods with better error handling
  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      const data = await this.executeGraphQL(LOGIN_MUTATION, credentials, true);
      
      if (!data?.login) {
        throw new Error('Invalid login response structure');
      }
      
      if (data.login.token) {
        await storageService.setAuthToken(data.login.token);
      }
      
      return {
        user: data.login.user,
        token: data.login.token,
      };
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.message || 'Login failed. Please check your credentials.');
    }
  }

  async register(credentials: AuthCredentials & { name: string }): Promise<AuthResponse> {
    try {
      const data = await this.executeGraphQL(REGISTER_MUTATION, credentials, true);
      
      if (!data?.register) {
        throw new Error('Invalid registration response structure');
      }
      
      if (data.register.token) {
        await storageService.setAuthToken(data.register.token);
      }
      
      return {
        user: data.register.user,
        token: data.register.token,
      };
    } catch (error: any) {
      console.error('Registration failed:', error);
      throw new Error(error.message || 'Registration failed. Please try again.');
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const data = await this.executeGraphQL(ME_QUERY);
      
      if (!data?.me) {
        throw new Error('Invalid user data response');
      }
      
      return data.me;
    } catch (error: any) {
      console.error('Get current user failed:', error);
      throw new Error(error.message || 'Failed to fetch user data');
    }
  }

  async updateProfile(updates: { name?: string; email?: string }): Promise<User> {
    try {
      const data = await this.executeGraphQL(UPDATE_PROFILE_MUTATION, updates, true);
      
      if (!data?.updateProfile) {
        throw new Error('Invalid profile update response');
      }
      
      return data.updateProfile;
    } catch (error: any) {
      console.error('Profile update failed:', error);
      throw new Error(error.message || 'Failed to update profile');
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = await this.executeGraphQL(
        CHANGE_PASSWORD_MUTATION, 
        { currentPassword, newPassword }, 
        true
      );
      
      if (!data?.changePassword) {
        throw new Error('Invalid password change response');
      }
      
      return data.changePassword;
    } catch (error: any) {
      console.error('Password change failed:', error);
      throw new Error(error.message || 'Failed to change password');
    }
  }

  // User Management
  async getUsers() {
    try {
      const data = await this.executeGraphQL(GET_USERS);
      return data?.users || [];
    } catch (error: any) {
      console.error('Get users failed:', error);
      throw new Error(error.message || 'Failed to fetch users');
    }
  }

  async createUser(email: string, name?: string) {
    try {
      const data = await this.executeGraphQL(CREATE_USER, { email, name }, true);
      
      if (!data?.createUser) {
        throw new Error('Invalid create user response');
      }
      
      return data.createUser;
    } catch (error: any) {
      console.error('Create user failed:', error);
      throw new Error(error.message || 'Failed to create user');
    }
  }

  // Chat Operations
  async getUserChats(userId: string) {
    try {
      const data = await this.executeGraphQL(GET_CHATS, { userId });
      return data?.chats || [];
    } catch (error: any) {
      console.error('Get chats failed:', error);
      throw new Error(error.message || 'Failed to fetch chats');
    }
  }

  async createChat(userId: string, title?: string, messages: any[] = []) {
    try {
      const data = await this.executeGraphQL(CREATE_CHAT, { userId, title, messages }, true);
      
      if (!data?.createChat) {
        throw new Error('Invalid create chat response');
      }
      
      return data.createChat;
    } catch (error: any) {
      console.error('Create chat failed:', error);
      throw new Error(error.message || 'Failed to create chat');
    }
  }

  // AI Operations
  async generateGeminiContent(prompt: string) {
    try {
      const data = await this.executeGraphQL(GENERATE_GEMINI_CONTENT, { prompt }, true);
      
      if (!data?.generateGeminiContent) {
        throw new Error('Invalid AI response');
      }
      
      return data.generateGeminiContent;
    } catch (error: any) {
      console.error('Generate content failed:', error);
      throw new Error(error.message || 'Failed to generate content');
    }
  }

  // Add to your ApiService class

// Chat Operations
async getChatHistory(chatId: string, limit?: number, offset?: number) {
  try {
    const data = await this.executeGraphQL(CHAT_HISTORY, { chatId, limit, offset });
    return data?.chatHistory || { messages: [], hasMore: false };
  } catch (error: any) {
    console.error('Get chat history failed:', error);
    throw new Error(error.message || 'Failed to fetch chat history');
  }
}

async sendMessageWithResponse(
  chatId: string, 
  content: string, 
  imageUrl?: string,
  fileName?: string,
  fileUri?: string,
  fileMimeType?: string
) {
  try {
    const data = await this.executeGraphQL(
      SEND_MESSAGE_WITH_RESPONSE, 
      { chatId, content, imageUrl, fileName, fileUri, fileMimeType }, 
      true
    );
    
    if (!data?.sendMessageWithResponse) {
      throw new Error('Invalid send message response');
    }
    
    return data.sendMessageWithResponse;
  } catch (error: any) {
    console.error('Send message failed:', error);
    throw new Error(error.message || 'Failed to send message');
  }
}

// Face Recognition
async registerFace(image: any) {
  // 
}


async removeFace() {
  try {
    const data = await this.executeGraphQL(REMOVE_FACE, {}, true);
    
    if (!data?.removeFace) {
      throw new Error('Invalid remove face response');
    }
    
    return data.removeFace;
  } catch (error: any) {
    console.error('Remove face failed:', error);
    throw new Error(error.message || 'Failed to remove face');
  }
}

  // Face Recognition
  async checkFaceServiceStatus() {
    try {
      const data = await this.executeGraphQL(FACE_SERVICE_STATUS);
      return data?.faceServiceStatus || { isOnline: false, registeredFacesCount: 0, message: 'Service unavailable' };
    } catch (error: any) {
      console.error('Face service status check failed:', error);
      return { isOnline: false, registeredFacesCount: 0, message: error.message };
    }
  }

  async loginWithFace(image: any) {
    try {
      const data = await this.executeGraphQL(LOGIN_WITH_FACE, { image }, true);
      
      if (!data?.loginWithFace) {
        throw new Error('Invalid face login response');
      }
      
      if (data.loginWithFace.token) {
        await storageService.setAuthToken(data.loginWithFace.token);
      }
      
      return data.loginWithFace;
    } catch (error: any) {
      console.error('Face login failed:', error);
      throw new Error(error.message || 'Face login failed');
    }
  }

  // Utility Methods
  async logout(): Promise<void> {
    await storageService.clearAuth();
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await storageService.getAuthToken();
      return !!token;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw new Error('Service unavailable');
    }
  }
}

export const apiService = new ApiService();