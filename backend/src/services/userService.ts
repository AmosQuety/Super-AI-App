import { PrismaClient, User } from "@prisma/client";
import { hash } from "bcryptjs";

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async createUser(email: string, password: string, name?: string): Promise<User> {
    const hashedPassword = await hash(password, 12);
    
    return this.prisma.user.create({
      data: { 
        email, 
        name,
        password: hashedPassword 
      },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }
}