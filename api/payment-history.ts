/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { isDemoRequest, sendJson, sendProductionDisabled } from './_environment.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

const paymentHistory: Array<Record<string, unknown>> = [];

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(request, response, 'commerce_read'))) return;

  if (!isDemoRequest(request)) {
    return sendProductionDisabled(response, 'Payment history');
  }

  return sendJson(response, 200, {
    records: paymentHistory,
    exportable: true,
    note: 'Preview endpoint. Production should read from payment_records and preserve tip/refund columns separately.',
  });
}
