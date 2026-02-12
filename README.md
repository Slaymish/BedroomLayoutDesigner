# Bedroom Layout Designer

Bedroom Layout Designer is a browser-based room planning app for creating and iterating on bedroom layouts.

## Current capabilities

- Multi-room workspace management.
- Room dimensions in `mm`, `cm`, `m`, `in`, or `ft` (state is stored in centimeters).
- Furniture and opening placement (doors/windows), rotation, and resize controls.
- Measurement line creation/editing with optional PDF inclusion.
- Undo/redo across workspace mutations.
- Local autosave with explicit workspace export/import (`.json`).
- PDF export for one room or all rooms.
- Offline support via service worker.

## Development commands

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
```

## SEO deployment notes

- `npm run build` now runs `npm run seo:assets` first.
- The SEO step generates `public/robots.txt`, `public/sitemap.xml`, and `public/llms.txt`.
- SEO assets default to `https://bedroomlayout.app/`.
- You can override the sitemap origin with `SITE_URL`, `URL`, `DEPLOY_PRIME_URL`, or `VITE_SITE_URL`.
