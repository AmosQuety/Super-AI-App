// src/services/DataLoaderService.ts - FIXED
import DataLoader from 'dataloader'; // Fixed import
import { PrismaClient, Chat } from '@prisma/client';

export class DataLoaderService {
  constructor(private prisma: PrismaClient) {}

  // User chats loader - batches chat queries by user ID
  userChatsLoader = new DataLoader(async (userIds: readonly string[]) => {
    const chats = await this.prisma.chat.findMany({
      where: { 
        userId: { in: userIds as string[] } 
      },
      orderBy: { createdAt: 'desc' }, // Most recent first
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Only get latest message for preview
        }
      }
    });

    // Group chats by user ID
    const chatsByUserId = chats.reduce((acc, chat) => {
      if (!acc[chat.userId]) acc[chat.userId] = [];
      acc[chat.userId].push(chat);
      return acc;
    }, {} as Record<string, Chat[]>);

    // Return in the same order as input userIds
    return userIds.map(userId => chatsByUserId[userId] || []);
  });

  // User face registration loader
  userFaceRegistrationLoader = new DataLoader(async (userIds: readonly string[]) => {
    // In a real implementation, you'd batch calls to your face recognition service
    // For now, return mock data
    return userIds.map(() => false);
  });

  // User by ID loader
  userByIdLoader = new DataLoader(async (userIds: readonly string[]) => {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds as string[] } },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        // Explicitly exclude password
      }
    });

    const usersById = users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {} as Record<string, any>);

    return userIds.map(userId => usersById[userId] || null);
  });

  // Chats by ID loader
  chatByIdLoader = new DataLoader(async (chatIds: readonly string[]) => {
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

    const chatsById = chats.reduce((acc, chat) => {
      acc[chat.id] = chat;
      return acc;
    }, {} as Record<string, any>);

    return chatIds.map(chatId => chatsById[chatId] || null);
  });
}