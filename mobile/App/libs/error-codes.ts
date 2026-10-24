// Server error codes that mean "the server explained a normal outcome" (wrong input, wrong
// password, not allowed). The screens show these to the user, so they are not logged as errors:
// console.error raises a red banner over the screen in development builds.
const EXPECTED_FAILURE_CODES = new Set(['BAD_USER_INPUT', 'UNAUTHENTICATED', 'FORBIDDEN']);

export function isExpectedFailureCode(code: unknown): boolean {
  return typeof code === 'string' && EXPECTED_FAILURE_CODES.has(code);
}
