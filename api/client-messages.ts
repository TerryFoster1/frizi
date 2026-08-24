/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from './_supabase.mjs';
import { dispatchNotificationPush } from './_notifications.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';
import { resolveProfessionalCapabilities } from './_entitlements.mjs';

type MessagePayload = {
  appointmentId?: string;
  body?: string;
  professionalId?: string;
};

type ConversationMessageRow = {
  id: string;
  conversation_id: string;
  sender_role: string | null;
  message_type: string | null;
  body: string | null;
  promotion_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  read_at: string | null;
};

type PromotionMessageRow = {
  id: string;
  client_headline: string | null;
  public_description: string | null;
  name: string | null;
  discount_type: string | null;
  discount_value: number | null;
  image_url: string | null;
  end_at: string | null;
  active: boolean | null;
  archived_at: string | null;
};

type ProfessionalInboxRow = {
  id: string;
  display_name: string | null;
  studio_name: string | null;
  profile_photo_url: string | null;
  hero_photo_url: string | null;
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
  const id = String(value || '')
    .trim()
    .replace(/^live-/, '');
  return /^[0-9a-f-]{36}$/i.test(id) ? id : '';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export default async function handler(
  request: IncomingMessage & { body?: unknown },
  response: ServerResponse,
) {
  if (request.method !== 'POST' && request.method !== 'GET') {
    response.setHeader('Allow', 'GET, POST');
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

    const { data: profile, error: profileError } = await supabase
      .from('frizi_profiles')
      .select('id, display_name, email')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile)
      return sendJson(response, 404, {
        error: 'Client profile was not found.',
      });

    const { data: client, error: clientError } = await supabase
      .from('frizi_clients')
      .select('id, preferred_name, first_name, last_name')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client)
      return sendJson(response, 404, {
        error: 'Client profile was not found.',
      });

    if (request.method === 'GET') {
      const { data: conversations, error: conversationsError } = await supabase
        .from('frizi_conversations')
        .select('id, professional_id, status, updated_at')
        .eq('client_id', client.id)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (conversationsError) throw conversationsError;

      const conversationRows = conversations || [];
      const conversationIds = conversationRows.map((conversation) =>
        String(conversation.id),
      );
      const professionalIds = conversationRows.map((conversation) =>
        String(conversation.professional_id),
      );
      const [{ data: professionals }, { data: messages }] = await Promise.all([
        professionalIds.length
          ? supabase
              .from('frizi_professionals')
              .select(
                'id, display_name, studio_name, profile_photo_url, hero_photo_url',
              )
              .in('id', professionalIds)
          : Promise.resolve({ data: [] }),
        conversationIds.length
          ? supabase
              .from('frizi_messages')
              .select(
                'id, conversation_id, sender_role, message_type, body, promotion_id, metadata, created_at, read_at',
              )
              .in('conversation_id', conversationIds)
              .order('created_at', { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [] }),
      ]);

      const professionalRows = (professionals || []) as ProfessionalInboxRow[];
      const messageRows = (messages || []) as ConversationMessageRow[];
      const promotionIds = Array.from(
        new Set(messageRows.map((message) => String(message.promotion_id || '')).filter(Boolean)),
      );
      const { data: promotionRows, error: promotionRowsError } = promotionIds.length
        ? await supabase
            .from('frizi_promotions')
            .select('id, client_headline, public_description, name, discount_type, discount_value, image_url, end_at, active, archived_at')
            .in('id', promotionIds)
        : { data: [], error: null };
      if (promotionRowsError) throw promotionRowsError;
      const promotionsById = new Map<string, PromotionMessageRow>(
        ((promotionRows || []) as PromotionMessageRow[]).map((promotion) => [
          String(promotion.id),
          promotion,
        ]),
      );
      const professionalsById = new Map<string, ProfessionalInboxRow>(
        professionalRows.map((professional) => [
          String(professional.id),
          professional,
        ]),
      );
      const messagesByConversation = new Map<
        string,
        ConversationMessageRow[]
      >();
      messageRows.forEach((message) => {
        const conversationId = String(message.conversation_id);
        messagesByConversation.set(conversationId, [
          ...(messagesByConversation.get(conversationId) || []),
          message,
        ]);
      });

      return sendJson(response, 200, {
        conversations: conversationRows.map((conversation) => {
          const professional = professionalsById.get(
            String(conversation.professional_id),
          );
          const professionalName = String(
            professional?.display_name || 'Frizi Pro',
          );
          const conversationMessages =
            messagesByConversation.get(String(conversation.id)) || [];
          const latestMessage = conversationMessages[0];
          const unreadCount = conversationMessages.filter(
            (message) =>
              message.sender_role === 'professional' && !message.read_at,
          ).length;
          const messagesForClient = conversationMessages
            .slice(0, 25)
            .reverse()
            .map((message) =>
              messagePayloadForClient(message, promotionsById),
            );
          return {
            id: conversation.id,
            professionalId: conversation.professional_id,
            professionalName,
            studioName: professional?.studio_name || '',
            avatarUrl:
              professional?.profile_photo_url ||
              professional?.hero_photo_url ||
              '',
            avatarFallback: initials(professionalName) || 'FP',
            latestMessage: latestMessage?.body || 'No messages yet.',
            latestMessageAt:
              latestMessage?.created_at || conversation.updated_at || '',
            messages: messagesForClient,
            unreadCount,
          };
        }),
      });
    }

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
    }

    const { data: professional, error: professionalError } = await supabase
      .from('frizi_professionals')
      .select('id, display_name, profile_id, account_plan, subscription_status, frizi_profiles(auth_user_id)')
      .eq('id', professionalId)
      .maybeSingle();
    if (professionalError) throw professionalError;
    if (!professional)
      return sendJson(response, 404, { error: 'Professional was not found.' });
    if (!resolveProfessionalCapabilities(professional).canMessageClients) {
      return sendJson(response, 403, {
        error: 'Messaging is not available for this professional yet.',
      });
    }

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
      const nextSource =
        relationship.source && relationship.source !== 'saved'
          ? relationship.source
          : appointmentId
            ? 'booking'
            : 'message';
      const { data: updatedRelationship, error: relationshipUpdateError } =
        await supabase
          .from('frizi_client_professional_relationships')
          .update({
            status: 'active',
            source: nextSource,
            updated_at: new Date().toISOString(),
          })
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
        ? String(
            (professionalProfiles as Record<string, unknown>).auth_user_id ||
              '',
          )
        : '';
    const clientName =
      [client.first_name, client.last_name].filter(Boolean).join(' ') ||
      String(
        client.preferred_name ||
          profile.display_name ||
          user.email ||
          'A client',
      );

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
      if (notification?.id)
        await dispatchNotificationPush(supabase, String(notification.id));
    }

    return sendJson(response, 200, {
      conversationId: conversation.id,
      messageId: message.id,
    });
  } catch (error) {
    return sendJson(response, 500, {
      error:
        error instanceof Error ? error.message : 'Message could not be sent.',
    });
  }
}

