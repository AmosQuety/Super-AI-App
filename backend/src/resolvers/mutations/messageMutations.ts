// src/resolvers/mutations/messageMutations.ts
import { AuthenticationError, UserInputError } from "apollo-server-express";
import { Message } from "@prisma/client";
import { AppContext } from "../types/context";
import { pubsub } from '../subscriptionResolvers'; // ADD THIS IMPORT

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

    if (chat.userId !== context.user.id) {
      throw new AuthenticationError("You can only add messages to your own chats");
    }

    // Create the message
    const newMessage = await context.prisma.message.create({ // CHANGED: store in variable
      data: {
        chatId,
        role,
        content,
      },
    });

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

      if (message.chat.userId !== context.user.id) {
        throw new AuthenticationError("You can only delete your own messages");
      }

      // Delete the message
      await context.prisma.message.delete({
        where: { id: messageId },
      });

      return true;
    } catch (error: any) {
      console.error("Error deleting message:", error);
      throw new Error(error.message || "Failed to delete message");
    }
  },
};