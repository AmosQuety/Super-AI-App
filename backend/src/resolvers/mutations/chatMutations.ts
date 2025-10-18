// src/resolvers/mutations/chatMutations.ts
import { AuthenticationError, UserInputError } from "apollo-server-express";
import { Chat } from "@prisma/client";
import { AppContext } from "../types/context";

export const chatMutations = {
  createChat: async (
    _: any,
    args: {
      userId: string;
      title?: string;
      messages: { role: string; content: string }[];
    },
    context: AppContext
  ): Promise<Chat> => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to create a chat");
    }

    // Check if user exists first
    const userExists = await context.prisma.user.findUnique({
      where: { id: args.userId },
    });

    if (!userExists) {
      throw new UserInputError("User not found. Please sign up first.");
    }

    return context.prisma.chat.create({
      data: {
        userId: args.userId,
        title: args.title,
        messages: {
          create: args.messages,
        },
      },
      include: {
        messages: true,
      },
    });
  },

  updateChat: async (
    _: any,
    { chatId, title }: { chatId: string; title: string },
    context: AppContext
  ): Promise<Chat> => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to update a chat");
    }

    // Verify the chat exists and belongs to the user
    const chat = await context.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new UserInputError("Chat not found");
    }

    if (chat.userId !== context.user.id) {
      throw new AuthenticationError("You can only update your own chats");
    }

    return context.prisma.chat.update({
      where: { id: chatId },
      data: { title },
    });
  },

  deleteChat: async (
    _: any,
    { chatId }: { chatId: string },
    context: AppContext
  ): Promise<boolean> => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to delete a chat");
    }

    // Verify the chat exists and belongs to the user
    const chat = await context.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new UserInputError("Chat not found");
    }

    if (chat.userId !== context.user.id) {
      throw new AuthenticationError("You can only delete your own chats");
    }

    // Delete all messages first (if not using cascade delete)
    await context.prisma.message.deleteMany({
      where: { chatId },
    });

    // Delete the chat
    await context.prisma.chat.delete({
      where: { id: chatId },
    });

    return true;
  },
};