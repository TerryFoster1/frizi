import { createHash } from 'node:crypto';

export const platformFeeRate = Number(process.env.FRIZI_PLATFORM_FEE_RATE || '0.045');
export const instantPayoutFeeRate = Number(process.env.FRIZI_INSTANT_PAYOUT_FEE_RATE || '0.02');
export const taxRateBps = Number(process.env.FRIZI_TAX_RATE_BPS || '1300');
export const maxCustomTipCents = Number(process.env.FRIZI_MAX_CUSTOM_TIP_CENTS || '20000');
export const quoteTtlMinutes = Number(process.env.FRIZI_PRICE_QUOTE_TTL_MINUTES || '30');
export const pricingVersion = 'frizi_dynamic_pricing_v1';

const professionals = [
  { id: 'omar', name: 'Omar Rahman', salonId: 'salon_civic', salonName: 'Civic Barbering', connectedAccountId: process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID || '' },
  { id: 'mara', name: 'Mara Chen', salonId: 'salon_hairline', salonName: 'Hairline Studio', connectedAccountId: process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID || '' },
  { id: 'niko', name: 'Niko Bell', salonId: 'salon_lane', salonName: 'Lane Studio', connectedAccountId: process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID || '' },
  { id: 'talia', name: 'Talia Brooks', salonId: 'salon_softshape', salonName: 'Soft Shape Studio', connectedAccountId: process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID || '' },
  { id: 'bea', name: 'Bea Santos', salonId: 'salon_curl', salonName: 'Curl Room', connectedAccountId: process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID || '' },
  { id: 'imani', name: 'Imani Cole', salonId: 'salon_texture', salonName: 'Texture House', connectedAccountId: process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID || '' },
  { id: 'jo', name: 'Jo Lee', salonId: 'salon_lowkey', salonName: 'Low Key Hair', connectedAccountId: process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID || '' },
];

const services = [
  ['omar', 'Fade and lineup', 5200, true],
  ['omar', 'Fade, beard, and wash', 7800, true],
  ['omar', 'Private-room haircut', 6500, true],
  ['mara', 'Skin fade', 5800, true],
  ['mara', 'Fade and curl taper', 7400, true],
  ['mara', 'Private-room cut', 6800, true],
  ['niko', 'Fade and lineup', 5000, true],
  ['niko', 'Fade and beard shape', 7600, true],
  ['niko', 'Textured crop cut', 6200, true],
  ['talia', 'Soft fade', 6000, true],
  ['talia', 'Short cut reset', 8200, true],
  ['talia', 'Consult and cut', 8800, true],
  ['bea', 'Dry curl cut', 11500, true],
  ['bea', 'Fine hair shaping', 9500, true],
  ['bea', 'Curl routine consult', 5500, true],
  ['imani', 'Protective style consult', 6500, true],
  ['imani', 'Loc maintenance', 18000, true],
  ['imani', 'Scalp care session', 8000, true],
  ['jo', 'Fine hair shaping', 8800, true],
  ['jo', 'Precision bob', 12000, true],
  ['jo', 'Pixie maintenance', 7000, true],
].map(([professionalId, name, priceCents, taxable]) => ({
  id: serviceIdFor(professionalId, name),
  professionalId,
  name,
  basePriceCents: priceCents,
  currency: 'cad',
  taxable,
  tipEligible: true,
  promotionEligible: true,
}));

const completedAppointments = [
  {
    id: 'appt_returning_mara_001',
    customerId: 'client_returning_demo',
    professionalId: 'mara',
    salonId: 'salon_hairline',
    status: 'completed',
    paymentStatus: 'paid',
    refunded: false,
    serviceIds: [serviceIdFor('mara', 'Skin fade')],
  },
  {
    id: 'appt_refunded_001',
    customerId: 'client_refunded_demo',
    professionalId: 'omar',
    salonId: 'salon_civic',
    status: 'completed',
    paymentStatus: 'refunded',
    refunded: true,
    serviceIds: [serviceIdFor('omar', 'Fade and lineup')],
  },
];

