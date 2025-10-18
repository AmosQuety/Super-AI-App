// src/loaders/ChatLoaders.ts
import DataLoader from 'dataloader';
import { PrismaClient, Chat } from '@prisma/client';

export class ChatLoaders {
  private chatByIdLoader: DataLoader<string, Chat | null>;
  private chatsByUserIdLoader: DataLoader<string, Chat[]>;
  private chatMessageCountLoader: DataLoader<string, number>;
  private chatLatestMessageLoader: DataLoader<string, any | null>;

  constructor(private prisma: PrismaClient) {
    this.chatByIdLoader = new DataLoader(async (chatIds: readonly string[]) => {
      const chats = await this.prisma.chat.findMany({
        where: { id: { in: chatIds as string[] } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Latest message for preview
            select: {
              id: true,
              content: true,
              role: true,
              createdAt: true,
            }
          }
        }
      });

      const chatMap = new Map(chats.map(chat => [chat.id, chat]));
      return chatIds.map(id => chatMap.get(id) || null);
    });

    this.chatsByUserIdLoader = new DataLoader(async (userIds: readonly string[]) => {
      const chats = await this.prisma.chat.findMany({
        where: { userId: { in: userIds as string[] } },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              role: true,
              createdAt: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const chatsByUserId = new Map<string, Chat[]>();
      chats.forEach(chat => {
        if (!chatsByUserId.has(chat.userId)) {
          chatsByUserId.set(chat.userId, []);
        }
        chatsByUserId.get(chat.userId)!.push(chat);
      });

      return userIds.map(userId => chatsByUserId.get(userId) || []);
    });

    this.chatMessageCountLoader = new DataLoader(async (chatIds: readonly string[]) => {
      const messageCounts = await this.prisma.message.groupBy({
        by: ['chatId'],
        where: { chatId: { in: chatIds as string[] } },
        _count: { _all: true }
      });

      const countMap = new Map(messageCounts.map(item => [item.chatId, item._count._all]));
      return chatIds.map(chatId => countMap.get(chatId) || 0);
    });

    this.chatLatestMessageLoader = new DataLoader(async (chatIds: readonly string[]) => {
      // Get the latest message for each chat
      const latestMessages = await this.prisma.message.findMany({
        where: { chatId: { in: chatIds as string[] } },
        distinct: ['chatId'],
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          role: true,
          createdAt: true,
          chatId: true,
        }
      });

      const messageMap = new Map(latestMessages.map(msg => [msg.chatId, msg]));
      return chatIds.map(chatId => messageMap.get(chatId) || null);
    });
  }

  // Public getters
  getChatByIdLoader() { return this.chatByIdLoader; }
  getChatsByUserIdLoader() { return this.chatsByUserIdLoader; }
  getChatMessageCountLoader() { return this.chatMessageCountLoader; }
  getChatLatestMessageLoader() { return this.chatLatestMessageLoader; }

  // Cache management
  clearChatCache(chatId: string) {
    this.chatByIdLoader.clear(chatId);
    this.chatMessageCountLoader.clear(chatId);
    this.chatLatestMessageLoader.clear(chatId);
  }

  clearUserChatsCache(userId: string) {
    this.chatsByUserIdLoader.clear(userId);
  }
}