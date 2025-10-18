import { PrismaClient, Message } from "@prisma/client";

export class MessageService {
  constructor(private prisma: PrismaClient) {}

  async addMessage(chatId: string, role: string, content: string): Promise<Message> {
    return this.prisma.message.create({
      data: { chatId, role, content },
    });
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    await this.prisma.message.delete({ where: { id: messageId } });
    return true;
  }
}