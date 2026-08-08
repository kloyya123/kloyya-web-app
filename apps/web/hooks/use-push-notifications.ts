'use client';

import { useCallback, useEffect, useState } from 'react';
import { services } from '@/services';

/**
 * Desktop push, end to end: register the service worker, ask permission,
 * subscribe with the browser's Push API, and hand the subscription to the
 * server (services.notifications.subscribePush).
 *
 * `support` distinguishes "not supported" from "not yet decided" from
 * "denied" so the settings UI can say something accurate instead of a single
 * on/off switch — Safari and any browser without Notification/PushManager/
 * ServiceWorker gets a clear "not supported here", not a silently broken toggle.
 */
export type PushSupport = 'unsupported' | 'default' | 'granted' | 'denied';

function currentSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/** VAPID keys are base64url; PushManager wants a raw Uint8Array. */
function toApplicationServerKey(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function usePushNotifications() {
  const [support, setSupport] = useState<PushSupport>('unsupported');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setSupport(currentSupport());
  }, []);

  const enable = useCallback(async () => {
    const vapidKey = process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY'];
    if (currentSupport() === 'unsupported' || !vapidKey) return;

    setIsBusy(true);
    try {
      const permission = await Notification.requestPermission();
      setSupport(permission);
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toApplicationServerKey(vapidKey),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.['p256dh'] || !json.keys?.['auth']) return;

      await services.notifications.subscribePush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys['p256dh'], auth: json.keys['auth'] },
        userAgent: navigator.userAgent,
      });
    } finally {
      setIsBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    setIsBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;

      await services.notifications.unsubscribePush(subscription.endpoint);
      await subscription.unsubscribe();
    } finally {
      setIsBusy(false);
    }
  }, []);

  return { support, isBusy, enable, disable };
}
