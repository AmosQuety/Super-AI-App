// services/api.ts
import { isExpectedFailureCode } from '../libs/error-codes';
import axios from 'axios';
import type { DocumentNode } from 'graphql';
import type { OperationVariables } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { Config } from '../libs/config';
import { AuthCredentials, AuthResponse, Chat, User } from '../libs/types';
import { storageService } from './storage';
import { apolloClient } from '../libs/apollo-client';
import {
  GET_CHATS,
  CREATE_CHAT,
  LOGIN_MUTATION,
  REGISTER_MUTATION,
  ME_QUERY,
  UPDATE_PROFILE_MUTATION,
  CHANGE_PASSWORD_MUTATION,
  FACE_SERVICE_STATUS,
  LOGIN_WITH_FACE,
} from './graphql/operations';

interface ChangePasswordResult {
  success: boolean;
  message: string;
  // A password change ends every earlier session; this one keeps this device signed in.
  token?: string | null;
}

interface FaceServiceStatus {
  isOnline: boolean;
  registeredFacesCount: number;
  message: string;
}

interface FaceLoginResult {
  success: boolean;
  token?: string | null;
  user?: User | null;
  message: string;
}

// Mirrors the backend MessageInput type.
interface MessageInput {
  role: string;
  content: string;
  imageUrl?: string;
  fileName?: string;
  fileUri?: string;
  fileMimeType?: string;
}

function operationNameOf(operation: DocumentNode): string {
  const definition = operation.definitions[0];
  return definition?.kind === 'OperationDefinition' && definition.name
    ? definition.name.value
    : 'AnonymousOperation';
}

// An error with a message a user can act on, plus the server's error code when there is one,
// so callers can tell a rejected session (UNAUTHENTICATED) from an outage.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Apollo cancels in-flight queries when a rejected session clears the cache.
const STORE_RESET_MESSAGE = /store reset while query was in flight/i;

// Turns an Apollo error into a message a user can act on.
function toUserFacingError(error: unknown): ApiError {
  if (CombinedGraphQLErrors.is(error)) {
    const first = error.errors[0];
    return new ApiError(
      first?.message || 'GraphQL request failed',
      first?.extensions?.code as string
    );
  }
  if (error instanceof Error && STORE_RESET_MESSAGE.test(error.message)) {
    return new ApiError('Your session has ended. Please sign in again.', 'UNAUTHENTICATED');
  }
  return new ApiError('Network error: Unable to connect to server. Please check your connection.');
}

// Logs the operation name and outcome only: variables and results can hold passwords and tokens.
function logOperationFailure(operationName: string, error: unknown) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`GraphQL ${operationName} failed: ${reason}`);
}

function requireApolloClient() {
  if (!apolloClient) {
    throw new Error('GraphQL client is not available');
  }
  return apolloClient;
}

class ApiService {
  private client;

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

  private async executeQuery<T>(query: DocumentNode, variables?: OperationVariables): Promise<T> {
    const operationName = operationNameOf(query);
    try {
      const result = await requireApolloClient().query<T>({
        query,
        variables,
        fetchPolicy: 'network-only',
      });
      // The client's errorPolicy is 'all', so errors arrive on the result instead of being thrown.
      if (result.error) throw result.error;
      if (!result.data) throw new Error('No data returned from query');
      return result.data as T;
    } catch (error) {
      const apiError = toUserFacingError(error);
      // A failure the server explained reaches the user through the caller; only the rest
      // (network, unexpected codes) is logged as an error.
      if (!isExpectedFailureCode(apiError.code)) logOperationFailure(operationName, error);
      throw apiError;
    }
  }

  private async executeMutation<T>(
    mutation: DocumentNode,
    variables?: OperationVariables
  ): Promise<T> {
    const operationName = operationNameOf(mutation);
    try {
      const result = await requireApolloClient().mutate<T>({ mutation, variables });
      if (result.error) throw result.error;
      if (!result.data) throw new Error('No data returned from mutation');
      return result.data as T;
    } catch (error) {
      const apiError = toUserFacingError(error);
      // A failure the server explained reaches the user through the caller; only the rest
      // (network, unexpected codes) is logged as an error.
      if (!isExpectedFailureCode(apiError.code)) logOperationFailure(operationName, error);
      throw apiError;
    }
  }

