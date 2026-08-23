import { createSupabaseClient, isSupabaseConfigured } from './_supabase.mjs';

export const siteUrl = 'https://frizi.ca';

export const faqItems = [
  {
    question: 'What is Frizi?',
    answer:
      'Frizi helps clients find local hair professionals, book directly, message their pro, and keep a portable hair profile with preferences and photos.',
  },
  {
    question: 'Can I search before creating an account?',
    answer:
      'Yes. You can search and review public professional profiles before signing in. You only need an account when you want to save, connect, message, or book.',
  },
  {
    question: 'Does Frizi replace my salon or barber?',
    answer:
      'No. Frizi helps you find and stay connected with the professional you choose. The relationship remains between you and your hair professional.',
  },
  {
    question: 'Can I book directly with a professional?',
    answer:
      'Yes. When a professional is live and bookable on Frizi, you can see available services and times, then book directly through Frizi.',
  },
  {
    question: 'Can I message my hair professional?',
    answer:
      'Yes. Frizi is designed so connected clients and professionals can keep appointment, preference, and hair-care communication in one place.',
  },
  {
    question: 'What is a Hair Passport?',
    answer:
      'Your Hair Passport is your client profile for hair photos, preferences, inspiration photos, notes, and appointment history that can move with you.',
  },
  {
    question: 'Are reviews real?',
    answer:
      'Frizi is built around verified professional relationships and real appointments. Public review pages should only show real review data when it exists.',
  },
  {
    question: 'What happens if no professionals are available near me yet?',
    answer:
      'You can nominate a professional in your area. Frizi will not show fake professionals or fake rankings to fill empty results.',
  },
];

export const learnSections = [
  {
    title: 'Find the right Pro',
    body: 'Search by service, style, location, hair needs, and the kind of professional relationship you want.',
  },
  {
    title: 'Book directly',
    body: 'Choose from real services and availability when a professional is live and accepting online bookings.',
  },
  {
    title: 'Message your Pro',
    body: 'Keep appointment details, hair advice, and follow-up messages connected to the person who knows your hair.',
  },
  {
    title: 'Keep your Hair Profile',
    body: 'Save profile photos separately from inspiration photos so every appointment starts with better context.',
  },
  {
    title: 'Reviews belong to the professional',
    body: 'Frizi helps independent professionals build a reputation that can move with them as their career grows.',
  },
  {
    title: 'Discover specialists',
    body: 'Find professionals for curls, fades, colour, beard grooming, extensions, updos, fine hair, and other specific needs.',
  },
  {
    title: 'Products and recommendations',
    body: 'Product recommendations are planned as a Frizi feature. Product commerce remains clearly marked as Coming Soon until live.',
  },
  {
    title: 'FAQ',
    body: 'Answers to common questions are shown below and published with matching structured data for search engines.',
  },
];

export const cityPages = {
  'kitchener-on': { name: 'Kitchener', province: 'ON' },
  'waterloo-on': { name: 'Waterloo', province: 'ON' },
  'cambridge-on': { name: 'Cambridge', province: 'ON' },
  'toronto-on': { name: 'Toronto', province: 'ON' },
};

export const discoveryCategories = {
  barbers: {
    singular: 'barber',
    plural: 'barbers',
    terms: ['barber', 'barbering', 'fade', 'fades', 'beard', 'taper'],
    title: 'Barbers',
  },
  hairstylists: {
    singular: 'hairstylist',
    plural: 'hairstylists',
    terms: ['hairstylist', 'stylist', 'haircut', 'cut', 'style', 'blowout'],
    title: 'Hairstylists',
  },
  colourists: {
    singular: 'colourist',
    plural: 'colourists',
    terms: ['colourist', 'colorist', 'colour', 'color', 'highlights'],
    title: 'Colourists',
  },
  balayage: {
    singular: 'balayage specialist',
    plural: 'balayage specialists',
    terms: ['balayage', 'colourist', 'colorist', 'highlights'],
    title: 'Balayage specialists',
  },
  'beard-grooming': {
    singular: 'beard grooming professional',
    plural: 'beard grooming professionals',
    terms: ['beard', 'beard trim', 'grooming', 'barber'],
    title: 'Beard grooming',
  },
  'curly-hair': {
    singular: 'curly hair specialist',
    plural: 'curly hair specialists',
    terms: ['curly', 'curl', 'curls', 'texture', 'wavy'],
    title: 'Curly hair specialists',
  },
  'fine-hair': {
    singular: 'fine hair specialist',
    plural: 'fine hair specialists',
    terms: ['fine hair', 'thin hair', 'volume'],
    title: 'Fine hair specialists',
  },
  'beard-trim': {
    singular: 'beard trim professional',
    plural: 'beard trim professionals',
    terms: ['beard trim', 'beard', 'barber'],
    title: 'Beard trim professionals',
  },
  fades: {
    singular: 'fade specialist',
    plural: 'fade specialists',
    terms: ['fade', 'fades', 'barber', 'taper'],
    title: 'Fade specialists',
  },
  'hair-extensions': {
    singular: 'hair extensions specialist',
    plural: 'hair extensions specialists',
    terms: ['extensions', 'hair extensions', 'weave'],
    title: 'Hair extensions specialists',
  },
};

