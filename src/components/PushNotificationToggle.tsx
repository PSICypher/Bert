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

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    if (typeof window === 'undefined') {
      setStatus('unsupported');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }

    // Check permission
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    // Check if subscribed
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setStatus('on');
          return;
        }
      }
      setStatus('off');
    } catch (err) {
      console.error('Error checking push status:', err);
      setStatus('off');
    }
  }

  async function enableNotifications() {
    setIsActioning(true);

    try {
      // Request permission
      const permission = await Notification.requestPermission();

      if (permission === 'denied') {
        setStatus('denied');
        setIsActioning(false);
        return;
      }

      if (permission !== 'granted') {
        setStatus('off');
        setIsActioning(false);
        return;
      }

      // Register service worker
      let registration: ServiceWorkerRegistration;
      try {
        registration = await navigator.serviceWorker.register('/sw.js');
        // Wait a moment for it to activate
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        console.error('SW registration failed:', err);
        setStatus('error');
        setIsActioning(false);
        return;
      }

      // Get VAPID key
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('No VAPID key');
        setStatus('error');
        setIsActioning(false);
        return;
      }

      // Subscribe to push
      let subscription: PushSubscription;
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      } catch (err) {
        console.error('Push subscribe failed:', err);
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
          throw new Error('Server rejected subscription');
        }

        setStatus('on');
      } catch (err) {
        console.error('Server subscribe failed:', err);
        // Still mark as on locally since browser is subscribed
        setStatus('on');
      }
    } catch (err) {
      console.error('Enable notifications failed:', err);
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
        title="Error - tap to retry"
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