function messagePayloadForClient(
  message: ConversationMessageRow,
  promotionsById: Map<string, PromotionMessageRow>,
) {
  return {
    id: message.id,
    body: message.body || '',
    createdAt: message.created_at || '',
    isFromProfessional: message.sender_role === 'professional',
    messageType: message.message_type || 'text',
    promotion: promotionPayloadForMessage(message, promotionsById),
  };
}

function promotionPayloadForMessage(
  message: ConversationMessageRow,
  promotionsById: Map<string, PromotionMessageRow>,
) {
  const snapshot =
    message.metadata &&
    typeof message.metadata === 'object' &&
    message.metadata.promotionSnapshot &&
    typeof message.metadata.promotionSnapshot === 'object'
      ? (message.metadata.promotionSnapshot as Record<string, unknown>)
      : null;
  const promotionId = String(message.promotion_id || snapshot?.id || '');
  if (!promotionId) return null;
  const promotion = promotionsById.get(promotionId);
  const headline = String(
    snapshot?.headline ||
      promotion?.client_headline ||
      promotion?.name ||
      '',
  ).trim();
  const description = String(
    snapshot?.description || promotion?.public_description || '',
  ).trim();
  if (!headline && !description) return null;
  const endAt = String(snapshot?.endAt || promotion?.end_at || '');
  const expired = Boolean(endAt && new Date(endAt).getTime() < Date.now());
  return {
    id: promotionId,
    headline,
    description,
    discountType: String(snapshot?.discountType || promotion?.discount_type || ''),
    discountValue: Number(snapshot?.discountValue || promotion?.discount_value || 0),
    imageUrl: String(snapshot?.imageUrl || promotion?.image_url || '/frizi-client-hero-salon.png'),
    endAt,
    expired: expired || promotion?.active === false || Boolean(promotion?.archived_at),
  };
}
