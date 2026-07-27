import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  MapPin,
  Mic,
  QrCode,
  Search,
  Send,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Star,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type Service = {
  name: string;
  duration: string;
  price: string;
};

type Review = {
  name: string;
  text: string;
  rating: number;
};

type Professional = {
  id: string;
  name: string;
  role: string;
  studio: string;
  neighborhood: string;
  distance: string;
  heroImage: string;
  detailImage: string;
  rating: number;
  reviews: number;
  repeatRate: string;
  nextAvailable: string;
  specialties: string[];
  accommodations: string[];
  searchTerms: string[];
  whyMatch: string;
  bio: string;
  services: Service[];
  bookingSlots: string[];
  clientReviews: Review[];
  promotion: string;
};

type BookingRequest = {
  professional: string;
  service: string;
  time: string;
  eventId: string;
};

type ClientNavKey = 'appointments' | 'saved' | 'products' | 'profile';

type InvitationFixture = {
  token: string;
  professionalId: string;
  openedEvent: string;
  offer: {
    id: string;
    title: string;
    type: string;
    value: string;
    expiresAt: string;
    terms: string;
    status: 'live' | 'paused' | 'expired';
    redeemedClientKeys: string[];
  };
};

type InfoPage = {
  title: string;
  eyebrow: string;
  summary: string;
  points: string[];
  cta?: { label: string; href: string };
};

const sampleQuery =
  'I am looking for a muslim friendly barber near me who is good at fades.';

const invitationFixtures: InvitationFixture[] = [
  {
    token: 'mara-chen-frizi25',
    professionalId: 'mara',
    openedEvent: 'client_invite_opened:mara-chen-frizi25',
    offer: {
      id: 'offer_mara_intro_25',
      title: 'Get 25% off your next appointment',
      type: 'Percentage discount',
      value: '25%',
      expiresAt: '2026-08-15',
      terms: 'One introductory redemption per invited client. Minimum service value $50 CAD. Not combinable with other discounts.',
      status: 'live',
      redeemedClientKeys: ['existing-redeemed-demo'],
    },
  },
  {
    token: 'mara-paused-demo',
    professionalId: 'mara',
    openedEvent: 'client_invite_opened:mara-paused-demo',
    offer: {
      id: 'offer_mara_paused',
      title: 'Free curl routine card',
      type: 'Complimentary add-on',
      value: '$0 CAD add-on',
      expiresAt: '2026-08-15',
      terms: 'Paused by the professional.',
      status: 'paused',
      redeemedClientKeys: [],
    },
  },
];

