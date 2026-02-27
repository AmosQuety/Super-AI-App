/**
 * Identifies the tenant and end-user associated with a completion request.
 *
 * Propagated through {@link CompletionOptions.tenantContext} so that the
 * {@link AdaptiveRouter}, {@link PolicyEngine}, and {@link CostGuard} can
 * all enforce per-tenant policies, quotas, and cost limits in a coordinated way.
 */
export interface TenantContext {
  /**
   * Unique identifier for the tenant (e.g. organisation ID, customer ID).
   * Used as the primary key for budget ledger and policy lookup.
   */
  readonly tenantId: string;

  /**
   * Optional identifier for the end-user within the tenant.
   * Available for user-level audit logging and future per-user quotas.
   */
  readonly userId?: string;

  /**
   * Service tier for this tenant.
   * Used by the {@link PolicyEngine} for tier-based routing rules.
   *
   * @default 'free'
   */
  readonly tier?: 'free' | 'pro' | 'enterprise';
}
