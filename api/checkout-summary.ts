/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { calculateAppointmentCheckout } from './_frizi-pricing.mjs';
import { isDemoRequest, sendJson, sendProductionDisabled } from './_environment.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

type SummaryRequest = {
  appointmentId?: string;
  professionalId?: string;
  customerId?: string;
  selectedServiceId?: string;
  selectedServiceIds?: string[];
  promoCode?: string;
  tipSelection?: '15' | '18' | '20' | '25' | 'custom' | 'none';
  customTipAmount?: string;
  currency?: string;
};

async function readJson(request: IncomingMessage & { body?: unknown }): Promise<SummaryRequest> {
  if (request.body && typeof request.body === 'object') {
    return request.body as SummaryRequest;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as SummaryRequest) : {};
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(request, response, 'checkout'))) return;

  if (!isDemoRequest(request)) {
    return sendProductionDisabled(response, 'Appointment checkout preview');
  }

  try {
    const payload = await readJson(request);
    return sendJson(response, 200, { summary: calculateAppointmentCheckout(payload) });
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Could not calculate checkout.' });
  }
}
