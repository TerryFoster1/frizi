/// <reference types="node" />

import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from './_supabase.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

type PassportPayload = {
  action?: 'rotate' | 'revoke';
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage & { body?: unknown }): Promise<PassportPayload> {
  if (request.body && typeof request.body === 'object') return request.body as PassportPayload;

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as PassportPayload) : {};
}

function bearerToken(request: IncomingMessage) {
  const header = request.headers.authorization || '';
  const match = Array.isArray(header) ? header[0]?.match(/^Bearer\s+(.+)$/i) : header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function passportUrlFor(token: string) {
  const proUrl = process.env.FRIZI_PRO_PUBLIC_URL || process.env.VITE_FRIZI_PRO_PUBLIC_URL || 'https://pro.frizi.ca';
  return `${proUrl.replace(/\/$/, '')}/client-passport/${token}`;
}

async function ensureClient(supabase: ReturnType<typeof createSupabaseServiceClient>, user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const displayName = String(user.user_metadata?.full_name || user.email || 'Frizi client').trim();
  const { data: profile, error: profileError } = await supabase
    .from('frizi_profiles')
    .upsert(
      {
        auth_user_id: user.id,
        account_type: 'client',
        display_name: displayName,
        email: user.email,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'auth_user_id' },
    )
    .select('id')
    .single();
  if (profileError) throw profileError;

  const { data: existingClient, error: existingClientError } = await supabase.from('frizi_clients').select('id').eq('profile_id', profile.id).maybeSingle();
  if (existingClientError) throw existingClientError;
  if (existingClient?.id) return String(existingClient.id);

  const { data: client, error: clientError } = await supabase
    .from('frizi_clients')
    .insert({
      profile_id: profile.id,
      preferred_name: displayName,
      email: user.email,
      account_claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (clientError) throw clientError;
  return String(client.id);
}

async function activePassport(supabase: ReturnType<typeof createSupabaseServiceClient>, clientId: string) {
  const { data, error } = await supabase
    .from('frizi_client_passport_tokens')
    .select('id, token, status, expires_at, created_at')
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createPassport(supabase: ReturnType<typeof createSupabaseServiceClient>, clientId: string) {
  const { data, error } = await supabase
    .from('frizi_client_passport_tokens')
    .insert({
      client_id: clientId,
      token: makeToken(),
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .select('id, token, status, expires_at, created_at')
    .single();
  if (error) throw error;
  return data;
}

function mapPassport(row: Record<string, unknown>) {
  const token = String(row.token || '');
  return {
    id: row.id,
    status: row.status,
    expiresAt: row.expires_at,
    passportUrl: passportUrlFor(token),
  };
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  if (!['GET', 'POST'].includes(request.method || '')) return sendJson(response, 405, { error: 'Method not allowed' });
  if (!(await enforceRateLimit(request, response, 'client_passport'))) return;
  if (!isSupabaseServiceConfigured()) return sendJson(response, 501, { error: 'Frizi passport sharing is not configured.' });

  const accessToken = bearerToken(request);
  if (!accessToken) return sendJson(response, 401, { error: 'Sign in before managing your hair passport.' });

  try {
    const supabase = createSupabaseServiceClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult.user) return sendJson(response, 401, { error: 'Sign in again before managing your hair passport.' });

    const clientId = await ensureClient(supabase, userResult.user);

    if (request.method === 'POST') {
      const payload = await readJson(request);
      if (payload.action === 'revoke') {
        const { error } = await supabase
          .from('frizi_client_passport_tokens')
          .update({ status: 'revoked', revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('client_id', clientId)
          .eq('status', 'active');
        if (error) throw error;
        return sendJson(response, 200, { passport: null, message: 'Passport QR revoked.' });
      }

      if (payload.action === 'rotate') {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from('frizi_client_passport_tokens')
          .update({ status: 'revoked', revoked_at: now, updated_at: now })
          .eq('client_id', clientId)
          .eq('status', 'active');
        if (error) throw error;
        return sendJson(response, 201, { passport: mapPassport(await createPassport(supabase, clientId)) });
      }
    }

    const passport = (await activePassport(supabase, clientId)) || (await createPassport(supabase, clientId));
    return sendJson(response, 200, { passport: mapPassport(passport) });
  } catch (error) {
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Passport sharing failed.',
    });
  }
}
