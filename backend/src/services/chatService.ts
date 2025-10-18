import { PrismaClient, Chat } from "@prisma/client";

export class ChatService {
  constructor(private prisma: PrismaClient) {}

  async getUserChats(userId: string): Promise<Chat[]> {
    return this.prisma.chat.findMany({
      where: { userId },
    });
  }

  async getChatHistory(chatId: string, limit: number = 20, offset: number = 0) {
    const messages = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
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