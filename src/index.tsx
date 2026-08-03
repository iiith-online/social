/* eslint-disable import/first */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { enableMapSet } from 'immer';
import '@fontsource/inter/variable.css';
import 'folds/dist/style.css';
import { configClass, varsClass } from 'folds';

enableMapSet();

import './index.css';

import { trimTrailingSlash } from './app/utils/common';
import App from './app/pages/App';

// import i18n (needs to be bundled ;))
import './app/i18n';
import { pushSessionToSW } from './sw-session';
import { getFallbackSession } from './app/state/sessions';

document.body.classList.add(configClass, varsClass);

const redactAnalyticsEvent = (event: BeforeSendEvent): BeforeSendEvent => {
  const url = new URL(event.url, window.location.origin);
  const section = url.pathname.split('/').filter(Boolean)[0];
  url.pathname = section ? `/${section}` : '/';
  url.search = '';
  url.hash = '';
  return { ...event, url: url.toString() };
};

// Register Service Worker
if ('serviceWorker' in navigator) {
  const swUrl =
    import.meta.env.MODE === 'production'
      ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
      : `/dev-sw.js?dev-sw`;

  const sendSessionToSW = () => {
    const session = getFallbackSession();
    pushSessionToSW(session?.baseUrl, session?.accessToken);
  };

  navigator.serviceWorker.register(swUrl).then(sendSessionToSW);
  navigator.serviceWorker.ready.then(sendSessionToSW);

  navigator.serviceWorker.addEventListener('message', (ev) => {
    const { type } = ev.data ?? {};

    if (type === 'requestSession') {
      sendSessionToSW();
    }
  });
}

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    console.error('Root container element not found!');
    return;
  }

  const root = createRoot(rootContainer);
  root.render(
    <>
      <App />
      <Analytics
        mode={import.meta.env.PROD ? 'production' : 'development'}
        beforeSend={redactAnalyticsEvent}
      />
      <SpeedInsights />
    </>
  );
};

mountApp();
