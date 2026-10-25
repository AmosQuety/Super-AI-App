// src/resolvers/mutations/chatMutations.ts
import { AuthenticationError, ForbiddenError, UserInputError } from "apollo-server-express";
import { Chat } from "@prisma/client";
import { AppContext } from "../types/context";
import { invalidateChatHistory, invalidateChatList } from "../../services/chatCache";

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

    if (args.userId !== context.user.userId) {
      throw new ForbiddenError("You can only create chats for your own account.");
    }

    // Check if user exists first (We can skip this if we trust the Token, but safer to keep)
    const userExists = await context.prisma.user.findUnique({
      where: { id: args.userId },
    });

    if (!userExists) {
      throw new UserInputError("User not found. Please sign up first.");
    }

    const chat = await context.prisma.chat.create({
      data: {
        userId: context.user.userId, // Always use the authenticated session ID, never args
        title: args.title,
        messages: {
          create: args.messages,
        },
      },
      include: {
        messages: true,
      },
    });
    await invalidateChatList(context.user.userId);
    return chat;
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

    // Not UNAUTHENTICATED: clients sign the user out on that code, and the session is fine.
    // Reported as "not found" so other users' chat ids cannot be probed.
    if (chat.userId !== context.user.userId) {
      throw new UserInputError("Chat not found");
    }

    const updated = await context.prisma.chat.update({
      where: { id: chatId },
      data: { title },
    });
    await invalidateChatList(context.user.userId);
    return updated;
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

    if (chat.userId !== context.user.userId) {
      throw new UserInputError("Chat not found");
    }

    // Delete all messages first (if not using cascade delete)
    await context.prisma.message.deleteMany({
      where: { chatId },
    });

    // Delete the chat
    await context.prisma.chat.delete({
      where: { id: chatId },
    });
    await Promise.all([
      invalidateChatList(context.user.userId),
      invalidateChatHistory(context.user.userId, chatId),
    ]);

    return true;
  },
};