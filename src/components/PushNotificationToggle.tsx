'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

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

export default function PushNotificationToggle() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function checkSupport() {
      // Check if push notifications are supported
      if (typeof window === 'undefined') return;

      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setIsSupported(false);
        setIsReady(true);
        return;
      }

      setIsSupported(true);

      // Check current subscription with timeout
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        );

        const checkPromise = async () => {
          const registrations = await navigator.serviceWorker.getRegistrations();
          if (registrations.length > 0) {
            const subscription = await registrations[0].pushManager.getSubscription();
            return !!subscription;
          }
          return false;
        };

        const subscribed = await Promise.race([checkPromise(), timeoutPromise]);
        setIsSubscribed(subscribed as boolean);
      } catch {
        // Timeout or error - just show as not subscribed
        setIsSubscribed(false);
      }

      setIsReady(true);
    }

    checkSupport();
  }, []);

  const subscribe = async () => {
    setIsLoading(true);

    try {
      // Request permission
      const result = await Notification.requestPermission();

      if (result !== 'granted') {
        setIsLoading(false);
        return;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');

      // Wait for it to be ready with timeout
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]) as ServiceWorkerRegistration;

      // Subscribe to push
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured');
        setIsLoading(false);
        return;
      }

      const subscription = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
          },
        }),
      });

      if (res.ok) {
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error('Error subscribing to push:', err);
    }

    setIsLoading(false);
  };

  const unsubscribe = async () => {
    setIsLoading(true);

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          });
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Error unsubscribing from push:', err);
    }

    setIsLoading(false);
  };

  const toggle = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  // Don't render until we know support status
  if (!isReady || !isSupported) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      disabled={isLoading}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs ${
        isSubscribed
          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      title={isSubscribed ? 'Notifications on - tap to disable' : 'Enable notifications'}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="w-3.5 h-3.5" />
      ) : (
        <BellOff className="w-3.5 h-3.5" />
      )}
      <span className="hidden sm:inline">
        {isSubscribed ? 'On' : 'Off'}
      </span>
    </button>
  );
}
