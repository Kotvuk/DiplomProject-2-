import { useState, useEffect, useCallback } from 'react';

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  var [registration, setRegistration] = useState(null);

  useEffect(() => {

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);

      navigator.serviceWorker.register('/service-worker.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered');
          setRegistration(reg);

          return reg.pushManager.getSubscription();
        })
        .then((subscription) => {
          if (subscription) {
            setPushSubscribed(true);
          }
        })
        .catch((error) => {
          console.error('[PWA] SW registration failed:', error);
        });
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
    }

    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  const subscribePush = useCallback(async () => {
    if (!registration) return null;

    try {

      var response = await fetch('/api/push/vapid-key');
      const { publicKey } = await response.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });

      setPushSubscribed(true);
      return subscription;
    } catch (error) {
      console.error('[PWA] Push subscription failed:', error);
      return null;
    }
  }, [registration]);

  const unsubscribePush = useCallback(async () => {
    if (!registration) return false;

    try {
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
      }

      setPushSubscribed(false);
      return true;
    } catch (error) {
      console.error('[PWA] Push unsubscribe failed:', error);
      return false;
    }
  }, [registration]);

  const sendTestNotification = useCallback(async () => {
    try {
      const response = await fetch('/api/push/test', { method: 'POST' });
      return await response.json();
    } catch (error) {
      console.error('[PWA] Test notification failed:', error);
      return null;
    }
  }, []);

  const showLocalNotification = useCallback(async (title, options = {}) => {
    if (!registration) return false;

    try {
      await registration.showNotification(title, {
        icon: '/icons/icon-192.svg',
        badge: '/icons/icon-192.svg',
        ...options
      });
      return true;
    } catch (error) {
      console.error('[PWA] Local notification failed:', error);
      return false;
    }
  }, [registration]);

  return {

    isInstalled,
    isOnline,
    canInstall,
    pushSupported,
    pushSubscribed,

    install,
    subscribePush,
    unsubscribePush,
    sendTestNotification,
    showLocalNotification
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  var base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default usePWA;
