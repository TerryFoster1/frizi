import { createClient } from '../utils/supabase/client';

const vapidPublicKey = import.meta.env.VITE_FRIZI_VAPID_PUBLIC_KEY || import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export function pushSupported() {
  return Boolean(vapidPublicKey && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
}

export function notificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export type PushSubscriptionStatus = {
  browserSubscribed: boolean;
  enabled: boolean;
  permission: NotificationPermission | 'unsupported';
  savedSubscriptionCount: number;
  supported: boolean;
};

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) output[index] = rawData.charCodeAt(index);
  return output;
}

export async function enablePushNotifications() {
  if (!pushSupported()) throw new Error('Push notifications are not configured for this browser yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifications are blocked in this browser.' : 'Notification permission was not granted.');
  await navigator.serviceWorker.register('/frizi-sw.js');
  const readyRegistration = await navigator.serviceWorker.ready;
  const currentSubscription = await readyRegistration.pushManager.getSubscription();
  if (currentSubscription) await currentSubscription.unsubscribe();
  const subscription = await readyRegistration.pushManager.subscribe({
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    userVisibleOnly: true,
  });
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Sign in before enabling notifications.');
  const { error } = await supabase.from('frizi_device_subscriptions').upsert(
    {
      user_id: userId,
      platform: 'web',
      provider: 'web_push',
      device_token: subscription.endpoint,
      subscription: subscription.toJSON(),
      active: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_token' },
  );
  if (error) throw error;
  return getPushSubscriptionStatus();
}

export async function getPushSubscriptionStatus(): Promise<PushSubscriptionStatus> {
  const supported = pushSupported();
  const permission = notificationPermission();
  let browserSubscribed = false;
  let savedSubscriptionCount = 0;

  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;

  if (supported) {
    try {
      await navigator.serviceWorker.register('/frizi-sw.js');
      const readyRegistration = await navigator.serviceWorker.ready;
      browserSubscribed = Boolean(await readyRegistration.pushManager.getSubscription());
    } catch {
      browserSubscribed = false;
    }
  }

  if (userId) {
    const { count, error } = await supabase
      .from('frizi_device_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('provider', 'web_push')
      .eq('active', true);
    if (error) throw error;
    savedSubscriptionCount = count || 0;
  }

  return {
    browserSubscribed,
    enabled: supported && permission === 'granted' && browserSubscribed && savedSubscriptionCount > 0,
    permission,
    savedSubscriptionCount,
    supported,
  };
}
