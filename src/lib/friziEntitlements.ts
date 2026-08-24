export type ProfessionalPlan = 'pro_free' | 'pro_paid';

const paidStatuses = new Set(['active', 'trialing']);

export function resolveProfessionalPlan(input?: {
  accountPlan?: string | null;
  account_plan?: string | null;
  subscriptionStatus?: string | null;
  subscription_status?: string | null;
} | null): ProfessionalPlan {
  if (input?.accountPlan === 'pro_paid' || input?.account_plan === 'pro_paid') return 'pro_paid';
  if (paidStatuses.has(String(input?.subscriptionStatus || input?.subscription_status || ''))) return 'pro_paid';
  return 'pro_free';
}

export function resolveProfessionalCapabilities(input?: {
  accountPlan?: string | null;
  account_plan?: string | null;
  subscriptionStatus?: string | null;
  subscription_status?: string | null;
} | null) {
  const paid = resolveProfessionalPlan(input) === 'pro_paid';
  return {
    canPublishProfile: true,
    canAppearInDiscovery: true,
    canReceiveBasicBookings: true,
    canUseBasicAvailability: true,
    canManageBasicCalendar: true,
    canDisplayVerifiedReviews: true,
    canBeSavedByClients: true,
    canUseAdvancedServices: paid,
    canMessageClients: paid,
    canAccessCRM: paid,
    canAccessConnectedHairProfiles: paid,
    canCreatePromotions: paid,
    canRecommendProducts: paid,
    canProcessPayments: paid,
    canUseDeposits: paid,
    canCreateGiftCards: paid,
    canCreatePackages: paid,
    canCreateMemberships: paid,
    canUseMarketingAutomation: paid,
  };
}
