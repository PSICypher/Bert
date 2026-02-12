import webpush from 'web-push';
import { createAdminSupabaseClient } from './supabase/server';

// Initialize web-push with VAPID details
// Trim values to remove any accidental whitespace/newlines from env vars
const vapidSubject = process.env.VAPID_SUBJECT?.trim();
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/=+$/, '');
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();

if (vapidSubject && vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification({
  title,
  message,
  excludeUserId,
}: {
  title: string;
  message: string;
  excludeUserId?: string;
}): Promise<{ sent: number; failed: number }> {
  const supabase = createAdminSupabaseClient();

  // Get all subscriptions except excluded user
  let query = supabase.from('push_subscriptions').select('*');
  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId);
  }

  const { data: subscriptions, error } = await query;

  if (error) {
    console.error('Error fetching push subscriptions:', error);
    throw new Error('Failed to fetch push subscriptions');
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title,
    body: message,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
  } satisfies NotificationPayload);

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        },
        payload
      )
    )
  );

  // Clean up expired/invalid subscriptions
  const failedSubscriptions = results
    .map((result, index) => ({ result, subscription: subscriptions[index] }))
    .filter(({ result }) => {
      if (result.status === 'rejected') {
        const error = result.reason as { statusCode?: number };
        // 410 Gone or 404 Not Found means subscription is invalid
        return error.statusCode === 410 || error.statusCode === 404;
      }
      return false;
    });

  if (failedSubscriptions.length > 0) {
    const endpointsToDelete = failedSubscriptions.map(
      ({ subscription }) => subscription.endpoint
    );
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', endpointsToDelete);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return { sent, failed };
}
