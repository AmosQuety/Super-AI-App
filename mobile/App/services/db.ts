import * as SQLite from 'expo-sqlite';
import { Item } from '../libs/types';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('monorepo.db');
      await this.createTables();
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  // Items CRUD operations
  async getItems(): Promise<Item[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<Item>(
      'SELECT * FROM items ORDER BY created_at DESC'
    );
    return results;
  }

  async createItem(item: Omit<Item, 'id'>): Promise<Item> {
    if (!this.db) throw new Error('Database not initialized');

    const id = Math.random().toString(36).substring(7);
    const newItem: Item = { ...item, id };

    await this.db.runAsync(
      'INSERT INTO items (id, name, created_at) VALUES (?, ?, ?)',
      [newItem.id, newItem.name, newItem.createdAt]
    );

    return newItem;
  }

  async deleteItem(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync('DELETE FROM items WHERE id = ?', [id]);
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    if (!this.db) throw new Error('Database not initialized');

    const existingItem = await this.db.getFirstAsync<Item>(
      'SELECT * FROM items WHERE id = ?',
      [id]
    );

    if (!existingItem) {
      throw new Error('Item not found');
    }

    const updatedItem = { ...existingItem, ...updates };
    
    await this.db.runAsync(
      'UPDATE items SET name = ?, created_at = ? WHERE id = ?',
      [updatedItem.name, updatedItem.createdAt, id]
    );

    return updatedItem;
  }
}

export const dbService = new DatabaseService();