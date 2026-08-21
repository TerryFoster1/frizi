/// <reference types="node" />

import Stripe from 'stripe';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from './_supabase.mjs';

const processedEventIds = new Set<string>();

export const config = {
  api: {
    bodyParser: false,
  },
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readRawBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function eventCreatedAt(created: number) {
  return new Date(created * 1000).toISOString();
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === '23505',
  );
}

async function reserveWebhookEvent(event: Stripe.Event) {
  if (!isSupabaseServiceConfigured()) {
    if (processedEventIds.has(event.id)) {
      return { duplicate: true, durable: false };
    }
    processedEventIds.add(event.id);
    return { duplicate: false, durable: false };
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('frizi_stripe_webhook_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    api_version: event.api_version,
    event_created_at: eventCreatedAt(event.created),
    processing_status: 'processing',
    payload: event,
  });

  if (!error) {
    return { duplicate: false, durable: true };
  }

  if (isUniqueViolation(error)) {
    return { duplicate: true, durable: true };
  }

  console.warn('[frizi-payments] durable webhook idempotency unavailable', {
    eventId: event.id,
    eventType: event.type,
    message: error.message,
  });

  if (processedEventIds.has(event.id)) {
    return { duplicate: true, durable: false };
  }
  processedEventIds.add(event.id);
  return { duplicate: false, durable: false };
}

async function completeWebhookEvent(eventId: string) {
  if (!isSupabaseServiceConfigured()) {
    return;
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('frizi_stripe_webhook_events')
    .update({
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', eventId);

  if (error) {
    console.warn('[frizi-payments] webhook event processed but status update failed', {
      eventId,
      message: error.message,
    });
  }
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return sendJson(response, 501, { error: 'Stripe webhook is not configured yet.' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-06-24.dahlia',
  });
  const signature = request.headers['stripe-signature'];
  const rawBody = await readRawBody(request);

  if (typeof signature !== 'string') {
    return sendJson(response, 400, { error: 'Missing Stripe signature.' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid webhook signature.' });
  }

  const reservation = await reserveWebhookEvent(event);
  if (reservation.duplicate) {
    return sendJson(response, 200, { received: true, duplicate: true, durable: reservation.durable });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.info('[frizi-payments] checkout completed', {
        id: session.id,
        kind: session.metadata?.frizi_checkout_kind,
        appointmentId: session.metadata?.appointment_id,
        customerId: session.metadata?.customer_id,
        stylistId: session.metadata?.stylist_id,
        salonId: session.metadata?.salon_id,
        promotionId: session.metadata?.promotion_id,
        promotionRedemptionId: session.metadata?.promotion_redemption_id,
        serviceSubtotalCents: session.metadata?.service_subtotal,
        discountCents: session.metadata?.discount_amount,
        taxCents: session.metadata?.tax_amount,
        tipCents: session.metadata?.tip_amount,
        amountDueCents: session.metadata?.amount_due,
        pricingSnapshotHash: session.metadata?.pricing_snapshot_hash,
        paymentStatus: session.payment_status,
      });
      if (session.metadata?.frizi_checkout_kind === 'product_purchase') {
        console.info('[frizi-commerce] order ready for manual fulfilment', {
          checkoutSessionId: session.id,
          customerId: session.metadata?.customer_id,
          orderSnapshotHash: session.metadata?.order_snapshot_hash,
          merchandiseSubtotalCents: session.metadata?.merchandise_subtotal,
          productDiscountCents: session.metadata?.product_discount,
          shippingCents: session.metadata?.shipping_amount,
          shippingProvider: session.metadata?.shipping_provider,
          taxCents: session.metadata?.tax_amount,
          amountDueCents: session.metadata?.amount_due,
          commissionTotalCents: session.metadata?.commission_total,
          nextOrderStatus: 'paid',
          nextFulfillmentStatus: 'awaiting_purchase',
          nextCommissionStatus: 'pending_return_window',
        });
      }
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      console.info('[frizi-payments] checkout expired', {
        id: session.id,
        appointmentId: session.metadata?.appointment_id,
        promotionRedemptionId: session.metadata?.promotion_redemption_id,
      });
      break;
    }
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.info('[frizi-payments] payment intent event', {
        type: event.type,
        id: paymentIntent.id,
        appointmentId: paymentIntent.metadata?.appointment_id,
        amount: paymentIntent.amount,
      });
      break;
    }
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      console.info('[frizi-payments] refund event', {
        type: event.type,
        id: charge.id,
        paymentIntent: charge.payment_intent,
        amountRefunded: charge.amount_refunded,
      });
      break;
    }
    case 'refund.updated': {
      const refund = event.data.object as Stripe.Refund;
      console.info('[frizi-payments] refund updated', {
        id: refund.id,
        paymentIntent: refund.payment_intent,
        amount: refund.amount,
        status: refund.status,
      });
      break;
    }
    default:
      console.info('[frizi-payments] unhandled stripe event', event.type);
  }

  await completeWebhookEvent(event.id);

  return sendJson(response, 200, { received: true, durable: reservation.durable });
}
