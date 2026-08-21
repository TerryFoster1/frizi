import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
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
  Trash2,
  User,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { Session as SupabaseSession, User as SupabaseUser } from '@supabase/supabase-js';
import { type CSSProperties, type FocusEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, isSupabaseConfigured } from './utils/supabase/client';

type Service = {
  id?: string;
  name: string;
  duration: string;
  price: string;
  durationMinutes?: number;
  paymentRequirement?: string;
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
  id?: string;
  professionalId: string;
  professional: string;
  service: string;
  serviceId: string;
  servicePriceCents: number;
  date: string;
  time: string;
  eventId: string;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
  scheduledStart?: string;
  scheduledEnd?: string;
  paymentRequirement?: string;
  paymentStatus?: string;
};

type CommerceCatalogueItem = {
  product: {
    id: string;
    brandName: string;
    productName: string;
    subtitle: string;
    description: string;
    usageInstructions: string;
    warnings: string;
    productCategories: string[];
    complianceState: string;
    primaryImage: string;
    complianceNote: string;
    sellerIdentity: string;
  };
  variant: {
    id: string;
    variantName: string;
    sku: string;
    priceCents: number;
    compareAtPriceCents: number | null;
    quantityOnHand: number;
    quantityReserved: number;
    inventoryMode: string;
  };
  recommendation: null | {
    id: string;
    professionalId: string;
    reason: string;
    usageInstructions: string;
    frequency: string;
    recommendedAt: string;
  };
  purchasable: boolean;
  blockedReason: string;
};

type CommerceCartItem = {
  variantId: string;
  quantity: number;
  recommendationId?: string;
};

type CommerceCartSummary = {
  customerId: string;
  items: Array<{
    variantId: string;
    productName: string;
    brandName: string;
    variantName: string;
    primaryImage: string;
    quantity: number;
    unitPriceCents: number;
    lineSubtotalCents: number;
    discountCents: number;
    lineNetCents: number;
    professionalName: string;
    commissionCents: number;
    returnPolicyId: string;
  }>;
  merchandiseSubtotalCents: number;
  productDiscountCents: number;
  merchandiseNetCents: number;
  shipping: {
    provider: string;
    service: string;
    shippingCents: number;
    shippingDiscountCents: number;
    estimatedTransitDays: string;
    packageName: string;
    destinationProvince: string;
    destinationPostalCode: string;
  };
  taxBps: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  promotion: null | { id: string; name: string; code: string; scope: string; discountType: string; discountValue: number };
  sellerIdentity: string;
  customerServiceContact: string;
  policyVersion: string;
  quoteExpiresAt: string;
  featureFlags: Record<string, boolean>;
  complianceWarning: string;
};

const clientSessionStorageKey = 'frizi-client-session';
const pendingBookingStorageKey = 'frizi-client-pending-booking';
const clientOAuthContextStorageKey = 'frizi-client-oauth-context';
const pendingInviteStorageKey = 'frizi-client-pending-invite';
const locationPromptStorageKey = 'frizi-client-location-prompt-complete';

type ClientNavKey = 'appointments' | 'saved' | 'products' | 'profile';
type AccountNavKey = Exclude<ClientNavKey, 'products'>;
type ClientAuthIntent = 'default' | 'promo' | 'booking' | 'invite' | AccountNavKey;

type FilterState = {
  distanceKm: number;
  serviceType: string;
  specialty: string;
  accessibility: string;
};

type ClientSession = {
  name: string;
  email: string;
  accessToken?: string;
};

type ClientPhoto = {
  id: string;
  imagePath: string;
  imageUrl: string;
  label: string;
  note: string;
  photoType: 'profile' | 'hair_history' | 'example_reference';
};

type ClientPassport = {
  id: string;
  status: string;
  passportUrl: string;
  expiresAt?: string | null;
};

function isAccountNavIntent(intent: ClientAuthIntent): intent is AccountNavKey {
  return intent === 'appointments' || intent === 'saved' || intent === 'profile';
}

function readClientOAuthContext() {
  try {
    const rawContext = window.sessionStorage.getItem(clientOAuthContextStorageKey);
    if (!rawContext) return null;
    const parsed = JSON.parse(rawContext) as { intent?: string; returnPath?: string; hasPendingBooking?: boolean };
    const intent: ClientAuthIntent = parsed.intent === 'promo' || parsed.intent === 'booking' || parsed.intent === 'invite' || isAccountNavIntent(parsed.intent as ClientAuthIntent)
      ? (parsed.intent as ClientAuthIntent)
      : 'default';
    const returnPath = typeof parsed.returnPath === 'string' && parsed.returnPath.startsWith('/') ? parsed.returnPath : '/';
    return { intent, returnPath, hasPendingBooking: Boolean(parsed.hasPendingBooking) };
  } catch {
    return null;
  }
}

