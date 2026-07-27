import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Gift,
  MapPin,
  Mic,
  QrCode,
  ReceiptText,
  Search,
  Send,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Star,
  User,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

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
  servicePriceCents: number;
  time: string;
  eventId: string;
};

type TipChoice = 15 | 18 | 20 | 25 | 'custom' | 'none';

const taxRate = 0.13;
const defaultTipChoice: TipChoice = 18;
const clientSessionStorageKey = 'frizi-client-session';

type ClientNavKey = 'appointments' | 'saved' | 'products' | 'profile';

type FilterState = {
  distanceKm: number;
  serviceType: string;
  specialty: string;
  accessibility: string;
};

type ClientSession = {
  name: string;
  email: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  start: () => void;
};

type BrowserSpeechRecognitionEvent = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

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

const defaultFilters: FilterState = {
  distanceKm: 5,
  serviceType: 'Any service',
  specialty: 'Any specialty',
  accessibility: 'Any accessibility',
};

const serviceTypeOptions = ['Any service', 'Haircut', 'Fades', 'Curls', 'Color', 'Protective styles', 'Blowout'];
const specialtyOptions = ['Any specialty', 'Fine hair', 'Curly cuts', 'Fades', 'Protective styles', 'Color consults', 'Pixies'];
const accessibilityOptions = [
  'Any accessibility',
  'Quiet appointment',
  'Private room',
  'Hijab-friendly space',
  'Muslim friendly',
  'Fragrance aware',
];

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

const completedAppointmentHistory = [
  {
    id: 'hist_mara_001',
    professional: 'Mara Chen',
    service: 'Dry curl cut',
    date: 'Jul 14, 2026',
    servicePriceCents: 11500,
    tipCents: 2300,
    reviewStatus: 'Review left',
    photosAttached: 2,
  },
  {
    id: 'hist_omar_001',
    professional: 'Omar Rahman',
    service: 'Fade and lineup',
    date: 'Jun 28, 2026',
    servicePriceCents: 5200,
    tipCents: 936,
    reviewStatus: 'Review pending',
    photosAttached: 1,
  },
];

const clientProfilePhoto =
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80';

const clientHairPhotos = [
  {
    id: 'hair_ari_after_001',
    imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
    label: 'Last low fade',
    note: 'Synced after a completed appointment with consent.',
  },
  {
    id: 'hair_ari_after_002',
    imageUrl: 'https://images.unsplash.com/photo-1622286346003-cbc8b8e30a58?auto=format&fit=crop&w=900&q=80',
    label: 'Texture reference from last visit',
    note: 'Professional-updated haircut history, visible to both sides.',
  },
];

