import { NextFunction, Request, RequestHandler, Response } from "express";
import { forwardingHeaderForLog } from "./logging";

export const MAX_DIAGNOSTIC_LINES = 20;

// A temporary aid for choosing TRUST_PROXY_HOPS. In production the application logger only keeps
// errors, in files that are lost on the host, so this writes straight to the process output
// (which a host such as Render shows in its Logs page). It is off unless FORWARDING_DIAGNOSTIC is
// "true", prints at most MAX_DIAGNOSTIC_LINES lines per process, and holds nothing but the
// addresses a caller already sent. Each line shows the address Express chose next to the raw
// headers, so the number of proxies can be read off one line. Switch it off again afterwards.
export function createForwardingDiagnostic(
  flag: string | undefined,
  write: (line: string) => void = (line) => void process.stdout.write(line),
): RequestHandler {
  if (flag !== "true") return (_req, _res, next) => next();

  let remaining = MAX_DIAGNOSTIC_LINES;
  return (req: Request, _res: Response, next: NextFunction) => {
    if (remaining > 0) {
      remaining--;
      write(
        `${JSON.stringify({
          diagnostic: "forwarding-headers",
          expressIp: req.ip,
          peer: req.socket?.remoteAddress,
          forwardedFor: forwardingHeaderForLog(req.headers["x-forwarded-for"]),
          cfConnectingIp: forwardingHeaderForLog(req.headers["cf-connecting-ip"]),
        })}\n`,
      );
    }
    next();
  };
}
