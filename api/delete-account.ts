/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from './_supabase.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

type DeletePayload = {
  confirmation?: string;
};

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage & { body?: unknown }): Promise<DeletePayload> {
  if (request.body && typeof request.body === 'object') return request.body as DeletePayload;
  if (typeof request.body === 'string') return request.body ? (JSON.parse(request.body) as DeletePayload) : {};

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as DeletePayload) : {};
}

function bearerToken(request: IncomingMessage) {
  const header = request.headers.authorization || '';
  const match = Array.isArray(header) ? header[0]?.match(/^Bearer\s+(.+)$/i) : header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function safeMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && ['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205'].includes(String(error.code || '')));
}

async function ignoreMissing(result: PromiseLike<{ error: { code?: string; message?: string } | null }>) {
  const { error } = await result;
  if (error && !safeMissing(error)) throw error;
}

async function removeStorageFolder(supabase: SupabaseServiceClient, bucket: string, prefix: string) {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) return;
  const files = (data || []).filter((item) => item.name && item.id !== null).map((item) => `${prefix}/${item.name}`);
  if (files.length) await supabase.storage.from(bucket).remove(files);
}

async function removeClientMedia(supabase: SupabaseServiceClient, userId: string) {
  await Promise.all([
    removeStorageFolder(supabase, 'frizi-client-media', `${userId}/profile`),
    removeStorageFolder(supabase, 'frizi-client-media', `${userId}/hair_history`),
    removeStorageFolder(supabase, 'frizi-client-media', `${userId}/example_reference`),
  ]);
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed' });
  if (!(await enforceRateLimit(request, response, 'client_delete_account'))) return;
  if (!isSupabaseServiceConfigured()) return sendJson(response, 501, { error: 'Account deletion is not configured.' });

  try {
    const payload = await readJson(request);
    if (String(payload.confirmation || '').trim().toUpperCase() !== 'DELETE') {
      return sendJson(response, 400, { error: 'Type DELETE to confirm account deletion.' });
    }

    const accessToken = bearerToken(request);
    if (!accessToken) return sendJson(response, 401, { error: 'Sign in before deleting your account.' });

    const supabase = createSupabaseServiceClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult.user) return sendJson(response, 401, { error: 'Sign in again before deleting your account.' });

    const { data: profile, error: profileError } = await supabase
      .from('frizi_profiles')
      .select('id')
      .eq('auth_user_id', userResult.user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    const { data: client, error: clientError } = profile
      ? await supabase.from('frizi_clients').select('id').eq('profile_id', profile.id).maybeSingle()
      : { data: null, error: null };
    if (clientError) throw clientError;

    const now = new Date().toISOString();
    if (client?.id) {
      await ignoreMissing(supabase.from('frizi_client_passport_tokens').update({ status: 'revoked', revoked_at: now, updated_at: now }).eq('client_id', client.id));
      await ignoreMissing(supabase.from('frizi_client_photos').delete().eq('client_id', client.id));
      await ignoreMissing(supabase.from('frizi_client_professional_relationships').delete().eq('client_id', client.id));
      await ignoreMissing(supabase.from('frizi_conversations').delete().eq('client_id', client.id));
      await ignoreMissing(
        supabase
          .from('frizi_reviews')
          .update({ review_text: null, status: 'withdrawn', updated_at: now })
          .eq('client_id', client.id),
      );
      await ignoreMissing(
        supabase
          .from('frizi_appointments')
          .update({
            status: 'cancelled',
            client_notes: null,
            reference_photo_urls: [],
            updated_at: now,
          })
          .eq('client_id', client.id)
          .in('status', ['pending', 'confirmed']),
      );
      await ignoreMissing(
        supabase
          .from('frizi_clients')
          .update({
            preferred_name: null,
            hair_profile: {},
            preferences: {},
            communication_preferences: {},
            privacy_settings: {},
            first_name: null,
            last_name: null,
            email: null,
            phone: null,
            profile_photo_url: null,
            account_claimed_at: null,
            updated_at: now,
          })
          .eq('id', client.id),
      );
    }

    await ignoreMissing(supabase.from('frizi_device_subscriptions').delete().eq('user_id', userResult.user.id));
    await removeClientMedia(supabase, userResult.user.id);

    if (profile?.id) {
      await ignoreMissing(
        supabase
          .from('frizi_profiles')
          .update({
            auth_user_id: null,
            display_name: 'Deleted account',
            email: null,
            phone: null,
            profile_photo_url: null,
            status: 'deleted',
            updated_at: now,
          })
          .eq('id', profile.id)
          .eq('auth_user_id', userResult.user.id),
      );
    }

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userResult.user.id, true);
    if (deleteUserError) throw deleteUserError;

    return sendJson(response, 200, { deleted: true });
  } catch (error) {
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Account deletion could not be completed.',
    });
  }
}
