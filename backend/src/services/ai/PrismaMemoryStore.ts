import { PrismaClient } from '@prisma/client';
import { IMemoryStore, ChatMessage } from '@super-ai/ai-orchestrator';

export class PrismaMemoryStore implements IMemoryStore {
  constructor(private readonly prisma: PrismaClient) {}

  async append(sessionId: string, message: ChatMessage): Promise<void> {
    await this.prisma.message.create({
      data: {
        chatId: sessionId,
        role: message.role === 'user' ? 'user' : 'assistant', // DB schema might rely on uppercase/lowercase, mapping standard 'user' or 'assistant'
        content: message.content,
      },
    });
  }

  async getHistory(sessionId: string, limit?: number): Promise<ChatMessage[]> {
    const messages = await this.prisma.message.findMany({
      where: { chatId: sessionId },
      orderBy: { createdAt: 'asc' },
      ...(limit !== undefined ? { take: -limit } : {}), // Negative take fetches from the end
    });

    return messages.map((m) => ({
      id: m.id,
      role: m.role.toLowerCase() as 'user' | 'system' | 'assistant' | 'tool',
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async clear(sessionId: string): Promise<void> {
    await this.prisma.message.deleteMany({
      where: { chatId: sessionId },
    });
  }
}