export const reviewCategories = {
  'barber-reviews': { baseCategory: 'barbers', title: 'Barber reviews' },
  'hairstylist-reviews': {
    baseCategory: 'hairstylists',
    title: 'Hairstylist reviews',
  },
  'colourist-reviews': {
    baseCategory: 'colourists',
    title: 'Colourist reviews',
  },
};

export const rankedCategories = {
  'best-barbers': { baseCategory: 'barbers', title: 'Best barbers' },
  'top-colourists': { baseCategory: 'colourists', title: 'Top colourists' },
};

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function canonical(pathname) {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  return `${siteUrl}${normalized}`;
}

export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function pageShell({
  title,
  description,
  pathname,
  robots = 'index, follow',
  body,
  jsonLd = [],
}) {
  const ld = jsonLd
    .filter(Boolean)
    .map(
      (entry) =>
        `<script type="application/ld+json">${JSON.stringify(entry).replaceAll('</script', '<\\/script')}</script>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${escapeHtml(canonical(pathname))}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical(pathname))}">
  <meta property="og:type" content="website">
  <style>
    :root { --gold:#c89b22; --on-gold:#17130c; --ink:#090807; --muted:#5f574f; --paper:#fffaf0; --surface:#fff; --line:rgba(23,19,12,.12); }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--paper); color:var(--ink); }
    a { color:inherit; }
    .page { width:min(920px, calc(100% - 32px)); margin:0 auto; padding:28px 0 76px; }
    .top { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 0 22px; }
    .brand { font-size:24px; font-weight:950; letter-spacing:.18em; text-decoration:none; }
    .cta, button { display:inline-flex; min-height:48px; align-items:center; justify-content:center; border:1px solid var(--ink); border-radius:12px; background:var(--ink); color:#fffaf0; padding:0 18px; font-weight:900; text-decoration:none; }
    .ghost { background:#fff; color:var(--ink); }
    h1 { margin:24px 0 14px; font-size:clamp(38px, 8vw, 70px); line-height:1.03; letter-spacing:0; }
    h2 { margin:34px 0 14px; font-size:clamp(26px, 5vw, 38px); line-height:1.1; }
    h3 { margin:0 0 8px; font-size:22px; }
    p, li { color:var(--muted); font-size:18px; line-height:1.55; }
    .lead { max-width:720px; color:#17130c; font-size:clamp(20px, 4vw, 26px); font-weight:650; }
    .grid { display:grid; gap:16px; }
    .card { border:1px solid var(--line); border-radius:18px; background:var(--surface); padding:22px; box-shadow:0 14px 34px rgba(23,19,12,.08); }
    .list { display:grid; gap:14px; margin-top:20px; }
    .pro { display:grid; gap:10px; }
    .tags { display:flex; flex-wrap:wrap; gap:8px; }
    .tag { border:1px solid var(--line); border-radius:999px; padding:7px 11px; font-size:14px; font-weight:800; color:#17130c; background:#fff; }
    .notice { border-left:5px solid var(--gold); background:#fff; padding:18px; border-radius:14px; }
    .faq dt { margin-top:18px; font-size:20px; font-weight:900; }
    .faq dd { margin:8px 0 0; color:var(--muted); font-size:17px; line-height:1.5; }
    label { display:grid; gap:7px; margin-top:14px; font-weight:900; }
    input, textarea, select { width:100%; min-height:48px; border:1px solid var(--line); border-radius:12px; padding:10px 12px; font:inherit; background:#fff; color:var(--ink); }
    textarea { min-height:112px; resize:vertical; }
    footer { margin-top:46px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted); }
    @media (max-width:560px) { .page { width:min(100% - 28px, 520px); } .top { align-items:flex-start; } .brand { font-size:20px; } }
  </style>
  ${ld}
</head>
<body>
  <main class="page">
    <nav class="top" aria-label="Frizi">
      <a class="brand" href="/">FRIZI</a>
      <a class="cta ghost" href="/nominate-a-pro">Nominate a pro</a>
    </nav>
    ${body}
    <footer>Frizi connects clients with real local hair professionals. Product commerce is Coming Soon.</footer>
  </main>
</body>
</html>`;
}

export function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}

