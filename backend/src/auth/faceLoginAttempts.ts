import { networkOf } from "./networkAddress";
import { refundAttempt, reserveAttempt } from "./passwordAttempts";

// Face sign-in compares a stranger's photo against everyone enrolled, so there is no email to
// limit by; it is limited per network address instead. The ceiling is looser than for passwords
// because a photo fails for ordinary reasons (light, angle). Behind a proxy that is not trusted
// every user shares the proxy's address and therefore one count, so this must be paired with a
// correct "trust proxy" setting before the limit is fair to individual users.
export const MAX_FACE_LOGIN_ATTEMPTS = 10;

const faceKey = (address: string | undefined) => `face:${networkOf(address)}`;

export type FaceLoginReservation =
  | { allowed: true; reachedLimit: boolean }
  | { allowed: false; retryAfterMs: number };

export function reserveFaceLogin(address: string | undefined): FaceLoginReservation {
  const turn = reserveAttempt(faceKey(address), Date.now(), MAX_FACE_LOGIN_ATTEMPTS);
  return turn.allowed
    ? { allowed: true, reachedLimit: turn.isLastAllowed }
    : { allowed: false, retryAfterMs: turn.retryAfterMs };
}

// The service being down is not a guess at anyone's face.
export function releaseFaceLogin(address: string | undefined): void {
  refundAttempt(faceKey(address));
}

// Gives back only the attempt that succeeded. Clearing the whole count would let anyone with an
// enrolled face of their own alternate a genuine login with guesses at other people's faces and
// never reach the limit.
export function markFaceLoginSucceeded(address: string | undefined): void {
  refundAttempt(faceKey(address));
}
