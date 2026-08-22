/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from './_supabase.mjs';
import { dispatchNotificationPush } from './_notifications.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

type MessagePayload = {
  appointmentId?: string;
  body?: string;
  professionalId?: string;
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(
  request: IncomingMessage & { body?: unknown },
): Promise<MessagePayload> {
  if (request.body && typeof request.body === 'object')
    return request.body as MessagePayload;

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as MessagePayload) : {};
}

function bearerToken(request: IncomingMessage) {
  const header = request.headers.authorization || '';
  const match = Array.isArray(header)
    ? header[0]?.match(/^Bearer\s+(.+)$/i)
    : header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function cleanUuid(value: unknown) {
  const id = String(value || '').trim().replace(/^live-/, '');
  return /^[0-9a-f-]{36}$/i.test(id) ? id : '';
}

export default async function handler(
  request: IncomingMessage & { body?: unknown },
  response: ServerResponse,
) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  if (!isSupabaseServiceConfigured()) {
    return sendJson(response, 503, {
      error: 'Messaging is temporarily unavailable.',
    });
  }

  if (
    !(await enforceRateLimit(request, response, 'client_message', {
      limit: 20,
      windowSeconds: 60,
    }))
  )
    return;

  try {
    const token = bearerToken(request);
    if (!token)
      return sendJson(response, 401, { error: 'Sign in before messaging.' });

    const supabase = createSupabaseServiceClient();
    const userResult = await supabase.auth.getUser(token);
    if (userResult.error || !userResult.data.user)
      return sendJson(response, 401, { error: 'Sign in before messaging.' });
    const user = userResult.data.user;

    const payload = await readJson(request);
    const body = String(payload.body || '').trim();
    const professionalId = cleanUuid(payload.professionalId);
    const appointmentId = cleanUuid(payload.appointmentId);

    if (!professionalId)
      return sendJson(response, 400, { error: 'Choose a professional.' });
    if (body.length < 1)
      return sendJson(response, 400, { error: 'Write a message first.' });
    if (body.length > 1000)
      return sendJson(response, 400, {
        error: 'Keep the message under 1,000 characters.',
      });

    const { data: profile, error: profileError } = await supabase
      .from('frizi_profiles')
      .select('id, display_name, email')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile)
      return sendJson(response, 404, { error: 'Client profile was not found.' });

    const { data: client, error: clientError } = await supabase
      .from('frizi_clients')
      .select('id, preferred_name, first_name, last_name')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client)
      return sendJson(response, 404, { error: 'Client profile was not found.' });

    if (appointmentId) {
      const { data: appointment, error: appointmentError } = await supabase
        .from('frizi_appointments')
        .select('id')
        .eq('id', appointmentId)
        .eq('client_id', client.id)
        .eq('professional_id', professionalId)
        .maybeSingle();
      if (appointmentError) throw appointmentError;
      if (!appointment)
        return sendJson(response, 403, {
          error: 'This appointment is not available for messaging.',
        });
    } else {
      const { data: relationship, error: relationshipError } = await supabase
        .from('frizi_client_professional_relationships')
        .select('id')
        .eq('client_id', client.id)
        .eq('professional_id', professionalId)
        .maybeSingle();
      if (relationshipError) throw relationshipError;
      if (!relationship)
        return sendJson(response, 403, {
          error: 'Connect with this professional before messaging.',
        });
    }

    const { data: professional, error: professionalError } = await supabase
      .from('frizi_professionals')
      .select('id, display_name, profile_id, frizi_profiles(auth_user_id)')
      .eq('id', professionalId)
      .maybeSingle();
    if (professionalError) throw professionalError;
    if (!professional)
      return sendJson(response, 404, { error: 'Professional was not found.' });

    const { data: existingRelationship, error: existingRelationshipError } =
      await supabase
        .from('frizi_client_professional_relationships')
        .select('id, source')
        .eq('client_id', client.id)
        .eq('professional_id', professionalId)
        .maybeSingle();
    if (existingRelationshipError) throw existingRelationshipError;

    let relationship = existingRelationship;
    if (relationship?.id) {
      const { data: updatedRelationship, error: relationshipUpdateError } =
        await supabase
          .from('frizi_client_professional_relationships')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', relationship.id)
          .select('id, source')
          .single();
      if (relationshipUpdateError) throw relationshipUpdateError;
      relationship = updatedRelationship;
    } else {
      const { data: createdRelationship, error: relationshipCreateError } =
        await supabase
          .from('frizi_client_professional_relationships')
          .insert({
            client_id: client.id,
            professional_id: professionalId,
            status: 'active',
            source: appointmentId ? 'booking' : 'message',
          })
          .select('id, source')
          .single();
      if (relationshipCreateError) throw relationshipCreateError;
      relationship = createdRelationship;
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('frizi_conversations')
      .upsert(
        {
          client_id: client.id,
          professional_id: professionalId,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'professional_id,client_id' },
      )
      .select('id')
      .single();
    if (conversationError) throw conversationError;

    const { data: message, error: messageError } = await supabase
      .from('frizi_messages')
      .insert({
        body,
        conversation_id: conversation.id,
        message_type: 'text',
        metadata: {
          appointmentId: appointmentId || null,
          professionalId,
        },
        sender_role: 'client',
        sender_user_id: user.id,
      })
      .select('id')
      .single();
    if (messageError) throw messageError;

    const professionalProfiles = Array.isArray(professional.frizi_profiles)
      ? professional.frizi_profiles[0]
      : professional.frizi_profiles;
    const recipientUserId =
      professionalProfiles && typeof professionalProfiles === 'object'
        ? String((professionalProfiles as Record<string, unknown>).auth_user_id || '')
        : '';
    const clientName =
      [client.first_name, client.last_name].filter(Boolean).join(' ') ||
      String(client.preferred_name || profile.display_name || user.email || 'A client');

    if (recipientUserId) {
      const { data: notification, error: notificationError } = await supabase
        .from('frizi_notifications')
        .upsert(
          {
            recipient_user_id: recipientUserId,
            recipient_role: 'professional',
            notification_type: 'message_received',
            title: 'New client message',
            body: `${clientName}: ${body.slice(0, 120)}`,
            professional_id: professionalId,
            client_id: client.id,
            relationship_id: relationship.id,
            appointment_id: appointmentId || null,
            conversation_id: conversation.id,
            message_id: message.id,
            action_path: '/clients',
            source_key: `message:${message.id}:professional`,
            metadata: {
              preview: body.slice(0, 140),
              source: 'client_appointment_message',
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'source_key' },
        )
        .select('id')
        .single();
      if (notificationError) throw notificationError;
      if (notification?.id) await dispatchNotificationPush(supabase, String(notification.id));
    }

    return sendJson(response, 200, {
      conversationId: conversation.id,
      messageId: message.id,
    });
  } catch (error) {
    return sendJson(response, 500, {
      error:
        error instanceof Error
          ? error.message
          : 'Message could not be sent.',
    });
  }
}
