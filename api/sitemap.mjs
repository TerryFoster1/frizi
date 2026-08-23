import { siteUrl } from './_seo-content.mjs';

const staticPaths = [
  '/',
  '/learn',
  '/nominate-a-pro',
  '/hair-tips',
  '/barbers/kitchener-on',
  '/hairstylists/kitchener-on',
  '/colourists/kitchener-on',
  '/balayage/kitchener-on',
  '/beard-grooming/kitchener-on',
];

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export default function handler(_request, response) {
  const now = new Date().toISOString();
  const urls = staticPaths
    .map(
      (path) =>
        `<url><loc>${xmlEscape(`${siteUrl}${path}`)}</loc><lastmod>${now}</lastmod></url>`,
    )
    .join('');
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/xml; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
  response.end(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
  );
}