function inviteTokenFromPath(pathname = window.location.pathname) {
  return pathname.match(/^\/invite\/([^/?#]+)/)?.[1] || '';
}

function writePendingInviteContext(token: string) {
  if (!token) return;
  window.localStorage.setItem(
    pendingInviteStorageKey,
    JSON.stringify({
      token,
      startedAt: new Date().toISOString(),
    }),
  );
}

function readPendingInviteContext() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(pendingInviteStorageKey) || '{}') as {
      token?: string;
      startedAt?: string;
    };
    return typeof parsed.token === 'string' && parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

function clearPendingInviteContext(token?: string) {
  const pending = readPendingInviteContext();
  if (!token || !pending || pending.token === token) {
    window.localStorage.removeItem(pendingInviteStorageKey);
  }
}

type LiveInvite = {
  invitation: {
    id: string;
    token: string;
    source: string;
    expiresAt: string | null;
  };
  professional: Professional;
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

type InfoPage = {
  title: string;
  eyebrow: string;
  summary: string;
  points: string[];
  cta?: { label: string; href: string };
};

const defaultFilters: FilterState = {
  distanceKm: 5,
  serviceType: 'Any service',
  specialty: 'Any specialty',
  accessibility: 'Any accessibility',
};

const serviceTypeOptions = [
  'Any service',
  'Hairstylist',
  'Barber',
  'Colourist',
  'Beard Grooming',
  'Extensions',
  'Braids',
  'Curly Hair',
  'Bridal Hair',
  'Manicure',
  'Lashes',
  'Brows',
];
const specialtyOptions = [
  'Any specialty',
  'Fine hair',
  'Curly Hair',
  'Barber',
  'Short cuts',
  'Colourist',
  'Extensions',
  'Braids',
  'Bridal Hair',
];
const accessibilityOptions = [
  'Any accessibility',
  'Quiet appointment',
  'Private room',
  'Hijab-friendly space',
  'Muslim friendly',
  'Fragrance aware',
];

const searchSuggestionCategories = [
  {
    label: 'Hairstylist',
    query: 'Hairstylist',
    aliases: ['stylist', 'haircut', 'hair services', 'blowout', 'cut'],
  },
  {
    label: 'Barber',
    query: 'Barber',
    aliases: ['barbering', "men's cuts", 'mens cuts', 'fades', 'beard services'],
  },
  {
    label: 'Colourist',
    query: 'Colourist',
    aliases: ['colour', 'color', 'highlights', 'balayage', 'colour correction', 'color correction'],
  },
  { label: 'Stylist', query: 'Stylist', aliases: ['hairstylist', 'hair professional', 'cut and style'] },
  { label: 'Beard Grooming', query: 'Beard Grooming', aliases: ['beard', 'barbering', 'line up', 'trim'] },
  { label: 'Manicure', query: 'Manicure', aliases: ['nails', 'gel nails', 'nail care'] },
  { label: 'Lashes', query: 'Lashes', aliases: ['lash extensions', 'lash lift'] },
  { label: 'Brows', query: 'Brows', aliases: ['brow shaping', 'brow lamination'] },
  { label: 'Extensions', query: 'Extensions', aliases: ['hair extensions', 'weave'] },
  { label: 'Braids', query: 'Braids', aliases: ['protective styles', 'braiding'] },
  { label: 'Curly Hair', query: 'Curly Hair', aliases: ['curls', 'curly cuts', 'texture'] },
  { label: 'Bridal Hair', query: 'Bridal Hair', aliases: ['wedding hair', 'updo', 'formal styling'] },
] as const;

const completedAppointmentHistory = [] as Array<{
  id: string;
  professional: string;
  service: string;
  date: string;
  servicePriceCents: number;
  tipCents: number;
  reviewStatus: string;
  photosAttached: number;
}>;
const clientProfilePhoto = '';
const clientHairPhotos = [] as ClientPhoto[];
const clientExamplePhotos = [] as ClientPhoto[];


type LiveProfessionalRow = {
  id: string;
  display_name: string;
  studio_name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  hero_photo_url: string | null;
  specialties: string[] | null;
  primary_specialty: string | null;
  booking_settings: Record<string, unknown> | null;
};

type LiveLocationRow = {
  professional_id: string;
  city: string;
  province: string;
  service_radius_km: number | null;
};

type LiveServiceRow = {
  id: string;
  professional_id: string;
  name: string;
  public_description: string | null;
  base_price_cents: number;
  pricing_type: string;
  duration_minutes: number | null;
  deposit_type: string;
  deposit_amount_cents: number;
  deposit_percentage: number;
  service_metadata: Record<string, unknown> | null;
};

function formatServicePrice(service: LiveServiceRow) {
  if (service.pricing_type === 'free_consultation') return 'Free';
  if (service.pricing_type === 'price_varies') return 'Varies';
  const dollars = Math.round(service.base_price_cents / 100);
  return service.pricing_type === 'starting_at' ? `From $${dollars}` : `$${dollars}`;
}

function liveProfessionalSearchTerms(profile: LiveProfessionalRow, location?: LiveLocationRow) {
  return [
    profile.display_name,
    profile.studio_name || '',
    profile.bio || '',
    profile.primary_specialty || '',
    ...(profile.specialties || []),
    location?.city || '',
    location?.province || '',
    'book online',
    'frizi professional',
  ].filter(Boolean);
}

function taxonomyTermsForLiveProfile(profile: LiveProfessionalRow, services: LiveServiceRow[]) {
  const rawTerms = [
    profile.primary_specialty || '',
    ...(profile.specialties || []),
    ...services.flatMap((service) => [service.name, service.public_description || '']),
  ]
    .join(' ')
    .toLowerCase();

  const aliases: string[] = [];
  if (/\b(barber|fade|taper|beard|men|mens|line up)\b/.test(rawTerms)) {
    aliases.push('Barber', 'barbering', "men's cuts", 'fades', 'Beard Grooming', 'beard services');
  }
  if (/\b(colou?r|highlight|balayage|toner|blond|correction)\b/.test(rawTerms)) {
    aliases.push('Colourist', 'colour', 'color', 'highlights', 'balayage', 'colour correction');
  }
  if (/\b(curl|curly|texture|wave)\b/.test(rawTerms)) {
    aliases.push('Curly Hair', 'curls', 'curly cuts', 'texture');
  }
  if (/\b(extension|weave)\b/.test(rawTerms)) aliases.push('Extensions', 'hair extensions');
  if (/\b(braid|protective)\b/.test(rawTerms)) aliases.push('Braids', 'protective styles');
  if (/\b(bride|bridal|wedding|updo)\b/.test(rawTerms)) aliases.push('Bridal Hair', 'wedding hair');
  if (/\b(manicure|nail)\b/.test(rawTerms)) aliases.push('Manicure', 'nails');
  if (/\b(lash|lashes)\b/.test(rawTerms)) aliases.push('Lashes', 'lash extensions');
  if (/\b(brow|brows)\b/.test(rawTerms)) aliases.push('Brows', 'brow shaping');
  if (/\b(hair|cut|style|blowout|stylist)\b/.test(rawTerms)) aliases.push('Hairstylist', 'Stylist', 'hair services');

  return Array.from(new Set(aliases));
}

async function loadLiveProfessionals(): Promise<Professional[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = createClient();
  const { data: liveProfiles, error: profileError } = await supabase
    .from('frizi_professionals')
    .select('id, display_name, studio_name, bio, specialties, primary_specialty, profile_photo_url, hero_photo_url, booking_settings')
    .eq('public_profile_status', 'published')
    .eq('bookable', true)
    .in('subscription_status', ['active', 'trialing'])
    .order('updated_at', { ascending: false })
    .limit(12);

  if (profileError) throw profileError;
  if (!liveProfiles?.length) return [];

  const ids = liveProfiles.map((profile: LiveProfessionalRow) => profile.id);
  const [{ data: locations, error: locationError }, { data: services, error: serviceError }] = await Promise.all([
    supabase
      .from('frizi_professional_locations')
      .select('professional_id, city, province, service_radius_km')
      .in('professional_id', ids)
      .eq('primary_location', true)
      .eq('active', true),
    supabase
      .from('frizi_services')
      .select('id, professional_id, name, public_description, base_price_cents, pricing_type, duration_minutes, deposit_type, deposit_amount_cents, deposit_percentage, service_metadata')
      .in('professional_id', ids)
      .eq('active', true)
      .eq('online_booking_enabled', true)
      .order('display_order', { ascending: true }),
  ]);

  if (locationError) throw locationError;
  if (serviceError) throw serviceError;

  return (liveProfiles as LiveProfessionalRow[])
    .flatMap((profile): Professional[] => {
    const location = (locations as LiveLocationRow[] | null)?.find((candidate) => candidate.professional_id === profile.id);
    const profileServices = ((services as LiveServiceRow[] | null) || []).filter((service) => service.professional_id === profile.id);
    const specialties = profile.specialties?.length ? profile.specialties : [profile.primary_specialty || 'Hair services'];
    if (!profileServices.length) return [];
    const bookingSlots = buildSlotsFromBookingSettings(profile.booking_settings, profileServices[0]?.duration_minutes || 60);
    const searchTerms = [
      ...liveProfessionalSearchTerms(profile, location),
      ...profileServices.flatMap((service) => [service.name, service.public_description || '']),
      ...taxonomyTermsForLiveProfile(profile, profileServices),
    ].filter(Boolean);

    return [{
      id: `live-${profile.id}`,
      name: profile.display_name,
      role: profile.primary_specialty || 'Frizi professional',
      studio: profile.studio_name || 'Independent professional',
      neighborhood: location ? `${location.city}, ${location.province}` : 'Local area',
      distance: location?.city ? location.city : 'Local area',
      heroImage: profile.hero_photo_url || profile.profile_photo_url || '/frizi-icon.png',
      detailImage: profile.profile_photo_url || profile.hero_photo_url || '/frizi-icon.png',
      rating: 0,
      reviews: 0,
      repeatRate: 'New',
      nextAvailable: 'Request a time',
      specialties,
      accommodations: ['Book online', 'Frizi verified profile'],
      searchTerms,
      whyMatch: profile.studio_name || 'Independent professional',
      bio: profile.bio || 'This professional has not added a bio yet.',
      services: profileServices.map((service) => ({
            name: service.name,
            duration: `${service.duration_minutes || 60} min`,
            price: formatServicePrice(service),
            id: service.id,
            durationMinutes: service.duration_minutes || 60,
            paymentRequirement: paymentRequirementForService(service),
          })),
      bookingSlots,
      clientReviews: [],
      promotion: '',
    }];
    });
}

function paymentRequirementForService(service: LiveServiceRow) {
  const metadataRequirement = String(service.service_metadata?.payment_requirement || '');
  if (['pay_at_appointment', 'frizi_payment_optional', 'deposit_required', 'full_prepayment_required'].includes(metadataRequirement)) {
    return metadataRequirement;
  }
  if (service.deposit_type && service.deposit_type !== 'none') return 'deposit_required';
  return 'pay_at_appointment';
}

function buildSlotsFromBookingSettings(settings: Record<string, unknown> | null, durationMinutes: number) {
  const availability = (settings?.availability || {}) as { shifts?: Array<{ date?: string; startTime?: string; endTime?: string }> };
  const intervalMinutes = Number((availability as { bookingIntervalMinutes?: number }).bookingIntervalMinutes || 30);
  const shifts = Array.isArray(availability.shifts) ? availability.shifts : [];
  const now = new Date();
  const slots: string[] = [];

  for (const shift of shifts) {
    if (!shift.date || !shift.startTime || !shift.endTime) continue;
    const startMinutes = parseClockMinutes(shift.startTime);
    const endMinutes = parseClockMinutes(shift.endTime);
    if (startMinutes === null || endMinutes === null) continue;

    for (let cursor = startMinutes; cursor + durationMinutes <= endMinutes; cursor += intervalMinutes) {
      const slot = dateTimeFromParts(shift.date, cursor);
      if (slot.getTime() <= now.getTime() + 12 * 60 * 60 * 1000) continue;
      slots.push(slot.toISOString());
      if (slots.length >= 24) return slots;
    }
  }

  return slots.sort();
}

function parseClockMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function dateTimeFromParts(date: string, minutes: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

const infoPages: Record<string, InfoPage> = {
  'help/payments': {
    eyebrow: 'Help',
    title: 'Payments and payouts',
    summary:
      'Frizi is being set up for Stripe Connect so clients can pay for bookings and products in-app while professionals receive payouts through the platform.',
    points: [
      'Frizi Pro is modeled as a $29/month subscription for professionals.',
      'Online service and product payments may carry a disclosed platform transaction fee when Frizi payments are enabled.',
      'Service payments can use Stripe Connect destination charges with the professional as the connected account and Frizi collecting the application fee.',
      'Standard payouts are planned weekly. Instant payout can be offered as an optional faster transfer with an added 2% fee where Stripe eligibility allows it.',
      'Live processing requires payment onboarding and business verification before client cards are charged.',
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
      'These terms explain the basic roles in Frizi: clients book through Frizi, professionals manage services and CRM, and Frizi operates the software platform.',
    points: [
      'Clients are responsible for entering accurate booking, contact, hair profile, delivery, and payment information.',
      'Professionals are responsible for service descriptions, availability, appointment quality, cancellation handling, and any client-facing claims they publish.',
      'Frizi may collect subscription fees, transaction fees, product margins, and other disclosed fees for use of the platform.',
      'Product prices, availability, and delivery windows can change before checkout is confirmed.',
      'Frizi will publish updated policy terms as new payment and product features go live.',
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
      'This policy separates service payments from product orders and keeps client support routed through Frizi.',
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
  const inviteToken = inviteTokenFromPath();
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
  const [authIntent, setAuthIntent] = useState<ClientAuthIntent>('default');
  const [clientSession, setClientSession] = useState<ClientSession | null>(null);
  const [openBookingAfterAuth, setOpenBookingAfterAuth] = useState(false);
  const [liveProfessionals, setLiveProfessionals] = useState<Professional[]>([]);
  const [clientAppointments, setClientAppointments] = useState<BookingRequest[]>([]);
  const [bookingError, setBookingError] = useState('');
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  useEffect(() => {
    const savedSession = window.localStorage.getItem(clientSessionStorageKey);
    if (!savedSession) return;
    try {
      setClientSession(JSON.parse(savedSession) as ClientSession);
    } catch {
      window.localStorage.removeItem(clientSessionStorageKey);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient()
      .auth.getSession()
      .then(async ({ data }) => {
        if (!data.session?.access_token) return;
        const authContext = readClientOAuthContext();
        const session = clientSessionFromSupabaseSession(data.session);
        await ensureCanonicalClientProfile(data.session.user, session.name).catch((error) =>
          console.warn('[frizi-client-profile-upsert]', error instanceof Error ? error.message : error),
        );
        setClientSession(session);
        window.localStorage.setItem(clientSessionStorageKey, JSON.stringify(session));
        window.sessionStorage.removeItem(clientOAuthContextStorageKey);
        const pendingBooking = window.localStorage.getItem(pendingBookingStorageKey);
        if (pendingBooking) {
          try {
            void submitBookingRequest(JSON.parse(pendingBooking) as BookingRequest, session);
          } finally {
            window.localStorage.removeItem(pendingBookingStorageKey);
          }
        } else {
          void loadClientAppointments(session);
          if (authContext?.intent === 'promo') {
            setOpenBookingAfterAuth(true);
          } else if (authContext?.intent === 'invite') {
            trackClientEvent('auth_completed', {
              intent: 'invite',
              route: authContext.returnPath,
            });
          } else if (authContext && isAccountNavIntent(authContext.intent)) {
            setActiveClientNav(authContext.intent);
          }
        }
      })
      .catch((error) => console.warn('[frizi-client-auth-session]', error instanceof Error ? error.message : error));
  }, []);

  useEffect(() => {
    loadLiveProfessionals()
      .then(setLiveProfessionals)
      .catch((error) => console.warn('[frizi-live-professionals]', error instanceof Error ? error.message : error));
  }, []);

  const allProfessionals = liveProfessionals;
  const hasSearched = submittedQuery.trim().length > 0;
  const rankedProfiles = useMemo(
    () => (hasSearched ? rankProfessionals(allProfessionals, submittedQuery, filters) : []),
    [allProfessionals, filters, hasSearched, submittedQuery],
  );
  const activeProfile = rankedProfiles.length > 0 ? rankedProfiles[activeIndex % rankedProfiles.length] : null;
  const activeService = activeProfile ? selectedService || activeProfile.services[0].name : '';
  const activeTime = activeProfile ? selectedTime || activeProfile.bookingSlots[0] || '' : '';

  if (infoPageMatch) {
    const pageKey = `${infoPageMatch[1]}/${infoPageMatch[2]}`;
    return <InfoPageView page={infoPages[pageKey]} />;
  }

  if (inviteToken) {
    return (
      <>
        <InviteLanding
          token={inviteToken}
          clientSession={clientSession}
          onAuthRequired={() => openClientAuth('invite')}
          onClientConnected={(session) => {
            setClientSession(session);
            window.localStorage.setItem(clientSessionStorageKey, JSON.stringify(session));
          }}
          onContinueHome={(session) => {
            setClientSession(session);
            window.localStorage.setItem(clientSessionStorageKey, JSON.stringify(session));
            setActiveClientNav('profile');
            window.history.replaceState({}, '', '/');
            trackClientEvent('client_home_reached', {
              invitation_token: inviteToken,
              route: '/',
            });
          }}
        />
        {authModalOpen ? <ClientAuthModal intent={authIntent} onClose={() => setAuthModalOpen(false)} onComplete={handleClientAuth} /> : null}
      </>
    );
  }

  function submitSearch(nextQuery = query) {
    const trimmedQuery = nextQuery.trim();
    if (!trimmedQuery) return;
    setQuery(trimmedQuery);
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
      setVoiceMessage('Voice search is not available in this browser.');
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

  function handleClientAuth(session: ClientSession, createdAccount = false) {
    setClientSession(session);
    window.localStorage.setItem(clientSessionStorageKey, JSON.stringify(session));
    setAuthModalOpen(false);
    trackClientEvent('auth_completed', {
      intent: authIntent,
      route: window.location.pathname,
    });
    if (authIntent === 'invite') {
      setAuthIntent('default');
      return;
    }
    if (createdAccount && !window.localStorage.getItem(locationPromptStorageKey)) {
      setLocationPromptOpen(true);
    }
    if (authIntent === 'booking') {
      const pendingBooking = window.localStorage.getItem(pendingBookingStorageKey);
      if (pendingBooking) {
        try {
          void submitBookingRequest(JSON.parse(pendingBooking) as BookingRequest, session);
          window.localStorage.removeItem(pendingBookingStorageKey);
        } catch {
          window.localStorage.removeItem(pendingBookingStorageKey);
        }
      }
    } else if (authIntent === 'promo') {
      setOpenBookingAfterAuth(true);
      setActiveClientNav(null);
    } else if (isAccountNavIntent(authIntent)) {
      setActiveClientNav(authIntent);
    } else {
      setActiveClientNav('profile');
    }
    setAuthIntent('default');
  }

  function clearClientAccountBrowserState() {
    window.localStorage.removeItem(clientSessionStorageKey);
    window.localStorage.removeItem(pendingBookingStorageKey);
    window.localStorage.removeItem(pendingInviteStorageKey);
    window.sessionStorage.removeItem(clientOAuthContextStorageKey);
    setClientSession(null);
    setClientAppointments([]);
    setBooking(null);
    setOpenBookingAfterAuth(false);
    setAuthIntent('default');
    setAuthModalOpen(false);
    setDeleteAccountOpen(false);
    setActiveClientNav(null);
  }

  async function signOutClient() {
    await createClient().auth.signOut().catch(() => undefined);
    clearClientAccountBrowserState();
  }

  async function deleteClientAccount(confirmation: string) {
    const { data, error } = await createClient().auth.getSession();
    const accessToken = data.session?.access_token || clientSession?.accessToken;
    if (error || !accessToken) throw error || new Error('Sign in again before deleting your account.');

    const response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmation }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Account deletion could not be completed.');
    await createClient().auth.signOut().catch(() => undefined);
    clearClientAccountBrowserState();
  }

  async function loadClientAppointments(session = clientSession) {
    if (!session?.accessToken) return;
    try {
      const response = await fetch('/api/client-appointments', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load appointments.');
      const appointments: BookingRequest[] = Array.isArray(payload.appointments)
        ? payload.appointments.map((appointment: Record<string, unknown>) => bookingFromApiAppointment(appointment))
        : [];
      setClientAppointments(appointments);
      const nextAppointment = appointments.find((appointment) => appointment.status === 'pending' || appointment.status === 'confirmed');
      if (nextAppointment) setBooking(nextAppointment);
    } catch (error) {
      console.warn('[frizi-client-appointments]', error instanceof Error ? error.message : error);
    }
  }

  async function submitBookingRequest(request: BookingRequest, session = clientSession) {
    setBookingError('');
    if (!session?.accessToken) {
      window.localStorage.setItem(pendingBookingStorageKey, JSON.stringify(request));
      openClientAuth('booking');
      return;
    }

    try {
      const response = await fetch('/api/client-appointments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          professionalId: request.professionalId,
          serviceId: request.serviceId,
          scheduledStart: request.scheduledStart || request.time,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not book that appointment.');
      const confirmedRequest = bookingFromApiAppointment(payload.appointment);
      setBooking(confirmedRequest);
      setClientAppointments((current) => [confirmedRequest, ...current.filter((appointment) => appointment.id !== confirmedRequest.id)]);
      setActiveClientNav('appointments');
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Could not book that appointment.');
      setActiveClientNav(null);
    }
  }

  function openClientAuth(intent: ClientAuthIntent = 'default') {
    setAuthIntent(intent);
    setAuthModalOpen(true);
  }

  function handleClientNavChange(nav: ClientNavKey) {
    if (nav === 'products') {
      setActiveClientNav(nav);
      return;
    }
    if (!clientSession) {
      openClientAuth(nav);
      return;
    }
    setActiveClientNav(nav);
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
    if (!activeTime) {
      setBookingError('Choose an available appointment time.');
      return;
    }
    const selectedService = activeProfile.services.find((service) => service.name === activeService) || activeProfile.services[0];
    const selectedDay = buildAvailabilityDays(activeProfile.bookingSlots).find((day) => day.times.includes(activeTime));
    const request: BookingRequest = {
      professionalId: activeProfile.id,
      professional: activeProfile.name,
      service: selectedService.name,
      serviceId: selectedService.id || serviceIdFor(activeProfile.id, selectedService.name),
      servicePriceCents: parseMoneyToCents(selectedService.price),
      date: selectedDay
        ? selectedDay.date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'Selected date',
      time: activeTime,
      eventId: `appt_${Date.now().toString(36)}`,
      status: 'pending',
      scheduledStart: activeTime,
      paymentRequirement: selectedService.paymentRequirement || 'pay_at_appointment',
    };

    if (!clientSession) {
      window.localStorage.setItem(pendingBookingStorageKey, JSON.stringify(request));
      openClientAuth('booking');
      return;
    }

    void submitBookingRequest(request);
  }

  const showResults = hasSearched && Boolean(activeProfile);

  return (
    <main className="clientApp min-h-screen bg-[#080808] pb-24 text-white">
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
              onClick={() => (clientSession ? setActiveClientNav('profile') : openClientAuth('profile'))}
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
          appointments={clientAppointments}
          clientSession={clientSession}
          isDemo={false}
          onBookSaved={(profileId) => {
            const index = allProfessionals.findIndex((profile) => profile.id === profileId);
            if (index >= 0) {
              const profile = allProfessionals[index];
              setSubmittedQuery(profile.name);
              setQuery(profile.name);
              setActiveIndex(0);
              setActiveClientNav(null);
              window.setTimeout(() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' }), 50);
            }
          }}
          onDeleteAccount={() => setDeleteAccountOpen(true)}
          onSignOut={signOutClient}
          savedProfiles={allProfessionals.filter((profile) => savedIds.includes(profile.id))}
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
                  onToggleSaved={() => (clientSession ? toggleSaved(activeProfile.id) : openClientAuth('saved'))}
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
                bookingError={bookingError}
                clientSession={clientSession}
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
      {deleteAccountOpen ? <ClientDeleteAccountModal onClose={() => setDeleteAccountOpen(false)} onDelete={deleteClientAccount} /> : null}
      {locationPromptOpen ? <LocationPrompt onClose={() => setLocationPromptOpen(false)} /> : null}
      <DesktopMobilePrompt canonicalOrigin="https://frizi.ca" storageKey="frizi-client-mobile-prompt-dismissed" />
      <ClientFooter activeNav={activeClientNav} onChange={handleClientNavChange} />
    </main>
  );
}

function DesktopMobilePrompt({ canonicalOrigin, storageKey }: { canonicalOrigin: string; storageKey: string }) {
  const [dismissed, setDismissed] = useState(() => window.localStorage.getItem(storageKey) === '1');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 900px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 900px)');
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (dismissed || !isDesktop) return;
    const path = `${window.location.pathname}${window.location.search}`;
    QRCode.toDataURL(`${canonicalOrigin}${path}`, { margin: 2, width: 164, color: { dark: '#23201c', light: '#fffaf0' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [canonicalOrigin, dismissed, isDesktop]);

  if (dismissed || !isDesktop) return null;

  return (
    <aside className="desktopMobilePrompt" aria-label="Open Frizi on mobile">
      <button
        className="desktopMobilePromptClose"
        type="button"
        aria-label="Dismiss mobile prompt"
        onClick={() => {
          window.localStorage.setItem(storageKey, '1');
          setDismissed(true);
        }}
      >
        Close
      </button>
      <strong>Frizi works best on mobile.</strong>
      <p>Scan the QR code to open Frizi on your phone.</p>
      {qrDataUrl ? <img src={qrDataUrl} alt="QR code for frizi.ca" /> : <div className="desktopQrFallback"><QrCode size={42} /></div>}
      <div className="desktopMobilePromptActions">
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(storageKey, '1');
            setDismissed(true);
          }}
        >
          Continue on desktop
        </button>
      </div>
      <small>Mobile apps coming soon.</small>
    </aside>
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
      </section>
    </main>
  );
}

function trackClientEvent(event: string, metadata: Record<string, string>) {
  console.info('[frizi-client-analytics]', event, metadata);
}

function getClientDisplayName(user: SupabaseUser, fallback = 'Frizi client') {
  return String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || fallback).trim();
}

function clientSessionFromSupabaseSession(session: SupabaseSession): ClientSession {
  return {
    name: getClientDisplayName(session.user),
    email: session.user.email || '',
    accessToken: session.access_token,
  };
}

function splitClientName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || displayName,
    lastName: parts.slice(1).join(' '),
  };
}

async function ensureCanonicalClientProfile(user: SupabaseUser, fallbackName?: string) {
  if (!isSupabaseConfigured) return;
  const email = user.email || '';
  const displayName = getClientDisplayName(user, fallbackName || email || 'Frizi client');
  const { firstName, lastName } = splitClientName(displayName);
  const supabase = createClient();
  const { data: profile, error: profileError } = await supabase
    .from('frizi_profiles')
    .upsert(
      {
        auth_user_id: user.id,
        account_type: 'client',
        display_name: displayName,
        email,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'auth_user_id' },
    )
    .select('id')
    .single();

  if (profileError) throw profileError;

  const { data: existingClient, error: existingClientError } = await supabase.from('frizi_clients').select('id').eq('profile_id', profile.id).maybeSingle();
  if (existingClientError) throw existingClientError;

  const clientMutation = {
    profile_id: profile.id,
    preferred_name: displayName,
    first_name: firstName,
    last_name: lastName,
    email,
    account_claimed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: clientError } = existingClient
    ? await supabase.from('frizi_clients').update(clientMutation).eq('id', existingClient.id)
    : await supabase.from('frizi_clients').insert(clientMutation);
  if (clientError) throw clientError;
}

function getSafeClientOAuthReturnPath() {
  const { pathname } = window.location;
  if (/^\/invite\/[A-Za-z0-9_-]+\/?$/.test(pathname)) return pathname.replace(/\/$/, '');
  return '/';
}

function professionalInvitePhrase(role: string) {
  const normalizedRole = role.toLowerCase();
  if (normalizedRole.includes('barber')) return 'barber';
  if (normalizedRole.includes('colour') || normalizedRole.includes('color')) return 'colourist';
  if (normalizedRole.includes('hairdresser') || normalizedRole.includes('stylist')) return 'hairstylist';
  return 'hair professional';
}

function InviteLanding({
  clientSession,
  onAuthRequired,
  onClientConnected,
  onContinueHome,
  token,
}: {
  clientSession: ClientSession | null;
  onAuthRequired: () => void;
  onClientConnected: (session: ClientSession) => void;
  onContinueHome: (session: ClientSession) => void;
  token: string;
}) {
  const [inviteData, setInviteData] = useState<LiveInvite | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState('');
  const [connectionState, setConnectionState] = useState<'idle' | 'success' | 'already' | 'error'>('idle');
  const autoAcceptAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      setLoading(true);
      setInviteError('');
      try {
        const response = await fetch(`/api/invite?token=${encodeURIComponent(token)}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'This invitation is not available.');
        if (!cancelled) {
          setInviteData(payload as LiveInvite);
          trackClientEvent('invite_opened', {
            invitation_token: token,
            professional_slug: (payload as LiveInvite).professional.id,
          });
        }
      } catch (error) {
        if (!cancelled) setInviteError(error instanceof Error ? error.message : 'This invitation is not available.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const pendingInvite = readPendingInviteContext();
    if (!inviteData || !clientSession?.accessToken || pendingInvite?.token !== token || autoAcceptAttempted.current) return;
    autoAcceptAttempted.current = true;
    void acceptInvite(clientSession);
  }, [clientSession, inviteData, token]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080808] px-4 py-6 text-white">
        <section className="mx-auto flex min-h-[82vh] max-w-lg flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <QrCode className="mx-auto text-[#f4c430]" size={42} />
          <h1 className="mt-5 text-3xl font-black">Opening invite...</h1>
          <p className="mt-3 text-white/70">Checking this Frizi invite securely.</p>
        </section>
      </main>
    );
  }

  if (!inviteData) {
    return (
      <main className="min-h-screen bg-[#080808] px-4 py-6 text-white">
        <section className="mx-auto flex min-h-[82vh] max-w-lg flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <QrCode className="mx-auto text-[#f4c430]" size={42} />
          <h1 className="mt-5 text-3xl font-black">This invitation is not available.</h1>
          <p className="mt-3 text-white/70">
            {inviteError || 'This invitation is no longer available. Ask your professional for a new Frizi invite.'}
          </p>
          <a className="mt-6 rounded-2xl bg-[#f4c430] px-5 py-4 text-center font-black text-black" href="/">
            Open Frizi
          </a>
        </section>
      </main>
    );
  }

  const invitingProfessional = inviteData.professional;
  const professionalPhrase = professionalInvitePhrase(invitingProfessional.role);

  async function acceptInvite(session: ClientSession) {
    if (connecting) return;
    setConnecting(true);
    setConnectMessage('');
    setConnectionState('idle');

    try {
      const response = await fetch('/api/accept-invite', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, displayName: session.name }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'We could not connect this invite. Please try again.');

      const alreadyConnected = Boolean((payload as { alreadyConnected?: boolean }).alreadyConnected);
      const nextState = alreadyConnected ? 'already' : 'success';
      setConnectionState(nextState);
      setConnectMessage(
        alreadyConnected ? `You're already connected to ${invitingProfessional.name}.` : `You're now connected to ${invitingProfessional.name}.`,
      );
      clearPendingInviteContext(token);
      onClientConnected(session);
      trackClientEvent('invite_accepted', {
        invitation_token: token,
        professional_slug: invitingProfessional.id,
        result: nextState,
      });
      window.setTimeout(() => onContinueHome(session), 2000);
    } catch (error) {
      setConnectionState('error');
      setConnectMessage(error instanceof Error ? error.message : 'We could not connect this invite. Please try again.');
    } finally {
      setConnecting(false);
    }
  }

  function startConnection() {
    if (connecting) return;
    trackClientEvent('connect_free_clicked', {
      invitation_token: token,
      professional_slug: invitingProfessional.id,
    });
    if (!clientSession?.accessToken) {
      writePendingInviteContext(token);
      onAuthRequired();
      return;
    }
    void acceptInvite(clientSession);
  }

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-5 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-md flex-col justify-center">
        <section className="rounded-[32px] border border-white/10 bg-[#151519] p-5 shadow-2xl shadow-black/45">
          <img
            className="mx-auto h-28 w-28 rounded-full border-2 border-[#f4c430] object-cover shadow-xl shadow-black/40"
            src={invitingProfessional.heroImage}
            alt=""
          />
          <h1 className="mt-5 text-center text-3xl font-black leading-tight">{invitingProfessional.name}</h1>
          <p className="mt-2 text-center text-sm font-bold text-[#f4c430]">
            {invitingProfessional.role} at {invitingProfessional.studio}
          </p>
          <p className="mx-auto mt-5 max-w-sm text-center text-lg font-bold leading-7 text-white/82">
            Your {professionalPhrase} wants to connect with you on Frizi.
          </p>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-white/62">
            Connect free so they can recognize your Frizi profile when you book, message, or share hair notes with them.
          </p>

          <button
            className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-5 text-base font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={connecting || connectionState === 'success' || connectionState === 'already'}
            onClick={startConnection}
          >
            <QrCode size={19} />
            {connecting ? 'Connecting...' : connectionState === 'success' || connectionState === 'already' ? 'Connected' : 'Connect free'}
          </button>

          {connectMessage ? (
            <p
              className={`mt-4 rounded-2xl border p-4 text-center text-sm font-bold leading-6 ${
                connectionState === 'error'
                  ? 'border-red-400/35 bg-red-500/12 text-red-100'
                  : 'border-[#f4c430]/35 bg-[#f4c430]/10 text-[#f4c430]'
              }`}
              role="status"
            >
              {connectMessage}
            </p>
          ) : null}

          {connectionState === 'success' || connectionState === 'already' ? (
            <p className="mt-3 text-center text-xs font-semibold text-white/52">Taking you to your Frizi home...</p>
          ) : null}
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
  intent: ClientAuthIntent;
  onClose: () => void;
  onComplete: (session: ClientSession, createdAccount?: boolean) => void;
}) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [visibleHeight, setVisibleHeight] = useState('100dvh');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    function updateVisibleHeight() {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      setVisibleHeight(`${Math.floor(viewportHeight)}px`);
    }

    updateVisibleHeight();
    window.visualViewport?.addEventListener('resize', updateVisibleHeight);
    window.visualViewport?.addEventListener('scroll', updateVisibleHeight);
    window.addEventListener('resize', updateVisibleHeight);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.overscrollBehavior = originalOverscrollBehavior;
      window.visualViewport?.removeEventListener('resize', updateVisibleHeight);
      window.visualViewport?.removeEventListener('scroll', updateVisibleHeight);
      window.removeEventListener('resize', updateVisibleHeight);
    };
  }, []);

  function keepFieldVisible(event: FocusEvent<HTMLInputElement>) {
    window.setTimeout(() => {
      event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 90);
  }

  async function continueWithGoogle() {
    setError('');
    setNotice('');

    if (!isSupabaseConfigured) {
      setError('Frizi account signup is not configured yet.');
      return;
    }

    setLoading(true);
    try {
      const returnPath = getSafeClientOAuthReturnPath();
      if (intent === 'invite') writePendingInviteContext(inviteTokenFromPath());
      trackClientEvent('auth_started', {
        intent,
        method: 'google',
        route: returnPath,
      });
      window.sessionStorage.setItem(
        clientOAuthContextStorageKey,
        JSON.stringify({
          intent,
          returnPath,
          hasPendingBooking: Boolean(window.localStorage.getItem(pendingBookingStorageKey)),
          startedAt: new Date().toISOString(),
        }),
      );

      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${returnPath}`,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Frizi could not start Google sign-in.');
      setLoading(false);
    }
  }

  async function submitAuth() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    setError('');
    setNotice('');

    if (mode === 'signup' && !trimmedName) {
      setError('Add your name to continue.');
      return;
    }

    if (!trimmedEmail.includes('@') || password.length < 6) {
      setError('Enter a valid email and a password with at least 6 characters.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Frizi account signup is not configured yet.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const returnPath = getSafeClientOAuthReturnPath();
      if (intent === 'invite') writePendingInviteContext(inviteTokenFromPath());
      trackClientEvent('auth_started', {
        intent,
        method: mode,
        route: returnPath,
      });
      window.sessionStorage.setItem(
        clientOAuthContextStorageKey,
        JSON.stringify({
          intent,
          returnPath,
          hasPendingBooking: Boolean(window.localStorage.getItem(pendingBookingStorageKey)),
          startedAt: new Date().toISOString(),
        }),
      );
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: { full_name: trimmedName, account_type: 'client' },
            emailRedirectTo: `${window.location.origin}${returnPath}`,
          },
        });

        if (error) throw error;
        if (!data.session) {
          setNotice(
            intent === 'invite'
              ? "Check your email to verify your Frizi account. We'll connect you when you return and sign in."
              : intent === 'booking'
              ? 'Check your email to verify your Frizi account. Your selected appointment is saved for when you return and sign in.'
              : 'Check your email to verify your Frizi account, then return to Frizi and sign in.',
          );
          return;
        }

        onComplete({ name: trimmedName, email: trimmedEmail, accessToken: data.session.access_token }, true);
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) throw error;
      if (!data.session) {
        setNotice('Sign in needs email verification first. Check your inbox, then try again.');
        return;
      }

      onComplete({
        name: data.user.user_metadata?.full_name || trimmedEmail.split('@')[0] || 'Frizi client',
        email: trimmedEmail,
        accessToken: data.session.access_token,
      }, false);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Frizi could not sign you in.');
    } finally {
      setLoading(false);
    }
  }

  const sheetStyle = {
    '--frizi-client-auth-visible-height': visibleHeight,
    maxHeight:
      'calc(var(--frizi-client-auth-visible-height) - max(0.75rem, env(safe-area-inset-top)) - max(0.75rem, env(safe-area-inset-bottom)))',
  } as CSSProperties;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-hidden bg-black/72 px-3 backdrop-blur-sm sm:items-center sm:px-4"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))', paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <section
        className="flex w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#151519] shadow-2xl shadow-black/60"
        style={sheetStyle}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <div>
            <p className="text-sm font-black text-[#f4c430]">{mode === 'signup' ? 'Free client account' : 'Welcome back'}</p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">
              {mode === 'signup' ? 'Create your free Frizi account' : 'Sign in to Frizi'}
            </h2>
            {intent === 'booking' ? (
              <p className="mt-2 text-sm font-bold leading-6 text-white/68">Book and manage appointments directly with your stylist.</p>
            ) : intent === 'promo' ? (
              <p className="mt-2 text-sm font-bold leading-6 text-white/68">Sign up for exclusive deals and promos.</p>
            ) : intent === 'invite' ? (
              <p className="mt-2 text-sm font-bold leading-6 text-white/68">Connect with your professional and keep your Frizi profile ready for future visits.</p>
            ) : (
              <p className="mt-2 text-sm font-bold leading-6 text-white/68">
                Manage your bookings, save your hair profile and inspiration photos, connect with your stylist, and receive discounts and promotions.
              </p>
            )}
          </div>
          <button className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-white/70" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1 [-webkit-overflow-scrolling:touch] sm:px-5">
          <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1">
            <button
              className="col-span-2 mb-2 flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-white px-4 font-black text-black disabled:opacity-60"
              type="button"
              onClick={continueWithGoogle}
              disabled={loading}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black text-sm text-[#f4c430]" aria-hidden="true">G</span>
              Continue with Google
            </button>
            <div className="col-span-2 mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs font-black lowercase text-white/50" aria-hidden="true">
              <span className="h-px bg-white/10" />
              <strong>or</strong>
              <span className="h-px bg-white/10" />
            </div>
            {(['signup', 'signin'] as const).map((item) => (
              <button
                key={item}
                className={`rounded-xl px-3 py-3 text-sm font-black ${mode === item ? 'bg-[#f4c430] text-black' : 'text-white/70'}`}
                type="button"
                onClick={() => setMode(item)}
              >
                {item === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            ))}
          </div>

          {mode === 'signup' ? (
            <>
              <label className="mt-4 block text-sm font-black text-white" htmlFor="client-auth-name">
                Name
              </label>
              <input
                id="client-auth-name"
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-3 font-semibold text-white outline-none placeholder:text-white/38"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onFocus={keepFieldVisible}
                placeholder="Your name"
                autoComplete="name"
              />
            </>
          ) : null}

          <label className="mt-4 block text-sm font-black text-white" htmlFor="client-auth-email">
            Email
          </label>
          <input
            id="client-auth-email"
            className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-3 font-semibold text-white outline-none placeholder:text-white/38"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onFocus={keepFieldVisible}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            inputMode="email"
          />

          <label className="mt-4 block text-sm font-black text-white" htmlFor="client-auth-password">
            {mode === 'signup' ? 'Create password' : 'Password'}
          </label>
          <input
            id="client-auth-password"
            className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-3 font-semibold text-white outline-none placeholder:text-white/38"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onFocus={keepFieldVisible}
            placeholder={mode === 'signup' ? 'Create password' : 'Password'}
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />

          {error ? <p className="mt-3 rounded-2xl bg-red-500/12 px-3 py-2 text-sm font-bold text-red-100">{error}</p> : null}
          {notice ? <p className="mt-3 rounded-2xl border border-[#f4c430]/35 bg-[#f4c430]/10 px-3 py-2 text-sm font-bold text-[#f4c430]">{notice}</p> : null}

          <p className="mt-4 text-center text-sm font-semibold leading-6 text-white/55">
          {intent === 'promo'
            ? 'Promos only apply when booking and paying through Frizi.'
            : intent === 'booking'
              ? 'After you sign in, Frizi will bring you back to this appointment request.'
              : intent === 'invite'
                ? 'This connection is free. Marketing messages need separate consent.'
                : 'Use your Frizi account to connect with professionals, keep hair photos, and manage bookings.'}
          </p>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#151519]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
          <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-5 py-3 font-black text-black disabled:opacity-60" type="button" onClick={submitAuth} disabled={loading}>
            <User size={18} />
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create free account' : 'Sign in'}
          </button>
        </div>
      </section>
    </div>
  );
}

function ClientDeleteAccountModal({
  onClose,
  onDelete,
}: {
  onClose: () => void;
  onDelete: (confirmation: string) => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canDelete = confirmation.trim().toUpperCase() === 'DELETE';

  async function submitDelete() {
    if (!canDelete || busy) return;
    setBusy(true);
    setError('');
    try {
      await onDelete('DELETE');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Account deletion could not be completed.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/78 px-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[32px] border border-red-300/25 bg-[#151519] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Trash2 className="text-red-100" size={30} />
            <h2 className="mt-4 text-3xl font-black">Delete your Frizi account?</h2>
            <p className="mt-3 text-sm font-bold leading-6 text-white/68">
              You will lose access to your account. Profile data will be removed or deactivated according to Frizi retention rules, and this cannot simply be undone.
            </p>
          </div>
          <button className="rounded-full border border-white/10 px-3 py-2 text-sm font-black text-white/70" type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <label className="mt-5 block">
          <span className="text-sm font-black text-white">Type DELETE to confirm</span>
          <input
            className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 font-semibold text-white outline-none"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        {error ? <p className="mt-4 rounded-2xl border border-red-300/35 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">{error}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="min-h-12 rounded-2xl border border-white/15 px-4 text-sm font-black text-white" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="min-h-12 rounded-2xl bg-red-200 px-4 text-sm font-black text-black disabled:opacity-45"
            type="button"
            onClick={submitDelete}
            disabled={!canDelete || busy}
          >
            {busy ? 'Deleting...' : 'Delete account'}
          </button>
        </div>
      </section>
    </div>
  );
}

function LocationPrompt({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('');

  function finish() {
    window.localStorage.setItem(locationPromptStorageKey, '1');
    onClose();
  }

  function shareLocation() {
    if (!navigator.geolocation) {
      setMessage('Location sharing is not available in this browser.');
      return;
    }

    setMessage('Requesting location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.localStorage.setItem(
          'frizi-client-location',
          JSON.stringify({
            latitude: Number(position.coords.latitude.toFixed(3)),
            longitude: Number(position.coords.longitude.toFixed(3)),
            accuracy: Math.round(position.coords.accuracy),
            capturedAt: new Date().toISOString(),
          }),
        );
        finish();
      },
      () => setMessage('Location was not shared. You can still book without it.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60 * 60 * 1000 },
    );
  }

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-black/72 px-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[32px] border border-white/12 bg-[#151519] p-5 shadow-2xl shadow-black/60">
        <MapPin className="text-[#f4c430]" size={30} />
        <h2 className="mt-4 text-3xl font-black">Share your location to find professionals near you</h2>
        <p className="mt-3 leading-7 text-white/68">Frizi can use your approximate location to improve local search. You can skip this and book normally.</p>
        <div className="mt-5 grid gap-3">
          <button className="min-h-14 rounded-2xl bg-[#f4c430] px-5 font-black text-black" type="button" onClick={shareLocation}>
            Share location
          </button>
          <button className="min-h-14 rounded-2xl border border-white/15 px-5 font-black text-white" type="button" onClick={finish}>
            Not now
          </button>
        </div>
        {message ? <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm font-bold text-white/68">{message}</p> : null}
      </section>
    </div>
  );
}

function SearchInputWithSuggestions({
  id,
  isListening,
  onMic,
  onSubmit,
  query,
  setQuery,
  voiceMessage,
  compact = false,
}: {
  id: string;
  isListening: boolean;
  onMic: () => void;
  onSubmit: (nextQuery?: string) => void;
  query: string;
  setQuery: (value: string) => void;
  voiceMessage: string;
  compact?: boolean;
}) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSuggestions = normalizedQuery
    ? searchSuggestionCategories.filter((suggestion) =>
        [suggestion.label, suggestion.query, ...suggestion.aliases].some((term) => term.toLowerCase().includes(normalizedQuery)),
      )
    : searchSuggestionCategories;
  const suggestionsId = `${id}-suggestions`;

  useEffect(() => {
    function closeOnOutside(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!containerRef.current?.contains(target)) {
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }
    }

    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
    };
  }, []);

  function chooseSuggestion(nextQuery: string) {
    setQuery(nextQuery);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    onSubmit(nextQuery);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2 rounded-[22px] border border-white/10 bg-white/8 px-3 ${compact ? 'py-2' : 'py-2'}`}>
        <Search className="shrink-0 text-[#f4c430]" size={compact ? 18 : 20} />
        <input
          id={id}
          aria-autocomplete="list"
          aria-controls={suggestionsId}
          aria-expanded={suggestionsOpen}
          className={`min-w-0 flex-1 bg-transparent font-semibold text-white outline-none placeholder:text-white/45 ${compact ? 'text-sm' : 'text-base'}`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSuggestionsOpen(true);
            setActiveSuggestionIndex(-1);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSuggestionsOpen(true);
              setActiveSuggestionIndex((current) => Math.min(current + 1, visibleSuggestions.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveSuggestionIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Escape') {
              setSuggestionsOpen(false);
              setActiveSuggestionIndex(-1);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const activeSuggestion = visibleSuggestions[activeSuggestionIndex];
              if (suggestionsOpen && activeSuggestion) {
                chooseSuggestion(activeSuggestion.query);
                return;
              }
              setSuggestionsOpen(false);
              onSubmit();
            }
          }}
          placeholder="I am looking for....."
          role="combobox"
        />
        <button
          aria-label="Voice search"
          className={`grid shrink-0 place-items-center rounded-full ${
            compact ? 'h-10 w-10' : 'h-11 w-11'
          } ${isListening ? 'bg-[#f4c430] text-black' : 'bg-white/10 text-white'}`}
          type="button"
          onClick={onMic}
        >
          <Mic size={compact ? 17 : 18} />
        </button>
      </div>
      {suggestionsOpen ? (
        <div
          id={suggestionsId}
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 max-h-[min(18rem,45vh)] overflow-auto rounded-[22px] border border-white/12 bg-[#151519]/98 p-2 shadow-2xl shadow-black/55 backdrop-blur-xl"
          role="listbox"
        >
          {visibleSuggestions.length ? (
            visibleSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.label}
                aria-selected={activeSuggestionIndex === index}
                className={`flex min-h-11 w-full items-center justify-between rounded-2xl px-3 text-left text-sm font-black ${
                  activeSuggestionIndex === index ? 'bg-[#f4c430] text-black' : 'text-white hover:bg-white/8'
                }`}
                role="option"
                type="button"
                onMouseEnter={() => setActiveSuggestionIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseSuggestion(suggestion.query)}
              >
                <span>{suggestion.label}</span>
                <Search size={15} />
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm font-semibold text-white/58">Press Enter to search your exact phrase.</p>
          )}
        </div>
      ) : null}
      {isListening || voiceMessage ? (
        <p className={`mt-2 rounded-2xl bg-[#f4c430]/14 px-3 py-2 font-black text-[#f4c430] ${compact ? 'text-xs' : 'text-sm'}`}>
          {voiceMessage || 'Listening...'}
        </p>
      ) : null}
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
  onSubmit: (nextQuery?: string) => void;
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
    <section className="clientMediaSurface relative h-[100svh] overflow-hidden pt-20">
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
            <SearchInputWithSuggestions
              id="frizi-search"
              isListening={isListening}
              onMic={onMic}
              onSubmit={onSubmit}
              query={query}
              setQuery={setQuery}
              voiceMessage={voiceMessage}
            />
            <button className="mt-3 min-h-12 w-full rounded-2xl bg-[#f4c430] px-5 font-black text-black" type="button" onClick={() => onSubmit()}>
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
        <h2 className="mt-4 text-2xl font-black">No professionals found</h2>
        <p className="mt-2 leading-7 text-white/68">
          Try another service or location.
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
  onSearch: (nextQuery?: string) => void;
  query: string;
  setQuery: (value: string) => void;
  voiceMessage: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/16 bg-black/58 p-2 shadow-2xl shadow-black/45 backdrop-blur-xl">
      <SearchInputWithSuggestions
        compact
        id="frizi-results-search"
        isListening={isListening}
        onMic={onMic}
        onSubmit={onSearch}
        query={query}
        setQuery={setQuery}
        voiceMessage={voiceMessage}
      />
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
  onSearch: (nextQuery?: string) => void;
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
      className="clientMediaSurface relative h-[100svh] overflow-hidden bg-black [touch-action:pan-y]"
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
              {profile.reviews > 0 ? profile.rating : 'New'}
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
  bookingError,
  clientSession,
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
  bookingError: string;
  clientSession: ClientSession | null;
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
        bookingError={bookingError}
        clientSession={clientSession}
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
          Reviews {profile.reviews > 0 ? profile.rating : 'New'}
          <Star size={16} fill="currentColor" />
        </button>

        {showReviews ? (
          <Panel title="Reviews">
            {profile.clientReviews.length ? (
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
            ) : (
              <p className="leading-7 text-white/64">No public reviews yet.</p>
            )}
          </Panel>
        ) : null}
      </div>
    </section>
  );
}

function BookingCalendarPage({
  availabilityDays,
  booking,
  bookingError,
  clientSession,
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
  bookingError: string;
  clientSession: ClientSession | null;
  onBack: () => void;
  onBook: () => void;
  profile: Professional;
  selectedDay: ReturnType<typeof buildAvailabilityDays>[number] | undefined;
  selectedService: string;
  selectedTime: string;
  servicesOpen: boolean;
  setSelectedService: (value: string) => void;
  setSelectedTime: (value: string) => void;
  setServicesOpen: (value: boolean | ((current: boolean) => boolean)) => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(selectedDay?.date ?? new Date()));
  const [timeSheetDay, setTimeSheetDay] = useState<ReturnType<typeof buildAvailabilityDays>[number] | null>(null);
  const availableByDate = useMemo(
    () => new Map(availabilityDays.map((day) => [dateKey(day.date), day])),
    [availabilityDays],
  );
  const selectedServiceRecord = profile.services.find((service) => service.name === selectedService) || profile.services[0];
  const selectedPaymentRequirement = selectedServiceRecord?.paymentRequirement || 'pay_at_appointment';
  const paymentBlocksBooking = selectedPaymentRequirement === 'deposit_required' || selectedPaymentRequirement === 'full_prepayment_required';
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
                  onClick={() => {
                    if (!availableDay) return;
                    setSelectedTime(availableDay.times[0]);
                    setTimeSheetDay(availableDay);
                  }}
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
          {availabilityDays.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/64">
              This professional has not opened client-bookable times yet.
            </div>
          ) : null}
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

          <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-[#f4c430]">
            {selectedDay ? selectedDay.date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a day'}
            {selectedTime ? <span className="ml-2 text-white">at {formatSlotTime(selectedTime)}</span> : null}
          </p>

          {selectedPaymentRequirement === 'frizi_payment_optional' ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/64">
              Payment through Frizi is optional for this service. You can book now and pay at the appointment.
            </p>
          ) : null}
          {paymentBlocksBooking ? (
            <p className="rounded-2xl border border-amber-300/35 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
              This service requires online {selectedPaymentRequirement === 'deposit_required' ? 'deposit' : 'prepayment'} before booking. Frizi checkout is not live for this service yet.
            </p>
          ) : null}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 text-base font-black text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/38"
            type="button"
            onClick={onBook}
            disabled={paymentBlocksBooking || !selectedTime}
          >
            <CalendarDays size={20} />
            Book an appointment
          </button>
          {bookingError ? <p className="rounded-2xl bg-red-500/12 px-4 py-3 text-sm font-bold text-red-100">{bookingError}</p> : null}
          {booking ? <BookingConfirmation booking={booking} clientSession={clientSession} /> : null}
        </div>
      </div>

      {timeSheetDay ? (
        <div className="fixed inset-0 z-[75] flex items-end bg-black/68 px-3 pb-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6" onClick={() => setTimeSheetDay(null)}>
          <section
            aria-modal="true"
            className="w-full rounded-[28px] border border-white/12 bg-[#151519] p-5 shadow-2xl shadow-black/60 sm:max-w-md"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-black text-[#f4c430]">Choose a time</p>
            <h2 className="mt-1 text-2xl font-black">
              {timeSheetDay.date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {timeSheetDay.times.map((slot) => (
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
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="min-h-12 rounded-2xl border border-white/15 px-4 font-black text-white" type="button" onClick={() => setTimeSheetDay(null)}>
                Cancel
              </button>
              <button className="min-h-12 rounded-2xl bg-[#f4c430] px-4 font-black text-black" type="button" onClick={() => {
                setTimeSheetDay(null);
                onBook();
              }}>
                Book appointment
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
  appointments,
  booking,
  clientSession,
  isDemo,
  onBookSaved,
  onDeleteAccount,
  onSignOut,
  savedProfiles,
}: {
  activeNav: ClientNavKey;
  appointments: BookingRequest[];
  booking: BookingRequest | null;
  clientSession: ClientSession | null;
  isDemo: boolean;
  onBookSaved: (profileId: string) => void;
  onDeleteAccount: () => void;
  onSignOut: () => void;
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
      {activeNav === 'appointments' ? <AppointmentsPanel appointments={appointments} booking={booking} isDemo={isDemo} /> : null}
      {activeNav === 'saved' ? <SavedPanel profiles={savedProfiles} onBookSaved={onBookSaved} /> : null}
      {activeNav === 'products' ? <ProductsPanel isDemo={isDemo} /> : null}
      {activeNav === 'profile' ? <ClientPassportPanel clientSession={clientSession} isDemo={isDemo} onDeleteAccount={onDeleteAccount} onSignOut={onSignOut} /> : null}
    </section>
  );
}

function AppointmentsPanel({
  appointments,
  booking,
  isDemo,
}: {
  appointments: BookingRequest[];
  booking: BookingRequest | null;
  isDemo: boolean;
}) {
  const visibleAppointments = appointments.length ? appointments : booking ? [booking] : [];
  const upcomingAppointments = visibleAppointments.filter((appointment) => appointment.status === 'confirmed');
  const pendingAppointments = visibleAppointments.filter((appointment) => appointment.status === 'pending');
  const pastAppointments = visibleAppointments.filter((appointment) => ['declined', 'cancelled', 'completed'].includes(appointment.status));

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">Upcoming</h2>
        {upcomingAppointments.length ? (
          <div className="mt-4 space-y-3">
            {upcomingAppointments.map((appointment) => (
              <BookingConfirmation key={appointment.eventId} booking={appointment} clientSession={null} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-white/[0.05] p-4">
            <CalendarDays className="text-[#f4c430]" size={30} />
            <h3 className="mt-4 text-xl font-black">No upcoming appointments</h3>
            <p className="mt-2 leading-7 text-white/68">Search for a professional, choose a service, and book when you are ready.</p>
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">Pending</h2>
        {pendingAppointments.length ? (
          <div className="mt-4 space-y-3">
            {pendingAppointments.map((appointment) => (
              <BookingConfirmation key={appointment.eventId} booking={appointment} clientSession={null} />
            ))}
          </div>
        ) : (
          <p className="mt-3 leading-7 text-white/64">No pending appointment requests.</p>
        )}
      </div>

      {isDemo ? (
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <h2 className="text-2xl font-black">Past</h2>
          <div className="mt-4 space-y-3">
            {completedAppointmentHistory.map((appointment) => {
              const total = appointment.servicePriceCents + appointment.tipCents;
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
      ) : (
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <h2 className="text-2xl font-black">Past</h2>
          {pastAppointments.length ? (
            <div className="mt-4 space-y-3">
              {pastAppointments.map((appointment) => (
                <BookingConfirmation key={appointment.eventId} booking={appointment} clientSession={null} />
              ))}
            </div>
          ) : (
            <p className="mt-3 leading-7 text-white/64">No past appointments yet.</p>
          )}
        </div>
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

function ProductsPanel({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) {
    return (
      <div className="mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-[#151519]">
        <div className="relative p-6">
          <div className="absolute right-5 top-5 rounded-full bg-[#f4c430] px-3 py-2 text-xs font-black text-black">Coming Soon</div>
          <ShoppingBag className="text-[#f4c430]" size={32} />
          <h2 className="mt-4 max-w-sm text-3xl font-black">Product recommendations</h2>
          <p className="mt-3 max-w-xl leading-7 text-white/68">
            Soon, your stylist will be able to recommend products directly through Frizi. Product purchasing is not active yet.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: 'Stylist recommended routines',
                copy: 'See product suggestions matched to your hair goals once recommendations go live.',
              },
              {
                title: 'Buy through Frizi',
                copy: 'Checkout, promos, and order tracking will stay disabled until commerce is ready.',
              },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 opacity-80">
                <p className="font-black">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const customerId = 'commerce_coming_soon_customer';
  const [catalogue, setCatalogue] = useState<CommerceCatalogueItem[]>([]);
  const [cartItems, setCartItems] = useState<CommerceCartItem[]>([]);
  const [province, setProvince] = useState('ON');
  const [postalCode, setPostalCode] = useState('M5V 2T6');
  const [promoCodeDraft, setPromoCodeDraft] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState('');
  const [summary, setSummary] = useState<CommerceCartSummary | null>(null);
  const [commerceError, setCommerceError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogue() {
      try {
        const response = await fetch(`/api/commerce-catalog?customerId=${encodeURIComponent(customerId)}`);
        const payload = await response.json();
        if (!cancelled) {
          setCatalogue(payload.catalogue || []);
        }
      } catch (error) {
        if (!cancelled) {
          setCommerceError(error instanceof Error ? error.message : 'Could not load product catalogue.');
        }
      }
    }

    loadCatalogue();
    return () => {
      cancelled = true;
    };
  }, []);

  const cartPayload = useMemo(
    () => ({
      customerId,
      items: cartItems,
      shippingAddress: { province, postalCode },
      promoCode: appliedPromoCode || undefined,
    }),
    [appliedPromoCode, cartItems, postalCode, province],
  );

  useEffect(() => {
    const controller = new AbortController();
    setCommerceError('');

    async function loadCartSummary() {
      if (cartItems.length === 0) {
        setSummary(null);
        return;
      }

      try {
        const response = await fetch('/api/commerce-cart-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cartPayload),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) {
          setSummary(null);
          setCommerceError(payload.error || 'Could not calculate cart.');
          return;
        }
        setSummary(payload.summary);
      } catch (error) {
        if (!controller.signal.aborted) {
          setCommerceError(error instanceof Error ? error.message : 'Could not calculate cart.');
        }
      }
    }

    loadCartSummary();
    return () => controller.abort();
  }, [cartItems.length, cartPayload]);

  function addToCart(item: CommerceCatalogueItem) {
    if (!item.purchasable) {
      setCommerceError(item.blockedReason);
      return;
    }

    setCartItems((current) => {
      const existing = current.find((cartItem) => cartItem.variantId === item.variant.id);
      if (existing) {
        return current.map((cartItem) =>
          cartItem.variantId === item.variant.id ? { ...cartItem, quantity: Math.min(cartItem.quantity + 1, 12) } : cartItem,
        );
      }
      return [
        ...current,
        {
          variantId: item.variant.id,
          quantity: 1,
          recommendationId: item.recommendation?.id,
        },
      ];
    });
  }

  async function startProductCheckout() {
    setCheckoutLoading(false);
    setCommerceError('Product checkout is disabled. Product purchasing is coming soon.');
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <ShoppingBag className="text-[#f4c430]" size={28} />
          <h2 className="mt-3 text-2xl font-black">Recommended for you</h2>
          <p className="mt-2 leading-7 text-white/68">
            Products are sold by Frizi, not sent to an outside affiliate checkout. Only Canadian-sale-approved variants can be added to cart.
          </p>
        </div>

        {catalogue.map((item) => (
          <article key={item.variant.id} className="overflow-hidden rounded-[28px] border border-white/10 bg-[#151519]">
            <div className="grid gap-4 p-4 sm:grid-cols-[128px,1fr]">
              <img className="aspect-square w-full rounded-3xl object-cover" src={item.product.primaryImage} alt="" />
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#f4c430]">{item.product.brandName}</p>
                    <h3 className="mt-1 text-xl font-black">{item.product.productName}</h3>
                    <p className="mt-1 text-sm font-semibold text-white/58">{item.variant.variantName}</p>
                  </div>
                  <p className="shrink-0 text-lg font-black text-[#f4c430]">{formatCurrency(item.variant.priceCents)}</p>
                </div>

                {item.recommendation ? (
                  <div className="mt-3 rounded-2xl border border-[#f4c430]/30 bg-[#f4c430]/10 p-3">
                    <p className="text-sm font-black text-[#f4c430]">Recommended by your professional</p>
                    <p className="mt-1 text-sm leading-6 text-white/72">{item.recommendation.reason}</p>
                    <p className="mt-1 text-xs font-bold text-white/48">{item.recommendation.frequency}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-white/62">{item.product.description}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/12 px-3 py-1 text-xs font-bold text-white/64">{item.product.complianceState}</span>
                  <span className="rounded-full border border-white/12 px-3 py-1 text-xs font-bold text-white/64">{item.variant.inventoryMode}</span>
                  {item.product.productCategories.slice(0, 2).map((category) => (
                    <span key={category} className="rounded-full border border-white/12 px-3 py-1 text-xs font-bold text-white/64">{category.replace(/_/g, ' ')}</span>
                  ))}
                </div>

                {!item.purchasable ? (
                  <p className="mt-3 rounded-2xl bg-red-500/12 p-3 text-sm font-bold text-red-100">{item.blockedReason}</p>
                ) : null}

                <button
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 font-black ${
                    item.purchasable ? 'bg-[#f4c430] text-black' : 'bg-white/10 text-white/42'
                  }`}
                  type="button"
                  onClick={() => addToCart(item)}
                  disabled={!item.purchasable}
                >
                  <ShoppingBag size={18} />
                  {item.purchasable ? 'Add to cart' : 'Blocked pending review'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <ReceiptText className="text-[#f4c430]" size={22} />
            Cart
          </h2>
          {cartItems.length === 0 ? (
            <p className="mt-3 leading-7 text-white/64">Add an approved recommended product to preview shipping, tax, commission attribution, and Stripe checkout.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {summary?.items.map((item) => (
                <div key={item.variantId} className="flex gap-3 rounded-2xl bg-white/[0.05] p-3">
                  <img className="h-16 w-16 rounded-2xl object-cover" src={item.primaryImage} alt="" />
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{item.productName}</p>
                    <p className="text-sm font-semibold text-white/55">Qty {item.quantity} - {formatCurrency(item.lineNetCents)}</p>
                    {item.professionalName ? <p className="text-xs font-bold text-[#f4c430]">Commission tracked for {item.professionalName}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <label>
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/42">Province</span>
              <select
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-bold text-white"
                value={province}
                onChange={(event) => setProvince(event.target.value)}
              >
                {['ON', 'BC', 'AB', 'QC', 'NS', 'NB', 'MB', 'SK', 'PE', 'NL', 'NT', 'YT', 'NU'].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/42">Postal code</span>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-bold text-white outline-none"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-white/42" htmlFor="product-promo-code">
              Product promo
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="product-promo-code"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 font-bold text-white outline-none placeholder:text-white/35"
                placeholder="PRODUCT10"
                value={promoCodeDraft}
                onChange={(event) => setPromoCodeDraft(event.target.value)}
              />
              <button className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-black" type="button" onClick={() => setAppliedPromoCode(promoCodeDraft.trim().toUpperCase())}>
                Apply
              </button>
            </div>
            {summary?.promotion ? (
              <button className="mt-3 text-sm font-black text-[#f4c430]" type="button" onClick={() => {
                setAppliedPromoCode('');
                setPromoCodeDraft('');
              }}>
                {summary.promotion.name} applied. Remove
              </button>
            ) : null}
          </div>

          {summary ? (
            <div className="mt-4 rounded-2xl bg-black/28 p-4">
              <ReceiptRow label="Merchandise" value={formatCurrency(summary.merchandiseSubtotalCents)} />
              {summary.productDiscountCents > 0 ? <ReceiptRow label="Product discount" value={`-${formatCurrency(summary.productDiscountCents)}`} highlight /> : null}
              <ReceiptRow label="Shipping" value={formatCurrency(summary.shipping.shippingCents)} />
              {summary.shipping.shippingDiscountCents > 0 ? <ReceiptRow label="Shipping promo" value={`-${formatCurrency(summary.shipping.shippingDiscountCents)}`} highlight /> : null}
              <ReceiptRow label="Tax" value={formatCurrency(summary.taxCents)} />
              <ReceiptRow label="Total" value={formatCurrency(summary.totalCents)} strong />
              <p className="mt-3 text-xs font-bold text-white/48">{summary.shipping.service}. {summary.shipping.estimatedTransitDays}. Quote expires {new Date(summary.quoteExpiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</p>
            </div>
          ) : null}

          {commerceError ? <p className="mt-3 rounded-2xl bg-red-500/12 px-3 py-2 text-sm font-bold text-red-100">{commerceError}</p> : null}

          <button
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 font-black text-black disabled:bg-white/10 disabled:text-white/40"
            type="button"
            onClick={startProductCheckout}
            disabled={!summary || checkoutLoading}
          >
            <CreditCard size={18} />
            {checkoutLoading ? 'Opening Stripe...' : 'Preview checkout'}
          </button>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <ShieldCheck className="text-[#f4c430]" size={24} />
          <h3 className="mt-3 text-xl font-black">Commerce safeguards</h3>
          <p className="mt-2 text-sm leading-6 text-white/62">
            Product checkout is separated from appointment payment. Unapproved products are blocked, returns and recalls remain operational workflows, and legal/tax/product-safety review is still required before live launch.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ClientPassportPanel({
  clientSession,
  isDemo,
  onDeleteAccount,
  onSignOut,
}: {
  clientSession: ClientSession | null;
  isDemo: boolean;
  onDeleteAccount: () => void;
  onSignOut: () => void;
}) {
  return isDemo ? <LegacyPreviewClientPassportPanel /> : <ProductionClientPassportPanel clientSession={clientSession} onDeleteAccount={onDeleteAccount} onSignOut={onSignOut} />;
}

function ProductionClientPassportPanel({
  clientSession,
  onDeleteAccount,
  onSignOut,
}: {
  clientSession: ClientSession | null;
  onDeleteAccount: () => void;
  onSignOut: () => void;
}) {
  const [clientId, setClientId] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<ClientPhoto | null>(null);
  const [inspirationPhotos, setInspirationPhotos] = useState<ClientPhoto[]>([]);
  const [hairPhotos, setHairPhotos] = useState<ClientPhoto[]>([]);
  const [passport, setPassport] = useState<ClientPassport | null>(null);
  const [mediaMessage, setMediaMessage] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [passportBusy, setPassportBusy] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadClientMedia() {
      if (!clientSession?.accessToken || !isSupabaseConfigured) return;
      setMediaMessage('');
      try {
        const supabase = createClient();
        const { data: userResult, error: userError } = await supabase.auth.getUser();
        if (userError || !userResult.user) return;
        const ensuredClientId = await ensureClientRecord(userResult.user.id, clientSession.name, clientSession.email);
        if (cancelled) return;
        setClientId(ensuredClientId);
        const photos = await loadSignedClientPhotos(ensuredClientId);
        const nextPassport = await loadClientPassport();
        if (cancelled) return;
        setProfilePhoto(photos.find((photo) => photo.photoType === 'profile') || null);
        setInspirationPhotos(photos.filter((photo) => photo.photoType === 'example_reference'));
        setHairPhotos(photos.filter((photo) => photo.photoType === 'hair_history'));
        setPassport(nextPassport);
      } catch (error) {
        if (!cancelled) setMediaMessage(error instanceof Error ? error.message : 'Could not load your photos.');
      }
    }

    void loadClientMedia();
    return () => {
      cancelled = true;
    };
  }, [clientSession]);

  async function loadClientPassport() {
    if (!clientSession?.accessToken) return null;
    const response = await fetch('/api/client-passport', {
      headers: { Authorization: `Bearer ${clientSession.accessToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not prepare your passport QR.');
    return (payload.passport || null) as ClientPassport | null;
  }

  async function updatePassport(action: 'rotate' | 'revoke') {
    if (!clientSession?.accessToken) {
      setMediaMessage('Sign in before managing your hair passport.');
      return;
    }
    setPassportBusy(true);
    setMediaMessage('');
    try {
      const response = await fetch('/api/client-passport', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clientSession.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not update your passport QR.');
      setPassport((payload.passport || null) as ClientPassport | null);
      setMediaMessage(action === 'rotate' ? 'New passport QR created. The old one no longer works.' : 'Passport QR revoked.');
    } catch (error) {
      setMediaMessage(error instanceof Error ? error.message : 'Could not update your passport QR.');
    } finally {
      setPassportBusy(false);
    }
  }

  async function ensureClientRecord(authUserId: string, displayName: string, email: string) {
    const supabase = createClient();
    const { data: profile, error: profileError } = await supabase
      .from('frizi_profiles')
      .upsert(
        {
          auth_user_id: authUserId,
          account_type: 'client',
          display_name: displayName,
          email,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'auth_user_id' },
      )
      .select('id')
      .single();
    if (profileError) throw profileError;

    const { data: existingClient, error: existingClientError } = await supabase.from('frizi_clients').select('id').eq('profile_id', profile.id).maybeSingle();
    if (existingClientError) throw existingClientError;
    if (existingClient?.id) return String(existingClient.id);

    const { data: client, error: clientError } = await supabase
      .from('frizi_clients')
      .insert({
        profile_id: profile.id,
        preferred_name: displayName,
        email,
        account_claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (clientError) throw clientError;
    return String(client.id);
  }

  async function loadSignedClientPhotos(ensuredClientId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('frizi_client_photos')
      .select('id, image_url, photo_type, caption, created_at')
      .eq('client_id', ensuredClientId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const signed = await Promise.all(
      (data || []).map(async (row: Record<string, unknown>) => {
        const path = String(row.image_url || '');
        const { data: signedUrl } = await supabase.storage.from('frizi-client-media').createSignedUrl(path, 60 * 30);
        return {
          id: String(row.id),
          imagePath: path,
          imageUrl: signedUrl?.signedUrl || '',
          label: row.photo_type === 'profile' ? 'Profile photo' : row.photo_type === 'hair_history' ? 'Completed haircut' : 'Inspiration photo',
          note: String(row.caption || ''),
          photoType: String(row.photo_type || 'example_reference') as ClientPhoto['photoType'],
        };
      }),
    );

    return signed.filter((photo) => photo.imageUrl);
  }

  async function uploadClientPhoto(file: File, photoType: ClientPhoto['photoType']) {
    if (!clientSession || !isSupabaseConfigured) {
      setMediaMessage('Sign in before uploading photos.');
      return;
    }
    setMediaBusy(true);
    setMediaMessage('');
    try {
      const supabase = createClient();
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult.user) throw new Error('Sign in again before uploading photos.');
      const ensuredClientId = clientId || (await ensureClientRecord(userResult.user.id, clientSession.name, clientSession.email));
      setClientId(ensuredClientId);

      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '') || 'photo.jpg';
      const path = `${userResult.user.id}/${photoType}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('frizi-client-media').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      if (photoType === 'profile' && profilePhoto?.imagePath) {
        await supabase.storage.from('frizi-client-media').remove([profilePhoto.imagePath]);
        await supabase.from('frizi_client_photos').delete().eq('id', profilePhoto.id);
      }

      const { data: inserted, error: photoError } = await supabase
        .from('frizi_client_photos')
        .insert({
          client_id: ensuredClientId,
          image_url: path,
          photo_type: photoType,
          consent_status: photoType === 'hair_history' ? 'private' : 'shared_with_professional',
          caption: photoType === 'example_reference' ? captionDraft.trim() || null : null,
          updated_at: new Date().toISOString(),
        })
        .select('id, image_url, photo_type, caption')
        .single();
      if (photoError) throw photoError;

      if (photoType === 'profile') {
        await supabase.from('frizi_clients').update({ profile_photo_url: path, updated_at: new Date().toISOString() }).eq('id', ensuredClientId);
      }

      const { data: signedUrl } = await supabase.storage.from('frizi-client-media').createSignedUrl(path, 60 * 30);
      const nextPhoto: ClientPhoto = {
        id: String(inserted.id),
        imagePath: path,
        imageUrl: signedUrl?.signedUrl || '',
        label: photoType === 'profile' ? 'Profile photo' : 'Inspiration photo',
        note: String(inserted.caption || ''),
        photoType,
      };
      if (photoType === 'profile') setProfilePhoto(nextPhoto);
      if (photoType === 'example_reference') {
        setInspirationPhotos((current) => [nextPhoto, ...current]);
        setCaptionDraft('');
      }
      setMediaMessage(photoType === 'profile' ? 'Profile photo updated.' : 'Inspiration photo uploaded.');
    } catch (error) {
      setMediaMessage(error instanceof Error ? error.message : 'Photo upload failed.');
    } finally {
      setMediaBusy(false);
    }
  }

  async function removeClientPhoto(photo: ClientPhoto) {
    if (!clientSession || !isSupabaseConfigured) return;
    setMediaBusy(true);
    setMediaMessage('');
    try {
      const supabase = createClient();
      await supabase.storage.from('frizi-client-media').remove([photo.imagePath]);
      const { error } = await supabase.from('frizi_client_photos').delete().eq('id', photo.id);
      if (error) throw error;
      if (photo.photoType === 'profile') {
        setProfilePhoto(null);
        if (clientId) await supabase.from('frizi_clients').update({ profile_photo_url: null, updated_at: new Date().toISOString() }).eq('id', clientId);
      }
      if (photo.photoType === 'example_reference') setInspirationPhotos((current) => current.filter((item) => item.id !== photo.id));
      setMediaMessage('Photo removed.');
    } catch (error) {
      setMediaMessage(error instanceof Error ? error.message : 'Could not remove photo.');
    } finally {
      setMediaBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <div className="flex items-center gap-4">
          {profilePhoto ? (
            <img className="h-20 w-20 rounded-3xl object-cover" src={profilePhoto.imageUrl} alt="Client profile" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/[0.06]">
              <User className="text-[#f4c430]" size={30} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black">Profile photo</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/62">
              This is your account image. It stays separate from inspiration and completed haircut photos.
            </p>
          </div>
        </div>
        <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 font-black text-black">
          <Camera size={18} />
          {profilePhoto ? 'Replace profile photo' : 'Upload profile photo'}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={mediaBusy || !clientSession}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadClientPhoto(file, 'profile');
              event.currentTarget.value = '';
            }}
          />
        </label>
        {profilePhoto ? (
          <button className="mt-3 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white" type="button" disabled={mediaBusy} onClick={() => void removeClientPhoto(profilePhoto)}>
            Remove profile photo
          </button>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">Inspiration photos</h2>
        <p className="mt-2 leading-7 text-white/68">Add photos of cuts, colours, and styles you want your professional to see.</p>
        <textarea
          className="mt-4 min-h-24 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-3 font-semibold text-white outline-none placeholder:text-white/38"
          placeholder="Optional note for this inspiration photo"
          value={captionDraft}
          onChange={(event) => setCaptionDraft(event.target.value)}
        />
        <label className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 font-black text-black">
          <Camera size={18} />
          Upload inspiration photo
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={mediaBusy || !clientSession}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadClientPhoto(file, 'example_reference');
              event.currentTarget.value = '';
            }}
          />
        </label>
        <PhotoBoard description="" onRemove={(photo) => void removeClientPhoto(photo as ClientPhoto)} photos={inspirationPhotos} title="" />
      </div>

      <PhotoBoard
        description="Photos added after completed appointments will appear here with your consent."
        photos={hairPhotos}
        title="Completed haircut photos"
      />

      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <QrCode className="text-[#f4c430]" size={30} />
        <h2 className="mt-4 text-2xl font-black">Hair passport QR</h2>
        {clientSession && passport ? (
          <>
            <p className="mt-2 leading-7 text-white/68">
              Share this with a professional so they can request access to your hair profile. You can rotate or revoke this QR any time.
            </p>
            <div className="mx-auto mt-5 max-w-xs rounded-3xl bg-white p-4">
              <img
                className="aspect-square w-full"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=720x720&margin=18&data=${encodeURIComponent(passport.passportUrl)}`}
                alt="Client hair passport QR code"
              />
            </div>
            <p className="mt-4 break-all rounded-2xl bg-black/30 p-3 text-sm font-semibold text-white/62">{passport.passportUrl}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="min-h-12 rounded-2xl border border-white/15 px-4 text-sm font-black text-white disabled:opacity-50"
                type="button"
                disabled={passportBusy}
                onClick={() => void updatePassport('rotate')}
              >
                Rotate QR
              </button>
              <button
                className="min-h-12 rounded-2xl border border-red-300/30 px-4 text-sm font-black text-red-100 disabled:opacity-50"
                type="button"
                disabled={passportBusy}
                onClick={() => void updatePassport('revoke')}
              >
                Revoke
              </button>
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-white/45">
              Professional scan access still requires the Pro-side passport acceptance screen before private profile details are shown.
            </p>
          </>
        ) : (
          <p className="mt-2 leading-7 text-white/68">
            {clientSession ? 'Preparing your secure passport QR...' : 'Sign in to prepare your client hair passport.'}
          </p>
        )}
      </div>

      {mediaMessage ? <p className="rounded-2xl border border-[#f4c430]/35 bg-[#f4c430]/10 px-4 py-3 text-sm font-bold text-[#f4c430]">{mediaMessage}</p> : null}

      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <User className="text-[#f4c430]" size={30} />
        <h2 className="mt-4 text-2xl font-black">Settings</h2>
        <div className="mt-4 rounded-2xl border border-white/10">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-black text-white">
              Account
              <ChevronDown className="transition group-open:rotate-180" size={18} />
            </summary>
            <div className="border-t border-white/10 p-3">
              <button className="w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white" type="button" onClick={onSignOut} disabled={!clientSession}>
                Sign out
              </button>
              <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/35 px-4 py-3 text-sm font-black text-red-100" type="button" onClick={onDeleteAccount} disabled={!clientSession}>
                <Trash2 size={16} />
                Delete account
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function LegacyPreviewClientPassportPanel() {
  const passportUrl = 'https://frizi.ca/passport/preview';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&margin=18&data=${encodeURIComponent(passportUrl)}`;
  const [exampleUploaded, setExampleUploaded] = useState(false);
  const [profileUpdated, setProfileUpdated] = useState(false);
  const previewExample = {
    id: 'example_uploaded_preview',
    imageUrl: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80',
    label: 'Uploaded example',
    note: 'Client-added inspiration photo shared with the professional before booking.',
  };
  const visibleExamples = exampleUploaded ? [...clientExamplePhotos, previewExample] : clientExamplePhotos;

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
  onRemove,
  photos,
  title,
}: {
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  onRemove?: (photo: { id: string; imageUrl: string; label: string; note: string }) => void;
  photos: Array<{ id: string; imageUrl: string; label: string; note: string }>;
  title: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
      {title ? <h2 className="text-2xl font-black">{title}</h2> : null}
      {description ? <p className="mt-2 leading-7 text-white/68">{description}</p> : null}
      {photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {photos.map((photo) => (
          <article key={photo.id} className="overflow-hidden rounded-3xl bg-white/[0.06]">
            <img className="aspect-[4/5] w-full object-cover" src={photo.imageUrl} alt="" />
            <div className="p-3">
              <p className="font-black">{photo.label}</p>
              <p className="mt-1 text-sm font-semibold leading-5 text-white/58">{photo.note}</p>
              {onRemove ? (
                <button className="mt-3 rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => onRemove(photo)}>
                  Remove
                </button>
              ) : null}
            </div>
          </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/58">
          {title.toLowerCase().includes('completed') ? 'No haircut photos yet' : 'No photos uploaded yet'}
        </div>
      )}
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

function BookingConfirmation({ booking }: { booking: BookingRequest; clientSession: ClientSession | null }) {
  return (
    <div className="mt-4 rounded-2xl border border-[#f4c430]/35 bg-[#f4c430]/10 p-4">
      <p className="flex items-center gap-2 font-black text-emerald-300">
        <CheckCircle2 size={19} />
        Appointment request sent
      </p>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Your request for {booking.service} with {booking.professional} has been sent.
      </p>
      <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-[#101014] p-4 text-sm">
        <ReceiptRow label="Service" value={booking.service} />
        <ReceiptRow label="Professional" value={booking.professional} />
        <ReceiptRow label="Date" value={booking.date} />
        <ReceiptRow label="Time" value={formatSlotTime(booking.time)} />
        <ReceiptRow label="Status" value={booking.status === 'confirmed' ? 'Confirmed' : `Waiting for ${booking.professional} to confirm`} strong />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button className="rounded-2xl bg-[#f4c430] px-4 py-3 text-sm font-black text-black" type="button">
          View appointment
        </button>
        <button className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white" type="button">
          Message {booking.professional.split(' ')[0]}
        </button>
        <a className="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-black text-white" href="/">
          Back to Frizi
        </a>
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

function bookingFromApiAppointment(appointment: Record<string, unknown>): BookingRequest {
  const scheduledStart = String(appointment.scheduledStart || appointment.starts_at || '');
  const startDate = scheduledStart ? new Date(scheduledStart) : new Date();
  const status = String(appointment.status || 'pending') as BookingRequest['status'];
  return {
    id: String(appointment.id || ''),
    professionalId: String(appointment.professionalId || appointment.professional_id || ''),
    professional: String(appointment.professional || 'Professional'),
    service: String(appointment.service || 'Appointment'),
    serviceId: String(appointment.serviceId || appointment.service_id || ''),
    servicePriceCents: 0,
    date: startDate.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }),
    time: scheduledStart,
    eventId: String(appointment.id || `appt_${Date.now().toString(36)}`),
    status: ['pending', 'confirmed', 'declined', 'cancelled', 'completed'].includes(status) ? status : 'pending',
    scheduledStart,
    scheduledEnd: String(appointment.scheduledEnd || appointment.ends_at || ''),
    paymentRequirement: String(appointment.paymentRequirement || appointment.payment_requirement || 'pay_at_appointment'),
    paymentStatus: String(appointment.paymentStatus || appointment.payment_status || 'not_required'),
  };
}

function serviceIdFor(professionalId: string, serviceName: string) {
  return `${professionalId}:${slug(serviceName)}`;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
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
  const parsedSlot = new Date(slot);
  if (!Number.isNaN(parsedSlot.getTime())) return startOfDay(parsedSlot);

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
  const parsedSlot = new Date(slot);
  if (!Number.isNaN(parsedSlot.getTime())) {
    return parsedSlot.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  }

  return slot.replace(/^(today|tomorrow|mon|tue|wed|thu|fri|sat|sun)\s+/i, '');
}

function rankProfessionals(profileList: Professional[], query: string, filters: FilterState) {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return filterLocalProfiles(profileList, filters).sort((a, b) => scoreProfile(b, tokens) - scoreProfile(a, tokens));
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
  return Number.isFinite(parsed) ? parsed : 0;
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
  }, 0);
}

export default App;