const clientExamplePhotos = [
  {
    id: 'example_ari_low_fade',
    imageUrl: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80',
    label: 'Low fade goal',
    note: 'Natural neckline, not squared off.',
  },
  {
    id: 'example_ari_texture',
    imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=900&q=80',
    label: 'Top texture',
    note: 'Keep movement on top without shiny gel.',
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
    id: 'layla',
    name: 'Layla Brooks',
    role: 'Inclusive barber and fade specialist',
    studio: 'East Room Barber',
    neighborhood: 'Leslieville',
    distance: '2.1 km',
    heroImage:
      'https://images.unsplash.com/photo-1592647420148-bfcc177e2117?auto=format&fit=crop&w=1200&q=85',
    detailImage:
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=85',
    rating: 4.95,
    reviews: 176,
    repeatRate: '81%',
    nextAvailable: 'Today 6:00 PM',
    specialties: ['Skin fades', 'Drop fades', 'Scissor-over-comb', 'Curly taper cuts'],
    accommodations: ['Muslim friendly', 'Women-friendly barbering', 'Private room on request', 'Quiet appointment'],
    searchTerms: ['muslim', 'friendly', 'barber', 'fade', 'fades', 'women', 'private', 'curly taper', 'near me'],
    whyMatch:
      'Strong match for clients who want a Muslim-friendly barber, clean fades, and a calm private-room option.',
    bio: 'Layla works with clients who want barber-level fades in a respectful, low-pressure space. She keeps notes on guard lengths, neckline shape, product preferences, and privacy needs.',
    services: [
      { name: 'Skin fade', duration: '50 min', price: '$58' },
      { name: 'Fade and curl taper', duration: '65 min', price: '$74' },
      { name: 'Private-room cut', duration: '60 min', price: '$68' },
    ],
    bookingSlots: ['Today 6:00 PM', 'Tomorrow 1:15 PM', 'Thu 5:30 PM', 'Sat 10:00 AM'],
    clientReviews: [
      {
        name: 'Amina',
        rating: 5,
        text: 'Layla made the private-room request feel normal and gave me the clean taper I wanted.',
      },
      {
        name: 'Noah',
        rating: 5,
        text: 'She remembered the exact guard blend from my last cut and fixed the weight on top.',
      },
    ],
    promotion: 'First fade appointment includes a complimentary neckline cleanup within 10 days.',
  },
  {
    id: 'malik',
    name: 'Malik Stone',
    role: 'Fade, lineup, and textured cut barber',
    studio: 'Block 9 Grooming',
    neighborhood: 'Dundas West',
    distance: '3.4 km',
    heroImage:
      'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=85',
    detailImage:
      'https://images.unsplash.com/photo-1622286346003-cbc8b8e30a58?auto=format&fit=crop&w=900&q=85',
    rating: 4.92,
    reviews: 264,
    repeatRate: '86%',
    nextAvailable: 'Tomorrow 9:45 AM',
    specialties: ['Mid fades', 'Burst fades', 'Beard shaping', 'Textured tops'],
    accommodations: ['Muslim friendly', 'Prayer-time aware', 'Fragrance aware', 'Same-day booking'],
    searchTerms: ['muslim', 'barber', 'fade', 'fades', 'beard', 'lineup', 'men', 'textured', 'near me'],
    whyMatch:
      'Great option for fade searches with beard work, textured tops, and appointment notes that carry forward.',
    bio: 'Malik specializes in sharp fades that still grow out cleanly. He documents blend height, neckline preference, beard shape, and styling product tolerance for repeat bookings.',
    services: [
      { name: 'Fade and lineup', duration: '45 min', price: '$50' },
      { name: 'Fade and beard shape', duration: '65 min', price: '$76' },
      { name: 'Textured crop cut', duration: '55 min', price: '$62' },
    ],
    bookingSlots: ['Tomorrow 9:45 AM', 'Tomorrow 6:30 PM', 'Fri 12:30 PM', 'Sun 11:00 AM'],
    clientReviews: [
      {
        name: 'Bilal',
        rating: 5,
        text: 'The fade was sharp without going too high, and the beard line stayed natural.',
      },
      {
        name: 'Andre',
        rating: 5,
        text: 'Malik actually used my old photo notes and matched the cut better than I expected.',
      },
    ],
    promotion: 'Book a fade and beard shape together and get $8 off this week.',
  },
  {
    id: 'serena',
    name: 'Serena Vale',
    role: 'Short cuts, fades, and gender-neutral barbering',
    studio: 'Vale Chair',
    neighborhood: 'Kensington Market',
    distance: '4.2 km',
    heroImage:
      'https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?auto=format&fit=crop&w=1200&q=85',
    detailImage:
      'https://images.unsplash.com/photo-1544717301-9cdcb1f5940f?auto=format&fit=crop&w=900&q=85',
    rating: 4.9,
    reviews: 119,
    repeatRate: '74%',
    nextAvailable: 'Friday 4:15 PM',
    specialties: ['Soft fades', 'Short cuts', 'Gender-neutral cuts', 'Low-maintenance texture'],
    accommodations: ['Queer friendly', 'Muslim friendly', 'Consult-first cuts', 'Quiet appointment'],
    searchTerms: ['muslim', 'friendly', 'barber', 'fade', 'fades', 'short cuts', 'quiet', 'gender neutral', 'near me'],
    whyMatch:
      'Good match for clients who want a softer fade, a consult-first appointment, and a comfortable inclusive chair.',
    bio: 'Serena blends barbering and salon cutting for clients who want short shapes that feel intentional, not rushed. She is especially good with soft fades, grow-out plans, and reference photos.',
    services: [
      { name: 'Soft fade', duration: '55 min', price: '$60' },
      { name: 'Short cut reset', duration: '70 min', price: '$82' },
      { name: 'Consult and cut', duration: '75 min', price: '$88' },
    ],
    bookingSlots: ['Friday 4:15 PM', 'Sat 1:00 PM', 'Mon 10:45 AM', 'Tue 2:30 PM'],
    clientReviews: [
      {
        name: 'Riley',
        rating: 5,
        text: 'Serena listened first and gave me a fade that felt like me, not a template.',
      },
      {
        name: 'Hana',
        rating: 5,
        text: 'The appointment was quiet and easy, and she saved exactly what to repeat next time.',
      },
    ],
    promotion: 'New clients can add a 15-minute shape consult at no extra charge.',
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
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [activeIndex, setActiveIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeClientNav, setActiveClientNav] = useState<ClientNavKey | null>(null);
  const [selectedService, setSelectedService] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<'default' | 'promo'>('default');
  const [clientSession, setClientSession] = useState<ClientSession | null>(null);
  const [openBookingAfterAuth, setOpenBookingAfterAuth] = useState(false);

  useEffect(() => {
    const savedSession = window.localStorage.getItem(clientSessionStorageKey);
    if (!savedSession) return;
    try {
      setClientSession(JSON.parse(savedSession) as ClientSession);
    } catch {
      window.localStorage.removeItem(clientSessionStorageKey);
    }
  }, []);

  const hasSearched = submittedQuery.trim().length > 0;
  const rankedProfiles = useMemo(
    () => (hasSearched ? rankProfessionals(submittedQuery, filters) : []),
    [filters, hasSearched, submittedQuery],
  );
  const activeProfile = rankedProfiles.length > 0 ? rankedProfiles[activeIndex % rankedProfiles.length] : null;
  const activeService = activeProfile ? selectedService || activeProfile.services[0].name : '';
  const activeTime = activeProfile ? selectedTime || activeProfile.bookingSlots[0] : '';

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
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    setSubmittedQuery(trimmedQuery);
    setActiveIndex(0);
    setSelectedService('');
    setSelectedTime('');
    setBooking(null);
    setActiveClientNav(null);
  }

  function runSearchFromVoice(transcript: string) {
    const spokenQuery = transcript.trim();
    if (!spokenQuery) return;
    setQuery(spokenQuery);
    setSubmittedQuery(spokenQuery);
    setActiveIndex(0);
    setSelectedService('');
    setSelectedTime('');
    setBooking(null);
    setActiveClientNav(null);
  }

  function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setVoiceMessage('');

    if (!SpeechRecognition) {
      setIsListening(true);
      setVoiceMessage('Voice search is not available in this browser. Using a sample spoken search.');
      window.setTimeout(() => {
        runSearchFromVoice(sampleQuery);
        setIsListening(false);
      }, 650);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-CA';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      runSearchFromVoice(transcript);
      setVoiceMessage(transcript ? `Searching for: ${transcript}` : 'No speech detected. Try again.');
    };
    recognition.onerror = () => {
      setIsListening(false);
      setVoiceMessage('Voice search could not hear you. Tap the mic and try again.');
    };
    recognition.onend = () => setIsListening(false);

    try {
      setIsListening(true);
      setVoiceMessage('Listening...');
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceMessage('Voice search is already starting. Try again in a second.');
    }
  }

  function handleClientAuth(session: ClientSession) {
    setClientSession(session);
    window.localStorage.setItem(clientSessionStorageKey, JSON.stringify(session));
    setAuthModalOpen(false);
    if (authIntent === 'promo') {
      setOpenBookingAfterAuth(true);
      setActiveClientNav(null);
    } else {
      setActiveClientNav('profile');
    }
    setAuthIntent('default');
  }

  function openClientAuth(intent: 'default' | 'promo' = 'default') {
    setAuthIntent(intent);
    setAuthModalOpen(true);
  }

  function moveDeck(direction: 'previous' | 'next') {
    if (rankedProfiles.length === 0) return;
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
    if (!activeProfile) return;
    const eventId = `booking_requested:${activeProfile.id}:${Date.now().toString().slice(-5)}`;
    setBooking({
      professional: activeProfile.name,
      service: activeService,
      servicePriceCents: parseMoneyToCents(activeProfile.services.find((service) => service.name === activeService)?.price || '$0'),
      time: activeTime,
      eventId,
    });
  }

  const showResults = hasSearched && Boolean(activeProfile);

  return (
    <main className="min-h-screen bg-[#080808] pb-24 text-white">
      {!showResults ? (
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#080808]/88 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <button className="flex items-center gap-2" type="button" onClick={() => setActiveClientNav(null)}>
              <img className="h-10 w-10 rounded-xl border border-[#f4c430]/55 object-cover" src="/frizi-icon.png" alt="" />
              <span className="text-lg font-black text-[#f4c430]">Frizi</span>
            </button>
            <button
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-black text-white"
              type="button"
              onClick={() => (clientSession ? setActiveClientNav('profile') : openClientAuth())}
            >
              {clientSession ? clientSession.name.split(' ')[0] : 'Sign in/up'}
            </button>
          </div>
        </header>
      ) : null}

      {activeClientNav ? (
          <ClientNavScreen
          activeNav={activeClientNav}
          booking={booking}
          onBookSaved={(profileId) => {
            const index = professionals.findIndex((profile) => profile.id === profileId);
            if (index >= 0) {
              const profile = professionals[index];
              setSubmittedQuery(profile.name);
              setQuery(profile.name);
              setActiveIndex(0);
              setActiveClientNav(null);
              window.setTimeout(() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' }), 50);
            }
          }}
          savedProfiles={professionals.filter((profile) => savedIds.includes(profile.id))}
        />
      ) : (
        <>
          {!hasSearched ? (
            <HeroSearch
              isListening={isListening}
              onMic={startVoiceSearch}
              onSubmit={submitSearch}
              query={query}
              setQuery={setQuery}
              voiceMessage={voiceMessage}
              filters={filters}
              setFilters={setFilters}
              hasSearched={hasSearched}
              resultCount={rankedProfiles.length}
            />
          ) : null}
          {hasSearched && activeProfile ? (
            <ResultsExperience
              deck={
                <DeckCard
                  activeIndex={activeIndex}
                  isListening={isListening}
                  isSaved={savedIds.includes(activeProfile.id)}
                  onMic={startVoiceSearch}
                  onNext={() => moveDeck('next')}
                  onSearch={submitSearch}
                  onPrevious={() => moveDeck('previous')}
                  onToggleSaved={() => toggleSaved(activeProfile.id)}
                  profile={activeProfile}
                  query={query}
                  setQuery={setQuery}
                  total={rankedProfiles.length}
                  voiceMessage={voiceMessage}
                />
              }
              details={
              <ProfileDetails
                booking={booking}
                isClientSignedIn={Boolean(clientSession)}
                onBook={confirmBooking}
                onPromoSignupRequired={() => openClientAuth('promo')}
                openBookingAfterAuth={openBookingAfterAuth}
                profile={activeProfile}
                selectedService={activeService}
                selectedTime={activeTime}
                onBookingAfterAuthHandled={() => setOpenBookingAfterAuth(false)}
                setSelectedService={setSelectedService}
                setSelectedTime={setSelectedTime}
              />
              }
            />
          ) : null}
          {hasSearched && !activeProfile ? <NoLocalMatches /> : null}
        </>
      )}
      {authModalOpen ? <ClientAuthModal intent={authIntent} onClose={() => setAuthModalOpen(false)} onComplete={handleClientAuth} /> : null}
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
      servicePriceCents: parseMoneyToCents(invitingProfessional.services[0].price),
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

function ClientAuthModal({
  intent,
  onClose,
  onComplete,
}: {
  intent: 'default' | 'promo';
  onClose: () => void;
  onComplete: (session: ClientSession) => void;
}) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('Ari M.');
  const [email, setEmail] = useState('ari@example.com');
  const [error, setError] = useState('');

  function submitAuth() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail.includes('@')) {
      setError('Add your name and a valid email to continue.');
      return;
    }

    onComplete({ name: trimmedName, email: trimmedEmail });
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/72 px-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[32px] border border-white/12 bg-[#151519] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-[#f4c430]">{mode === 'signup' ? 'Create client account' : 'Welcome back'}</p>
            <h2 className="mt-1 text-3xl font-black">{mode === 'signup' ? 'Join Frizi' : 'Sign in'}</h2>
            {intent === 'promo' ? (
              <p className="mt-2 text-sm font-bold leading-6 text-white/68">Sign up for exclusive deals and promos.</p>
            ) : null}
          </div>
          <button className="rounded-full border border-white/10 px-3 py-2 text-sm font-black text-white/70" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1">
          {(['signup', 'signin'] as const).map((item) => (
            <button
              key={item}
              className={`rounded-xl px-3 py-3 text-sm font-black ${mode === item ? 'bg-[#f4c430] text-black' : 'text-white/70'}`}
              type="button"
              onClick={() => setMode(item)}
            >
              {item === 'signup' ? 'Sign up' : 'Sign in'}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-sm font-black text-white" htmlFor="client-auth-name">
          Name
        </label>
        <input
          id="client-auth-name"
          className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-4 font-semibold text-white outline-none placeholder:text-white/38"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
        />

        <label className="mt-4 block text-sm font-black text-white" htmlFor="client-auth-email">
          Email
        </label>
        <input
          id="client-auth-email"
          className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-4 font-semibold text-white outline-none placeholder:text-white/38"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
        />

        {error ? <p className="mt-3 rounded-2xl bg-red-500/12 px-3 py-2 text-sm font-bold text-red-100">{error}</p> : null}

        <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-5 py-4 font-black text-black" type="button" onClick={submitAuth}>
          <User size={18} />
          {mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
        <p className="mt-4 text-center text-sm font-semibold leading-6 text-white/55">
          {intent === 'promo'
            ? 'Promos only apply when booking and paying through Frizi.'
            : 'Demo account flow saves this client session in the browser and opens your Frizi profile.'}
        </p>
      </section>
    </div>
  );
}

function HeroSearch({
  filters,
  hasSearched,
  isListening,
  onMic,
  onSubmit,
  query,
  resultCount,
  setFilters,
  setQuery,
  voiceMessage,
}: {
  filters: FilterState;
  hasSearched: boolean;
  isListening: boolean;
  onMic: () => void;
  onSubmit: () => void;
  query: string;
  resultCount: number;
  setFilters: (value: FilterState) => void;
  setQuery: (value: string) => void;
  voiceMessage: string;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  function updateFilter<Key extends keyof FilterState>(key: Key, value: FilterState[Key]) {
    setFilters({ ...filters, [key]: value });
  }

  return (
    <section className="relative h-[100svh] overflow-hidden pt-20">
      <img
        className="absolute inset-0 h-full w-full object-cover"
        src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1800&q=85"
        alt=""
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/44 to-[#080808]" />
      <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-28 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-black leading-[0.95] tracking-normal sm:text-7xl">
            Find your style
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
                placeholder="I am looking for....."
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
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04]">
              <button
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left"
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <span>
                  <span className="block text-sm font-black text-white">Filters</span>
                  <span className="block text-xs font-semibold text-white/52">
                    Within {filters.distanceKm} km of your current location
                  </span>
                </span>
                <ChevronDown
                  className={`text-[#f4c430] transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
                  size={20}
                />
              </button>
              {filtersOpen ? (
                <div className="grid gap-3 border-t border-white/10 p-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-black text-white">
                    Distance
                    <select
                      className="h-12 rounded-2xl border border-white/10 bg-[#101014] px-3 font-semibold text-white outline-none"
                      value={filters.distanceKm}
                      onChange={(event) => updateFilter('distanceKm', Number(event.target.value))}
                    >
                      {[2, 5, 10, 25].map((distance) => (
                        <option key={distance} value={distance}>
                          Within {distance} km
                        </option>
                      ))}
                    </select>
                  </label>
                  <FilterSelect
                    label="Service"
                    options={serviceTypeOptions}
                    value={filters.serviceType}
                    onChange={(value) => updateFilter('serviceType', value)}
                  />
                  <FilterSelect
                    label="Specialty"
                    options={specialtyOptions}
                    value={filters.specialty}
                    onChange={(value) => updateFilter('specialty', value)}
                  />
                  <FilterSelect
                    label="Comfort"
                    options={accessibilityOptions}
                    value={filters.accessibility}
                    onChange={(value) => updateFilter('accessibility', value)}
                  />
                </div>
              ) : null}
            </div>
            {hasSearched ? (
              <p className="mt-3 rounded-2xl bg-black/30 px-3 py-2 text-sm font-bold text-white/68">
                {resultCount} local {resultCount === 1 ? 'match' : 'matches'} near your current location.
              </p>
            ) : null}
            {isListening || voiceMessage ? (
              <p className="mt-3 rounded-2xl bg-[#f4c430]/12 px-3 py-2 text-sm font-bold text-[#f4c430]">
                {voiceMessage || 'Listening...'}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-white">
      {label}
      <select
        className="h-12 rounded-2xl border border-white/10 bg-[#101014] px-3 font-semibold text-white outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NoLocalMatches() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-6 text-center">
        <Search className="mx-auto text-[#f4c430]" size={32} />
        <h2 className="mt-4 text-2xl font-black">No local matches yet</h2>
        <p className="mt-2 leading-7 text-white/68">
          Try expanding the distance filter or using fewer specifics in the search.
        </p>
      </div>
    </section>
  );
}

function ResultsExperience({ deck, details }: { deck: ReactNode; details: ReactNode }) {
  return (
    <section className="bg-[#080808]">
      {deck}
      {details}
    </section>
  );
}

function ResultsSearchPill({
  isListening,
  onMic,
  onSearch,
  query,
  setQuery,
  voiceMessage,
}: {
  isListening: boolean;
  onMic: () => void;
  onSearch: () => void;
  query: string;
  setQuery: (value: string) => void;
  voiceMessage: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/16 bg-black/58 p-2 shadow-2xl shadow-black/45 backdrop-blur-xl">
      <div className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-white/10 px-3 py-2">
        <Search className="shrink-0 text-[#f4c430]" size={18} />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/50"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSearch();
            }
          }}
          placeholder="I am looking for....."
        />
        <button
          aria-label="Voice search"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
            isListening ? 'bg-[#f4c430] text-black' : 'bg-white/12 text-white'
          }`}
          type="button"
          onClick={onMic}
        >
          <Mic size={17} />
        </button>
      </div>
      {isListening || voiceMessage ? (
        <p className="mt-2 rounded-2xl bg-[#f4c430]/14 px-3 py-2 text-xs font-black text-[#f4c430]">
          {voiceMessage || 'Listening...'}
        </p>
      ) : null}
    </div>
  );
}

function DeckCard({
  activeIndex,
  isListening,
  isSaved,
  onMic,
  onNext,
  onSearch,
  onPrevious,
  onToggleSaved,
  profile,
  query,
  setQuery,
  total,
  voiceMessage,
}: {
  activeIndex: number;
  isListening: boolean;
  isSaved: boolean;
  onMic: () => void;
  onNext: () => void;
  onSearch: () => void;
  onPrevious: () => void;
  onToggleSaved: () => void;
  profile: Professional;
  query: string;
  setQuery: (value: string) => void;
  total: number;
  voiceMessage: string;
}) {
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const swipeGesture = useRef<{
    isHorizontal: boolean;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
  } | null>(null);

  function finishSwipe(clientX: number) {
    if (touchStartX === null) return;
    const delta = clientX - touchStartX;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) {
      onNext();
    } else {
      onPrevious();
    }
  }

  function finishTouchSwipe() {
    const gesture = swipeGesture.current;
    swipeGesture.current = null;
    if (!gesture) return;

    const deltaX = gesture.lastX - gesture.startX;
    const deltaY = gesture.lastY - gesture.startY;
    if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;

    if (deltaX < 0) {
      onNext();
    } else {
      onPrevious();
    }
  }

  return (
    <section
      className="relative h-[100svh] overflow-hidden bg-black [touch-action:pan-y]"
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') return;
        setTouchStartX(event.clientX);
      }}
      onPointerUp={(event) => {
        if (event.pointerType === 'touch') return;
        finishSwipe(event.clientX);
        setTouchStartX(null);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        swipeGesture.current = {
          isHorizontal: false,
          lastX: touch.clientX,
          lastY: touch.clientY,
          startX: touch.clientX,
          startY: touch.clientY,
        };
      }}
      onTouchMove={(event) => {
        const gesture = swipeGesture.current;
        const touch = event.touches[0];
        if (!gesture || !touch) return;

        gesture.lastX = touch.clientX;
        gesture.lastY = touch.clientY;
        const deltaX = gesture.lastX - gesture.startX;
        const deltaY = gesture.lastY - gesture.startY;

        if (Math.abs(deltaX) > 14 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
          gesture.isHorizontal = true;
          event.preventDefault();
        }
      }}
      onTouchEnd={finishTouchSwipe}
    >
      <div className="relative h-full">
        <img
          alt={`${profile.name} professional profile`}
          className="absolute inset-0 h-full w-full object-cover"
          src={profile.heroImage}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/8 to-black/82" />
        <div className="absolute left-4 right-4 top-4 z-20 pt-safe">
          <ResultsSearchPill
            isListening={isListening}
            onMic={onMic}
            onSearch={onSearch}
            query={query}
            setQuery={setQuery}
            voiceMessage={voiceMessage}
          />
        </div>
        <div className="absolute right-4 top-28 z-10 flex items-center gap-3 sm:top-24">
          <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-black text-white/72 backdrop-blur">
            {activeIndex + 1}/{total}
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
        <div className="absolute bottom-0 right-0 z-10 max-w-[86%] p-5 text-right sm:max-w-xl sm:p-8">
          <h2 className="text-5xl font-black leading-none drop-shadow-2xl sm:text-7xl">{profile.name}</h2>
          <p className="ml-auto mt-3 max-w-md text-xl font-black leading-6 text-white/90 drop-shadow sm:text-2xl">{profile.studio}</p>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm font-black text-white">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-3 py-2 backdrop-blur">
              <Star className="text-[#f4c430]" size={16} fill="currentColor" />
              {profile.rating}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-3 py-2 backdrop-blur">
              <MapPin className="text-[#f4c430]" size={16} />
              {profile.distance}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileDetails({
  booking,
  isClientSignedIn,
  onBook,
  onBookingAfterAuthHandled,
  onPromoSignupRequired,
  openBookingAfterAuth,
  profile,
  selectedService,
  selectedTime,
  setSelectedService,
  setSelectedTime,
}: {
  booking: BookingRequest | null;
  isClientSignedIn: boolean;
  onBook: () => void;
  onBookingAfterAuthHandled: () => void;
  onPromoSignupRequired: () => void;
  openBookingAfterAuth: boolean;
  profile: Professional;
  selectedService: string;
  selectedTime: string;
  setSelectedService: (value: string) => void;
  setSelectedTime: (value: string) => void;
}) {
  const [showReviews, setShowReviews] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const availabilityDays = useMemo(() => buildAvailabilityDays(profile.bookingSlots), [profile.bookingSlots]);
  const selectedDay = availabilityDays.find((day) => day.times.includes(selectedTime)) || availabilityDays[0];

  useEffect(() => {
    if (!openBookingAfterAuth || !isClientSignedIn) return;
    setBookingOpen(true);
    onBookingAfterAuthHandled();
  }, [isClientSignedIn, onBookingAfterAuthHandled, openBookingAfterAuth]);

  function applyPromotion() {
    if (isClientSignedIn) {
      setBookingOpen(true);
      return;
    }

    onPromoSignupRequired();
  }

  if (bookingOpen) {
    return (
      <BookingCalendarPage
        availabilityDays={availabilityDays}
        booking={booking}
        onBack={() => setBookingOpen(false)}
        onBook={onBook}
        profile={profile}
        selectedDay={selectedDay}
        selectedService={selectedService}
        selectedTime={selectedTime}
        servicesOpen={servicesOpen}
        setSelectedService={setSelectedService}
        setSelectedTime={setSelectedTime}
        setServicesOpen={setServicesOpen}
      />
    );
  }

  return (
    <section className="min-h-screen bg-[#080808] pb-28" id="booking">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <div className="flex items-start gap-4">
            <img
              alt={`${profile.name} profile`}
              className="h-24 w-24 rounded-3xl object-cover"
              src={profile.detailImage}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-[#f4c430]">{profile.studio}</p>
              <h3 className="mt-1 text-2xl font-black">{profile.name}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/64">{profile.role} in {profile.neighborhood}</p>
            </div>
          </div>
          <p className="mt-5 text-base leading-7 text-white/72">{profile.bio}</p>
        </div>

        <div className="rounded-[28px] border border-[#f4c430]/30 bg-[#f4c430]/10 p-4">
          <p className="text-lg font-black text-[#f4c430]">{profile.promotion}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white/68">Promo applies only when booked and purchased through the app.</p>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-black text-black" type="button" onClick={applyPromotion}>
            <Send size={18} />
            Apply Promotion
          </button>
        </div>

        <div className="rounded-2xl border border-[#f4c430]/30 bg-[#f4c430]/10 p-4">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 text-base font-black text-black"
            type="button"
            onClick={() => setBookingOpen(true)}
          >
            <CalendarDays size={20} />
            Book an appointment
          </button>
        </div>

        <button
          className="inline-flex items-center gap-2 px-1 py-2 text-sm font-black text-[#f4c430]"
          type="button"
          onClick={() => setShowReviews((current) => !current)}
        >
          Reviews {profile.rating}
          <Star size={16} fill="currentColor" />
        </button>

        {showReviews ? (
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
        ) : null}
      </div>
    </section>
  );
}

function BookingCalendarPage({
  availabilityDays,
  booking,
  onBack,
  onBook,
  profile,
  selectedDay,
  selectedService,
  selectedTime,
  servicesOpen,
  setSelectedService,
  setSelectedTime,
  setServicesOpen,
}: {
  availabilityDays: ReturnType<typeof buildAvailabilityDays>;
  booking: BookingRequest | null;
  onBack: () => void;
  onBook: () => void;
  profile: Professional;
  selectedDay: ReturnType<typeof buildAvailabilityDays>[number];
  selectedService: string;
  selectedTime: string;
  servicesOpen: boolean;
  setSelectedService: (value: string) => void;
  setSelectedTime: (value: string) => void;
  setServicesOpen: (value: boolean | ((current: boolean) => boolean)) => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(selectedDay?.date ?? new Date()));
  const availableByDate = useMemo(
    () => new Map(availabilityDays.map((day) => [dateKey(day.date), day])),
    [availabilityDays],
  );
  const monthCells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);
  const monthLabel = monthCursor.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <section className="min-h-screen bg-[#080808] px-4 pb-28 pt-5 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <button className="mb-5 inline-flex items-center gap-2 py-2 text-sm font-black text-[#f4c430]" type="button" onClick={onBack}>
          <ChevronLeft size={18} />
          Back to profile
        </button>

        <div className="mb-5 flex items-center gap-4 rounded-[28px] border border-white/10 bg-[#151519] p-4">
          <img className="h-16 w-16 rounded-2xl object-cover" src={profile.detailImage} alt="" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#f4c430]">{profile.studio}</p>
            <h2 className="text-2xl font-black">{profile.name}</h2>
            <p className="text-sm font-semibold text-white/58">{profile.role}</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#101014] p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-3xl font-black sm:text-4xl">{monthLabel}</h1>
            <div className="flex gap-2">
              <button
                aria-label="Previous month"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06]"
                type="button"
                onClick={() => setMonthCursor((date) => addMonths(date, -1))}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                aria-label="Next month"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06]"
                type="button"
                onClick={() => setMonthCursor((date) => addMonths(date, 1))}
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-white/64 sm:gap-3">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-7 gap-2 sm:gap-3">
            {monthCells.map((cell, index) => {
              const availableDay = cell ? availableByDate.get(dateKey(cell)) : undefined;
              const isSelected = availableDay?.label === selectedDay?.label;
              return (
                <button
                  key={cell ? dateKey(cell) : `blank-${index}`}
                  className={`aspect-square rounded-xl border text-center text-lg font-black sm:rounded-2xl sm:text-2xl ${
                    isSelected
                      ? 'border-[#f4c430] bg-[#f4c430] text-black'
                      : availableDay
                        ? 'border-white/12 bg-white/[0.06] text-white'
                        : 'border-transparent bg-transparent text-white/22'
                  }`}
                  type="button"
                  disabled={!availableDay}
                  onClick={() => availableDay && setSelectedTime(availableDay.times[0])}
                >
                  {cell ? (
                    <span className="flex h-full flex-col items-center justify-center">
                      {cell.getDate()}
                      {availableDay ? <span className={`mt-1 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-black' : 'bg-[#f4c430]'}`} /> : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 space-y-4 rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <button
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-left"
            type="button"
            onClick={() => setServicesOpen((current) => !current)}
          >
            <span>
              <span className="block text-sm font-black text-white">Service</span>
              <span className="block text-sm font-semibold text-white/58">{selectedService || profile.services[0].name}</span>
            </span>
            <ChevronDown className={`text-[#f4c430] transition-transform ${servicesOpen ? 'rotate-180' : ''}`} size={20} />
          </button>

          {servicesOpen ? (
            <div className="space-y-2">
              {profile.services.map((service) => (
                <button
                  key={service.name}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left ${
                    selectedService === service.name ? 'border-[#f4c430] bg-[#f4c430]/12' : 'border-white/10 bg-white/[0.04]'
                  }`}
                  type="button"
                  onClick={() => {
                    setSelectedService(service.name);
                    setServicesOpen(false);
                  }}
                >
                  <span>
                    <span className="block font-black">{service.name}</span>
                    <span className="text-sm font-semibold text-white/52">{service.duration}</span>
                  </span>
                  <span className="text-lg font-black text-[#f4c430]">{service.price}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div>
            <p className="text-sm font-black text-[#f4c430]">
              {selectedDay ? selectedDay.date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a day'}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(selectedDay?.times ?? []).map((slot) => (
                <button
                  key={slot}
                  className={`rounded-2xl border px-3 py-4 text-sm font-black ${
                    selectedTime === slot ? 'border-[#f4c430] bg-[#f4c430] text-black' : 'border-white/10 bg-white/[0.04] text-white'
                  }`}
                  type="button"
                  onClick={() => setSelectedTime(slot)}
                >
                  {formatSlotTime(slot)}
                </button>
              ))}
            </div>
          </div>

          <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 text-base font-black text-black" type="button" onClick={onBook}>
            <CalendarDays size={20} />
            Book an appointment
          </button>
          {booking ? <BookingConfirmation booking={booking} /> : null}
        </div>
      </div>
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
    <div className="mt-5 space-y-4">
      {booking ? (
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <BookingConfirmation booking={booking} />
        </div>
      ) : (
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <CalendarDays className="text-[#f4c430]" size={30} />
          <h2 className="mt-4 text-2xl font-black">No appointment booked yet</h2>
          <p className="mt-2 leading-7 text-white/68">Search without signing up, choose a professional, and your booked appointment will appear here.</p>
        </div>
      )}
      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">Completed appointments</h2>
        <div className="mt-4 space-y-3">
          {completedAppointmentHistory.map((appointment) => {
            const taxes = Math.round(appointment.servicePriceCents * taxRate);
            const total = appointment.servicePriceCents + taxes + appointment.tipCents;
            return (
              <article key={appointment.id} className="rounded-2xl bg-white/[0.05] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{appointment.service}</p>
                    <p className="mt-1 text-sm font-semibold text-white/58">{appointment.professional} - {appointment.date}</p>
                  </div>
                  <p className="text-lg font-black text-[#f4c430]">{formatCurrency(total)}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <InfoTile label="Price" value={formatCurrency(appointment.servicePriceCents)} />
                  <InfoTile label="Tip" value={formatCurrency(appointment.tipCents)} />
                  <InfoTile label="Review" value={appointment.reviewStatus} />
                  <InfoTile label="Photos" value={`${appointment.photosAttached} attached`} />
                </div>
              </article>
            );
          })}
        </div>
      </div>
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
  const [exampleUploaded, setExampleUploaded] = useState(false);
  const [profileUpdated, setProfileUpdated] = useState(false);
  const demoExample = {
    id: 'example_uploaded_demo',
    imageUrl: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80',
    label: 'Uploaded demo example',
    note: 'Client-added inspiration photo shared with the pro before booking.',
  };
  const visibleExamples = exampleUploaded ? [...clientExamplePhotos, demoExample] : clientExamplePhotos;

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <div className="flex items-center gap-4">
          <img className="h-20 w-20 rounded-3xl object-cover" src={clientProfilePhoto} alt="Client profile" />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black">Profile photo</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/62">
              This is your account image. It is separate from haircut history and example photos.
            </p>
          </div>
        </div>
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 font-black text-black"
          type="button"
          onClick={() => setProfileUpdated((value) => !value)}
        >
          <Camera size={18} />
          {profileUpdated ? 'Profile photo updated' : 'Update profile photo'}
        </button>
      </div>

      <PhotoBoard
        actionLabel={exampleUploaded ? 'Example photo uploaded' : 'Upload example photo'}
        description="Upload inspiration photos for what you want. These are shared with the professional before the appointment, but they are not your profile picture or proof of a past cut."
        onAction={() => setExampleUploaded((value) => !value)}
        photos={visibleExamples}
        title="Example photos"
      />

      <PhotoBoard
        description="These are your actual haircut photos from completed appointments. When a professional updates your photo after a cut, it appears here and in their CRM with your consent."
        photos={clientHairPhotos}
        title="Your haircut photos"
      />

      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <QrCode className="text-[#f4c430]" size={30} />
        <h2 className="mt-4 text-2xl font-black">Hair passport QR</h2>
        <p className="mt-2 leading-7 text-white/68">
          Share this with your hairdresser so they can see your haircut photos, preferences, example photos, product notes, and appointment history if they are not on Frizi yet.
        </p>
        <div className="mx-auto mt-5 max-w-xs rounded-3xl bg-white p-4">
          <img className="aspect-square w-full" src={qrUrl} alt="Client hair passport QR code" />
        </div>
        <p className="mt-4 break-all rounded-2xl bg-black/30 p-3 text-sm font-semibold text-white/62">{passportUrl}</p>
      </div>
    </div>
  );
}

function PhotoBoard({
  actionLabel,
  description,
  onAction,
  photos,
  title,
}: {
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  photos: Array<{ id: string; imageUrl: string; label: string; note: string }>;
  title: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-2 leading-7 text-white/68">{description}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {photos.map((photo) => (
          <article key={photo.id} className="overflow-hidden rounded-3xl bg-white/[0.06]">
            <img className="aspect-[4/5] w-full object-cover" src={photo.imageUrl} alt="" />
            <div className="p-3">
              <p className="font-black">{photo.label}</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-white/58">{photo.note}</p>
            </div>
          </article>
        ))}
      </div>
      {actionLabel && onAction ? (
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 font-black text-black" type="button" onClick={onAction}>
          <Camera size={18} />
          {actionLabel}
        </button>
      ) : null}
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
  const [tipChoice, setTipChoice] = useState<TipChoice>(defaultTipChoice);
  const [customTip, setCustomTip] = useState('');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const serviceTotal = booking.servicePriceCents;
  const taxes = Math.round(serviceTotal * taxRate);
  const tipAmount =
    tipChoice === 'none'
      ? 0
      : tipChoice === 'custom'
        ? Math.max(0, parseMoneyToCents(customTip))
        : Math.round(serviceTotal * (tipChoice / 100));
  const finalTotal = serviceTotal + taxes + tipAmount;
  const receiptId = `frizi_rcpt_${booking.eventId.split(':').pop()}`;

  if (paymentComplete) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
        <p className="flex items-center gap-2 text-xl font-black text-emerald-300">
          <CheckCircle2 size={22} />
          Payment Successful
        </p>
        <p className="mt-2 text-sm leading-6 text-white/74">
          Thanks for booking with {booking.professional}. Your receipt is saved to payment history and the pro-side booking record.
        </p>
        <div className="mt-4 rounded-2xl bg-black/28 p-4">
          <p className="mb-3 flex items-center gap-2 font-black text-white">
            <ReceiptText size={18} className="text-[#f4c430]" />
            Receipt summary
          </p>
          <ReceiptRow label="Service" value={booking.service} />
          <ReceiptRow label="Appointment" value={booking.time} />
          <ReceiptRow label="Service total" value={formatCurrency(serviceTotal)} />
          <ReceiptRow label="Taxes" value={formatCurrency(taxes)} />
          <ReceiptRow label="Tip" value={formatCurrency(tipAmount)} highlight />
          <ReceiptRow label="Total paid" value={formatCurrency(finalTotal)} strong />
          <p className="mt-3 text-xs font-bold text-white/48">Receipt {receiptId}. Tip is stored separately from service revenue for payout and refund reporting.</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button className="rounded-2xl bg-white px-3 py-3 text-sm font-black text-black" type="button">
            Leave a Review
          </button>
          <button className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-3 py-3 text-sm font-black text-white" type="button">
            <Camera size={16} />
            Upload haircut photos
          </button>
          <button className="rounded-2xl bg-[#f4c430] px-3 py-3 text-sm font-black text-black" type="button">
            Book next appointment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#f4c430]/35 bg-[#f4c430]/10 p-4">
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
      <div className="mt-4 rounded-2xl border border-white/10 bg-[#101014] p-4">
        <p className="flex items-center gap-2 text-lg font-black text-white">
          <CreditCard size={19} className="text-[#f4c430]" />
          Add gratuity before payment
        </p>
        <p className="mt-1 text-sm leading-6 text-white/62">Tips are optional and go with the individual professional's earnings history.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[15, 18, 20, 25].map((percent) => (
            <button
              key={percent}
              className={`rounded-2xl px-3 py-3 text-sm font-black ${
                tipChoice === percent ? 'bg-[#f4c430] text-black' : 'bg-white/10 text-white'
              }`}
              type="button"
              onClick={() => setTipChoice(percent as TipChoice)}
            >
              {percent}%
            </button>
          ))}
          <button
            className={`rounded-2xl px-3 py-3 text-sm font-black ${
              tipChoice === 'custom' ? 'bg-[#f4c430] text-black' : 'bg-white/10 text-white'
            }`}
            type="button"
            onClick={() => setTipChoice('custom')}
          >
            Custom
          </button>
          <button
            className={`rounded-2xl px-3 py-3 text-sm font-black ${
              tipChoice === 'none' ? 'bg-[#f4c430] text-black' : 'bg-white/10 text-white'
            }`}
            type="button"
            onClick={() => setTipChoice('none')}
          >
            No Tip
          </button>
        </div>
        {tipChoice === 'custom' ? (
          <label className="mt-3 block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-white/50">Custom tip amount</span>
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 font-bold text-white outline-none placeholder:text-white/35"
              inputMode="decimal"
              placeholder="$20.00"
              value={customTip}
              onChange={(event) => setCustomTip(event.target.value)}
            />
          </label>
        ) : null}
        <div className="mt-4 rounded-2xl bg-black/28 p-4">
          <ReceiptRow label="Service Total" value={formatCurrency(serviceTotal)} />
          <ReceiptRow label="Taxes" value={formatCurrency(taxes)} />
          <ReceiptRow label="Optional Tip" value={formatCurrency(tipAmount)} highlight />
          <ReceiptRow label="Final Total" value={formatCurrency(finalTotal)} strong />
        </div>
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 text-base font-black text-black"
          type="button"
          onClick={() => setPaymentComplete(true)}
        >
          Confirm payment
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ReceiptRow({
  highlight,
  label,
  strong,
  value,
}: {
  highlight?: boolean;
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1 ${strong ? 'border-t border-white/10 pt-3 text-lg' : 'text-sm'}`}>
      <span className={strong ? 'font-black text-white' : 'font-semibold text-white/62'}>{label}</span>
      <span className={`font-black ${highlight ? 'text-[#f4c430]' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function parseMoneyToCents(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(cents / 100);
}

function buildAvailabilityDays(slots: string[]) {
  const grouped = slots.reduce<Array<{ date: Date; label: string; times: string[]; weekday: string; dayNumber: number }>>(
    (days, slot) => {
      const date = dateFromSlot(slot);
      const label = date.toDateString();
      const existing = days.find((day) => day.label === label);
      if (existing) {
        existing.times.push(slot);
        return days;
      }

      days.push({
        date,
        label,
        times: [slot],
        weekday: date.toLocaleDateString('en-CA', { weekday: 'short' }),
        dayNumber: date.getDate(),
      });
      return days;
    },
    [],
  );

  return grouped.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function buildMonthCells(monthCursor: Date) {
  const firstDay = startOfMonth(monthCursor);
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = Array.from({ length: firstDay.getDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(firstDay.getFullYear(), firstDay.getMonth(), day));
  }

  return cells;
}

function dateFromSlot(slot: string) {
  const now = new Date();
  const normalized = slot.toLowerCase();
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const explicitDay = dayNames.findIndex((day) => normalized.startsWith(day));

  if (normalized.startsWith('today')) return startOfDay(now);
  if (normalized.startsWith('tomorrow')) return addDays(startOfDay(now), 1);
  if (explicitDay >= 0) {
    const today = startOfDay(now);
    const offset = (explicitDay - today.getDay() + 7) % 7 || 7;
    return addDays(today, offset);
  }

  return startOfDay(now);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatSlotTime(slot: string) {
  return slot.replace(/^(today|tomorrow|mon|tue|wed|thu|fri|sat|sun)\s+/i, '');
}

function rankProfessionals(query: string, filters: FilterState) {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return filterLocalProfiles(professionals, filters).sort((a, b) => scoreProfile(b, tokens) - scoreProfile(a, tokens));
}

function filterLocalProfiles(profiles: Professional[], filters: FilterState) {
  return profiles.filter((profile) => {
    if (distanceToKm(profile.distance) > filters.distanceKm) return false;
    if (!profileMatchesFilter(profile, filters.serviceType, 'service')) return false;
    if (!profileMatchesFilter(profile, filters.specialty, 'specialty')) return false;
    if (!profileMatchesFilter(profile, filters.accessibility, 'accessibility')) return false;
    return true;
  });
}

function distanceToKm(distance: string) {
  const parsed = Number(distance.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function profileMatchesFilter(profile: Professional, option: string, kind: 'service' | 'specialty' | 'accessibility') {
  if (option.startsWith('Any')) return true;
  const normalized = option.toLowerCase();
  const haystacks = {
    service: [...profile.services.map((service) => service.name), ...profile.searchTerms],
    specialty: [...profile.specialties, ...profile.services.map((service) => service.name), ...profile.searchTerms],
    accessibility: [...profile.accommodations, ...profile.searchTerms],
  };
  return haystacks[kind].some((value) => {
    const candidate = value.toLowerCase();
    return candidate.includes(normalized) || normalized.includes(candidate);
  });
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

export default App;