const deposits = [
  {
    appointmentId: 'appt_demo_deposit_balance',
    paymentId: 'pay_deposit_demo_001',
    amountCents: 2000,
    currency: 'cad',
    status: 'paid',
  },
];

const redemptions = [
  {
    id: 'redemption_existing_firstcut',
    promotionId: 'promo_first_cut_25',
    customerId: 'client_used_promo_demo',
    status: 'redeemed',
  },
];

export const promotions = [
  {
    id: 'promo_first_cut_25',
    name: 'First Cut Promotion',
    publicDescription: '25% off your first cut',
    internalDescription: 'New clients receive 25% off the first qualifying service booked and paid through Frizi.',
    code: 'FIRSTCUT25',
    discountType: 'percentage',
    discountValue: 25,
    currency: 'cad',
    appliesAutomatically: true,
    requiresCode: false,
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: '2026-12-31T23:59:59.999Z',
    active: true,
    firstAppointmentOnly: true,
    newClientsOnly: true,
    returningClientsOnly: false,
    eligibleServiceIds: [],
    excludedServiceIds: [],
    eligibleStylistIds: [],
    eligibleSalonIds: [],
    minimumSubtotalCents: 0,
    maximumDiscountCents: null,
    totalRedemptionLimit: 1000,
    perCustomerRedemptionLimit: 1,
    currentRedemptionCount: 1,
    combinable: false,
  },
  {
    id: 'promo_fixed_10',
    name: '$10 New Client Offer',
    publicDescription: '$10 off your first appointment',
    internalDescription: 'Code-required fixed discount test promo.',
    code: 'FRIZI10',
    discountType: 'fixed_amount',
    discountValue: 1000,
    currency: 'cad',
    appliesAutomatically: false,
    requiresCode: true,
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: '2026-12-31T23:59:59.999Z',
    active: true,
    firstAppointmentOnly: false,
    newClientsOnly: false,
    returningClientsOnly: false,
    eligibleServiceIds: [],
    excludedServiceIds: [],
    eligibleStylistIds: [],
    eligibleSalonIds: [],
    minimumSubtotalCents: 6000,
    maximumDiscountCents: 1000,
    totalRedemptionLimit: 500,
    perCustomerRedemptionLimit: 1,
    currentRedemptionCount: 0,
    combinable: false,
  },
  {
    id: 'promo_expired_demo',
    name: 'Expired Demo Promotion',
    publicDescription: 'Expired promotion test case',
    internalDescription: 'Used for validation testing.',
    code: 'EXPIRED',
    discountType: 'percentage',
    discountValue: 20,
    currency: 'cad',
    appliesAutomatically: false,
    requiresCode: true,
    startAt: '2025-01-01T00:00:00.000Z',
    endAt: '2025-12-31T23:59:59.999Z',
    active: true,
    firstAppointmentOnly: false,
    newClientsOnly: false,
    returningClientsOnly: false,
    eligibleServiceIds: [],
    excludedServiceIds: [],
    eligibleStylistIds: [],
    eligibleSalonIds: [],
    minimumSubtotalCents: 0,
    maximumDiscountCents: null,
    totalRedemptionLimit: 100,
    perCustomerRedemptionLimit: 1,
    currentRedemptionCount: 0,
    combinable: false,
  },
  {
    id: 'promo_inactive_demo',
    name: 'Inactive Demo Promotion',
    publicDescription: 'Inactive promotion test case',
    internalDescription: 'Used for validation testing.',
    code: 'INACTIVE',
    discountType: 'percentage',
    discountValue: 15,
    currency: 'cad',
    appliesAutomatically: false,
    requiresCode: true,
    startAt: '2026-01-01T00:00:00.000Z',
    endAt: '2026-12-31T23:59:59.999Z',
    active: false,
    firstAppointmentOnly: false,
    newClientsOnly: false,
    returningClientsOnly: false,
    eligibleServiceIds: [],
    excludedServiceIds: [],
    eligibleStylistIds: [],
    eligibleSalonIds: [],
    minimumSubtotalCents: 0,
    maximumDiscountCents: null,
    totalRedemptionLimit: 100,
    perCustomerRedemptionLimit: 1,
    currentRedemptionCount: 0,
    combinable: false,
  },
];

