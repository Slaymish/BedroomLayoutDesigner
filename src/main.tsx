import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

declare const __APP_BUILD_ID__: string;
const CANONICAL_ORIGIN = 'https://bedroomlayout.app';

const setSeoUrls = () => {
  const canonicalUrl = new URL('/', CANONICAL_ORIGIN).toString();
  let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.append(canonicalLink);
  }
  canonicalLink.href = canonicalUrl;

  const ogUrlTag = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (ogUrlTag) {
    ogUrlTag.content = canonicalUrl;
  }
};

setSeoUrls();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(__APP_BUILD_ID__)}`)
  })
}
