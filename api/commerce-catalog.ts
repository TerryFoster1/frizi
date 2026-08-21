/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getCommerceCatalogue } from './_frizi-commerce.mjs';
import { isDemoRequest, sendJson, sendProductionDisabled } from './_environment.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(request, response, 'commerce_read'))) return;

  if (!isDemoRequest(request)) {
    return sendProductionDisabled(response, 'Commerce catalogue');
  }

  const url = new URL(request.url || '/api/commerce-catalog', 'https://frizi.ca');
  const customerId = url.searchParams.get('customerId') || 'commerce_coming_soon_customer';
  return sendJson(response, 200, {
    catalogue: getCommerceCatalogue(customerId),
    complianceWarning:
      'Products require final Canadian legal, regulatory, tax, supplier, privacy, product-safety, and consumer-law review before live launch.',
  });
}
