import { logger } from "../utils/logger";

// A subscription is authenticated once, when it starts. To honour "changing the password ends
// every other session" the open WebSocket connections of a user are remembered here and closed
// when the password changes; clients reconnect with their (new) stored token.
//
// In memory, so it covers only this server process. With several instances behind a load
// balancer, the close request would have to be shared between them (for example over Redis).

interface ClosableSocket {
  close(code?: number, reason?: string): void;
  once(event: "close", listener: () => void): unknown;
}

// graphql-ws reserves the 4xxx range for applications; 4401 is its "unauthorized" convention.
export const SESSION_ENDED_CLOSE_CODE = 4401;

const socketsByUser = new Map<string, Set<ClosableSocket>>();

export function trackUserSocket(userId: string, socket: ClosableSocket): void {
  let sockets = socketsByUser.get(userId);
  if (!sockets) {
    sockets = new Set();
    socketsByUser.set(userId, sockets);
  }
  if (sockets.has(socket)) return;

  sockets.add(socket);
  socket.once("close", () => forget(userId, socket));
}

export function closeUserSockets(userId: string): void {
  const sockets = socketsByUser.get(userId);
  if (!sockets) return;
  socketsByUser.delete(userId);

  for (const socket of sockets) {
    try {
      socket.close(SESSION_ENDED_CLOSE_CODE, "Session ended");
    } catch (error: any) {
      // One broken socket must not leave the others of the same user open.
      logger.warn("[ws] could not close a socket of a user whose session ended", { message: error.message });
    }
  }
}

export function trackedSocketCount(): number {
  let count = 0;
  for (const sockets of socketsByUser.values()) count += sockets.size;
  return count;
}

function forget(userId: string, socket: ClosableSocket): void {
  const sockets = socketsByUser.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) socketsByUser.delete(userId);
}
