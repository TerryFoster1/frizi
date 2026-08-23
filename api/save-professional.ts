/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from './_supabase.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

type SaveProfessionalPayload = {
  professionalId?: string;
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage & { body?: unknown }): Promise<SaveProfessionalPayload> {
  if (request.body && typeof request.body === 'object') return request.body as SaveProfessionalPayload;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as SaveProfessionalPayload;
}

function bearerToken(request: IncomingMessage) {
  const value = request.headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  return String(header || '').replace(/^Bearer\s+/i, '').trim();
}

function cleanProfessionalId(value: unknown) {
  const id = String(value || '').replace(/^live-/, '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : '';
}

function splitName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || displayName,
    lastName: parts.slice(1).join(' '),
  };
}

export default async function handler(request: IncomingMessage & { body?: unknown }, response: ServerResponse) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' });
  if (!(await enforceRateLimit(request, response, 'client_save_professional', { limit: 20, windowSeconds: 60 }))) return;
  if (!isSupabaseServiceConfigured()) return sendJson(response, 501, { error: 'Frizi connections are not configured.' });

  try {
    const token = bearerToken(request);
    if (!token) return sendJson(response, 401, { error: 'Sign in before saving this professional.' });

    const payload = await readJson(request);
    const professionalId = cleanProfessionalId(payload.professionalId);
    if (!professionalId) return sendJson(response, 400, { error: 'Choose a valid professional.' });

    const supabase = createSupabaseServiceClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userResult.user) return sendJson(response, 401, { error: 'Sign in again before saving this professional.' });

    const { data: professional, error: professionalError } = await supabase
      .from('frizi_professionals')
      .select('id, display_name, public_profile_status, bookable, subscription_status')
      .eq('id', professionalId)
      .maybeSingle();

    if (professionalError) throw professionalError;
    if (
      !professional ||
      professional.public_profile_status !== 'published' ||
      !professional.bookable ||
      !['active', 'trialing'].includes(String(professional.subscription_status || ''))
    ) {
      return sendJson(response, 404, { error: 'This professional is not currently available to save.' });
    }

    const displayName = String(userResult.user.user_metadata?.full_name || userResult.user.email || 'Frizi client').trim();
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

    const { data: existingRelationship, error: existingRelationshipError } = await supabase
      .from('frizi_client_professional_relationships')
      .select('id, source')
      .eq('client_id', client.id)
      .eq('professional_id', professional.id)
      .maybeSingle();

    if (existingRelationshipError) throw existingRelationshipError;

    const relationshipMutation = {
      client_id: client.id,
      professional_id: professional.id,
      status: 'active',
      source: existingRelationship?.source || 'saved',
      account_claimed_status: 'claimed',
      marketing_consent_status: 'unknown',
      updated_at: new Date().toISOString(),
    };

    const { data: relationship, error: relationshipError } = existingRelationship
      ? await supabase
          .from('frizi_client_professional_relationships')
          .update(relationshipMutation)
          .eq('id', existingRelationship.id)
          .select('id, client_id, professional_id, source')
          .single()
      : await supabase
          .from('frizi_client_professional_relationships')
          .insert(relationshipMutation)
          .select('id, client_id, professional_id, source')
          .single();

    if (relationshipError) throw relationshipError;

    return sendJson(response, 200, {
      professionalId: professional.id,
      relationship,
      saved: true,
      alreadyConnected: Boolean(existingRelationship),
    });
  } catch (error) {
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Professional could not be saved.',
    });
  }
}