export function serviceIdFor(professionalId, serviceName) {
  return `${professionalId}:${slug(serviceName)}`;
}

export function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseMoneyToCents(value) {
  const input = String(value ?? '').trim().replace(/^\$/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(input)) {
    throw new Error('Enter a valid dollar amount.');
  }
  const [dollars, cents = ''] = input.split('.');
  return Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
}

export function formatCurrency(cents, currency = 'cad') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

export function calculateTipCents(selection, customTipAmount, tipBasisCents) {
  if (!selection || selection === 'none') return 0;
  if (['15', '18', '20', '25'].includes(selection)) {
    return Math.round((tipBasisCents * Number(selection)) / 100);
  }
  if (selection !== 'custom') {
    throw new Error('Choose a valid tip option.');
  }
  const customTipCents = parseMoneyToCents(customTipAmount);
  if (customTipCents < 0) throw new Error('Tip cannot be negative.');
  if (customTipCents > maxCustomTipCents) {
    throw new Error(`Custom tip cannot exceed ${formatCurrency(maxCustomTipCents)}.`);
  }
  return customTipCents;
}

function loadProfessional(professionalId) {
  const professional = professionals.find((record) => record.id === professionalId);
  if (!professional) throw new Error('This professional is not available for checkout.');
  return professional;
}

function loadServices(professionalId, selectedServiceIds) {
  const ids = selectedServiceIds?.length ? selectedServiceIds : [];
  if (ids.length === 0) throw new Error('Choose a service before checkout.');

  return ids.map((serviceId) => {
    const service = services.find((record) => record.id === serviceId && record.professionalId === professionalId);
    if (!service) throw new Error('This service is not available for the selected professional.');
    return service;
  });
}

function customerHasQualifyingAppointment(customerId, promotion, professional) {
  return completedAppointments.some((appointment) => {
    if (appointment.customerId !== customerId) return false;
    if (appointment.status !== 'completed') return false;
    if (appointment.paymentStatus !== 'paid') return false;
    if (appointment.refunded) return false;
    if (promotion.eligibleSalonIds.length > 0 || professional.salonId) {
      return appointment.salonId === professional.salonId || appointment.professionalId === professional.id;
    }
    return appointment.professionalId === professional.id;
  });
}

function customerRedemptionCount(customerId, promotionId) {
  return redemptions.filter((redemption) => redemption.customerId === customerId && redemption.promotionId === promotionId && redemption.status === 'redeemed').length;
}

function validatePromotion(promotion, context) {
  const now = context.now ?? new Date();
  const code = context.promoCode?.trim().toUpperCase();
  const subtotalCents = context.services.reduce((sum, service) => sum + service.basePriceCents, 0);

  if (!promotion) throw new Error('Promotion not found.');
  if (!promotion.active) throw new Error('This promotion is not active.');
  if (now < new Date(promotion.startAt)) throw new Error('This promotion is not active yet.');
  if (now > new Date(promotion.endAt)) throw new Error('This promotion has expired.');
  if (promotion.requiresCode && promotion.code !== code) throw new Error('This promotion code is not valid.');
  if (promotion.currency !== context.currency) throw new Error('This promotion does not match the checkout currency.');
  if (promotion.minimumSubtotalCents > subtotalCents) {
    throw new Error(`The minimum appointment value for this offer is ${formatCurrency(promotion.minimumSubtotalCents, context.currency)}.`);
  }
  if (promotion.totalRedemptionLimit !== null && promotion.currentRedemptionCount >= promotion.totalRedemptionLimit) {
    throw new Error('This code has reached its redemption limit.');
  }
  if (customerRedemptionCount(context.customerId, promotion.id) >= promotion.perCustomerRedemptionLimit) {
    throw new Error('This offer has already been used.');
  }
  if (promotion.firstAppointmentOnly && customerHasQualifyingAppointment(context.customerId, promotion, context.professional)) {
    throw new Error('This offer is for first-time clients.');
  }
  if (promotion.newClientsOnly && customerHasQualifyingAppointment(context.customerId, promotion, context.professional)) {
    throw new Error('This offer is for first-time clients.');
  }
  if (promotion.returningClientsOnly && !customerHasQualifyingAppointment(context.customerId, promotion, context.professional)) {
    throw new Error('This offer is for returning clients.');
  }
  if (promotion.eligibleServiceIds.length > 0 && !context.services.some((service) => promotion.eligibleServiceIds.includes(service.id))) {
    throw new Error('This promotion does not apply to the selected service.');
  }
  if (promotion.excludedServiceIds.some((serviceId) => context.services.some((service) => service.id === serviceId))) {
    throw new Error('This promotion does not apply to the selected service.');
  }
  if (promotion.eligibleStylistIds.length > 0 && !promotion.eligibleStylistIds.includes(context.professional.id)) {
    throw new Error('This promotion does not apply to this stylist.');
  }
  if (promotion.eligibleSalonIds.length > 0 && !promotion.eligibleSalonIds.includes(context.professional.salonId)) {
    throw new Error('This promotion does not apply to this salon.');
  }
}

