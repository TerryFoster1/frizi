import type { IncomingMessage, ServerResponse } from 'node:http';
import { dispatchNotificationPush } from './_notifications.mjs';
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from './_supabase.mjs';

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function bearerToken(request: IncomingMessage) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

async function notificationBelongsToUser(supabase: ReturnType<typeof createSupabaseServiceClient>, notification: any, authUserId: string) {
  if (notification.recipient_user_id === authUserId) return true;

  if (notification.professional_id) {
    const { data: professional, error } = await supabase
      .from('frizi_professionals')
      .select('id, frizi_profiles!inner(auth_user_id)')
      .eq('id', notification.professional_id)
      .eq('frizi_profiles.auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw error;
    if (professional) return true;
  }

  if (notification.client_id) {
    const { data: client, error } = await supabase
      .from('frizi_clients')
      .select('id, frizi_profiles!inner(auth_user_id)')
      .eq('id', notification.client_id)
      .eq('frizi_profiles.auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw error;
    if (client) return true;
  }

  return false;
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed' });
  if (!isSupabaseServiceConfigured()) return sendJson(response, 501, { error: 'Notifications are not configured.' });
  try {
    const payload = await readJson(request);
    const notificationId = typeof payload.notificationId === 'string' ? payload.notificationId : '';
    if (!notificationId) return sendJson(response, 400, { error: 'Choose a valid notification.' });
    const supabase = createSupabaseServiceClient();
    const token = bearerToken(request);
    const { data: userResult, error: userError } = token ? await supabase.auth.getUser(token) : { data: { user: null }, error: null };
    if (userError || !userResult.user) return sendJson(response, 401, { error: 'Sign in before dispatching notifications.' });
    const { data: notification, error: notificationError } = await supabase
      .from('frizi_notifications')
      .select('id, recipient_user_id, professional_id, client_id')
      .eq('id', notificationId)
      .maybeSingle();
    if (notificationError) throw notificationError;
    if (!notification) return sendJson(response, 404, { error: 'Notification not found.' });
    const authorized = await notificationBelongsToUser(supabase, notification, userResult.user.id);
    if (!authorized) return sendJson(response, 403, { error: 'You cannot dispatch this notification.' });
    const result = await dispatchNotificationPush(supabase, notificationId);
    return sendJson(response, 200, result);
  } catch (error) {
    return sendJson(response, 500, { error: error instanceof Error ? error.message : 'Notification dispatch failed.' });
  }
}
