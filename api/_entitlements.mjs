const paidStatuses = new Set(['active', 'trialing']);

export function resolveProfessionalPlan(input = {}) {
  if (input.account_plan === 'pro_paid') return 'pro_paid';
  if (paidStatuses.has(String(input.subscription_status || input.subscriptionStatus || ''))) return 'pro_paid';
  return 'pro_free';
}

export function resolveProfessionalCapabilities(input = {}) {
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

export function isPubliclyBookableProfessional(professional) {
  const capabilities = resolveProfessionalCapabilities(professional || {});
  const hasProfileIdentity =
    !Object.prototype.hasOwnProperty.call(professional || {}, 'profile_id') ||
    Boolean(professional.profile_id);
  return Boolean(
    professional &&
      hasProfileIdentity &&
      professional.public_profile_status === 'published' &&
      professional.bookable &&
      capabilities.canAppearInDiscovery &&
      capabilities.canReceiveBasicBookings,
  );
}
