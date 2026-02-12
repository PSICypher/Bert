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
  const [step, setStep] = useState<string>('');

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
    setStep('1');

    try {
      // Request permission
      console.log('[Push] Requesting permission...');
      setStep('2');
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

      // Get service worker registration - try existing first, then register
      let registration: ServiceWorkerRegistration;
      try {
        console.log('[Push] Getting service worker...');
        setStep('3a');

        // First try to get existing registration
        const existingRegs = await navigator.serviceWorker.getRegistrations();
        console.log('[Push] Existing registrations:', existingRegs.length);

        if (existingRegs.length > 0) {
          registration = existingRegs[0];
          console.log('[Push] Using existing SW registration');
        } else {
          // Register new SW
          setStep('3b');
          console.log('[Push] Registering new SW...');
          registration = await navigator.serviceWorker.register('/sw.js');
          console.log('[Push] SW registered');
        }

        setStep('3c');

        // Wait briefly for activation if needed
        if (!registration.active) {
          console.log('[Push] Waiting for SW activation...');
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 1500);
          });
        }

        setStep('3d');
        console.log('[Push] SW ready, active:', !!registration.active);
      } catch (err: any) {
        console.error('[Push] SW failed:', err);
        setErrorMsg(`SW: ${err?.message || String(err)}`);
        setStatus('error');
        setIsActioning(false);
        return;
      }

      // Get VAPID key - use env var or fallback to hardcoded value
      // The public key is safe to expose (it's meant to be public)
      const FALLBACK_VAPID_KEY = 'BJvHL-34fv7HQw_km9bBIpGmI-DRIfEhq_FZCSKLLWzUZb_9qZPl8g3iXtucX0CzRFv6n_2NRjdB-lg6QLVI-TU';
      const rawVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || FALLBACK_VAPID_KEY;
      console.log('[Push] VAPID key from env:', !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, 'using fallback:', !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

      // Clean the key - remove whitespace, newlines, and any trailing chars
      const vapidPublicKey = rawVapidKey.trim().replace(/\\n/g, '').replace(/\n/g, '');
      console.log('[Push] Cleaned VAPID key length:', vapidPublicKey.length);

      // Subscribe to push
      let subscription: PushSubscription;
      try {
        console.log('[Push] Subscribing to push...');
        console.log('[Push] VAPID key length:', vapidPublicKey.length);
        setStep('4a');

        // Check if already subscribed
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          console.log('[Push] Already subscribed, using existing');
          subscription = existingSub;
        } else {
          setStep('4b');
          console.log('[Push] Creating new subscription...');
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
          console.log('[Push] Subscribed successfully');
        }
        setStep('4c');
      } catch (err: any) {
        console.error('[Push] Push subscribe failed:', err);
        setErrorMsg(`Sub: ${err?.message || err?.name || String(err)}`);
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
        setStep('5');
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
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-100 text-red-600 text-xs max-w-[120px]"
        title={errorMsg || 'Error - tap to retry'}
      >
        {isActioning ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        )}
        {errorMsg && <span className="truncate text-[10px]">{errorMsg}</span>}
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
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {step && <span className="text-[10px]">{step}</span>}
        </>
      ) : isOn ? (
        <BellRing className="w-3.5 h-3.5" />
      ) : (
        <Bell className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