function findPromotion(context) {
  const code = context.promoCode?.trim().toUpperCase();
  if (code) {
    const promotion = promotions.find((record) => record.code === code);
    validatePromotion(promotion, context);
    return promotion;
  }

  for (const promotion of promotions.filter((record) => record.appliesAutomatically)) {
    try {
      validatePromotion(promotion, context);
      return promotion;
    } catch {
      // Automatic promotions should not block checkout if the customer is not eligible.
    }
  }

  return null;
}

function calculateDiscountCents(promotion, serviceSubtotalCents) {
  if (!promotion) return 0;
  const rawDiscount =
    promotion.discountType === 'percentage'
      ? Math.round((serviceSubtotalCents * promotion.discountValue) / 100)
      : promotion.discountValue;
  const cappedDiscount = promotion.maximumDiscountCents === null ? rawDiscount : Math.min(rawDiscount, promotion.maximumDiscountCents);
  return Math.max(0, Math.min(serviceSubtotalCents, cappedDiscount));
}

function depositCreditFor(appointmentId, currency) {
  return deposits
    .filter((deposit) => deposit.appointmentId === appointmentId && deposit.currency === currency && deposit.status === 'paid')
    .reduce((sum, deposit) => sum + deposit.amountCents, 0);
}

export function calculateAppointmentCheckout(input) {
  const currency = (input.currency || 'cad').toLowerCase();
  const customerId = input.customerId || 'guest_demo';
  const professional = loadProfessional(input.professionalId || 'mara');
  const selectedServiceIds = input.selectedServiceIds || (input.selectedServiceId ? [input.selectedServiceId] : []);
  const selectedServices = loadServices(professional.id, selectedServiceIds);
  const appointmentId = input.appointmentId || `quote_${professional.id}_${Date.now()}`;
  const serviceSubtotalCents = selectedServices.reduce((sum, service) => sum + service.basePriceCents, 0);
  const promotionContext = { ...input, currency, customerId, professional, services: selectedServices };
  const promotion = findPromotion(promotionContext);
  const discountCents = calculateDiscountCents(promotion, serviceSubtotalCents);
  const discountedServiceSubtotalCents = serviceSubtotalCents - discountCents;
  const taxableSubtotalCents = selectedServices.some((service) => service.taxable) ? discountedServiceSubtotalCents : 0;
  const taxCents = Math.round((taxableSubtotalCents * taxRateBps) / 10000);
  const depositCreditCents = Math.min(depositCreditFor(appointmentId, currency), discountedServiceSubtotalCents + taxCents);
  const tipBasisCents = selectedServices.filter((service) => service.tipEligible).reduce((sum, service) => sum + service.basePriceCents, 0);
  const tipCents = calculateTipCents(input.tipSelection || 'none', input.customTipAmount, tipBasisCents);
  const amountDueCents = Math.max(0, discountedServiceSubtotalCents + taxCents - depositCreditCents + tipCents);
  const quoteExpiresAt = new Date(Date.now() + quoteTtlMinutes * 60 * 1000).toISOString();
  const snapshot = {
    appointmentId,
    customerId,
    professionalId: professional.id,
    professionalName: professional.name,
    salonId: professional.salonId,
    salonName: professional.salonName,
    services: selectedServices.map((service) => ({
      id: service.id,
      name: service.name,
      priceCents: service.basePriceCents,
      currency: service.currency,
      taxable: service.taxable,
      tipEligible: service.tipEligible,
    })),
    serviceSubtotalCents,
    promotion: promotion
      ? {
          id: promotion.id,
          name: promotion.name,
          code: promotion.code,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          combinable: promotion.combinable,
        }
      : null,
    discountCents,
    discountedServiceSubtotalCents,
    taxRateBps,
    taxCents,
    depositCreditCents,
    tipSelection: input.tipSelection || 'none',
    tipBasisCents,
    tipCents,
    amountDueCents,
    currency,
    pricingVersion,
    quoteExpiresAt,
    createdAt: new Date().toISOString(),
  };

  return {
    ...snapshot,
    connectedAccountId: professional.connectedAccountId,
    tipOptions: [15, 18, 20, 25].map((percent) => ({
      percent,
      amountCents: Math.round((tipBasisCents * percent) / 100),
    })),
    idempotencyKey: createHash('sha256')
      .update(JSON.stringify({
        appointmentId,
        customerId,
        professionalId: professional.id,
        selectedServiceIds: selectedServices.map((service) => service.id),
        promotionId: promotion?.id || null,
        tipSelection: input.tipSelection || 'none',
        tipCents,
        amountDueCents,
        pricingVersion,
      }))
      .digest('hex')
      .slice(0, 40),
  };
}

