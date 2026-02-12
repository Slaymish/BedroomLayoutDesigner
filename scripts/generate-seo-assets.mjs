import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(currentDir, '..', 'public');
const robotsPath = resolve(publicDir, 'robots.txt');
const sitemapPath = resolve(publicDir, 'sitemap.xml');
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
  const lines = ['User-agent: *', 'Allow: /'];
  if (siteOrigin) {
    lines.push(`Sitemap: ${siteOrigin}/sitemap.xml`);
  }
  return `${lines.join('\n')}\n`;
};

const buildSitemapXml = (siteOrigin) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteOrigin}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

mkdirSync(publicDir, { recursive: true });

const siteOrigin = resolveSiteOrigin();
writeFileSync(robotsPath, buildRobotsTxt(siteOrigin), 'utf8');
writeFileSync(sitemapPath, buildSitemapXml(siteOrigin), 'utf8');
rmSync(resolve(publicDir, 'sitemap.txt'), { force: true });
console.log(`[seo] Generated robots.txt and sitemap.xml for ${siteOrigin}`);
