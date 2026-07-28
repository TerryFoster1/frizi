/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getCommerceCatalogue } from './_frizi-commerce.mjs';

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  const url = new URL(request.url || '/api/commerce-catalog', 'https://frizi.ca');
  const customerId = url.searchParams.get('customerId') || 'client_ari_demo';
  return sendJson(response, 200, {
    catalogue: getCommerceCatalogue(customerId),
    complianceWarning:
      'Products require final Canadian legal, regulatory, tax, supplier, privacy, product-safety, and consumer-law review before live launch.',
  });
}
