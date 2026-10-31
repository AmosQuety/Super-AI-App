// src/resolvers/mutations/messageMutations.ts
import { ApolloError, AuthenticationError, UserInputError } from "apollo-server-express";
import { Message } from "@prisma/client";
import { AppContext } from "../types/context";
import { pubsub } from '../subscriptionResolvers'; // ADD THIS IMPORT
import { invalidateChatHistory } from "../../services/chatCache";

export const messageMutations = {
  addMessage: async (
    _: any,
    {
      chatId,
      role,
      content,
    }: { chatId: string; role: string; content: string },
    context: AppContext
  ): Promise<Message> => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to add a message");
    }

    // Verify the chat exists and belongs to the user
    const chat = await context.prisma.chat.findUnique({
      where: { id: chatId },
    });

    if (!chat) {
      throw new UserInputError("Chat not found");
    }

    // Not UNAUTHENTICATED: clients sign the user out on that code, and the session is fine.
    if (chat.userId !== context.user.userId) {
      throw new UserInputError("Chat not found");
    }

    // Create the message
    const newMessage = await context.prisma.message.create({ // CHANGED: store in variable
      data: {
        chatId,
        role,
        content,
      },
    });

    await invalidateChatHistory(context.user.userId, chatId);

    // ADD THIS: PUBLISH TO SUBSCRIPTION
    await pubsub.publish('MESSAGE_ADDED', {
      messageAdded: {
        ...newMessage,
        chatId: chatId, // Include chatId for filtering
      },
    });

    return newMessage; // CHANGED: return the stored variable
  },

  deleteMessage: async (
    _: any,
    { messageId }: { messageId: string },
    context: AppContext
  ): Promise<boolean> => {
    if (!context.user) {
      throw new AuthenticationError("You must be logged in to delete a message");
    }

    try {
      // First, verify the message exists and belongs to the user
      const message = await context.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          chat: true,
        },
      });

      if (!message) {
        throw new UserInputError("Message not found");
      }

      if (message.chat.userId !== context.user.userId) {
        throw new UserInputError("Message not found");
      }

      // Delete the message
      await context.prisma.message.delete({
        where: { id: messageId },
      });
      await invalidateChatHistory(context.user.userId, message.chatId);

      return true;
    } catch (error: any) {
      // Errors that already carry a code (not found, not allowed) must reach the client as they are.
      if (error instanceof ApolloError) throw error;
      console.error("Error deleting message:", error);
      throw new Error(error.message || "Failed to delete message");
    }
  },
};