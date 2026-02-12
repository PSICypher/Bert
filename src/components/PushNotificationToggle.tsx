'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2, AlertCircle } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Status = 'loading' | 'off' | 'on' | 'denied' | 'error' | 'unsupported';

export default function PushNotificationToggle() {
  const [status, setStatus] = useState<Status>('loading');
  const [isActioning, setIsActioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    console.log('[Push] Checking status...');

    if (typeof window === 'undefined') {
      console.log('[Push] No window - unsupported');
      setStatus('unsupported');
      return;
    }

    if (!('serviceWorker' in navigator)) {
      console.log('[Push] No serviceWorker support');
      setStatus('unsupported');
      return;
    }

    if (!('PushManager' in window)) {
      console.log('[Push] No PushManager support');
      setStatus('unsupported');
      return;
    }

    if (!('Notification' in window)) {
      console.log('[Push] No Notification support');
      setStatus('unsupported');
      return;
    }

    // Check permission
    console.log('[Push] Notification.permission:', Notification.permission);
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    // Check if subscribed
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('[Push] SW registrations:', registrations.length);
      for (const reg of registrations) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          console.log('[Push] Found existing subscription');
          setStatus('on');
          return;
        }
      }
      console.log('[Push] No existing subscription, status: off');
      setStatus('off');
    } catch (err) {
      console.error('[Push] Error checking status:', err);
      setStatus('off');
    }
  }

  async function enableNotifications() {
    console.log('[Push] Enable notifications starting...');
    setIsActioning(true);
    setErrorMsg('');

    try {
      // Request permission
      console.log('[Push] Requesting permission...');
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission result:', permission);

      if (permission === 'denied') {
        setStatus('denied');
        setIsActioning(false);
        return;
      }

      if (permission !== 'granted') {
        console.log('[Push] Permission not granted');
        setStatus('off');
        setIsActioning(false);
        return;
      }

      // Register service worker
      let registration: ServiceWorkerRegistration;
      try {
        console.log('[Push] Registering service worker...');
        registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[Push] SW registered, waiting for activation...');
        // Wait for it to be ready
        await navigator.serviceWorker.ready;
        console.log('[Push] SW ready');
      } catch (err) {
        console.error('[Push] SW registration failed:', err);
        setErrorMsg('SW failed');
        setStatus('error');
        setIsActioning(false);
        return;
      }

      // Get VAPID key - trim any whitespace/newlines
      const rawVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      console.log('[Push] Raw VAPID key present:', !!rawVapidKey, 'length:', rawVapidKey?.length);

      if (!rawVapidKey) {
        console.error('[Push] No VAPID key in env');
        setErrorMsg('No VAPID key');
        setStatus('error');
        setIsActioning(false);
        return;
      }

      // Clean the key - remove whitespace, newlines, and any trailing chars
      const vapidPublicKey = rawVapidKey.trim().replace(/\\n/g, '').replace(/\n/g, '');
      console.log('[Push] Cleaned VAPID key length:', vapidPublicKey.length);

      // Subscribe to push
      let subscription: PushSubscription;
      try {
        console.log('[Push] Subscribing to push...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        console.log('[Push] Subscribed successfully');
      } catch (err) {
        console.error('[Push] Push subscribe failed:', err);
        setErrorMsg('Subscribe failed');
        setStatus('error');
        setIsActioning(false);
        return;
      }

      // Send to server
      try {
        const p256dh = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');

        if (!p256dh || !auth) {
          throw new Error('Missing subscription keys');
        }

        console.log('[Push] Sending subscription to server...');
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
              auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
            },
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error('[Push] Server error:', res.status, text);
          throw new Error('Server rejected subscription');
        }

        console.log('[Push] Server accepted subscription');
        setStatus('on');
      } catch (err) {
        console.error('[Push] Server subscribe failed:', err);
        // Still mark as on locally since browser is subscribed
        setStatus('on');
      }
    } catch (err) {
      console.error('[Push] Enable notifications failed:', err);
      setErrorMsg(String(err));
      setStatus('error');
    }

    setIsActioning(false);
  }

  async function disableNotifications() {
    setIsActioning(true);

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Tell server first
          try {
            await fetch('/api/push/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
          } catch (err) {
            console.error('Server unsubscribe failed:', err);
          }
          // Unsubscribe locally
          await sub.unsubscribe();
        }
      }
      setStatus('off');
    } catch (err) {
      console.error('Disable notifications failed:', err);
      setStatus('error');
    }

    setIsActioning(false);
  }

  function handleClick() {
    if (isActioning) return;

    if (status === 'on') {
      disableNotifications();
    } else if (status === 'off' || status === 'error') {
      enableNotifications();
    }
  }

  // Don't show if unsupported
  if (status === 'loading' || status === 'unsupported') {
    return null;
  }

  // Denied - show disabled state
  if (status === 'denied') {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 text-gray-400 text-xs"
        title="Notifications blocked in browser settings"
      >
        <BellOff className="w-3.5 h-3.5" />
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <button
        onClick={handleClick}
        disabled={isActioning}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-100 text-red-600 text-xs"
        title={errorMsg || 'Error - tap to retry'}
      >
        {isActioning ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  // Normal on/off states
  const isOn = status === 'on';

  return (
    <button
      onClick={handleClick}
      disabled={isActioning}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs ${
        isOn
          ? 'bg-green-100 text-green-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      title={isOn ? 'Notifications ON - tap to turn off' : 'Tap to enable notifications'}
    >
      {isActioning ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isOn ? (
        <BellRing className="w-3.5 h-3.5" />
      ) : (
        <Bell className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