  // Auth Methods
  async login(credentials: AuthCredentials): Promise<AuthResponse> {
    const data = await this.executeMutation<{ login: AuthResponse }>(LOGIN_MUTATION, {
      ...credentials,
    });
    if (!data.login) {
      throw new Error('Invalid login response structure');
    }

    await storageService.setAuthToken(data.login.token);
    return { user: data.login.user, token: data.login.token };
  }

  async register(credentials: AuthCredentials & { name: string }): Promise<AuthResponse> {
    const data = await this.executeMutation<{ register: AuthResponse }>(REGISTER_MUTATION, {
      ...credentials,
    });
    if (!data.register) {
      throw new Error('Invalid registration response structure');
    }

    await storageService.setAuthToken(data.register.token);
    return { user: data.register.user, token: data.register.token };
  }

  async getCurrentUser(): Promise<User> {
    const data = await this.executeQuery<{ me: User }>(ME_QUERY);
    if (!data.me) {
      throw new Error('Invalid user data response');
    }
    return data.me;
  }

  async updateProfile(updates: { name?: string; email?: string }): Promise<User> {
    const data = await this.executeMutation<{ updateProfile: User }>(
      UPDATE_PROFILE_MUTATION,
      updates
    );
    if (!data.updateProfile) {
      throw new Error('Invalid profile update response');
    }
    return data.updateProfile;
  }

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResult> {
    const data = await this.executeMutation<{ changePassword: ChangePasswordResult }>(
      CHANGE_PASSWORD_MUTATION,
      { currentPassword, newPassword }
    );
    if (!data.changePassword) {
      throw new Error('Invalid password change response');
    }
    // The token in use was just revoked by the server, so swap in the fresh one before
    // anything else makes a request.
    if (data.changePassword.success && data.changePassword.token) {
      try {
        await storageService.setAuthToken(data.changePassword.token);
      } catch (error) {
        // The password did change, so this is not a failed change. The old token is dead, so the
        // next request sends the user to Sign In, where the new password works.
        console.warn('Could not store the new session after a password change:', error);
      }
    }
    return data.changePassword;
  }

  // Chat Operations
  async getUserChats(userId: string): Promise<Chat[]> {
    const data = await this.executeQuery<{ chats: Chat[] }>(GET_CHATS, { userId });
    return data.chats ?? [];
  }

  async createChat(userId: string, title?: string, messages: MessageInput[] = []): Promise<Chat> {
    const data = await this.executeMutation<{ createChat: Chat }>(CREATE_CHAT, {
      userId,
      title,
      messages,
    });
    if (!data.createChat) {
      throw new Error('Invalid create chat response');
    }
    return data.createChat;
  }

  // Face Recognition
  async checkFaceServiceStatus(): Promise<FaceServiceStatus> {
    try {
      const data = await this.executeQuery<{ faceServiceStatus: FaceServiceStatus }>(
        FACE_SERVICE_STATUS
      );
      return (
        data.faceServiceStatus ?? {
          isOnline: false,
          registeredFacesCount: 0,
          message: 'Service unavailable',
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Service unavailable';
      return { isOnline: false, registeredFacesCount: 0, message };
    }
  }

  async loginWithFace(image: unknown): Promise<FaceLoginResult> {
    const data = await this.executeMutation<{ loginWithFace: FaceLoginResult }>(LOGIN_WITH_FACE, {
      image,
    });
    if (!data.loginWithFace) {
      throw new Error('Invalid face login response');
    }

    if (data.loginWithFace.token) {
      await storageService.setAuthToken(data.loginWithFace.token);
    }
    return data.loginWithFace;
  }

  // Utility Methods
  // Clears the stored login and the Apollo cache so the next user on this device sees none of it.
  async logout(): Promise<void> {
    await storageService.clearAuth();
    await apolloClient?.clearStore();
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await storageService.getAuthToken();
    return !!token;
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch {
      throw new Error('Service unavailable');
    }
  }
}

export const apiService = new ApiService();
