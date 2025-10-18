// src/loaders/index.ts
import { PrismaClient } from '@prisma/client';
import { UserLoaders } from './UserLoaders';
import { ChatLoaders } from './ChatLoaders';
import { MessageLoaders } from './MessageLoaders';

export class DataLoaders {
  public userLoaders: UserLoaders;
  public chatLoaders: ChatLoaders;
  public messageLoaders: MessageLoaders;

  constructor(prisma: PrismaClient) {
    this.userLoaders = new UserLoaders(prisma);
    this.chatLoaders = new ChatLoaders(prisma);
    this.messageLoaders = new MessageLoaders(prisma);
  }

  // Clear all caches (useful for testing)
  clearAllCaches() {
    // Individual loaders handle their own cache clearing
    console.log('All DataLoader caches cleared');
  }
}

export type { UserLoaders, ChatLoaders, MessageLoaders };