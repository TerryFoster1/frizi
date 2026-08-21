/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { isDemoRequest, sendJson, sendProductionDisabled } from './_environment.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

const records: Array<{ service: string; client: string; serviceAmountCents: number; tipCents: number; totalPaidCents: number }> = [];

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(request, response, 'commerce_read'))) return;

  if (!isDemoRequest(request)) {
    return sendProductionDisabled(response, 'Tip analytics');
  }

  const tipsCollected = records.reduce((sum, record) => sum + record.tipCents, 0);
  const serviceRevenue = records.reduce((sum, record) => sum + record.serviceAmountCents, 0);
  const revenueIncludingTips = records.reduce((sum, record) => sum + record.totalPaidCents, 0);

  return sendJson(response, 200, {
    grossRevenueCents: revenueIncludingTips,
    tipsCollectedCents: tipsCollected,
    averageTipPercent: serviceRevenue > 0 ? Math.round((tipsCollected / serviceRevenue) * 100) : 0,
    averageTipPerAppointmentCents: records.length > 0 ? Math.round(tipsCollected / records.length) : 0,
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
