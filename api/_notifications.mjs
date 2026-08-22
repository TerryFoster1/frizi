import webpush from 'web-push';

const vapidPublicKey = process.env.FRIZI_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.FRIZI_VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.FRIZI_VAPID_SUBJECT || 'mailto:support@frizi.ca';

function pushConfigured() {
  return Boolean(vapidPublicKey && vapidPrivateKey);
}

function configureWebPush() {
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  return true;
}

function pushAllowed(notification) {
  if (/promo/i.test(String(notification.notification_type || ''))) {
    const metadata = notification.metadata || {};
    return metadata.promotionalPushAllowed === true;
  }
  return true;
}

function safePushPayload(notification) {
  return JSON.stringify({
    title: notification.title,
    body: notification.body || '',
    actionPath: notification.action_path || '/',
    notificationId: notification.id,
    type: notification.notification_type,
  });
}

export async function dispatchNotificationPush(supabase, notificationId) {
  const { data: notification, error: notificationError } = await supabase
    .from('frizi_notifications')
    .select('id, recipient_user_id, notification_type, title, body, action_path, metadata')
    .eq('id', notificationId)
    .maybeSingle();
  if (notificationError) throw notificationError;
  if (!notification) return { attempted: 0, sent: 0, skipped: true };

  if (!pushConfigured() || !pushAllowed(notification)) {
    await supabase.from('frizi_notification_deliveries').upsert(
      {
        notification_id: notification.id,
        channel: 'push',
        status: 'skipped',
        provider: pushConfigured() ? 'web_push' : 'web_push_unconfigured',
        error_code: pushConfigured() ? null : 'missing_vapid',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'notification_id,channel,device_subscription_id' },
    );
    return { attempted: 0, sent: 0, skipped: true };
  }

  configureWebPush();
  const { data: devices, error: devicesError } = await supabase
    .from('frizi_device_subscriptions')
    .select('id, subscription')
    .eq('user_id', notification.recipient_user_id)
    .eq('active', true)
    .eq('provider', 'web_push');
  if (devicesError) throw devicesError;
  if (!devices?.length) {
    await supabase.from('frizi_notification_deliveries').upsert(
      {
        notification_id: notification.id,
        channel: 'push',
        status: 'skipped',
        provider: 'web_push',
        error_code: 'no_active_subscription',
        attempted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: { reason: 'No active saved web push subscription for recipient.' },
      },
      { onConflict: 'notification_id,channel,device_subscription_id' },
    );
    return { attempted: 0, sent: 0, skipped: true };
  }

  let sent = 0;
  for (const device of devices || []) {
    const attemptedAt = new Date().toISOString();
    try {
      await webpush.sendNotification(device.subscription, safePushPayload(notification));
      sent += 1;
      await supabase.from('frizi_notification_deliveries').upsert(
        {
          notification_id: notification.id,
          channel: 'push',
          device_subscription_id: device.id,
          status: 'sent',
          provider: 'web_push',
          attempted_at: attemptedAt,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'notification_id,channel,device_subscription_id' },
      );
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('frizi_device_subscriptions').update({ active: false, updated_at: new Date().toISOString() }).eq('id', device.id);
      }
      await supabase.from('frizi_notification_deliveries').upsert(
        {
          notification_id: notification.id,
          channel: 'push',
          device_subscription_id: device.id,
          status: 'failed',
          provider: 'web_push',
          error_code: statusCode ? String(statusCode) : 'push_failed',
          attempted_at: attemptedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'notification_id,channel,device_subscription_id' },
      );
    }
  }

  return { attempted: (devices || []).length, sent, skipped: false };
}
