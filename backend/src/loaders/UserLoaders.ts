// src/loaders/UserLoaders.ts - UPDATED WITH updatedAt
import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  avatarUrl?: string | null;
  lastLoginAt?: Date | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date; // ✅ NOW INCLUDED
};

export class UserLoaders {
  private userByIdLoader: DataLoader<string, SafeUser | null>;

  constructor(private prisma: PrismaClient) {
    this.userByIdLoader = new DataLoader(async (userIds: readonly string[]) => {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds as string[] } },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          lastLoginAt: true,
          isActive: true,
          createdAt: true,
          updatedAt: true, // ✅ NOW INCLUDED
        }
      });

      const userMap = new Map(users.map(user => [user.id, user]));
      return userIds.map(id => userMap.get(id) || null);
    });
  }

  getUserByIdLoader() { return this.userByIdLoader; }
}