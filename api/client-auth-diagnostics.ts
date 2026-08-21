/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { enforceRateLimit } from './_rate-limit.mjs';

type AuthDiagnosticPayload = {
  event?: string;
  traceId?: string;
  route?: string;
  intent?: string;
  method?: string;
  stage?: string;
  elapsedMs?: number;
  status?: number | null;
  errorCode?: string;
  message?: string;
  hasUser?: boolean;
  hasSession?: boolean;
  identitiesCount?: number | null;
  emailConfirmed?: boolean;
  existingAccountLikely?: boolean;
  redirectUrl?: string;
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage) {
  let body = '';
  for await (const chunk of request) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

function safeText(value: unknown, maxLength = 180) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(access_token|refresh_token|password|authorization|apikey|secret)\s*[:=]\s*[^,\s}]+/gi, '$1=[redacted]')
    .slice(0, maxLength);
}

function safeDiagnostic(payload: AuthDiagnosticPayload) {
  return {
    event: safeText(payload.event || 'client_auth_event', 80),
    traceId: safeText(payload.traceId, 24),
    route: safeText(payload.route, 120),
    intent: safeText(payload.intent, 40),
    method: safeText(payload.method, 40),
    stage: safeText(payload.stage, 80),
    elapsedMs: Number.isFinite(payload.elapsedMs) ? Math.max(0, Number(payload.elapsedMs)) : null,
    status: Number.isFinite(payload.status) ? Number(payload.status) : null,
    errorCode: safeText(payload.errorCode, 80),
    message: safeText(payload.message, 180),
    hasUser: Boolean(payload.hasUser),
    hasSession: Boolean(payload.hasSession),
    identitiesCount: Number.isFinite(payload.identitiesCount) ? Number(payload.identitiesCount) : null,
    emailConfirmed: Boolean(payload.emailConfirmed),
    existingAccountLikely: Boolean(payload.existingAccountLikely),
    redirectHost: safeText(payload.redirectUrl ? new URL(payload.redirectUrl).host : '', 120),
  };
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed' });
  if (!(await enforceRateLimit(request, response, 'client_auth_diagnostic'))) return;

  try {
    const payload = (await readJson(request)) as AuthDiagnosticPayload;
    const diagnostic = safeDiagnostic(payload);
    console.info('[frizi-client-auth-diagnostic]', JSON.stringify(diagnostic));
    return sendJson(response, 200, { ok: true });
  } catch {
    return sendJson(response, 400, { error: 'Invalid diagnostic payload.' });
  }
}
