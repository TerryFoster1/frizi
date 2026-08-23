import {
  breadcrumbJsonLd,
  cityPages,
  discoveryCategories,
  escapeHtml,
  faqItems,
  faqJsonLd,
  learnSections,
  loadPublicProfessionals,
  pageShell,
  rankedCategories,
  renderProfessionalList,
  reviewCategories,
  slugify,
} from './_seo-content.mjs';

function sendHtml(response, statusCode, html) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  response.end(html);
}

function routePath(request) {
  const host = request.headers.host || 'frizi.ca';
  const url = new URL(request.url || '/', `https://${host}`);
  const explicit = url.searchParams.get('path');
  if (explicit) return explicit.startsWith('/') ? explicit : `/${explicit}`;
  if (url.searchParams.get('section') === 'hair-tips') {
    return `/hair-tips/${url.searchParams.get('slug') || ''}`.replace(
      /\/$/,
      '',
    );
  }
  return url.pathname;
}

function renderLearnPage(pathname) {
  const body = `
    <h1>Find the right hair professional-and keep them.</h1>
    <p class="lead">Frizi helps clients discover local hair professionals, book directly, and keep their hair profile connected to the person doing the work.</p>
    <div class="grid">
      ${learnSections
        .map(
          (section) => `<section class="card">
            <h2>${escapeHtml(section.title)}</h2>
            <p>${escapeHtml(section.body)}</p>
          </section>`,
        )
        .join('')}
    </div>
    <section>
      <h2>FAQ</h2>
      <dl class="faq">
        ${faqItems
          .map(
            (item) =>
              `<dt>${escapeHtml(item.question)}</dt><dd>${escapeHtml(item.answer)}</dd>`,
          )
          .join('')}
      </dl>
    </section>
  `;

  return pageShell({
    title: 'Learn about Frizi | Find and keep your hair professional',
    description:
      'Learn how Frizi helps clients find local hair professionals, book directly, message their pro, keep a Hair Passport, and discover specialists.',
    pathname,
    body,
    jsonLd: [
      faqJsonLd(),
      breadcrumbJsonLd([
        { name: 'Frizi', path: '/' },
        { name: 'Learn', path: '/learn' },
      ]),
    ],
  });
}

function renderNominationPage(pathname, success = false) {
  const body = `
    <h1>Nominate a professional</h1>
    <p class="lead">If your favourite barber, stylist, colourist, or beauty professional is not on Frizi yet, tell us who we should invite.</p>
    ${
      success
        ? '<div class="notice"><p>Thanks. We received your nomination.</p></div>'
        : ''
    }
    <form class="card" action="/api/nominate-a-pro" method="post">
      <label>Professional name<input name="professional_name" required maxlength="140"></label>
      <label>Salon or studio name<input name="salon_name" maxlength="140"></label>
      <label>City<input name="city" required maxlength="100" placeholder="Kitchener"></label>
      <label>Type of professional
        <select name="professional_type" required>
          <option value="Barber">Barber</option>
          <option value="Hairstylist">Hairstylist</option>
          <option value="Colourist">Colourist</option>
          <option value="Braider">Braider</option>
          <option value="Other beauty professional">Other beauty professional</option>
        </select>
      </label>
      <label>Why should they be on Frizi?<textarea name="recommendation_reason" maxlength="800"></textarea></label>
      <label>How can we find them? <input name="contact_detail" maxlength="220" placeholder="Instagram, website, phone, or email"></label>
      <label>Your email <input name="nominator_email" type="email" maxlength="220"></label>
      <input type="hidden" name="source_path" value="${escapeHtml(pathname)}">
      <p><button type="submit">Send nomination</button></p>
    </form>
  `;

  return pageShell({
    title: 'Nominate a hair professional | Frizi',
    description:
      'Nominate a local hair professional, barber, stylist, colourist, or beauty professional for Frizi.',
    pathname,
    body,
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Frizi', path: '/' },
        { name: 'Nominate a professional', path: '/nominate-a-pro' },
      ]),
    ],
  });
}

