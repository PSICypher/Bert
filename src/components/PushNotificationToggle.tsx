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
    if (typeof window === 'undefined') {
      setStatus('unsupported');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

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
    setErrorMsg('');

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
        registration = await navigator.serviceWorker.register('/push-sw.js');

        // Poll until we have an active SW (max 15 seconds)
        const startTime = Date.now();
        while (!registration.active && Date.now() - startTime < 15000) {
          await new Promise(r => setTimeout(r, 1000));
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0 && regs[0].active) {
            registration = regs[0];
            break;
          }
        }

        if (!registration.active) {
          throw new Error('Service worker failed to activate');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'SW failed');
        setStatus('error');
        setIsActioning(false);
        return;
      }

      // VAPID key (public key is safe to expose)
      const VAPID_KEY = 'BJvHL-34fv7HQw_km9bBIpGmI-DRIfEhq_FZCSKLLWzUZb_9qZPl8g3iXtucX0CzRFv6n_2NRjdB-lg6QLVI-TU';

      // Subscribe to push
      let subscription: PushSubscription;
      try {
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          subscription = existingSub;
        } else {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
          });
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Subscribe failed');
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
        // Still mark as on since browser is subscribed
        setStatus('on');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed');
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
          try {
            await fetch('/api/push/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint }),
            });
          } catch (err) {
            // Continue anyway
          }
          await sub.unsubscribe();
        }
      }
      setStatus('off');
    } catch (err) {
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

  if (status === 'loading' || status === 'unsupported') {
    return null;
  }

  if (status === 'denied') {
    return (
      <button
        onClick={() => alert('Notifications are blocked.\n\nTo enable:\n1. Long-press app icon → App info → Notifications → Enable\n\nOr in browser:\nSettings → Site settings → Notifications → Allow')}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-100 text-orange-600 text-xs"
        title="Notifications blocked - tap for help"
      >
        <BellOff className="w-3.5 h-3.5" />
      </button>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-end gap-1">
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
          <span>Retry</span>
        </button>
        {errorMsg && (
          <span className="text-[9px] text-red-500 max-w-[200px] text-right">{errorMsg}</span>
        )}
      </div>
    );
  }

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
