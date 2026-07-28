/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { calculateCommerceCart } from './_frizi-commerce.mjs';

type CommerceCartRequest = {
  customerId?: string;
  items?: Array<{ variantId: string; quantity: number; recommendationId?: string }>;
  shippingAddress?: { province?: string; postalCode?: string };
  promoCode?: string;
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage & { body?: unknown }): Promise<CommerceCartRequest> {
  if (request.body && typeof request.body === 'object') {
    return request.body as CommerceCartRequest;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as CommerceCartRequest) : {};
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  try {
    const payload = await readJson(request);
    return sendJson(response, 200, { summary: calculateCommerceCart(payload) });
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Could not calculate cart.' });
  }
}
