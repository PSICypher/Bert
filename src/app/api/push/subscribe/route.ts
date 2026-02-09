import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import type { PushSubscriptionData } from '@/lib/push-utils';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient();

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse subscription data
  let subscription: PushSubscriptionData;
  try {
    subscription = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Validate subscription data
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json(
      { error: 'Missing required subscription fields: endpoint, keys.p256dh, keys.auth' },
      { status: 400 }
    );
  }

  // Store subscription in database (upsert to handle re-subscriptions)
  const { error: insertError } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
      },
      {
        onConflict: 'user_id,endpoint',
      }
    );

  if (insertError) {
    console.error('Error storing push subscription:', insertError);
    return NextResponse.json(
      { error: 'Failed to store subscription' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = createRouteHandlerClient();

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse subscription data to get endpoint
  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
  }

  // Delete subscription
  const { error: deleteError } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', body.endpoint);

  if (deleteError) {
    console.error('Error deleting push subscription:', deleteError);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