const professionals: Professional[] = [
  {
    id: 'omar',
    name: 'Omar Rahman',
    role: 'Barber and fade specialist',
    studio: 'Civic Barbering',
    neighborhood: 'Riverside',
    distance: '1.4 km',
    heroImage:
      'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=85',
    detailImage:
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=85',
    rating: 4.97,
    reviews: 312,
    repeatRate: '84%',
    nextAvailable: 'Today 5:15 PM',
    specialties: ['Skin fades', 'Low fades', 'Beard lineups', 'Textured crops'],
    accommodations: ['Muslim friendly', 'Private room on request', 'Prayer-time aware', 'Quiet appointment'],
    searchTerms: ['muslim', 'barber', 'fade', 'fades', 'beard', 'men', 'private', 'near me'],
    whyMatch:
      'Best match for Muslim-friendly barber care, fade reviews, and same-day availability near you.',
    bio: 'Omar keeps detailed cut notes for guards, taper shape, neckline preference, and beard lineups so your next visit starts with context.',
    services: [
      { name: 'Fade and lineup', duration: '45 min', price: '$52' },
      { name: 'Fade, beard, and wash', duration: '70 min', price: '$78' },
      { name: 'Private-room haircut', duration: '60 min', price: '$65' },
    ],
    bookingSlots: ['Today 5:15 PM', 'Tomorrow 10:30 AM', 'Tomorrow 4:45 PM', 'Fri 2:00 PM'],
    clientReviews: [
      {
        name: 'Yusuf',
        rating: 5,
        text: 'Omar understood exactly what I meant by a low fade and kept the beard line natural.',
      },
      {
        name: 'Samira',
        rating: 5,
        text: 'The private-room option made booking for my son feel easy and respectful.',
      },
    ],
    promotion: 'New clients get 10% off a fade and beard combo this week.',
  },
  {
    id: 'mara',
    name: 'Mara Chen',
    role: 'Curl cutter and colorist',
    studio: 'Northline Studio',
    neighborhood: 'West Queen West',
    distance: '1.8 km',
    heroImage:
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=85',
    detailImage:
      'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=900&q=85',
    rating: 4.98,
    reviews: 188,
    repeatRate: '72%',
    nextAvailable: 'Tomorrow 12:45 PM',
    specialties: ['Dry curl cuts', 'Fine hair shaping', 'Color consults', 'Wash-day routines'],
    accommodations: ['Queer friendly', 'Quiet appointment', 'On public transit', 'Photo history'],
    searchTerms: ['curl', 'curly', 'fine hair', 'color', 'quiet', 'women', 'natural curls'],
    whyMatch:
      'Connected to the Frizi Pro demo profile, including reviews, promotion, and available bookings.',
    bio: 'Mara is the professional shown in the Frizi Pro app. Her client notes, photo history, reviews, promotions, and booking requests sync into the pro-side demo.',
    services: [
      { name: 'Dry curl cut', duration: '75 min', price: '$115' },
      { name: 'Fine hair shaping', duration: '60 min', price: '$95' },
      { name: 'Curl routine consult', duration: '40 min', price: '$55' },
    ],
    bookingSlots: ['Tomorrow 12:45 PM', 'Wed 2:15 PM', 'Thu 11:30 AM', 'Sat 12:00 PM'],
    clientReviews: [
      {
        name: 'Nora',
        rating: 5,
        text: 'Mara remembered that I do not like heavy product and my curls lasted longer than usual.',
      },
      {
        name: 'Jason',
        rating: 5,
        text: 'The photo notes made it simple to explain what I liked from the last appointment.',
      },
    ],
    promotion: 'Free curl routine card with any first appointment before August 15.',
  },
  {
    id: 'sol',
    name: 'Sol Amari',
    role: 'Protective style artist',
    studio: 'The Annex Lofts',
    neighborhood: 'The Annex',
    distance: '4.9 km',
    heroImage:
      'https://images.unsplash.com/photo-1605980776566-0486c3ac7617?auto=format&fit=crop&w=1200&q=85',
    detailImage:
      'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=900&q=85',
    rating: 4.96,
    reviews: 141,
    repeatRate: '78%',
    nextAvailable: 'Friday 9:00 AM',
    specialties: ['Protective styles', 'Loc maintenance', 'Scalp care', 'Natural curls'],
    accommodations: ['Hijab-friendly space', 'Private suite', 'Fragrance aware', 'Textured hair'],
    searchTerms: ['protective', 'locs', 'braids', 'hijab', 'private', 'textured', 'scalp'],
    whyMatch:
      'Strong match for private-suite appointments, textured hair, and consent-first photo sharing.',
    bio: 'Sol focuses on protective styles and loc care with clear maintenance plans and privacy-first portfolio consent.',
    services: [
      { name: 'Protective style consult', duration: '45 min', price: '$65' },
      { name: 'Loc maintenance', duration: '120 min', price: '$180' },
      { name: 'Scalp care session', duration: '50 min', price: '$80' },
    ],
    bookingSlots: ['Friday 9:00 AM', 'Friday 1:00 PM', 'Sat 11:30 AM', 'Tue 10:00 AM'],
    clientReviews: [
      {
        name: 'Imani',
        rating: 5,
        text: 'Sol did not rush the consult, and my scalp felt considered the entire time.',
      },
      {
        name: 'Leah',
        rating: 5,
        text: 'I approved one photo for their portfolio and kept the rest private. Very clear consent.',
      },
    ],
    promotion: 'Free scalp oil sample with protective style bookings this month.',
  },
  {
    id: 'nina',
    name: 'Nina Patel',
    role: 'Fine hair and precision cut specialist',
    studio: 'Golden Hour Hair',
    neighborhood: 'Little Italy',
    distance: '2.6 km',
    heroImage:
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=85',
    detailImage:
      'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=900&q=85',
    rating: 4.94,
    reviews: 205,
    repeatRate: '76%',
    nextAvailable: 'Tomorrow 3:30 PM',
    specialties: ['Fine hair', 'Bobs', 'Pixies', 'Soft layers'],
    accommodations: ['Quiet appointment', 'Fragrance aware', 'Consult-first cuts', 'On public transit'],
    searchTerms: ['fine hair', 'thin hair', 'bob', 'pixie', 'layers', 'quiet'],
    whyMatch:
      'Helpful for clients who need precise shaping and do not want their fine hair over-thinned.',
    bio: 'Nina works with fine density, soft grow-out shapes, and haircut plans that avoid unnecessary thinning.',
    services: [
      { name: 'Fine hair shaping', duration: '60 min', price: '$88' },
      { name: 'Precision bob', duration: '75 min', price: '$120' },
      { name: 'Pixie maintenance', duration: '45 min', price: '$70' },
    ],
    bookingSlots: ['Tomorrow 3:30 PM', 'Thu 10:15 AM', 'Fri 5:00 PM', 'Sat 9:45 AM'],
    clientReviews: [
      {
        name: 'Claire',
        rating: 5,
        text: 'Nina knew how to make my hair look fuller without cutting too much off.',
      },
      {
        name: 'Avery',
        rating: 5,
        text: 'The grow-out notes helped us repeat the exact length that worked.',
      },
    ],
    promotion: 'Complimentary bang trim within three weeks of a precision cut.',
  },
];

