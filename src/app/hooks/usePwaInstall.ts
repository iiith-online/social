import { useCallback, useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = typeof window !== 'undefined' && isStandalone();
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((subscriber) => subscriber());
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notifySubscribers();
  });
}

export const usePwaInstall = () => {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const subscriber = () => forceUpdate((value) => value + 1);
    subscribers.add(subscriber);
    return () => {
      subscribers.delete(subscriber);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;

    const prompt = deferredPrompt;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') installed = true;
    notifySubscribers();
  }, []);

  return {
    isInstalled: installed,
    canInstall: !installed && deferredPrompt !== null,
    install,
  };
};
