import { PrismaClient, Chat } from "@prisma/client";

export class ChatService {
  constructor(private prisma: PrismaClient) {}

  async getUserChats(userId: string): Promise<Chat[]> {
    return this.prisma.chat.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      }
    }) as unknown as Promise<Chat[]>;
  }

  async getChatHistory(chatId: string, limit: number = 20, offset: number = 0) {
    const messages = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        chatId: true,
        role: true,
        content: true,
        imageUrl: true,
        fileName: true,
        fileUri: true,
        fileMimeType: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    const totalMessages = await this.prisma.message.count({
      where: { chatId },
    });

    return {
      messages: messages.slice().reverse(),
      hasMore: offset + limit < totalMessages,
    };
  }

  async createChat(userId: string, title?: string, messages?: any[]) {
    return this.prisma.chat.create({
      data: {
        userId,
        title,
        messages: messages ? { create: messages } : undefined,
      },
      include: { messages: true },
    });
  }

  async updateChatTitle(chatId: string, title: string, userId: string) {
    await this.verifyChatOwnership(chatId, userId);
    
    return this.prisma.chat.update({
      where: { id: chatId },
      data: { title },
    });
  }

  async deleteChat(chatId: string, userId: string) {
    await this.verifyChatOwnership(chatId, userId);

    await this.prisma.message.deleteMany({ where: { chatId } });
    await this.prisma.chat.delete({ where: { id: chatId } });

    return true;
  }

  private async verifyChatOwnership(chatId: string, userId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    
    if (!chat) throw new Error("Chat not found");
    if (chat.userId !== userId) throw new Error("You can only update your own chats");
    
    return chat;
  }
}