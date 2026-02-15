import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import RouteExperience from './RouteExperience'

declare const __APP_BUILD_ID__: string;
const CANONICAL_ORIGIN = 'https://bedroomlayout.app';
const SEO_PREVIEW_IMAGE = `${CANONICAL_ORIGIN}/seo-preview.svg`;
const SOFTWARE_FEATURE_LIST = [
  'Exact room dimensions in metric and imperial units',
  'Drag-and-drop furniture, doors, and windows',
  'Multi-room planning',
  'PDF export for sharing and printing',
  'Optional feng shui layout checks',
];
const SOFTWARE_KEYWORDS = [
  'bedroom layout planner',
  'free online bedroom planner',
  'bedroom planner with exact dimensions',
  'furniture layout planner',
  'bedroom floor plan app',
  'bedroom planner with PDF export',
];

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    plausible?: (eventName: string, options?: { props?: AnalyticsParams }) => void;
  }
}

type AppRoute = 'landing' | 'planner';
type AnalyticsPrimitive = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsPrimitive>;
type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'bedroom-layout-designer:v1';

const readStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'system';
    const parsed = JSON.parse(raw) as { preferences?: { themeMode?: unknown } };
    const mode = parsed.preferences?.themeMode;
    if (mode === 'light' || mode === 'dark' || mode === 'system') {
      return mode;
    }
  } catch {
    // Ignore malformed local storage payloads and use system preference.
  }

  return 'system';
};

const resolveThemeFromMode = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

const applyThemePreference = () => {
  const resolvedTheme = resolveThemeFromMode(readStoredThemeMode());
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
};

interface RouteSeoConfig {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  canonicalPath: string;
  schema: Record<string, unknown>;
}

const resolveRoute = (pathname: string): AppRoute => {
  if (pathname === '/app' || pathname.startsWith('/app/')) {
    return 'planner';
  }
  return 'landing';
};

const buildLandingSchema = (): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Bedroom Layout Planner',
      url: `${CANONICAL_ORIGIN}/`,
      inLanguage: 'en-US',
      description: 'Free online bedroom layout planner for exact room measurements, furniture fit checks, and printable PDF export.',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Bedroom Layout Planner',
      alternateName: 'Bedroom Layout Designer',
      url: `${CANONICAL_ORIGIN}/app`,
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Any',
      inLanguage: 'en-US',
      browserRequirements: 'Requires JavaScript',
      description: 'Free online bedroom layout planner with exact dimensions, drag-and-drop furniture placement, and printable PDF export.',
      image: SEO_PREVIEW_IMAGE,
      isAccessibleForFree: true,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: SOFTWARE_FEATURE_LIST,
      keywords: SOFTWARE_KEYWORDS,
    },
  ],
});

const buildPlannerSchema = (): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Bedroom Layout Planner',
  alternateName: 'Bedroom Layout Designer',
  url: `${CANONICAL_ORIGIN}/app`,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Any',
  inLanguage: 'en-US',
  browserRequirements: 'Requires JavaScript',
  description: 'Plan a bedroom with exact dimensions, furniture placement tools, and printable PDF export.',
  image: SEO_PREVIEW_IMAGE,
  isAccessibleForFree: true,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  featureList: SOFTWARE_FEATURE_LIST,
  keywords: SOFTWARE_KEYWORDS,
});

const ROUTE_SEO: Record<AppRoute, RouteSeoConfig> = {
  landing: {
    title: 'Bedroom Layout Planner With Exact Measurements | Free Online Tool',
    description: 'Design a bedroom layout that actually fits. Enter exact room dimensions, place furniture and openings, and export a printable PDF floor plan. Free with no sign-up.',
    keywords: 'bedroom layout planner, free online bedroom planner, bedroom planner with exact dimensions, furniture layout planner, bedroom floor plan app, bedroom planner with PDF export, no signup bedroom planner',
    ogTitle: 'Bedroom Layout Planner With Exact Measurements',
    ogDescription: 'Check what will fit before you move anything. Plan exact room dimensions, drag furniture, place doors/windows, and export a printable PDF.',
    twitterTitle: 'Bedroom Layout Planner With Exact Measurements',
    twitterDescription: 'Design a bedroom layout that actually fits with exact room sizing, drag-and-drop furniture, and printable PDF export.',
    canonicalPath: '/',
    schema: buildLandingSchema(),
  },
  planner: {
    title: 'Bedroom Layout Planner App | Start Designing Your Room',
    description: 'Open the planner to design your bedroom with exact measurements, furniture placement tools, and printable PDF export.',
    keywords: 'bedroom layout planner app, bedroom furniture planner, bedroom design tool, room planner with pdf export',
    ogTitle: 'Bedroom Layout Planner App',
    ogDescription: 'Use the planner to test exact room dimensions and furniture placement before you move or buy.',
    twitterTitle: 'Bedroom Layout Planner App',
    twitterDescription: 'Open the bedroom planning workspace and build an exact furniture layout with printable export.',
    canonicalPath: '/app',
    schema: buildPlannerSchema(),
  },
};

const setMetaByName = (name: string, content: string) => {
  const tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (tag) {
    tag.content = content;
  }
};

const setMetaByProperty = (property: string, content: string) => {
  const tag = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (tag) {
    tag.content = content;
  }
};

const setSeoForRoute = (route: AppRoute) => {
  const config = ROUTE_SEO[route];
  const canonicalUrl = new URL(config.canonicalPath, CANONICAL_ORIGIN).toString();

  document.title = config.title;
  setMetaByName('description', config.description);
  setMetaByName('keywords', config.keywords);
  setMetaByName('twitter:title', config.twitterTitle);
  setMetaByName('twitter:description', config.twitterDescription);
  setMetaByProperty('og:title', config.ogTitle);
  setMetaByProperty('og:description', config.ogDescription);
  setMetaByProperty('og:url', canonicalUrl);

  let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.append(canonicalLink);
  }
  canonicalLink.href = canonicalUrl;

  let routeSchemaScript = document.querySelector<HTMLScriptElement>('#route-structured-data');
  if (!routeSchemaScript) {
    routeSchemaScript = document.createElement('script');
    routeSchemaScript.id = 'route-structured-data';
    routeSchemaScript.type = 'application/ld+json';
    document.head.append(routeSchemaScript);
  }
  routeSchemaScript.textContent = JSON.stringify(config.schema);
};

const trackAnalyticsEvent = (eventName: string, params: AnalyticsParams) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
  if (typeof window.plausible === 'function') {
    window.plausible(eventName, { props: params });
  }
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: eventName, ...params });
  }
  window.dispatchEvent(new CustomEvent('bedroomlayout:analytics', { detail: { eventName, params } }));
};

const route = resolveRoute(window.location.pathname);
applyThemePreference();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouteExperience
      initialRoute={route}
      onSetSeoForRoute={setSeoForRoute}
      onTrackAnalyticsEvent={trackAnalyticsEvent}
    />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`/sw.js?build=${encodeURIComponent(__APP_BUILD_ID__)}`)
  })
}
