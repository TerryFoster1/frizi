/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';

const paymentHistory = [
  {
    id: 'pay_demo_mara_001',
    appointmentId: 'appt_demo_mara_001',
    professionalId: 'pro_mara_chen',
    clientId: 'client_demo',
    service: 'Dry curl cut',
    currency: 'CAD',
    serviceAmountCents: 11500,
    taxCents: 1495,
    tipCents: 2300,
    totalPaidCents: 15295,
    reviewStatus: 'submitted',
    photosAttached: 2,
    paidAt: '2026-07-14T12:12:00-04:00',
    status: 'paid',
  },
];

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  return sendJson(response, 200, {
    records: paymentHistory,
    exportable: true,
    note: 'Demo endpoint. Production should read from payment_records and preserve tip/refund columns separately.',
  });
}
