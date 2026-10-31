import { Application, Request } from "express";

// The client address of a connection that never went through Express, such as a WebSocket upgrade,
// worked out exactly as Express does it for an HTTP request: the same `trust proxy` setting
// decides which forwarded address is believed. Going through Express's own `req.ip` means the
// two transports cannot disagree about who is calling.
export function addressFromRequest(
  app: Application,
  request: Pick<Request, "headers" | "socket"> | undefined,
): string | undefined {
  if (!request?.socket) return undefined;

  // `request` exists on every Express app but is missing from its type declarations.
  const view = Object.create((app as any).request);
  view.headers = request.headers ?? {};
  view.connection = view.socket = request.socket;
  return view.ip;
}
