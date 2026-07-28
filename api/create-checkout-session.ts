/// <reference types="node" />

import Stripe from 'stripe';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  calculateAppointmentCheckout,
  createCheckoutLineItems,
  metadataFromSummary,
  platformFeeRate,
} from './_frizi-pricing.mjs';

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
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

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

  if (!process.env.STRIPE_SECRET_KEY) {
    return sendJson(response, 501, {
      error: 'Stripe is not configured yet.',
      requiredEnv: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'FRIZI_PUBLIC_APP_URL'],
    });
  }

  const payload = await readJson(request);
  const kind = payload.kind || 'service_booking';
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-06-24.dahlia',
  });
  const baseUrl = getBaseUrl(request);

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
