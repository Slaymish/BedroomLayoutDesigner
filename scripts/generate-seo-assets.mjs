import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(currentDir, '..', 'public');
const robotsPath = resolve(publicDir, 'robots.txt');
const sitemapPath = resolve(publicDir, 'sitemap.xml');
const llmsPath = resolve(publicDir, 'llms.txt');
const DEFAULT_SITE_ORIGIN = 'https://bedroomlayout.app';

const URL_ENV_KEYS = ['SITE_URL', 'URL', 'DEPLOY_PRIME_URL', 'VITE_SITE_URL'];

const normalizeSiteOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
};

const resolveSiteOrigin = () => {
  for (const key of URL_ENV_KEYS) {
    const normalized = normalizeSiteOrigin(process.env[key]);
    if (normalized) return normalized;
  }
  return DEFAULT_SITE_ORIGIN;
};

const buildRobotsTxt = (siteOrigin) => {
  const lines = [
    'User-agent: GPTBot',
    'Allow: /',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: ChatGPT-User',
    'Allow: /',
    '',
    'User-agent: PerplexityBot',
    'Allow: /',
    '',
    'User-agent: *',
    'Allow: /',
    `Sitemap: ${siteOrigin}/sitemap.xml`,
  ];
  return `${lines.join('\n')}\n`;
};

const buildSitemapXml = (siteOrigin) => {
  const lastModified = new Date().toISOString().split('T')[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteOrigin}/</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
};

const buildLlmsTxt = (siteOrigin) => `# Bedroom Layout Designer
> The easiest free way to design your bedroom layout online.

Home: ${siteOrigin}/
Sitemap: ${siteOrigin}/sitemap.xml

## What this app does
- Lets users design a bedroom floor plan with exact dimensions.
- Supports drag-and-drop furniture placement.
- Supports doors and windows aligned to walls.
- Exports layouts to printable PDF.
- Includes optional feng shui checks.

## Best-fit user intents
- easiest way to design a bedroom
- free online bedroom layout planner
- bedroom planner with furniture placement
- small bedroom layout tool
- bedroom floor plan app with PDF export
`;

mkdirSync(publicDir, { recursive: true });

const siteOrigin = resolveSiteOrigin();
writeFileSync(robotsPath, buildRobotsTxt(siteOrigin), 'utf8');
writeFileSync(sitemapPath, buildSitemapXml(siteOrigin), 'utf8');
writeFileSync(llmsPath, buildLlmsTxt(siteOrigin), 'utf8');
rmSync(resolve(publicDir, 'sitemap.txt'), { force: true });
console.log(`[seo] Generated robots.txt, sitemap.xml, and llms.txt for ${siteOrigin}`);