export async function loadPublicProfessionals({ categoryKey, cityKey, slug }) {
  if (!isSupabaseConfigured()) return [];

  const supabase = createSupabaseClient();
  const profileQuery = supabase
    .from('frizi_professionals')
    .select(
      'id, public_slug, display_name, studio_name, bio, specialties, primary_specialty, profile_photo_url, hero_photo_url, public_profile_status, bookable, subscription_status, updated_at',
    )
    .eq('public_profile_status', 'published')
    .eq('bookable', true)
    .in('subscription_status', ['active', 'trialing'])
    .not('profile_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(24);

  if (slug) profileQuery.eq('public_slug', slug);

  const { data: profiles, error: profileError } = await profileQuery;
  if (profileError || !profiles?.length) return [];

  const ids = profiles.map((profile) => profile.id);
  const [{ data: locations }, { data: services }] = await Promise.all([
    supabase
      .from('frizi_professional_locations')
      .select('professional_id, city, province, service_radius_km')
      .in('professional_id', ids)
      .eq('primary_location', true)
      .eq('active', true)
      .eq('online_booking_enabled', true),
    supabase
      .from('frizi_services')
      .select(
        'professional_id, name, category, public_description, base_price_cents, pricing_type, online_booking_enabled, active, existing_clients_only, new_clients_allowed',
      )
      .in('professional_id', ids)
      .eq('active', true)
      .eq('online_booking_enabled', true)
      .eq('new_clients_allowed', true)
      .eq('existing_clients_only', false),
  ]);

  const category = categoryKey ? discoveryCategories[categoryKey] : null;
  const city = cityKey ? cityPages[cityKey] : null;

  return profiles
    .map((profile) => {
      const location = (locations || []).find(
        (candidate) => candidate.professional_id === profile.id,
      );
      const publicServices = (services || []).filter(
        (service) => service.professional_id === profile.id,
      );
      return { ...profile, location, services: publicServices };
    })
    .filter((profile) => {
      if (!profile.location || !profile.services.length) return false;
      if (city) {
        const sameCity =
          slugify(profile.location.city) === slugify(city.name) &&
          String(profile.location.province || '').toUpperCase() ===
            city.province;
        if (!sameCity) return false;
      }
      if (!category) return true;
      const searchable = [
        profile.display_name,
        profile.studio_name,
        profile.bio,
        profile.primary_specialty,
        ...(profile.specialties || []),
        ...profile.services.flatMap((service) => [
          service.name,
          service.category,
          service.public_description,
        ]),
      ]
        .join(' ')
        .toLowerCase();
      return category.terms.some((term) => searchable.includes(term));
    });
}

export function renderProfessionalList(professionals, emptyMessage) {
  if (!professionals.length) {
    return `<div class="notice"><p>${escapeHtml(emptyMessage)}</p><p><a class="cta" href="/nominate-a-pro">Nominate a professional</a></p></div>`;
  }

  return `<div class="list">${professionals
    .map((pro) => {
      const city = pro.location
        ? `${pro.location.city}, ${pro.location.province}`
        : 'Location available in Frizi';
      const href = pro.public_slug
        ? `/pro/${pro.public_slug}`
        : `/pro/${slugify(`${pro.display_name}-${city}`)}`;
      const tags = [
        ...(pro.specialties || []),
        ...pro.services.slice(0, 2).map((service) => service.name),
      ]
        .filter(Boolean)
        .slice(0, 5);
      return `<article class="card pro">
        <h3><a href="${escapeHtml(href)}">${escapeHtml(pro.display_name)}</a></h3>
        <p><strong>${escapeHtml(pro.studio_name || 'Independent professional')}</strong> in ${escapeHtml(city)}</p>
        ${pro.bio ? `<p>${escapeHtml(pro.bio)}</p>` : ''}
        <div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
      </article>`;
    })
    .join('')}</div>`;
}