const infoPages: Record<string, InfoPage> = {
  'help/payments': {
    eyebrow: 'Help',
    title: 'Payments and payouts',
    summary:
      'Frizi is being set up for Stripe Connect so clients can pay for bookings and products in-app while professionals receive payouts through the platform.',
    points: [
      'Frizi Pro is modeled as a $29/month subscription for professionals.',
      'Online service and product payments carry a 4.5% platform transaction fee in the demo model.',
      'Service payments can use Stripe Connect destination charges with the professional as the connected account and Frizi collecting the application fee.',
      'Standard payouts are planned weekly. Instant payout can be offered as an optional faster transfer with an added 2% fee where Stripe eligibility allows it.',
      'Live processing requires Stripe secret keys, webhook signing secret, Connect onboarding, and production business verification before real client cards are charged.',
    ],
    cta: { label: 'View terms', href: '/policies/terms' },
  },
  'help/fulfillment': {
    eyebrow: 'Help',
    title: 'Product fulfillment',
    summary:
      'Frizi product sales are designed so clients buy from Frizi inside the app. Supplier and wholesale details stay in the admin catalogue, not on the client checkout screen.',
    points: [
      'Frizi should act as seller of record for in-app product orders and show Frizi on customer receipts, order updates, support, returns, and packing materials where possible.',
      'The admin catalogue stores source URL, internal cost, retail price, supplier, SKU, fulfillment method, tags, and stylist commission.',
      'For MVP fulfillment, start with manually reviewed orders and supplier placement before automating with Amazon MCF, wholesale distributors, or a 3PL.',
      'Use supplier agreements that allow blind or marketplace fulfillment, especially if Amazon inventory is used behind the scenes.',
      'Do not route clients to visible Amazon affiliate checkout if the goal is Frizi-owned checkout and Frizi transaction fees.',
    ],
    cta: { label: 'Open admin catalogue', href: 'https://admin.frizi.ca' },
  },
  'policies/terms': {
    eyebrow: 'Policy',
    title: 'Terms of service',
    summary:
      'These demo terms explain the basic roles in Frizi: clients book and buy through Frizi, professionals manage services and CRM, and Frizi operates the software and payment rails.',
    points: [
      'Clients are responsible for entering accurate booking, contact, hair profile, delivery, and payment information.',
      'Professionals are responsible for service descriptions, availability, appointment quality, cancellation handling, and any client-facing claims they publish.',
      'Frizi may collect subscription fees, transaction fees, product margins, and other disclosed fees for use of the platform.',
      'Product prices, availability, and delivery windows can change before checkout is confirmed.',
      'These demo policies need legal review before production launch.',
    ],
    cta: { label: 'Privacy policy', href: '/policies/privacy' },
  },
  'policies/privacy': {
    eyebrow: 'Policy',
    title: 'Privacy policy',
    summary:
      'Frizi handles sensitive client profile details, hair photos, reviews, booking notes, and payment metadata, so the policy is written around consent and minimum necessary access.',
    points: [
      'Hair photos are private by default and are shared with a professional only for booking, consultation, service history, or client-approved portfolio use.',
      'Marketing use of client photos or reviews requires explicit, asset-specific consent that can be revoked.',
      'Payment card details should be processed by Stripe and not stored directly by Frizi.',
      'Professionals can view CRM details needed for appointments and client relationship management.',
      'Production launch should include data retention, deletion, breach notification, and regional privacy compliance review.',
    ],
    cta: { label: 'Return policy', href: '/policies/returns' },
  },
  'policies/shipping': {
    eyebrow: 'Policy',
    title: 'Shipping policy',
    summary:
      'Frizi product orders are intended to ship from approved suppliers, wholesalers, Amazon MCF, or 3PL partners while the client sees Frizi as the store experience.',
    points: [
      'Shipping cost, carrier, and delivery estimate should be shown before checkout is completed.',
      'Supplier identity may be internal, but client-facing tracking, support, and order updates should come from Frizi.',
      'Some products may be unavailable for certain provinces, states, addresses, or delivery speeds.',
      'Orders should not be marked shipped until supplier confirmation or tracking is available.',
      'Production fulfillment needs inventory, tax, and restricted-product review before launch.',
    ],
    cta: { label: 'Fulfillment help', href: '/help/fulfillment' },
  },
  'policies/returns': {
    eyebrow: 'Policy',
    title: 'Returns and refunds',
    summary:
      'This demo policy separates service payments from product orders and keeps client support routed through Frizi.',
    points: [
      'Appointment cancellation and refund rules should be shown before the client pays.',
      'Unopened eligible products can be reviewed for return within the displayed return window.',
      'Opened personal-care products may be final sale unless damaged, incorrect, or required by applicable law.',
      'Product refunds should account for supplier return rules, shipping status, and stylist commission reversal when applicable.',
      'Chargebacks, disputes, and refunds must be reconciled against Stripe events before payout finalization.',
    ],
    cta: { label: 'Payments help', href: '/help/payments' },
  },
  'policies/marketplace': {
    eyebrow: 'Policy',
    title: 'Marketplace policy',
    summary:
      'Frizi connects clients with independent professionals while also selling selected products through an admin-managed catalogue.',
    points: [
      'Professionals keep their reviews, photos, CRM notes, and client relationships portable inside Frizi.',
      'Client reviews and photos should only be public when approved under the correct consent state.',
      'Professional service payouts, product commissions, refunds, and adjustments should be calculated from Stripe/order records.',
      'Frizi can remove products, promotions, or profile content that is misleading, unsafe, noncompliant, or unsupported by evidence.',
      'The admin product catalogue is separate from the pro and client apps so product sourcing can change without app releases.',
    ],
    cta: { label: 'Open Frizi', href: '/' },
  },
};

