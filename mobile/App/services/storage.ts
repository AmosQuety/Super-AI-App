import * as SecureStore from 'expo-secure-store';
import { Config } from '../libs/config';

class StorageService {
  // Add these user storage methods:
  async setUser(user: any): Promise<void> {
    try {
      await this.setItem(Config.STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  }

  async getUser(): Promise<any | null> {
    try {
      const user = await this.getItem(Config.STORAGE_KEYS.USER_DATA);
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Failed to get user:', error);
      return null;
    }
  }

  async clearUser(): Promise<void> {
    try {
      await this.removeItem(Config.STORAGE_KEYS.USER_DATA);
    } catch (error) {
      console.error('Failed to clear user:', error);
    }
  }

  
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Failed to get item:', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  }

  // Auth-specific methods
  async setAuthToken(token: string): Promise<void> {
    await this.setItem(Config.STORAGE_KEYS.AUTH_TOKEN, token);
  }

  async getAuthToken(): Promise<string | null> {
    return await this.getItem(Config.STORAGE_KEYS.AUTH_TOKEN);
  }

  async clearAuth(): Promise<void> {
    await this.removeItem(Config.STORAGE_KEYS.AUTH_TOKEN);
    await this.removeItem(Config.STORAGE_KEYS.USER_DATA);
  }
}

export const storageService = new StorageService();