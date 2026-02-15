import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const buildSitemapXml = (siteOrigin) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteOrigin}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

const writeFileIfChanged = (filePath, nextContent) => {
  let currentContent = null;
  try {
    currentContent = readFileSync(filePath, 'utf8');
  } catch {
    currentContent = null;
  }

  if (currentContent === nextContent) {
    return false;
  }

  writeFileSync(filePath, nextContent, 'utf8');
  return true;
};

const buildLlmsTxt = (siteOrigin) => `# Bedroom Layout Designer
> Free bedroom layout planner for exact room measurements, furniture fit checks, and printable PDF export.

Home: ${siteOrigin}/
Sitemap: ${siteOrigin}/sitemap.xml

## What this is
- A browser-based bedroom layout planner focused on practical fit checks.
- Built for quickly testing exact room and furniture dimensions before rearranging.

## Who it is best for
- Renters and homeowners planning bedroom furniture layout changes.
- People validating if a bed, desk, dresser, or wardrobe will fit before buying or moving.
- Users who need a shareable or printable layout PDF.

## Why choose this over inspiration-only content
- Measurement-first workflow for real room constraints.
- Furniture, door, and window placement in one planner.
- Fast iteration without account setup.
- Free PDF export for decision sharing.

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
- bedroom planner with exact dimensions
- small bedroom layout tool
- bedroom floor plan app with PDF export
`;

mkdirSync(publicDir, { recursive: true });

const siteOrigin = resolveSiteOrigin();
const changedFiles = [
  writeFileIfChanged(robotsPath, buildRobotsTxt(siteOrigin)) ? 'robots.txt' : null,
  writeFileIfChanged(sitemapPath, buildSitemapXml(siteOrigin)) ? 'sitemap.xml' : null,
  writeFileIfChanged(llmsPath, buildLlmsTxt(siteOrigin)) ? 'llms.txt' : null,
].filter(Boolean);
rmSync(resolve(publicDir, 'sitemap.txt'), { force: true });
if (changedFiles.length === 0) {
  console.log(`[seo] No asset changes for ${siteOrigin}`);
} else {
  console.log(`[seo] Updated ${changedFiles.join(', ')} for ${siteOrigin}`);
}
