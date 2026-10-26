import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Engine, outputSize } from './engine/engine';
import * as exporter from './export/exporter';
import * as generator from './generator/generator';
import { assets } from './storage/models';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Gancho para las pruebas automáticas de exportación (tests/export.test.mjs).
if (new URLSearchParams(location.search).has('test')) {
  (window as unknown as Record<string, unknown>).__sms = { ...exporter, ...generator, assets, Engine, outputSize };
}
