import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  canonicalDiscoveryRoutes,
  canonicalLocalPath,
  cityPages,
  initialSeoCitySlugs,
  resolveDiscoveryCategoryKey,
  resolveCityKey,
  shouldIndexDiscoveryPage,
} from '../api/_seo-content.mjs';

const vercelConfig = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
const sitemapSource = readFileSync(new URL('../api/sitemap.mjs', import.meta.url), 'utf8');
const seoPageSource = readFileSync(new URL('../api/seo-page.mjs', import.meta.url), 'utf8');

test('initial local SEO market includes Kitchener, Waterloo, Cambridge, and Guelph', () => {
  assert.deepEqual(initialSeoCitySlugs, ['kitchener', 'waterloo', 'cambridge', 'guelph']);

  for (const citySlug of initialSeoCitySlugs) {
    const cityKey = resolveCityKey(citySlug);
    assert.ok(cityKey, `${citySlug} should resolve to a canonical city key`);
    assert.ok(cityPages[cityKey], `${citySlug} should map to city metadata`);
  }
});

test('city-first local discovery URLs are canonical for launch markets', () => {
  assert.equal(canonicalLocalPath('barbers', 'kitchener-on'), '/kitchener/barbers');
  assert.equal(canonicalLocalPath('hairstylists', 'waterloo-on'), '/waterloo/hair-stylists');
  assert.equal(canonicalLocalPath('fine-hair', 'waterloo-on'), '/waterloo/fine-hair-stylists');
  assert.equal(canonicalLocalPath('balayage', 'guelph-on'), '/guelph/balayage');
  assert.match(seoPageSource, /resolveCityKey\(categoryOrReview\)/);
  assert.equal(resolveDiscoveryCategoryKey('hair-stylists'), 'hairstylists');
  assert.equal(resolveDiscoveryCategoryKey('fine-hair-stylists'), 'fine-hair');
  assert.match(seoPageSource, /canonicalLocalPath\(categoryKey, cityKey\)/);
});

test('sitemap can generate launch city-first local discovery routes without listing thin pages', () => {
  assert.match(sitemapSource, /initialSeoCitySlugs/);
  assert.match(sitemapSource, /canonicalDiscoveryRoutes/);
  assert.match(sitemapSource, /loadPublicProfessionals/);
  assert.match(sitemapSource, /shouldIndexDiscoveryPage/);

  for (const citySlug of initialSeoCitySlugs) {
    assert.match(vercelConfig, new RegExp(`"source": "\\/${citySlug}\\/:category"`));
  }
});

test('thin local discovery pages stay noindex until useful inventory exists', () => {
  assert.equal(
    shouldIndexDiscoveryPage({ categoryKey: 'barbers', professionals: [{}, {}] }),
    false,
  );
  assert.equal(
    shouldIndexDiscoveryPage({ categoryKey: 'barbers', professionals: [{}, {}, {}] }),
    true,
  );
  assert.equal(
    shouldIndexDiscoveryPage({ categoryKey: 'balayage', professionals: [{}] }),
    false,
  );
  assert.equal(
    shouldIndexDiscoveryPage({ categoryKey: 'balayage', professionals: [{}, {}] }),
    true,
  );
});

test('Vercel serves canonical SEO pages without catching app routes', () => {
  assert.match(vercelConfig, /"source": "\/kitchener\/:category"/);
  assert.match(vercelConfig, /"source": "\/waterloo\/:category"/);
  assert.match(vercelConfig, /"source": "\/cambridge\/:category"/);
  assert.match(vercelConfig, /"source": "\/guelph\/:category"/);
  assert.match(vercelConfig, /"source": "\/salon\/:slug"/);
  assert.match(vercelConfig, /"source": "\/invite\/:token"[\s\S]*"destination": "\/index\.html"/);
});
