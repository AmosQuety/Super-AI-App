import { UserInputError } from "apollo-server-express";
import { AuthorizationService, AuthContext } from "./authorization";

interface ChatLookup {
  prisma: {
    chat: {
      findUnique(args: { where: { id: string }; select: { id: true; userId: true } }): Promise<{
        id: string;
        userId: string;
      } | null>;
    };
  };
}

// A chat the caller may not access is reported as "not found" so that
// chat ids belonging to other users cannot be probed.
export async function requireChatAccess(context: AuthContext & ChatLookup, chatId: string) {
  const user = AuthorizationService.requireAuth(context);

  const chat = await context.prisma.chat.findUnique({
    where: { id: chatId },
    select: { id: true, userId: true },
  });

  const isOwner = chat?.userId === user.userId;
  const isAdmin = AuthorizationService.isAdmin(user);
  if (!chat || (!isOwner && !isAdmin)) {
    throw new UserInputError("Chat not found");
  }

  return chat;
}
