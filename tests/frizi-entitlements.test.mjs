import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isPubliclyBookableProfessional,
  resolveProfessionalCapabilities,
  resolveProfessionalPlan,
} from '../api/_entitlements.mjs';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const appointmentsEndpoint = readFileSync(new URL('../api/client-appointments.ts', import.meta.url), 'utf8');
const messagesEndpoint = readFileSync(new URL('../api/client-messages.ts', import.meta.url), 'utf8');
const checkoutEndpoint = readFileSync(new URL('../api/create-checkout-session.ts', import.meta.url), 'utf8');
const inviteEndpoint = readFileSync(new URL('../api/invite.ts', import.meta.url), 'utf8');
const seoContent = readFileSync(new URL('../api/_seo-content.mjs', import.meta.url), 'utf8');

test('Pro Free can be public, discoverable, and basically bookable without paid subscription', () => {
  const professional = {
    account_plan: 'pro_free',
    subscription_status: null,
    public_profile_status: 'published',
    bookable: true,
  };

  assert.equal(resolveProfessionalPlan(professional), 'pro_free');
  assert.equal(resolveProfessionalCapabilities(professional).canAppearInDiscovery, true);
  assert.equal(resolveProfessionalCapabilities(professional).canReceiveBasicBookings, true);
  assert.equal(isPubliclyBookableProfessional(professional), true);
});

test('Pro Free does not receive paid business capabilities', () => {
  const capabilities = resolveProfessionalCapabilities({ account_plan: 'pro_free' });

  assert.equal(capabilities.canMessageClients, false);
  assert.equal(capabilities.canCreatePromotions, false);
  assert.equal(capabilities.canProcessPayments, false);
});

test('active subscribers resolve to Pro Paid and keep paid capabilities', () => {
  const capabilities = resolveProfessionalCapabilities({ subscription_status: 'active' });

  assert.equal(resolveProfessionalPlan({ subscription_status: 'active' }), 'pro_paid');
  assert.equal(capabilities.canMessageClients, true);
  assert.equal(capabilities.canCreatePromotions, true);
  assert.equal(capabilities.canProcessPayments, true);
});

test('draft or non-bookable professionals do not become discoverable just because Free exists', () => {
  assert.equal(
    isPubliclyBookableProfessional({
      account_plan: 'pro_free',
      public_profile_status: 'draft',
      bookable: true,
    }),
    false,
  );
  assert.equal(
    isPubliclyBookableProfessional({
      account_plan: 'pro_free',
      public_profile_status: 'published',
      bookable: false,
    }),
    false,
  );
});

test('public discovery fails closed for professional rows without a linked profile identity', () => {
  assert.equal(
    isPubliclyBookableProfessional({
      profile_id: null,
      account_plan: 'pro_free',
      public_profile_status: 'published',
      bookable: true,
    }),
    false,
  );
  assert.match(appSource, /\.not\('profile_id', 'is', null\)/);
  assert.match(appSource, /profile_id, display_name/);
  assert.match(appointmentsEndpoint, /id, profile_id, display_name/);
  assert.match(inviteEndpoint, /id, profile_id, display_name/);
});

test('Client discovery and SEO use capability eligibility instead of active subscription filtering', () => {
  assert.match(appSource, /resolveProfessionalCapabilities\(profile\)\.canAppearInDiscovery/);
  assert.doesNotMatch(appSource, /\.in\('subscription_status', \['active', 'trialing'\]\)/);
  assert.match(seoContent, /isPubliclyBookableProfessional/);
  assert.doesNotMatch(seoContent, /\.in\('subscription_status', \['active', 'trialing'\]\)/);
});

test('Client profile omits Message for Pro Free and server-side paid gates remain enforced', () => {
  assert.match(appSource, /const canMessage = profile\.capabilities\.canMessageClients/);
  assert.match(appSource, /\{canMessage \? \(/);
  assert.match(messagesEndpoint, /canMessageClients/);
  assert.match(appointmentsEndpoint, /isPubliclyBookableProfessional\(professional\)/);
  assert.match(inviteEndpoint, /canCreatePromotions/);
  assert.match(checkoutEndpoint, /canProcessPayments/);
});

test('Pro Free booking exposes a basic appointment path without public prices', () => {
  assert.match(appSource, /basicBookingServiceFor/);
  assert.match(appSource, /capabilities\.canUseAdvancedServices[\s\S]*: \[basicBookingServiceFor/);
  assert.match(appointmentsEndpoint, /basicBookingService/);
  assert.match(appointmentsEndpoint, /isBasicBookingServiceId/);
  assert.match(appointmentsEndpoint, /service_id: service\.id\.startsWith\('basic:'\) \? null : service\.id/);
  assert.match(inviteEndpoint, /basicBookingService/);
  assert.doesNotMatch(appointmentsEndpoint, /payment_intent|PaymentIntent/);
  assert.match(appointmentsEndpoint, /paymentRequiredCents > 0/);
  assert.match(appSource, /service: String\(appointment\.service \|\| 'Appointment'\)/);
});

test('client search expands common service and specialty synonyms', () => {
  assert.match(appSource, /function expandSearchTokens/);
  assert.match(appSource, /barber: \['barbering', 'fade', 'beard', 'mens'\]/);
  assert.match(appSource, /thin: \['fine', 'fine hair'\]/);
});