function renderHairTips(pathname) {
  const body = `
    <h1>Hair tips</h1>
    <p class="lead">Frizi hair tips will focus on practical, professional-informed guidance for choosing services, preparing for appointments, and keeping your Hair Passport useful.</p>
    <div class="grid">
      <article class="card"><h2>Choosing a professional</h2><p>Learn what to look for when comparing services, specialties, portfolios, and availability.</p></article>
      <article class="card"><h2>Preparing for a booking</h2><p>Bring clear inspiration photos, note what has worked before, and keep your goals in your Hair Passport.</p></article>
      <article class="card"><h2>Product recommendations</h2><p>Product commerce is Coming Soon. Frizi will only publish product guidance when it is ready to support the client experience properly.</p></article>
    </div>
  `;

  return pageShell({
    title: 'Hair tips | Frizi',
    description:
      'Hair tips and appointment guidance from Frizi. Product commerce remains Coming Soon until the feature is live.',
    pathname,
    body,
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Frizi', path: '/' },
        { name: 'Hair tips', path: '/hair-tips' },
      ]),
    ],
  });
}

function renderHairTipStub(pathname) {
  const slug = pathname.split('/').filter(Boolean).at(-1) || 'hair-tip';
  const readable = slug.replaceAll('-', ' ');
  const body = `
    <h1>${escapeHtml(readable.charAt(0).toUpperCase() + readable.slice(1))}</h1>
    <div class="notice">
      <p>This Frizi hair-tip page is reserved for future editorial content. We are not publishing thin or fabricated articles before the real guidance is ready.</p>
    </div>
    <p><a class="cta" href="/hair-tips">Back to hair tips</a></p>
  `;

  return pageShell({
    title: `${readable} | Frizi hair tips`,
    description:
      'This Frizi hair-tip page is reserved for future professional-informed content.',
    pathname,
    robots: 'noindex, follow',
    body,
  });
}

async function renderDiscoveryPage(
  pathname,
  categoryKey,
  cityKey,
  options = {},
) {
  const city = cityPages[cityKey];
  const category = discoveryCategories[categoryKey];
  if (!city || !category) return null;

  const professionals = await loadPublicProfessionals({ categoryKey, cityKey });
  const hasResults = professionals.length > 0;
  const locationLabel = `${city.name}, ${city.province}`;
  const titlePrefix = options.title || category.title;
  const transparentRankCopy = options.ranked
    ? '<p class="notice">Frizi only shows real live professionals here. We do not fabricate rankings, ratings, or reviews to fill a page.</p>'
    : '';
  const reviewCopy = options.review
    ? '<p class="notice">Review pages will show real review data when professionals have verified Frizi reviews. No fake ratings are shown.</p>'
    : '';

  const body = `
    <h1>${escapeHtml(titlePrefix)} in ${escapeHtml(locationLabel)}</h1>
    <p class="lead">Find local ${escapeHtml(category.plural)} on Frizi and book directly when real availability is open.</p>
    ${transparentRankCopy}
    ${reviewCopy}
    ${renderProfessionalList(
      professionals,
      `Frizi does not have live ${category.plural} in ${locationLabel} yet.`,
    )}
  `;

  return pageShell({
    title: `${titlePrefix} in ${locationLabel} | Frizi`,
    description: `Find ${category.plural} in ${locationLabel} on Frizi. Frizi shows real live professionals only, with no fake rankings or filler profiles.`,
    pathname,
    robots: hasResults ? 'index, follow' : 'noindex, follow',
    body,
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Frizi', path: '/' },
        { name: titlePrefix, path: pathname },
      ]),
      hasResults
        ? {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: professionals.map((pro, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: pro.display_name,
              url: pro.public_slug
                ? `https://frizi.ca/pro/${pro.public_slug}`
                : undefined,
            })),
          }
        : null,
    ],
  });
}

