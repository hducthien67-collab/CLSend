import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker immediately so Chromium enables the Omnibox install icon [🖥️↓]
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info('PWA content refreshed');
  },
  onOfflineReady() {
    console.info('PWA ready for offline operation');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

