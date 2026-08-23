import crypto from 'node:crypto';
import {
  createSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from './_supabase.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

function sendRedirect(response, location) {
  response.statusCode = 303;
  response.setHeader('Location', location);
  response.end();
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  const contentType = String(request.headers['content-type'] || '');
  if (contentType.includes('application/json')) {
    return raw ? JSON.parse(raw) : {};
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
  return {};
}

function clean(value, maxLength) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function dedupeKey(payload) {
  const normalized = [
    payload.professional_name,
    payload.salon_name,
    payload.city,
    payload.contact_detail,
  ]
    .filter(Boolean)
    .join('|')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9|]+/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const accept = String(request.headers.accept || '');
  const wantsHtml = accept.includes('text/html');

  if (!isSupabaseServiceConfigured()) {
    if (wantsHtml)
      return sendRedirect(response, '/nominate-a-pro?error=configuration');
    return sendJson(response, 503, {
      error: 'Nominations are temporarily unavailable.',
    });
  }

  const allowed = await enforceRateLimit(request, response, 'seo_nomination', {
    limit: 8,
    windowSeconds: 60,
  });
  if (!allowed) return undefined;

  try {
    const body = await readBody(request);
    const nomination = {
      professional_name: clean(body.professional_name, 140),
      salon_name: clean(body.salon_name, 140) || null,
      city: clean(body.city, 100),
      professional_type: clean(body.professional_type, 80),
      recommendation_reason: clean(body.recommendation_reason, 800) || null,
      contact_detail: clean(body.contact_detail, 220) || null,
      nominator_email: clean(body.nominator_email, 220) || null,
      source_path: clean(body.source_path, 220) || '/nominate-a-pro',
    };

    if (
      !nomination.professional_name ||
      !nomination.city ||
      !nomination.professional_type
    ) {
      if (wantsHtml)
        return sendRedirect(response, '/nominate-a-pro?error=missing');
      return sendJson(response, 400, {
        error: 'Professional name, city, and professional type are required.',
      });
    }

    nomination.dedupe_key = dedupeKey(nomination);

    const supabase = createSupabaseServiceClient();
    const { error } = await supabase
      .from('frizi_professional_nominations')
      .upsert(nomination, {
        onConflict: 'dedupe_key',
      });

    if (error) throw error;

    if (wantsHtml) return sendRedirect(response, '/nominate-a-pro?success=1');
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error('frizi_nomination_error', {
      message: error instanceof Error ? error.message : String(error),
    });
    if (wantsHtml)
      return sendRedirect(response, '/nominate-a-pro?error=server');
    return sendJson(response, 500, {
      error: 'We could not save that nomination right now.',
    });
  }
}