async function renderProfessionalPage(pathname) {
  const slug = pathname.split('/').filter(Boolean).at(-1);
  if (!slug) return null;

  const professionals = await loadPublicProfessionals({ slug });
  const pro = professionals[0];
  if (!pro) {
    return pageShell({
      title: 'Professional not found | Frizi',
      description:
        'This Frizi professional profile is not currently public or bookable.',
      pathname,
      robots: 'noindex, follow',
      body: '<h1>Professional not found</h1><div class="notice"><p>This profile is not currently public or bookable on Frizi.</p></div>',
    });
  }

  const location = pro.location
    ? `${pro.location.city}, ${pro.location.province}`
    : 'Canada';
  const services = pro.services
    .map(
      (service) =>
        `<li>${escapeHtml(service.name)}${
          service.base_price_cents
            ? ` - from $${(Number(service.base_price_cents) / 100).toFixed(0)} CAD`
            : ''
        }</li>`,
    )
    .join('');

  const body = `
    <h1>${escapeHtml(pro.display_name)}</h1>
    <p class="lead">${escapeHtml(pro.studio_name || 'Independent professional')} in ${escapeHtml(location)}</p>
    ${pro.bio ? `<p>${escapeHtml(pro.bio)}</p>` : ''}
    <section class="card">
      <h2>Services</h2>
      <ul>${services}</ul>
      <p><a class="cta" href="/">Open Frizi to book</a></p>
    </section>
  `;

  return pageShell({
    title: `${pro.display_name} | Frizi`,
    description: `${pro.display_name} is a Frizi professional in ${location}. View public services and book through Frizi when availability is open.`,
    pathname,
    body,
    jsonLd: [
      breadcrumbJsonLd([
        { name: 'Frizi', path: '/' },
        { name: pro.display_name, path: pathname },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: pro.display_name,
        description: pro.bio || undefined,
        address: pro.location
          ? {
              '@type': 'PostalAddress',
              addressLocality: pro.location.city,
              addressRegion: pro.location.province,
              addressCountry: 'CA',
            }
          : undefined,
      },
    ],
  });
}

export default async function handler(request, response) {
  const pathname = routePath(request).replace(/\/+$/, '') || '/';
  const segments = pathname.split('/').filter(Boolean);

  try {
    if (pathname === '/learn')
      return sendHtml(response, 200, renderLearnPage(pathname));
    if (pathname === '/nominate-a-pro') {
      const success =
        new URL(
          request.url || '/',
          `https://${request.headers.host || 'frizi.ca'}`,
        ).searchParams.get('success') === '1';
      return sendHtml(response, 200, renderNominationPage(pathname, success));
    }
    if (pathname === '/hair-tips')
      return sendHtml(response, 200, renderHairTips(pathname));
    if (segments[0] === 'hair-tips')
      return sendHtml(response, 200, renderHairTipStub(pathname));
    if (segments[0] === 'pro') {
      return sendHtml(response, 200, await renderProfessionalPage(pathname));
    }

    const [categoryOrReview, cityKey] = segments;
    if (discoveryCategories[categoryOrReview]) {
      const html = await renderDiscoveryPage(
        pathname,
        categoryOrReview,
        cityKey,
      );
      if (html) return sendHtml(response, 200, html);
    }

    if (reviewCategories[categoryOrReview]) {
      const review = reviewCategories[categoryOrReview];
      const html = await renderDiscoveryPage(
        pathname,
        review.baseCategory,
        cityKey,
        {
          title: review.title,
          review: true,
        },
      );
      if (html) return sendHtml(response, 200, html);
    }

    if (rankedCategories[categoryOrReview]) {
      const ranked = rankedCategories[categoryOrReview];
      const html = await renderDiscoveryPage(
        pathname,
        ranked.baseCategory,
        cityKey,
        {
          title: ranked.title,
          ranked: true,
        },
      );
      if (html) return sendHtml(response, 200, html);
    }

    return sendHtml(
      response,
      404,
      pageShell({
        title: 'Page not found | Frizi',
        description: 'This Frizi page could not be found.',
        pathname,
        robots: 'noindex, follow',
        body: '<h1>Page not found</h1><p>This Frizi page could not be found.</p>',
      }),
    );
  } catch (error) {
    console.error('frizi_seo_page_error', {
      pathname,
      message: error instanceof Error ? error.message : String(error),
    });
    return sendHtml(
      response,
      500,
      pageShell({
        title: 'Frizi page unavailable',
        description: 'This Frizi page is temporarily unavailable.',
        pathname,
        robots: 'noindex, follow',
        body: '<h1>Page temporarily unavailable</h1><p>Please try again shortly.</p>',
      }),
    );
  }
}