export function createCheckoutLineItems(summary) {
  const currency = summary.currency;
  const lineItems = [];

  if (summary.discountedServiceSubtotalCents > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: {
          name: summary.promotion ? `Appointment services after ${summary.promotion.name}` : 'Appointment services',
          description: summary.services.map((service) => service.name).join(', '),
        },
        unit_amount: summary.discountedServiceSubtotalCents,
      },
      quantity: 1,
    });
  }

  if (summary.taxCents > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: { name: 'Tax' },
        unit_amount: summary.taxCents,
      },
      quantity: 1,
    });
  }

  if (summary.tipCents > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: { name: `Optional tip for ${summary.professionalName}` },
        unit_amount: summary.tipCents,
      },
      quantity: 1,
    });
  }

  if (summary.depositCreditCents > 0) {
    const netWithoutTip = Math.max(0, summary.discountedServiceSubtotalCents + summary.taxCents - summary.depositCreditCents);
    lineItems.splice(0, lineItems.length);
    if (netWithoutTip > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: 'Remaining appointment balance after deposit' },
          unit_amount: netWithoutTip,
        },
        quantity: 1,
      });
    }
    if (summary.tipCents > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: `Optional tip for ${summary.professionalName}` },
          unit_amount: summary.tipCents,
        },
        quantity: 1,
      });
    }
  }

  return lineItems;
}

export function metadataFromSummary(summary) {
  return {
    frizi_checkout_kind: 'service_booking',
    appointment_id: summary.appointmentId,
    customer_id: summary.customerId,
    stylist_id: summary.professionalId,
    salon_id: summary.salonId,
    promotion_id: summary.promotion?.id || '',
    promotion_redemption_id: summary.promotion ? `pending_${summary.appointmentId}_${summary.promotion.id}` : '',
    tip_amount: String(summary.tipCents),
    service_subtotal: String(summary.serviceSubtotalCents),
    discount_amount: String(summary.discountCents),
    tax_amount: String(summary.taxCents),
    deposit_credit: String(summary.depositCreditCents),
    amount_due: String(summary.amountDueCents),
    currency: summary.currency,
    pricing_version: summary.pricingVersion,
    pricing_snapshot_hash: createHash('sha256').update(JSON.stringify(summary)).digest('hex').slice(0, 32),
  };
}
