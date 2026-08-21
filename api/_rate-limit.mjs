import crypto from 'node:crypto';
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from './_supabase.mjs';

const scopeDefaults = {
  invite_lookup: { limit: 90, windowSeconds: 60 },
  invite_accept: { limit: 12, windowSeconds: 60 },
  client_passport: { limit: 20, windowSeconds: 60 },
  client_auth_diagnostic: { limit: 30, windowSeconds: 60 },
  client_booking: { limit: 10, windowSeconds: 60 },
  client_delete_account: { limit: 4, windowSeconds: 60 },
  checkout: { limit: 12, windowSeconds: 60 },
  commerce_read: { limit: 60, windowSeconds: 60 },
};

function requestIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function bearerFingerprint(request) {
  const header = request.headers.authorization || '';
  const value = Array.isArray(header) ? header[0] : header;
  const match = String(value || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1] ? crypto.createHash('sha256').update(match[1]).digest('hex').slice(0, 24) : '';
}

function hashedBucket(scope, raw) {
  return crypto.createHash('sha256').update(`${scope}:${raw}`).digest('hex');
}

export function sendRateLimitResponse(response, retryAfterSeconds) {
  response.statusCode = 429;
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Retry-After', String(retryAfterSeconds || 60));
  response.end(JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }));
}

export async function enforceRateLimit(request, response, scope, options = {}) {
  const config = {
    ...(scopeDefaults[scope] || { limit: 30, windowSeconds: 60 }),
    ...options,
  };

  if (!isSupabaseServiceConfigured()) {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'Rate limiting is not configured.' }));
    return false;
  }

  const identifier = options.identifier || bearerFingerprint(request) || requestIp(request);
  const bucket = hashedBucket(scope, identifier);
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc('frizi_consume_rate_limit', {
    p_scope: scope,
    p_bucket: bucket,
    p_limit: config.limit,
    p_window_seconds: config.windowSeconds,
  });

  if (error) {
    response.statusCode = 503;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ error: 'Rate limiting is temporarily unavailable.' }));
    return false;
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    sendRateLimitResponse(response, Number(result?.retry_after_seconds || config.windowSeconds));
    return false;
  }

  return true;
}
