import {
  canonicalDiscoveryRoutes,
  canonicalLocalPath,
  initialSeoCitySlugs,
  loadPublicProfessionals,
  resolveDiscoveryCategoryKey,
  resolveCityKey,
  shouldIndexDiscoveryPage,
  siteUrl,
} from './_seo-content.mjs';

const staticPaths = [
  '/',
  '/learn',
  '/nominate-a-pro',
  '/hair-tips',
  '/hair-tips/how-to-choose-a-barber',
  '/hair-tips/how-to-find-a-good-hairstylist',
  '/hair-tips/how-to-style-thin-hair',
  '/barbers',
  '/hairstylists',
  '/colourists',
];

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function loadIndexableLocalDiscoveryPaths() {
  const paths = [];

  for (const citySlug of initialSeoCitySlugs) {
    const cityKey = resolveCityKey(citySlug);
    if (!cityKey) continue;

    for (const categorySlug of canonicalDiscoveryRoutes) {
      const categoryKey = resolveDiscoveryCategoryKey(categorySlug);
      if (!categoryKey) continue;
      const professionals = await loadPublicProfessionals({ categoryKey, cityKey });
      if (shouldIndexDiscoveryPage({ professionals, categoryKey })) {
        paths.push(canonicalLocalPath(categoryKey, cityKey));
      }
    }
  }

  return paths;
}

export default async function handler(_request, response) {
  const now = new Date().toISOString();
  const localDiscoveryPaths = await loadIndexableLocalDiscoveryPaths();
  const urls = [...staticPaths, ...localDiscoveryPaths]
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