function App() {
  const inviteToken = window.location.pathname.match(/^\/invite\/([^/?#]+)/)?.[1];
  const infoPageMatch = window.location.pathname.match(/^\/(help|policies)\/([^/?#]+)/);
  const [query, setQuery] = useState(sampleQuery);
  const [submittedQuery, setSubmittedQuery] = useState(sampleQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeClientNav, setActiveClientNav] = useState<ClientNavKey | null>(null);
  const [selectedService, setSelectedService] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [isListening, setIsListening] = useState(false);

  const rankedProfiles = useMemo(() => rankProfessionals(submittedQuery), [submittedQuery]);
  const activeProfile = rankedProfiles[activeIndex % rankedProfiles.length];
  const activeService = selectedService || activeProfile.services[0].name;
  const activeTime = selectedTime || activeProfile.bookingSlots[0];

  if (infoPageMatch) {
    const pageKey = `${infoPageMatch[1]}/${infoPageMatch[2]}`;
    return <InfoPageView page={infoPages[pageKey]} />;
  }

  if (inviteToken) {
    const invitation = invitationFixtures.find((fixture) => fixture.token === inviteToken);
    return (
      <InviteLanding
        invitation={invitation}
        onViewProfile={(professionalId) => {
          const profileIndex = professionals.findIndex((profile) => profile.id === professionalId);
          setSubmittedQuery('Mara Chen Frizi invitation');
          setQuery('Mara Chen Frizi invitation');
          setActiveIndex(profileIndex >= 0 ? profileIndex : 0);
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  function submitSearch() {
    setSubmittedQuery(query.trim() || sampleQuery);
    setActiveIndex(0);
    setSelectedService('');
    setSelectedTime('');
    setBooking(null);
    setActiveClientNav(null);
  }

  function demoMicSearch() {
    setIsListening(true);
    window.setTimeout(() => {
      setQuery(sampleQuery);
      setSubmittedQuery(sampleQuery);
      setActiveIndex(0);
      setIsListening(false);
    }, 650);
  }

  function moveDeck(direction: 'previous' | 'next') {
    setSelectedService('');
    setSelectedTime('');
    setBooking(null);
    setActiveIndex((current) =>
      direction === 'next'
        ? (current + 1) % rankedProfiles.length
        : (current - 1 + rankedProfiles.length) % rankedProfiles.length,
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleSaved(profileId: string) {
    setSavedIds((current) =>
      current.includes(profileId) ? current.filter((id) => id !== profileId) : [...current, profileId],
    );
  }

  function confirmBooking() {
    const eventId = `booking_requested:${activeProfile.id}:${Date.now().toString().slice(-5)}`;
    setBooking({
      professional: activeProfile.name,
      service: activeService,
      time: activeTime,
      eventId,
    });
  }

  return (
    <main className="min-h-screen bg-[#080808] pb-24 text-white">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#080808]/88 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button className="flex items-center gap-2" type="button" onClick={() => setActiveClientNav(null)}>
            <img className="h-10 w-10 rounded-xl border border-[#f4c430]/55 object-cover" src="/frizi-icon.png" alt="" />
            <span className="text-lg font-black text-[#f4c430]">Frizi</span>
          </button>
          <button className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-white" type="button">
            Sign in/up
          </button>
        </div>
      </header>

      {activeClientNav ? (
        <ClientNavScreen
          activeNav={activeClientNav}
          booking={booking}
          onBookSaved={(profileId) => {
            const index = rankedProfiles.findIndex((profile) => profile.id === profileId);
            if (index >= 0) {
              setActiveIndex(index);
              setActiveClientNav(null);
              window.setTimeout(() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' }), 50);
            }
          }}
          savedProfiles={rankedProfiles.filter((profile) => savedIds.includes(profile.id))}
        />
      ) : (
        <>
          <HeroSearch
            isListening={isListening}
            onMic={demoMicSearch}
            onSubmit={submitSearch}
            query={query}
            setQuery={setQuery}
          />
          <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,480px)_1fr] lg:items-start lg:px-8">
            <aside className="lg:sticky lg:top-24">
              <DeckCard
                activeIndex={activeIndex}
                isSaved={savedIds.includes(activeProfile.id)}
                onNext={() => moveDeck('next')}
                onPrevious={() => moveDeck('previous')}
                onToggleSaved={() => toggleSaved(activeProfile.id)}
                profile={activeProfile}
                total={rankedProfiles.length}
              />
            </aside>

            <ProfileDetails
              booking={booking}
              onBook={confirmBooking}
              profile={activeProfile}
              selectedService={activeService}
              selectedTime={activeTime}
              setSelectedService={setSelectedService}
              setSelectedTime={setSelectedTime}
            />
          </section>
        </>
      )}
      <ClientFooter activeNav={activeClientNav} onChange={setActiveClientNav} />
    </main>
  );
}

function InfoPageView({ page }: { page?: InfoPage }) {
  const activePage = page ?? {
    eyebrow: 'Frizi',
    title: 'Page not found',
    summary: 'This Frizi help or policy page is not available yet.',
    points: ['Open the app or choose one of the published help links.'],
    cta: { label: 'Open Frizi', href: '/' },
  };

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-6 text-white">
      <section className="mx-auto max-w-3xl rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/35 sm:p-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-[#f4c430]" size={30} />
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4c430]">{activePage.eyebrow}</p>
        </div>
        <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">{activePage.title}</h1>
        <p className="mt-4 text-lg leading-8 text-white/72">{activePage.summary}</p>
        <div className="mt-6 grid gap-3">
          {activePage.points.map((point) => (
            <div key={point} className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <CheckCircle2 className="mt-1 shrink-0 text-[#f4c430]" size={18} />
              <p className="leading-7 text-white/82">{point}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {activePage.cta ? (
            <a className="rounded-2xl bg-[#f4c430] px-5 py-4 text-center font-black text-black" href={activePage.cta.href}>
              {activePage.cta.label}
            </a>
          ) : null}
          <a className="rounded-2xl border border-white/15 px-5 py-4 text-center font-black text-white" href="/">
            Back to Frizi
          </a>
        </div>
        <p className="mt-6 text-sm leading-6 text-white/45">
          Demo policy draft for product validation. Have counsel review before production launch.
        </p>
      </section>
    </main>
  );
}

function trackClientEvent(event: string, metadata: Record<string, string>) {
  console.info('[frizi-client-analytics]', event, metadata);
}

function InviteLanding({
  invitation,
  onViewProfile,
}: {
  invitation?: InvitationFixture;
  onViewProfile: (professionalId: string) => void;
}) {
  const [clientMode, setClientMode] = useState<'new' | 'existing'>('new');
  const [claimed, setClaimed] = useState(false);
  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const professional = invitation ? professionals.find((profile) => profile.id === invitation.professionalId) : undefined;
  const clientKey = clientMode === 'existing' ? 'existing-client-demo' : 'new-client-demo';
  const alreadyRedeemed = Boolean(invitation?.offer.redeemedClientKeys.includes(clientKey));
  const offerIsClaimable = invitation?.offer.status === 'live' && !alreadyRedeemed;

  useEffect(() => {
    if (invitation && professional) {
      trackClientEvent('client_invite_opened', {
        invitation_token: invitation.token,
        professional_slug: professional.id,
        offer_id: invitation.offer.id,
      });
    }
  }, [invitation, professional]);

  if (!invitation || !professional) {
    return (
      <main className="min-h-screen bg-[#080808] px-4 py-6 text-white">
        <section className="mx-auto flex min-h-[82vh] max-w-lg flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <QrCode className="mx-auto text-[#f4c430]" size={42} />
          <h1 className="mt-5 text-3xl font-black">This invitation is not available.</h1>
          <p className="mt-3 text-white/70">The link may be expired, disabled, or typed incorrectly. Ask your hair professional for a fresh Frizi invite.</p>
          <a className="mt-6 rounded-2xl bg-[#f4c430] px-5 py-4 text-center font-black text-black" href="/">
            Open Frizi
          </a>
        </section>
      </main>
    );
  }

  const activeInvitation = invitation;
  const invitingProfessional = professional;

  function claimOffer() {
    if (!offerIsClaimable) return;
    trackClientEvent('client_offer_claim_started', {
      invitation_token: activeInvitation.token,
      professional_slug: invitingProfessional.id,
      client_mode: clientMode,
    });
    setClaimed(true);
    trackClientEvent('client_offer_claimed', {
      invitation_token: activeInvitation.token,
      offer_id: activeInvitation.offer.id,
      client_mode: clientMode,
    });
    trackClientEvent('client_connected_to_professional', {
      invitation_token: activeInvitation.token,
      professional_slug: invitingProfessional.id,
    });
  }

  function bookFromInvite() {
    const eventId = `client_booking_completed:${invitingProfessional.id}:${Date.now().toString().slice(-5)}`;
    setBooking({
      professional: invitingProfessional.name,
      service: invitingProfessional.services[0].name,
      time: invitingProfessional.bookingSlots[0],
      eventId,
    });
    trackClientEvent('client_booking_started', {
      invitation_token: activeInvitation.token,
      professional_slug: invitingProfessional.id,
    });
    trackClientEvent('client_booking_completed', {
      invitation_token: activeInvitation.token,
      professional_slug: invitingProfessional.id,
      offer_id: activeInvitation.offer.id,
    });
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:px-8">
        <aside className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
          <img className="h-72 w-full object-cover sm:h-96 lg:h-[620px]" src={professional.detailImage} alt="" />
        </aside>

        <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="flex items-center gap-4">
            <img className="h-20 w-20 rounded-full border-2 border-[#f4c430] object-cover" src={professional.heroImage} alt="" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4c430]">Personal invitation</p>
              <h1 className="text-3xl font-black leading-tight">{professional.name}</h1>
              <p className="text-white/68">{professional.role} at {professional.studio}</p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl bg-[#f4c430] p-5 text-black">
            <div className="flex items-start gap-3">
              <Gift className="mt-1 shrink-0" size={24} />
              <div>
                <p className="text-2xl font-black">{invitation.offer.status === 'live' ? invitation.offer.title : 'Offer currently paused'}</p>
                <p className="mt-2 text-sm font-bold leading-6">
                  {invitation.offer.status === 'live'
                    ? `${invitation.offer.terms} Expires ${invitation.offer.expiresAt}.`
                    : 'You can still view the professional profile and book, but this invite offer is not active right now.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {['Book directly', 'Save your hair profile', 'Receive reminders and offers'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <CheckCircle2 className="text-[#f4c430]" size={20} />
                <p className="mt-3 text-sm font-black">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-4">
            <p className="font-black text-white">What is Frizi?</p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Frizi helps you book your professional, save the haircut photos and preferences that work, claim offers, and make future appointments easier.
            </p>
          </div>

          <div className="mt-5 flex gap-2 rounded-2xl bg-black/30 p-1">
            {(['new', 'existing'] as const).map((mode) => (
              <button
                key={mode}
                className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-black ${clientMode === mode ? 'bg-[#f4c430] text-black' : 'text-white/70'}`}
                onClick={() => {
                  setClientMode(mode);
                  setClaimed(false);
                  setBooking(null);
                }}
              >
                {mode === 'new' ? 'New client' : 'Existing client'}
              </button>
            ))}
          </div>

          {alreadyRedeemed ? (
            <p className="mt-3 rounded-2xl border border-[#f4c430]/40 bg-[#f4c430]/10 p-4 text-sm font-bold text-[#f4c430]">
              Demo safeguard: this existing account already redeemed the introductory offer.
            </p>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              className="min-h-14 rounded-2xl bg-[#f4c430] px-5 font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!offerIsClaimable}
              onClick={claimOffer}
            >
              {claimed ? 'Offer claimed' : 'Claim offer'}
            </button>
            <button className="min-h-14 rounded-2xl border border-white/15 px-5 font-black text-white" onClick={() => onViewProfile(professional.id)}>
              View professional profile
            </button>
          </div>

          {claimed ? (
            <div className="mt-5 rounded-3xl border border-[#f4c430]/40 bg-[#f4c430]/10 p-4">
              <p className="font-black text-[#f4c430]">Connected to {professional.name}</p>
              <p className="mt-2 text-sm leading-6 text-white/72">Your offer is attached to this professional relationship. You can book now without searching again.</p>
              <button className="mt-4 min-h-12 w-full rounded-2xl bg-white px-5 font-black text-black" onClick={bookFromInvite}>
                Join and book {professional.bookingSlots[0]}
              </button>
            </div>
          ) : null}

          {booking ? <BookingConfirmation booking={booking} /> : null}
        </section>
      </section>
    </main>
  );
}

function HeroSearch({
  isListening,
  onMic,
  onSubmit,
  query,
  setQuery,
}: {
  isListening: boolean;
  onMic: () => void;
  onSubmit: () => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  return (
    <section className="relative min-h-[76svh] overflow-hidden pt-20">
      <img
        className="absolute inset-0 h-full w-full object-cover"
        src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1800&q=85"
        alt=""
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/44 to-[#080808]" />
      <div className="relative mx-auto flex min-h-[76svh] max-w-6xl flex-col justify-end px-4 pb-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-black leading-[0.95] tracking-normal sm:text-7xl">
            Book your professional. Save what works.
          </h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-white/76">
            Search for the right stylist, barber, or colour professional, then keep your haircut photos, preferences, and appointment history together.
          </p>
          <div className="mt-7 rounded-[28px] border border-white/12 bg-black/58 p-3 shadow-2xl shadow-black/50 backdrop-blur">
            <label className="sr-only" htmlFor="frizi-search">
              Search for a hair professional
            </label>
            <div className="flex items-center gap-2 rounded-[22px] border border-white/10 bg-white/8 px-3 py-2">
              <Search className="shrink-0 text-[#f4c430]" size={20} />
              <input
                id="frizi-search"
                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-white/45"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onSubmit();
                  }
                }}
                placeholder="find me a stylist who..."
              />
              <button
                aria-label="Demo voice search"
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                  isListening ? 'bg-[#f4c430] text-black' : 'bg-white/10 text-white'
                }`}
                type="button"
                onClick={onMic}
              >
                <Mic size={18} />
              </button>
            </div>
            <button className="mt-3 min-h-12 w-full rounded-2xl bg-[#f4c430] px-5 font-black text-black" type="button" onClick={onSubmit}>
              Search
            </button>
            {isListening ? (
              <p className="mt-3 rounded-2xl bg-[#f4c430]/12 px-3 py-2 text-sm font-bold text-[#f4c430]">
                Listening demo: filling the sample search...
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DeckCard({
  activeIndex,
  isSaved,
  onNext,
  onPrevious,
  onToggleSaved,
  profile,
  total,
}: {
  activeIndex: number;
  isSaved: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onToggleSaved: () => void;
  profile: Professional;
  total: number;
}) {
  return (
    <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[#151519] shadow-2xl shadow-black/50">
      <div className="relative min-h-[78svh] lg:min-h-[650px]">
        <img
          alt={`${profile.name} haircut example`}
          className="absolute inset-0 h-full w-full object-cover"
          src={profile.heroImage}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/88" />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#f4c430] backdrop-blur">
            {activeIndex + 1} of {total}
          </span>
          <button
            aria-label={isSaved ? `Remove ${profile.name} from saved` : `Save ${profile.name}`}
            className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur ${
              isSaved ? 'border-[#f4c430] bg-[#f4c430] text-black' : 'border-white/20 bg-black/35 text-white'
            }`}
            type="button"
            onClick={onToggleSaved}
          >
            <Star size={22} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {profile.specialties.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-white backdrop-blur">
                {tag}
              </span>
            ))}
          </div>
          <h2 className="text-4xl font-black leading-none">{profile.name}</h2>
          <p className="mt-2 text-base font-bold text-white/75">{profile.role}</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-white/70">
            <MapPin size={16} />
            {profile.neighborhood} - {profile.distance}
          </p>
          <p className="mt-2 text-sm font-black text-[#f4c430]">{matchPercent(profile)}% match</p>
          <div className="mt-5 grid grid-cols-[58px_1fr_58px] items-center gap-3">
            <button
              aria-label="Previous professional"
              className="grid h-14 w-14 place-items-center rounded-full border border-white/12 bg-white/10 text-white"
              type="button"
              onClick={onPrevious}
            >
              <ChevronLeft size={30} />
            </button>
            <a
              className="rounded-full bg-[#f4c430] px-5 py-4 text-center text-base font-black text-black"
              href="#booking"
            >
              See details and book
            </a>
            <button
              aria-label="Next professional"
              className="grid h-14 w-14 place-items-center rounded-full bg-white text-black"
              type="button"
              onClick={onNext}
            >
              <ChevronRight size={30} />
            </button>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
            <ChevronDown size={16} />
            Swipe left or right, then scroll for details
          </p>
        </div>
      </div>
    </section>
  );
}

function ProfileDetails({
  booking,
  onBook,
  profile,
  selectedService,
  selectedTime,
  setSelectedService,
  setSelectedTime,
}: {
  booking: BookingRequest | null;
  onBook: () => void;
  profile: Professional;
  selectedService: string;
  selectedTime: string;
  setSelectedService: (value: string) => void;
  setSelectedTime: (value: string) => void;
}) {
  return (
    <section className="space-y-4 pb-24" id="booking">
      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <div className="flex items-start gap-4">
          <img
            alt={`${profile.name} profile`}
            className="h-24 w-24 rounded-3xl object-cover"
            src={profile.detailImage}
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm font-black text-[#f4c430]">
              <Star size={16} fill="currentColor" />
              {profile.rating} from {profile.reviews} reviews
            </p>
            <h3 className="mt-1 text-2xl font-black">{profile.studio}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/64">{profile.whyMatch}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <InfoTile label="Repeat" value={profile.repeatRate} />
          <InfoTile label="Next" value={profile.nextAvailable} />
          <InfoTile label="Distance" value={profile.distance} />
        </div>
      </div>

      <Panel title="Profile">
        <p className="text-base leading-7 text-white/72">{profile.bio}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[...profile.specialties, ...profile.accommodations].map((tag) => (
            <span key={tag} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-white/76">
              {tag}
            </span>
          ))}
        </div>
      </Panel>

      <Panel title="Pricing">
        <div className="space-y-2">
          {profile.services.map((service) => (
            <button
              key={service.name}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left ${
                selectedService === service.name
                  ? 'border-[#f4c430] bg-[#f4c430]/12'
                  : 'border-white/10 bg-white/[0.04]'
              }`}
              type="button"
              onClick={() => setSelectedService(service.name)}
            >
              <span>
                <span className="block font-black">{service.name}</span>
                <span className="text-sm font-semibold text-white/52">{service.duration}</span>
              </span>
              <span className="text-lg font-black text-[#f4c430]">{service.price}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Booking Options">
        <div className="grid grid-cols-2 gap-2">
          {profile.bookingSlots.map((slot) => (
            <button
              key={slot}
              className={`rounded-2xl border px-3 py-4 text-sm font-black ${
                selectedTime === slot ? 'border-[#f4c430] bg-[#f4c430] text-black' : 'border-white/10 bg-white/[0.04] text-white'
              }`}
              type="button"
              onClick={() => setSelectedTime(slot)}
            >
              {slot}
            </button>
          ))}
        </div>
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 text-base font-black text-black"
          type="button"
          onClick={onBook}
        >
          <CalendarDays size={20} />
          Request booking
        </button>
        {booking ? <BookingConfirmation booking={booking} /> : null}
      </Panel>

      <Panel title="Reviews">
        <div className="space-y-3">
          {profile.clientReviews.map((review) => (
            <article key={review.name} className="rounded-2xl bg-white/[0.05] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{review.name}</p>
                <p className="flex items-center gap-1 text-sm font-black text-[#f4c430]">
                  <Star size={15} fill="currentColor" />
                  {review.rating}.0
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/68">{review.text}</p>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Current Promotion">
        <div className="rounded-2xl border border-[#f4c430]/30 bg-[#f4c430]/10 p-4">
          <p className="text-lg font-black text-[#f4c430]">{profile.promotion}</p>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-black text-black" type="button">
            <Send size={18} />
            Save promo to my account
          </button>
        </div>
      </Panel>
    </section>
  );
}

function ClientFooter({
  activeNav,
  onChange,
}: {
  activeNav: ClientNavKey | null;
  onChange: (nav: ClientNavKey) => void;
}) {
  const items: Array<{ key: ClientNavKey; label: string; icon: typeof CalendarDays }> = [
    { key: 'appointments', label: 'Appointments', icon: CalendarDays },
    { key: 'saved', label: 'Saved', icon: Star },
    { key: 'products', label: 'Products', icon: ShoppingBag },
    { key: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#101014]/95 px-3 pb-3 pt-2 backdrop-blur-xl">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = activeNav === item.key;
          return (
            <button
              key={item.key}
              className={`grid min-h-14 place-items-center rounded-2xl text-[11px] font-black ${
                selected ? 'bg-[#f4c430] text-black' : 'text-white'
              }`}
              type="button"
              onClick={() => onChange(item.key)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ClientNavScreen({
  activeNav,
  booking,
  onBookSaved,
  savedProfiles,
}: {
  activeNav: ClientNavKey;
  booking: BookingRequest | null;
  onBookSaved: (profileId: string) => void;
  savedProfiles: Professional[];
}) {
  const titleMap: Record<ClientNavKey, string> = {
    appointments: 'Appointments',
    saved: 'Saved professionals',
    products: 'Products',
    profile: 'My hair profile',
  };

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-4 pb-28 pt-24 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-black">{titleMap[activeNav]}</h1>
      {activeNav === 'appointments' ? <AppointmentsPanel booking={booking} /> : null}
      {activeNav === 'saved' ? <SavedPanel profiles={savedProfiles} onBookSaved={onBookSaved} /> : null}
      {activeNav === 'products' ? <ProductsPanel /> : null}
      {activeNav === 'profile' ? <ClientPassportPanel /> : null}
    </section>
  );
}

function AppointmentsPanel({ booking }: { booking: BookingRequest | null }) {
  return (
    <div className="mt-5 rounded-[28px] border border-white/10 bg-[#151519] p-5">
      {booking ? (
        <BookingConfirmation booking={booking} />
      ) : (
        <>
          <CalendarDays className="text-[#f4c430]" size={30} />
          <h2 className="mt-4 text-2xl font-black">No appointment booked yet</h2>
          <p className="mt-2 leading-7 text-white/68">Search without signing up, choose a professional, and your booked appointment will appear here.</p>
        </>
      )}
    </div>
  );
}

function SavedPanel({
  profiles,
  onBookSaved,
}: {
  profiles: Professional[];
  onBookSaved: (profileId: string) => void;
}) {
  return (
    <div className="mt-5 grid gap-3">
      {profiles.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <Star className="text-[#f4c430]" size={30} />
          <h2 className="mt-4 text-2xl font-black">No saved professionals yet</h2>
          <p className="mt-2 leading-7 text-white/68">Tap the star on a profile hero to keep a stylist or barber here.</p>
        </div>
      ) : (
        profiles.map((profile) => (
          <button
            key={profile.id}
            className="flex items-center gap-4 rounded-[24px] border border-white/10 bg-[#151519] p-3 text-left"
            type="button"
            onClick={() => onBookSaved(profile.id)}
          >
            <img className="h-20 w-20 rounded-2xl object-cover" src={profile.heroImage} alt="" />
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-black">{profile.name}</span>
              <span className="block text-sm font-semibold text-white/60">{profile.role}</span>
              <span className="mt-1 block text-sm font-black text-[#f4c430]">Book with stylist</span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}

function ProductsPanel() {
  const products = [
    { name: 'Curl Routine Starter Kit', detail: 'Saved after Mara recommended it for dry ends.', price: '$68' },
    { name: 'Texture Spray', detail: 'Good for movement, shape, and second-day hair.', price: '$24' },
    { name: 'Dry Shampoo', detail: 'For stretching blowouts and keeping volume.', price: '$30' },
  ];

  return (
    <div className="mt-5 grid gap-3">
      {products.map((product) => (
        <div key={product.name} className="rounded-[24px] border border-white/10 bg-[#151519] p-5">
          <ShoppingBag className="text-[#f4c430]" size={24} />
          <h2 className="mt-3 text-xl font-black">{product.name}</h2>
          <p className="mt-2 leading-7 text-white/68">{product.detail}</p>
          <p className="mt-3 text-lg font-black text-[#f4c430]">{product.price}</p>
        </div>
      ))}
    </div>
  );
}

function ClientPassportPanel() {
  const passportUrl = 'https://frizi.ca/passport/client-demo-ari';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&margin=18&data=${encodeURIComponent(passportUrl)}`;

  return (
    <div className="mt-5 rounded-[28px] border border-white/10 bg-[#151519] p-5">
      <QrCode className="text-[#f4c430]" size={30} />
      <h2 className="mt-4 text-2xl font-black">Hair passport QR</h2>
      <p className="mt-2 leading-7 text-white/68">
        Share this with your hairdresser so they can see your haircut photos, preferences, product notes, and appointment history if they are not on Frizi yet.
      </p>
      <div className="mx-auto mt-5 max-w-xs rounded-3xl bg-white p-4">
        <img className="aspect-square w-full" src={qrUrl} alt="Client hair passport QR code" />
      </div>
      <p className="mt-4 break-all rounded-2xl bg-black/30 p-3 text-sm font-semibold text-white/62">{passportUrl}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-2 py-3">
      <p className="text-sm font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">{label}</p>
    </div>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-xl font-black">
        <Sparkles className="text-[#f4c430]" size={20} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function BookingConfirmation({ booking }: { booking: BookingRequest }) {
  return (
    <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
      <p className="flex items-center gap-2 font-black text-emerald-300">
        <CheckCircle2 size={19} />
        Booking request sent
      </p>
      <p className="mt-2 text-sm leading-6 text-white/70">
        {booking.service} with {booking.professional} at {booking.time}. This demo creates a
        pro-side event named <span className="font-black text-white">{booking.eventId}</span> with
        the client's profile, request, photo consent, and notes attached.
      </p>
      <p className="mt-3 flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2 text-sm font-bold text-white/68">
        <ShieldCheck size={17} className="text-[#f4c430]" />
        Synced to Frizi Pro booking queue for the professional app demo.
      </p>
    </div>
  );
}

function rankProfessionals(query: string) {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return [...professionals].sort((a, b) => scoreProfile(b, tokens) - scoreProfile(a, tokens));
}

function scoreProfile(profile: Professional, tokens: string[]) {
  const haystack = [
    profile.name,
    profile.role,
    profile.studio,
    profile.neighborhood,
    profile.bio,
    profile.whyMatch,
    ...profile.specialties,
    ...profile.accommodations,
    ...profile.searchTerms,
  ]
    .join(' ')
    .toLowerCase();

  return tokens.reduce((score, token) => {
    if (profile.searchTerms.includes(token)) return score + 8;
    if (haystack.includes(token)) return score + 3;
    return score;
  }, profile.id === 'mara' ? 2 : 0);
}

function matchPercent(profile: Professional) {
  if (profile.id === 'omar') return 98;
  if (profile.id === 'mara') return 91;
  if (profile.id === 'sol') return 87;
  return 82;
}

export default App;
