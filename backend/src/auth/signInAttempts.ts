import { networkOf } from "./networkAddress";
import {
  clearFailedAttempts,
  refundAttempt,
  reserveAttempt,
} from "./passwordAttempts";

// Sign-in is limited twice, both before the password is compared:
//  - per email AND network address (5 in 15 minutes), so a stranger guessing at someone's
//    account locks only their own address, not the real owner on another one;
//  - per email across all addresses (a looser ceiling), so rotating addresses cannot give
//    unlimited guesses at one account.
// A client is a network (an IPv6 /64, or one IPv4 address), see networkOf. Behind a proxy that
// is not trusted, every request shares the proxy's address and the first limit behaves like a
// plain per-email limit, which is the safe direction.
export const MAX_ATTEMPTS_PER_EMAIL = 20;
export const MAX_EMAIL_LENGTH = 254;

const normalise = (email: string) => email.toLowerCase().trim();
const pairKey = (email: string, address: string | undefined) =>
  `login:${normalise(email)}|${networkOf(address)}`;
const ceilingKey = (email: string) => `loginEmail:${normalise(email)}`;

export type SignInReservation =
  | { allowed: true; reachedLimit: boolean }
  | { allowed: false; scope: "address" | "email"; retryAfterMs: number };

export function reserveSignIn(
  email: string,
  address: string | undefined,
): SignInReservation {
  const pair = reserveAttempt(pairKey(email, address));
  if (!pair.allowed) {
    return { allowed: false, scope: "address", retryAfterMs: pair.retryAfterMs };
  }

  const ceiling = reserveAttempt(
    ceilingKey(email),
    Date.now(),
    MAX_ATTEMPTS_PER_EMAIL,
  );
  if (!ceiling.allowed) {
    refundAttempt(pairKey(email, address));
    return { allowed: false, scope: "email", retryAfterMs: ceiling.retryAfterMs };
  }

  return { allowed: true, reachedLimit: pair.isLastAllowed || ceiling.isLastAllowed };
}

// A correct password gives this address a fresh count and returns the attempt it used from the
// ceiling, which counts failures only.
export function markSignInSucceeded(email: string, address: string | undefined): void {
  clearFailedAttempts(pairKey(email, address));
  refundAttempt(ceilingKey(email));
}
