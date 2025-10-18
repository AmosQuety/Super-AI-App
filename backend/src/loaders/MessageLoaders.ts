// src/loaders/MessageLoaders.ts
import DataLoader from 'dataloader';
import { PrismaClient, Message } from '@prisma/client';

export class MessageLoaders {
  private messageByIdLoader: DataLoader<string, Message | null>;
  private messagesByChatIdLoader: DataLoader<string, Message[]>;
  private messageAuthorLoader: DataLoader<string, any | null>;

  constructor(private prisma: PrismaClient) {
    this.messageByIdLoader = new DataLoader(async (messageIds: readonly string[]) => {
      const messages = await this.prisma.message.findMany({
        where: { id: { in: messageIds as string[] } },
        include: {
          chat: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                }
              }
            }
          }
        }
      });

      const messageMap = new Map(messages.map(message => [message.id, message]));
      return messageIds.map(id => messageMap.get(id) || null);
    });

    this.messagesByChatIdLoader = new DataLoader(async (chatIds: readonly string[]) => {
      // This loader is designed for when you need all messages for multiple chats
      // Use with caution as it can return large datasets
      const messages = await this.prisma.message.findMany({
        where: { chatId: { in: chatIds as string[] } },
        orderBy: { createdAt: 'asc' },
        include: {
          chat: {
            select: {
              id: true,
              title: true,
              userId: true,
            }
          }
        }
      });

      const messagesByChatId = new Map<string, Message[]>();
      messages.forEach(message => {
        if (!messagesByChatId.has(message.chatId)) {
          messagesByChatId.set(message.chatId, []);
        }
        messagesByChatId.get(message.chatId)!.push(message);
      });

      return chatIds.map(chatId => messagesByChatId.get(chatId) || []);
    });

    this.messageAuthorLoader = new DataLoader(async (chatIds: readonly string[]) => {
      // Get chat authors for messages
      const chats = await this.prisma.chat.findMany({
        where: { id: { in: chatIds as string[] } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            }
          }
        }
      });

      const authorMap = new Map(chats.map(chat => [chat.id, chat.user]));
      return chatIds.map(chatId => authorMap.get(chatId) || null);
    });
  }

  // Public getters
  getMessageByIdLoader() { return this.messageByIdLoader; }
  getMessagesByChatIdLoader() { return this.messagesByChatIdLoader; }
  getMessageAuthorLoader() { return this.messageAuthorLoader; }

  // Cache management
  clearMessageCache(messageId: string) {
    this.messageByIdLoader.clear(messageId);
  }

  clearChatMessagesCache(chatId: string) {
    this.messagesByChatIdLoader.clear(chatId);
  }
}