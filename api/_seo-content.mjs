import { createSupabaseClient, isSupabaseConfigured } from './_supabase.mjs';
import { isPubliclyBookableProfessional } from './_entitlements.mjs';

export const siteUrl = 'https://frizi.ca';

export const faqItems = [
  {
    question: 'What is Frizi?',
    answer:
      'Frizi helps you find, connect with and book hair professionals directly. Search for barbers, hairstylists, colourists and other hair professionals by service, specialty or your specific needs, then keep the relationship in one place.',
  },
  {
    question: 'How does Frizi help me find a hairstylist or barber?',
    answer:
      'Search Frizi by service, specialty or what you need help with. You can compare individual professionals, view their services and profiles, read reviews and find someone who fits your style.',
  },
  {
    question: 'Can I search for barbers near me?',
    answer:
      "Yes. Frizi is designed to help you discover local barbers and other hair professionals based on your location, the service you need and the professional's specialties.",
  },
  {
    question: 'Can I search for hairstylists by specialty?',
    answer:
      'Yes. Frizi can help you find professionals based on specialties and services such as colour, balayage, curly hair, fine hair, fades, beard grooming, extensions and more as matching professionals join the platform.',
  },
  {
    question: 'Can I search for a professional who understands my hair type?',
    answer:
      'Yes. Frizi professional profiles can include specialties and experience with different hair types and needs, helping you find someone whose skills match your hair.',
  },
  {
    question: 'Can I find curly hair specialists on Frizi?',
    answer:
      'Frizi allows professionals to identify specialties such as curly and textured hair so clients can find professionals with relevant experience. Availability depends on professionals currently listed in your area.',
  },
  {
    question: 'Can I find professionals experienced with fine or thin hair?',
    answer:
      'Yes. Professionals can list fine or thin hair among their specialties, making it easier to find someone who understands how to cut, style and work with your hair type.',
  },
  {
    question: 'Can I find beard grooming services?',
    answer:
      'Yes. Search Frizi for beard trims, beard grooming and related barber services to find professionals offering them near you.',
  },
  {
    question: 'Can I find colourists and balayage specialists?',
    answer:
      'Yes. Search by services and specialties such as hair colour, highlights, balayage and colour correction to find professionals who offer what you need.',
  },
  {
    question: 'Can I find LGBTQ+ friendly hair professionals?',
    answer:
      "Frizi can help clients discover professionals who have identified their services as LGBTQ+ welcoming. Frizi does not infer this information about professionals; it is based on the professional's own public profile and service information.",
  },
  {
    question: 'Can I find hijab-friendly or private hair services?',
    answer:
      "Professionals can identify options such as private appointments or hijab-friendly hair services on their Frizi profile. Always review the professional's information or message them before booking if you need a specific accommodation.",
  },
  {
    question: 'Can I search for wheelchair-accessible hair professionals?',
    answer:
      'Frizi can surface accessibility information provided by professionals, including wheelchair accessibility where available. You can also message the professional before booking to confirm your specific needs.',
  },
  {
    question: 'Can I book a haircut online with Frizi?',
    answer:
      'Yes. When a professional accepts online bookings through Frizi, you can choose a service, view available appointment times and request or book an appointment directly with that professional.',
  },
  {
    question: 'Do I need a Frizi account to book an appointment?',
    answer:
      'You can search before creating an account. A free Frizi account gives you appointment management, saved professionals, messages, reminders and your Hair Profile when you are ready to connect or book.',
  },
  {
    question: 'Can I message a barber or hairstylist before booking?',
    answer:
      'Frizi messaging lets clients communicate directly with connected professionals. This can be useful for questions about services, pricing, hair needs or what to expect before an appointment.',
  },
  {
    question: 'Can I ask a stylist questions before my appointment?',
    answer:
      'Yes. You can use Frizi messaging with supported professionals to ask questions about your appointment, service or hair before you arrive.',
  },
  {
    question: 'Can I cancel or change my appointment through Frizi?',
    answer:
      "Frizi appointment tools are designed to let clients manage bookings directly with their professional, including cancellations and appointment changes where supported by the professional's booking rules.",
  },
  {
    question: 'What is a Frizi Hair Profile?',
    answer:
      'Your Frizi Hair Profile keeps useful information about your hair and style in one place. It can include photos, inspiration and preferences that help your hair professional understand what you like before you sit down in the chair.',
  },
  {
    question: 'Can my hairstylist save notes about how I like my hair?',
    answer:
      'Frizi gives connected professionals tools to keep useful haircut and client notes so they can remember details such as your preferred length, styling preferences and previous services. Private professional CRM notes remain separate from information shared with the client.',
  },
  {
    question: 'Can I save inspiration photos for my hairstylist?',
    answer:
      'Yes. Your Hair Profile can include inspiration photos so you can show your professional the cuts, colours or styles you are considering.',
  },
  {
    question: 'Can my hair professional recommend products through Frizi?',
    answer:
      'Frizi is being built to help professionals recommend products based on what they know about their clients hair needs. Product shopping features may be marked Coming Soon until the Frizi product marketplace is live.',
  },
  {
    question: 'Are Frizi reviews for the salon or the individual professional?',
    answer:
      'Frizi is built around the individual professional. Reviews can help clients understand the person who will actually be working on their hair rather than relying only on reviews of the salon or shop.',
  },
  {
    question: 'Can I keep my reviews if my hairstylist changes salons?',
    answer:
      'Frizi professional profiles are designed around the individual professional, allowing their Frizi reputation and client relationships to stay connected to them as their career changes.',
  },
  {
    question: 'How do I find highly rated barbers near me?',
    answer:
      "Search Frizi for barbers in your area and compare individual professional profiles and available reviews. As Frizi's review network grows, local discovery pages will make it easier to compare professionals based on real client feedback.",
  },
  {
    question: 'How do I find the best hairstylist for my needs?',
    answer:
      'Start with the service you need, then consider specialties, portfolio photos, individual reviews, location and availability. The best fit is not always the same professional for everyone, which is why Frizi focuses on helping you choose the individual professional who fits your hair and style.',
  },
  {
    question: 'How do hair professionals join Frizi?',
    answer:
      'Hair professionals can create a Frizi Pro profile to manage bookings, connect with clients, build their professional reputation and make it easier for new clients to discover them.',
  },
  {
    question: 'Can I nominate my barber or hairstylist for Frizi?',
    answer:
      'Yes. If your favourite professional is not on Frizi yet, you can nominate them. Your nomination helps Frizi identify great local professionals that clients want to see on the platform.',
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
  'guelph-on': { name: 'Guelph', province: 'ON' },
  'london-on': { name: 'London', province: 'ON' },
  'hamilton-on': { name: 'Hamilton', province: 'ON' },
  'burlington-on': { name: 'Burlington', province: 'ON' },
  'oakville-on': { name: 'Oakville', province: 'ON' },
  'mississauga-on': { name: 'Mississauga', province: 'ON' },
  'brampton-on': { name: 'Brampton', province: 'ON' },
  'toronto-on': { name: 'Toronto', province: 'ON' },
  'vaughan-on': { name: 'Vaughan', province: 'ON' },
  'markham-on': { name: 'Markham', province: 'ON' },
  'richmond-hill-on': { name: 'Richmond Hill', province: 'ON' },
  'barrie-on': { name: 'Barrie', province: 'ON' },
  'kingston-on': { name: 'Kingston', province: 'ON' },
  'ottawa-on': { name: 'Ottawa', province: 'ON' },
  'windsor-on': { name: 'Windsor', province: 'ON' },
  'niagara-falls-on': { name: 'Niagara Falls', province: 'ON' },
  'st-catharines-on': { name: 'St. Catharines', province: 'ON' },
};

export const initialSeoCitySlugs = ['kitchener', 'waterloo', 'cambridge', 'guelph'];

export const citySlugAliases = Object.fromEntries(
  Object.entries(cityPages).flatMap(([key, city]) => [
    [key, key],
    [slugify(city.name), key],
    [slugify(`${city.name}-${city.province}`), key],
  ]),
);

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

export const canonicalDiscoveryRoutes = [
  'barbers',
  'hair-stylists',
  'colourists',
  'balayage',
  'beard-trim',
  'fades',
  'curly-hair-stylists',
  'fine-hair-stylists',
];

export const discoverySlugAliases = {
  barbers: 'barbers',
  hairstylists: 'hairstylists',
  'hair-stylists': 'hairstylists',
  stylists: 'hairstylists',
  colourists: 'colourists',
  colorists: 'colourists',
  balayage: 'balayage',
  'beard-grooming': 'beard-grooming',
  'beard-trim': 'beard-trim',
  fades: 'fades',
  'fade-barbers': 'fades',
  'curly-hair': 'curly-hair',
  'curly-hair-stylists': 'curly-hair',
  'fine-hair': 'fine-hair',
  'fine-hair-stylists': 'fine-hair',
  'hair-extensions': 'hair-extensions',
};

export const canonicalCategorySlugs = {
  barbers: 'barbers',
  hairstylists: 'hair-stylists',
  colourists: 'colourists',
  balayage: 'balayage',
  'beard-grooming': 'beard-grooming',
  'curly-hair': 'curly-hair-stylists',
  'fine-hair': 'fine-hair-stylists',
  'beard-trim': 'beard-trim',
  fades: 'fades',
  'hair-extensions': 'hair-extensions',
};

export const reviewCategories = {
  barbers: { baseCategory: 'barbers', title: 'Barber reviews' },
  hairstylists: {
    baseCategory: 'hairstylists',
    title: 'Hairstylist reviews',
  },
  colourists: {
    baseCategory: 'colourists',
    title: 'Colourist reviews',
  },
};

export const rankedCategories = {
  'best-barbers': { baseCategory: 'barbers', title: 'Best barbers' },
  'top-colourists': { baseCategory: 'colourists', title: 'Top colourists' },
};

export const hairTipCategories = [
  'Haircuts & Styling',
  'Hair Health',
  'Colour',
  'Curly & Textured Hair',
  'Fine & Thin Hair',
  'Beards & Grooming',
  'Products',
  'DIY Hair Care',
];

export const hairTipArticles = {
  'how-to-choose-a-barber': {
    title: 'How to Choose a Barber | Find the Right Barber for You | Frizi',
    h1: 'How to Choose a Barber',
    description:
      'Learn how to choose a barber by comparing services, specialties, portfolio work, communication, pricing, location, availability and individual reviews.',
    category: 'Beards & Grooming',
    cta: { label: 'Find a Barber', href: '/barbers' },
    sections: [
      {
        heading: 'Start with the service you actually need',
        body: 'A quick cleanup, a skin fade, a beard trim and a full restyle can require different strengths. Look for a barber whose services and photos match the kind of work you want most often.',
      },
      {
        heading: 'Compare the person, not just the shop',
        body: 'Salon or barbershop reviews can be useful, but Frizi is built around the individual professional. Check their specialties, portfolio, service descriptions and public reviews so you know who will be cutting your hair.',
      },
      {
        heading: 'Look for communication and consistency',
        body: 'A good barber should understand your style, ask useful questions and remember what worked last time. Saving notes and photos in your Frizi Hair Profile helps make every future appointment easier.',
      },
      {
        heading: 'Check practical fit',
        body: 'Location, price, appointment length and availability all matter. The right barber is someone whose work fits your style and whose schedule works with your life.',
      },
    ],
  },
  'how-to-find-a-good-hairstylist': {
    title: 'How to Find a Good Hairstylist | Frizi',
    h1: 'How to Find a Good Hairstylist',
    description:
      'Learn how to find a hairstylist by comparing your hair type, service needs, specialties, portfolio work, reviews, communication and availability.',
    category: 'Haircuts & Styling',
    cta: { label: 'Find a Hairstylist', href: '/hairstylists' },
    sections: [
      {
        heading: 'Know what you want help with',
        body: 'Start with your hair type and goal. Fine hair, curly hair, colour correction, extensions, blowouts and major cut changes can each call for different experience.',
      },
      {
        heading: 'Use portfolios and specialties together',
        body: 'Photos show taste and technique, while specialties show where a professional says they are strongest. The best signal is when the portfolio, service list and reviews all point in the same direction.',
      },
      {
        heading: 'Ask questions before you commit',
        body: 'A good consultation can clarify maintenance, price, timing and whether the style fits your hair. Frizi is designed to keep that communication connected to your professional relationship.',
      },
      {
        heading: 'Keep the relationship portable',
        body: 'When you find someone you trust, you should not lose them because they change salons. Frizi profiles are centred on the individual professional, not just the location.',
      },
    ],
  },
  'how-to-style-thin-hair': {
    title: 'How to Style Thin Hair | Tips for Fine & Thin Hair | Frizi',
    h1: 'How to Style Thin Hair',
    description:
      'Practical styling tips for thin or fine hair, including lightweight products, volume, drying technique, haircut choices and when to ask a stylist for help.',
    category: 'Fine & Thin Hair',
    cta: { label: 'Find a Pro Who Understands Fine Hair', href: '/fine-hair/kitchener-on' },
    sections: [
      {
        heading: 'Keep products lightweight',
        body: 'Heavy creams, oils and waxes can make fine or thin hair sit flatter. Lightweight mousse, texture spray or a small amount of volumizing product can help create lift without weighing hair down.',
      },
      {
        heading: 'Build volume while drying',
        body: 'Drying at the roots, changing your part and using a brush or fingers to lift sections can make hair look fuller. Use heat carefully and avoid overworking fragile ends.',
      },
      {
        heading: 'Choose a cut that supports fullness',
        body: 'Shape matters. A stylist who understands fine hair can help choose a length, layering approach and styling plan that makes your hair easier to manage day to day.',
      },
      {
        heading: 'Know when to get extra help',
        body: 'These are cosmetic styling tips, not medical advice. If you notice sudden hair loss, scalp pain, inflammation or unexplained shedding, speak with a qualified healthcare professional.',
      },
    ],
  },
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

export function cityPathSlug(cityKey) {
  const city = cityPages[cityKey];
  return city ? slugify(city.name) : cityKey;
}

export function canonicalLocalPath(categoryKey, cityKey) {
  const categorySlug = canonicalCategorySlugs[categoryKey] || categoryKey;
  return `/${cityPathSlug(cityKey)}/${categorySlug}`;
}

export function resolveCityKey(value) {
  return citySlugAliases[String(value || '').toLowerCase()] || null;
}

export function resolveDiscoveryCategoryKey(value) {
  return discoverySlugAliases[String(value || '').toLowerCase()] || null;
}

export function shouldIndexDiscoveryPage({ professionals = [], categoryKey }) {
  const coreCategories = new Set(['barbers', 'hairstylists', 'colourists']);
  const minimum = coreCategories.has(categoryKey) ? 3 : 2;
  return professionals.length >= minimum;
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
    .cta:focus-visible, button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, summary:focus-visible { outline:3px solid var(--gold); outline-offset:3px; }
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
    details.faq-item { border-top:1px solid var(--line); padding:16px 0; }
    details.faq-item summary { cursor:pointer; font-size:19px; font-weight:900; list-style:none; }
    details.faq-item summary::-webkit-details-marker { display:none; }
    details.faq-item p { margin:10px 0 0; font-size:17px; }
    label { display:grid; gap:7px; margin-top:14px; font-weight:900; }
    input, textarea, select { width:100%; min-height:48px; border:1px solid var(--line); border-radius:12px; padding:10px 12px; font:inherit; background:#fff; color:var(--ink); }
    textarea { min-height:112px; resize:vertical; }
    .footer-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:18px; }
    .footer-grid h2 { margin:0 0 8px; font-size:15px; text-transform:uppercase; }
    .footer-grid a { display:block; margin:8px 0; color:var(--muted); text-decoration:none; }
    footer { margin-top:46px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted); }
    footer > p { font-size:15px; }
    @media (max-width:560px) { .page { width:min(100% - 28px, 520px); } .top { align-items:flex-start; } .brand { font-size:20px; } }
    @media (max-width:560px) { .footer-grid { grid-template-columns:1fr; } }
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
    <footer>
      <div class="footer-grid">
        <section>
          <h2>Find a Pro</h2>
          <a href="/barbers">Barbers</a>
          <a href="/hairstylists">Hairstylists</a>
          <a href="/colourists">Colourists</a>
        </section>
        <section>
          <h2>Explore</h2>
          <a href="/hair-tips">Hair Tips</a>
          <a href="/reviews/barbers/kitchener-on">Reviews</a>
          <a href="/learn">Learn</a>
        </section>
        <section>
          <h2>Frizi</h2>
          <a href="/nominate-a-pro">Nominate a Pro</a>
          <a href="https://pro.frizi.ca">Frizi for Professionals</a>
        </section>
      </div>
      <p>Frizi connects clients with real local hair professionals. Product commerce is Coming Soon.</p>
    </footer>
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
      'id, public_slug, display_name, studio_name, bio, specialties, primary_specialty, profile_photo_url, hero_photo_url, public_profile_status, bookable, account_plan, subscription_status, updated_at',
    )
    .eq('public_profile_status', 'published')
    .eq('bookable', true)
    .not('profile_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(24);

  if (slug) profileQuery.eq('public_slug', slug);

  const { data: profiles, error: profileError } = await profileQuery;
  if (profileError || !profiles?.length) return [];

  const eligibleProfiles = profiles.filter(isPubliclyBookableProfessional);
  if (!eligibleProfiles.length) return [];

  const ids = eligibleProfiles.map((profile) => profile.id);
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

  return eligibleProfiles
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

export async function loadPublicSalons({ cityKey, slug }) {
  if (!isSupabaseConfigured()) return [];

  const supabase = createSupabaseClient();
  const salonQuery = supabase
    .from('frizi_salons')
    .select('id, name, public_slug, status, account_plan, settings, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(24);

  if (slug) salonQuery.eq('public_slug', slug);

  const { data: salons, error } = await salonQuery;
  if (error || !salons?.length) return [];

  const ids = salons.map((salon) => salon.id);
  const { data: locations } = await supabase
    .from('frizi_salon_locations')
    .select('salon_id, name, city, province, country, status, primary_location')
    .in('salon_id', ids)
    .eq('status', 'active');

  const city = cityKey ? cityPages[cityKey] : null;
  return salons
    .map((salon) => {
      const location = (locations || []).find(
        (candidate) => candidate.salon_id === salon.id && candidate.primary_location,
      ) || (locations || []).find((candidate) => candidate.salon_id === salon.id);
      return { ...salon, location };
    })
    .filter((salon) => {
      if (!salon.location) return false;
      if (!city) return true;
      return (
        slugify(salon.location.city) === slugify(city.name) &&
        String(salon.location.province || '').toUpperCase() === city.province
      );
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
