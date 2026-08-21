/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from './_supabase.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

type AcceptInvitePayload = {
  token?: string;
  displayName?: string;
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage & { body?: unknown }): Promise<AcceptInvitePayload> {
  if (request.body && typeof request.body === 'object') return request.body as AcceptInvitePayload;

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as AcceptInvitePayload) : {};
}

function bearerToken(request: IncomingMessage) {
  const header = request.headers.authorization || '';
  const match = Array.isArray(header) ? header[0]?.match(/^Bearer\s+(.+)$/i) : header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function splitName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(request, response, 'invite_accept'))) return;

  if (!isSupabaseServiceConfigured()) {
    return sendJson(response, 501, { error: 'Frizi invite acceptance is not configured.' });
  }

  const accessToken = bearerToken(request);
  if (!accessToken) return sendJson(response, 401, { error: 'Sign in before accepting this invite.' });

  try {
    const payload = await readJson(request);
    const token = String(payload.token || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,160}$/.test(token)) {
      return sendJson(response, 400, { error: 'Invite link is invalid.' });
    }

    const supabase = createSupabaseServiceClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult.user) {
      return sendJson(response, 401, { error: 'Sign in again before accepting this invite.' });
    }

    const { data: invite, error: inviteError } = await supabase
      .from('frizi_professional_invites')
      .select('id, token, status, expires_at, professional_id')
      .eq('token', token)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite || invite.status !== 'active' || (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) {
      return sendJson(response, 404, { error: 'This invitation is not available.' });
    }

    const displayName = String(payload.displayName || userResult.user.user_metadata?.full_name || userResult.user.email || 'Frizi client').trim();
    const { firstName, lastName } = splitName(displayName);

    const { data: profile, error: profileError } = await supabase
      .from('frizi_profiles')
      .upsert(
        {
          auth_user_id: userResult.user.id,
          account_type: 'client',
          display_name: displayName,
          email: userResult.user.email,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'auth_user_id' },
      )
      .select('id, display_name, email')
      .single();

    if (profileError) throw profileError;

    const { data: existingClient, error: existingClientError } = await supabase
      .from('frizi_clients')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (existingClientError) throw existingClientError;

    const clientMutation = {
      profile_id: profile.id,
      preferred_name: displayName,
      first_name: firstName,
      last_name: lastName,
      email: userResult.user.email,
      account_claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: client, error: clientError } = existingClient
      ? await supabase.from('frizi_clients').update(clientMutation).eq('id', existingClient.id).select('id').single()
      : await supabase.from('frizi_clients').insert(clientMutation).select('id').single();

    if (clientError) throw clientError;

    const { data: relationship, error: relationshipError } = await supabase
      .from('frizi_client_professional_relationships')
      .upsert(
        {
          client_id: client.id,
          professional_id: invite.professional_id,
          status: 'active',
          source: 'invite',
          invite_status: 'accepted',
          account_claimed_status: 'claimed',
          marketing_consent_status: 'unknown',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,professional_id' },
      )
      .select('id, client_id, professional_id, source')
      .single();

    if (relationshipError) throw relationshipError;

    await supabase
      .from('frizi_professional_invites')
      .update({ last_accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', invite.id);

    return sendJson(response, 200, { relationship });
  } catch (error) {
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Invite acceptance failed.',
    });
  }
}
