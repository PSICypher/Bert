import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/push-utils';

interface NotifyRequestBody {
  title: string;
  message: string;
  excludeUserId?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient();

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate VAPID configuration
  if (
    !process.env.VAPID_SUBJECT ||
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  ) {
    return NextResponse.json(
      { error: 'Push notifications not configured. Missing VAPID keys.' },
      { status: 503 }
    );
  }

  // Parse request body
  let body: NotifyRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.title || !body.message) {
    return NextResponse.json(
      { error: 'Missing required fields: title, message' },
      { status: 400 }
    );
  }

  try {
    const result = await sendPushNotification({
      title: body.title,
      message: body.message,
      excludeUserId: body.excludeUserId,
    });

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Error sending push notifications:', error);
    return NextResponse.json(
      { error: 'Failed to send push notifications' },
      { status: 500 }
    );
  }
}
