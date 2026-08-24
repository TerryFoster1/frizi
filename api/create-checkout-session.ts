/// <reference types="node" />

import Stripe from 'stripe';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  calculateAppointmentCheckout,
  createCheckoutLineItems,
  metadataFromSummary,
  platformFeeRate,
} from './_frizi-pricing.mjs';
import {
  calculateCommerceCart,
  commerceCheckoutEnabled,
  commerceMetadata,
  createCommerceLineItems,
} from './_frizi-commerce.mjs';
import { isDemoRequest, sendJson, sendProductionDisabled } from './_environment.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from './_supabase.mjs';
import { resolveProfessionalCapabilities } from './_entitlements.mjs';

type CheckoutKind = 'pro_subscription' | 'service_booking' | 'product_purchase';

type CheckoutRequest = {
  kind?: CheckoutKind;
  appointmentId?: string;
  professionalId?: string;
  customerId?: string;
  customerEmail?: string;
  selectedServiceId?: string;
  selectedServiceIds?: string[];
  promoCode?: string;
  tipSelection?: '15' | '18' | '20' | '25' | 'custom' | 'none';
  customTipAmount?: string;
  currency?: string;
  items?: Array<{ variantId: string; quantity: number; recommendationId?: string }>;
  shippingAddress?: { province?: string; postalCode?: string };
};

function getBaseUrl(request: IncomingMessage) {
  const host = request.headers.host;
  return process.env.FRIZI_PUBLIC_APP_URL || (host ? `https://${host}` : 'https://frizi.ca');
}

async function readJson(request: IncomingMessage & { body?: unknown }): Promise<CheckoutRequest> {
  if (request.body && typeof request.body === 'object') {
    return request.body as CheckoutRequest;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as CheckoutRequest) : {};
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(request, response, 'checkout'))) return;

  if (!process.env.STRIPE_SECRET_KEY) {
    return sendJson(response, 501, {
      error: 'Stripe is not configured yet.',
      requiredEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'FRIZI_PUBLIC_APP_URL'],
    });
  }

  const payload = await readJson(request);
  const kind = payload.kind || 'service_booking';

  if (!isDemoRequest(request)) {
    if (kind === 'product_purchase') return sendProductionDisabled(response, 'Product checkout');
    if (kind === 'service_booking' && process.env.FRIZI_APPOINTMENT_PAYMENTS_ENABLED !== 'true') {
      return sendProductionDisabled(response, 'Appointment checkout');
    }
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-06-24.dahlia',
  });
  const baseUrl = getBaseUrl(request);

  if (kind === 'product_purchase') {
    if (!commerceCheckoutEnabled) {
      return sendJson(response, 403, {
        error: 'Frizi Commerce checkout is disabled for this environment.',
        requiredEnv: ['COMMERCE_CHECKOUT_ENABLED=true'],
      });
    }

    let commerceSummary;
    try {
      commerceSummary = calculateCommerceCart(payload);
    } catch (error) {
      return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Could not calculate cart.' });
    }

    const metadata = commerceMetadata(commerceSummary);
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: payload.customerEmail,
        line_items: createCommerceLineItems(commerceSummary),
        success_url: `${baseUrl}/?commerce=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/?commerce=cancelled`,
        metadata,
        payment_intent_data: { metadata },
        shipping_address_collection: {
          allowed_countries: ['CA'],
        },
      },
      {
        idempotencyKey: `frizi_commerce_${commerceSummary.idempotencyKey}`,
      },
    );

    return sendJson(response, 200, {
      url: session.url,
      id: session.id,
      summary: commerceSummary,
    });
  }

  if (kind !== 'service_booking') {
    return sendJson(response, 400, {
      error: 'This endpoint now supports dynamic Frizi appointment payments only. Pro subscriptions remain in the Frizi Pro project.',
    });
  }

  let summary;
  try {
    summary = calculateAppointmentCheckout(payload);
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Could not calculate checkout.' });
  }

  if (summary.amountDueCents <= 0) {
    return sendJson(response, 200, {
      noCost: true,
      summary,
      message: 'No payment is due. Frizi can complete this appointment without creating a Stripe Checkout Session.',
    });
  }

  if (!isSupabaseServiceConfigured()) {
    return sendJson(response, 501, { error: 'Frizi payment checkout is not configured.' });
  }
  const supabase = createSupabaseServiceClient();
  const normalizedProfessionalId = String(payload.professionalId || summary.professionalId || '').replace(/^live-/, '');
  if (!normalizedProfessionalId) {
    return sendJson(response, 400, { error: 'Choose a professional before starting payment.' });
  }
  const { data: professional, error: professionalError } = await supabase
    .from('frizi_professionals')
    .select('id, account_plan, subscription_status')
    .eq('id', normalizedProfessionalId)
    .maybeSingle();
  if (professionalError) return sendJson(response, 500, { error: 'Payment eligibility could not be checked.' });
  if (!professional || !resolveProfessionalCapabilities(professional).canProcessPayments) {
    return sendJson(response, 403, { error: 'Online payment is not available for this professional.' });
  }

  const metadata = metadataFromSummary(summary);
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    customer_email: payload.customerEmail,
    line_items: createCheckoutLineItems(summary),
    success_url: `${baseUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/?checkout=cancelled`,
    metadata,
    payment_intent_data: {
      metadata,
      ...(summary.connectedAccountId
        ? {
            application_fee_amount: Math.round(summary.amountDueCents * platformFeeRate),
            transfer_data: {
              destination: summary.connectedAccountId,
            },
          }
        : {}),
    },
  };

  const session = await stripe.checkout.sessions.create(sessionParams, {
    idempotencyKey: `frizi_checkout_${summary.idempotencyKey}`,
  });

  return sendJson(response, 200, {
    url: session.url,
    id: session.id,
    summary,
  });
}
