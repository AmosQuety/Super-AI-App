/**
 * Thrown by {@link IntelligentRouter} when no provider survives the
 * elimination and scoring pass for a given request.
 */
export class RouterError extends Error {
  /**
   * Total number of candidate providers that were evaluated before
   * all were eliminated.
   */
  readonly candidatesEvaluated: number;

  constructor(reason: string, candidatesEvaluated: number) {
    super(`Router could not select a provider: ${reason}`);
    this.name = 'RouterError';
    this.candidatesEvaluated = candidatesEvaluated;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
