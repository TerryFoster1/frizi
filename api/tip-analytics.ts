/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';

const records = [
  { service: 'Curly shag refresh', client: 'Nora V.', serviceAmountCents: 11500, tipCents: 2300, totalPaidCents: 15295 },
  { service: 'Low-maintenance short cut', client: 'Ari M.', serviceAmountCents: 5200, tipCents: 936, totalPaidCents: 6812 },
  { service: 'Gloss refresh', client: 'Stacey Jones', serviceAmountCents: 14500, tipCents: 3625, totalPaidCents: 20010 },
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

  const tipsCollected = records.reduce((sum, record) => sum + record.tipCents, 0);
  const serviceRevenue = records.reduce((sum, record) => sum + record.serviceAmountCents, 0);
  const revenueIncludingTips = records.reduce((sum, record) => sum + record.totalPaidCents, 0);

  return sendJson(response, 200, {
    grossRevenueCents: revenueIncludingTips,
    tipsCollectedCents: tipsCollected,
    averageTipPercent: Math.round((tipsCollected / serviceRevenue) * 100),
    averageTipPerAppointmentCents: Math.round(tipsCollected / records.length),
    revenueExcludingTipsCents: serviceRevenue,
    revenueIncludingTipsCents: revenueIncludingTips,
    highestTippingServices: [...records].sort((a, b) => b.tipCents - a.tipCents).map((record) => ({
      service: record.service,
      tipCents: record.tipCents,
    })),
    highestReturningClients: [...records].sort((a, b) => b.tipCents - a.tipCents).map((record) => ({
      client: record.client,
      tipCents: record.tipCents,
    })),
    privacy: 'Tip analytics are private to the professional and internal reporting surfaces.',
  });
}
