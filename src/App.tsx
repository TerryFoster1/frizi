import {
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  MapPin,
  MessageCircle,
  Mic,
  QrCode,
  ReceiptText,
  Search,
  Send,
  ShoppingBag,
  ShieldCheck,
  Scissors,
  Sparkles,
  Star,
  Trash2,
  User,
  UsersRound,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import type {
  Session as SupabaseSession,
  User as SupabaseUser,
} from '@supabase/supabase-js';
import {
  type CSSProperties,
  type FocusEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createClient, isSupabaseConfigured } from './utils/supabase/client';
import {
  enablePushNotifications,
  getPushSubscriptionStatus,
  notificationPermission,
  pushSupported,
  type PushSubscriptionStatus,
} from './lib/pushNotifications';
import { resolveProfessionalCapabilities } from './lib/friziEntitlements';

const FRIZI_PROMO_FALLBACK_IMAGE = '/frizi-client-hero-salon.png';

type Service = {
  id?: string;
  name: string;
  duration: string;
  price: string;
  priceCents?: number;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  paymentRequirement?: string;
};

type Review = {
  name: string;
  text: string;
  rating: number;
};

type PublicPromotion = {
  id: string;
  headline: string;
  description: string;
  discountType: string;
  discountValue: number;
  imageUrl: string;
  endAt: string;
  newClientsOnly: boolean;
  firstAppointmentOnly: boolean;
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
  bookingSlotsByService?: Record<string, string[]>;
  bookingSettings?: Record<string, unknown> | null;
  clientReviews: Review[];
  promotion: PublicPromotion | null;
  capabilities: ReturnType<typeof resolveProfessionalCapabilities>;
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
  status:
    | 'pending'
    | 'requested'
    | 'confirmed'
    | 'declined'
    | 'cancelled'
    | 'completed'
    | 'expired';
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
  promotion: null | {
    id: string;
    name: string;
    code: string;
    scope: string;
    discountType: string;
    discountValue: number;
  };
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
const pendingSaveProfessionalStorageKey = 'frizi-client-pending-save-professional';
const locationPromptStorageKey = 'frizi-client-location-prompt-complete';

type ClientNavKey =
  | 'appointments'
  | 'my-pros'
  | 'messages'
  | 'products'
  | 'hair-profile'
  | 'settings';
type AccountNavKey = 'appointments' | 'my-pros' | 'messages' | 'hair-profile';
type ClientAuthIntent =
  'default' | 'promo' | 'booking' | 'invite' | 'save-pro' | AccountNavKey;

type ClientHairProfile = {
  color: string;
  texture: string;
  density: string;
  length: string;
  currentStyle: string;
  goals: string;
  products: string;
  treatmentHistory: string;
};

const emptyClientHairProfile: ClientHairProfile = {
  color: '',
  texture: '',
  density: '',
  length: '',
  currentStyle: '',
  goals: '',
  products: '',
  treatmentHistory: '',
};

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

type ClientNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  professionalId: string;
  appointmentId: string;
  messageId: string;
  promotionId: string;
  actionPath: string;
  readAt: string | null;
  createdAt: string;
};

type ClientConversation = {
  id: string;
  professionalId: string;
  professionalName: string;
  studioName: string;
  avatarUrl: string;
  avatarFallback: string;
  latestMessage: string;
  latestMessageAt: string;
  messages: ClientConversationMessage[];
  unreadCount: number;
};

type ClientConversationMessage = {
  id: string;
  body: string;
  createdAt: string;
  isFromProfessional: boolean;
  messageType: string;
  promotion: ClientPromoMessage | null;
};

type ClientPromoMessage = {
  id: string;
  headline: string;
  description: string;
  discountType: string;
  discountValue: number;
  imageUrl: string;
  endAt: string;
  expired: boolean;
};

type ClientPassport = {
  id: string;
  status: string;
  passportUrl: string;
  expiresAt?: string | null;
};

function isAccountNavIntent(intent: ClientAuthIntent): intent is AccountNavKey {
  return (
    intent === 'appointments' ||
    intent === 'my-pros' ||
    intent === 'messages' ||
    intent === 'hair-profile'
  );
}

function readClientOAuthContext() {
  try {
    const rawContext = window.sessionStorage.getItem(
      clientOAuthContextStorageKey,
    );
    if (!rawContext) return null;
    const parsed = JSON.parse(rawContext) as {
      intent?: string;
      returnPath?: string;
      hasPendingBooking?: boolean;
    };
    const intent: ClientAuthIntent =
      parsed.intent === 'promo' ||
      parsed.intent === 'booking' ||
      parsed.intent === 'invite' ||
      isAccountNavIntent(parsed.intent as ClientAuthIntent)
        ? (parsed.intent as ClientAuthIntent)
        : 'default';
    const returnPath =
      typeof parsed.returnPath === 'string' && parsed.returnPath.startsWith('/')
        ? parsed.returnPath
        : '/';
    return {
      intent,
      returnPath,
      hasPendingBooking: Boolean(parsed.hasPendingBooking),
    };
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
    const parsed = JSON.parse(
      window.localStorage.getItem(pendingInviteStorageKey) || '{}',
    ) as {
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
    label: 'Haircut',
    query: 'Haircut',
    aliases: ['cut', 'trim', 'hairstylist', 'stylist', 'hair services'],
  },
  {
    label: 'Barber',
    query: 'Barber',
    aliases: [
      'barbering',
      "men's cuts",
      'mens cuts',
      'fades',
      'beard services',
    ],
  },
  {
    label: 'Colourist',
    query: 'Colourist',
    aliases: [
      'colour',
      'color',
      'highlights',
      'balayage',
      'colour correction',
      'color correction',
    ],
  },
  {
    label: 'Beard Trim',
    query: 'Beard Trim',
    aliases: ['beard', 'barbering', 'line up', 'grooming'],
  },
  {
    label: 'Blowout',
    query: 'Blowout',
    aliases: ['blow dry', 'style', 'styling'],
  },
  {
    label: 'Balayage',
    query: 'Balayage',
    aliases: ['colour', 'color', 'highlights', 'colourist'],
  },
  {
    label: 'Updo',
    query: 'Updo',
    aliases: ['formal styling', 'bridal hair', 'wedding hair'],
  },
  {
    label: 'Braids',
    query: 'Braids',
    aliases: ['protective styles', 'braiding'],
  },
  {
    label: 'Extensions',
    query: 'Extensions',
    aliases: ['hair extensions', 'weave'],
  },
  {
    label: 'Lashes',
    query: 'Lashes',
    aliases: ['lash extensions', 'lash lift'],
  },
  {
    label: 'Manicure',
    query: 'Manicure',
    aliases: ['nails', 'gel nails', 'nail care'],
  },
  {
    label: 'More services...',
    query: 'Hair professional near me',
    aliases: ['stylist', 'barber', 'colourist', 'lashes', 'manicure', 'brows'],
  },
] as const;

const clientProfilePhoto = '';
const clientHairPhotos = [] as ClientPhoto[];
const clientExamplePhotos = [] as ClientPhoto[];

type LiveProfessionalRow = {
  id: string;
  profile_id?: string | null;
  display_name: string;
  professional_title?: string | null;
  studio_name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  hero_photo_url: string | null;
  specialties: string[] | null;
  primary_specialty: string | null;
  booking_settings: Record<string, unknown> | null;
  public_profile_status?: string | null;
  bookable?: boolean | null;
  account_plan?: string | null;
  subscription_status?: string | null;
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
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  service_metadata: Record<string, unknown> | null;
};

type LivePromotionRow = {
  id: string;
  created_by: string;
  name: string;
  client_headline: string | null;
  public_description: string | null;
  discount_type: string;
  discount_value: number;
  image_url: string | null;
  end_at: string | null;
  active: boolean;
  first_appointment_only: boolean;
  new_clients_only: boolean;
  show_on_profile?: boolean;
  is_featured_profile_offer?: boolean;
  requires_code: boolean;
  archived_at?: string | null;
};

function formatServicePrice(service: LiveServiceRow) {
  if (service.pricing_type === 'free_consultation') return 'Free';
  if (service.pricing_type === 'price_varies') return 'Varies';
  const dollars = Math.round(service.base_price_cents / 100);
  return service.pricing_type === 'starting_at'
    ? `From $${dollars}`
    : `$${dollars}`;
}

function defaultBookingDurationFromSettings(settings: Record<string, unknown> | null) {
  const availability = settings?.availability && typeof settings.availability === 'object'
    ? (settings.availability as { defaultBookingDurationMinutes?: unknown })
    : null;
  const value = Number(settings?.defaultBookingDurationMinutes || availability?.defaultBookingDurationMinutes || 45);
  return Number.isFinite(value) && value >= 15 ? Math.min(240, value) : 45;
}

function basicBookingServiceFor(profileId: string, settings: Record<string, unknown> | null): Service {
  const durationMinutes = defaultBookingDurationFromSettings(settings);
  return {
    id: `basic:${profileId.replace(/^live-/, '')}`,
    name: 'Appointment request',
    duration: `${durationMinutes} min`,
    price: '',
    priceCents: 0,
    durationMinutes,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    paymentRequirement: 'pay_at_appointment',
  };
}

function cleanPublicProfessionalTitle(value?: string | null) {
  const trimmed = String(value || '').trim();
  if (!trimmed || /^other$/i.test(trimmed)) return '';
  return trimmed;
}

function publicProfessionalTitle(profile: {
  professional_title?: string | null;
  primary_specialty?: string | null;
  specialties?: string[] | null;
}) {
  return (
    cleanPublicProfessionalTitle(profile.professional_title) ||
    cleanPublicProfessionalTitle(profile.primary_specialty) ||
    cleanPublicProfessionalTitle(profile.specialties?.find(Boolean)) ||
    ''
  );
}

function normalizeClientHairProfile(value: unknown): ClientHairProfile {
  const source =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  return {
    color: String(source.color || source.hairColor || ''),
    texture: String(source.texture || source.hairTexture || ''),
    density: String(source.density || ''),
    length: String(source.length || source.hairLength || ''),
    currentStyle: String(source.currentStyle || source.current_style || ''),
    goals: String(source.goals || source.notes || ''),
    products: String(source.products || source.productNotes || ''),
    treatmentHistory: String(
      source.treatmentHistory || source.treatment_history || '',
    ),
  };
}

function liveProfessionalSearchTerms(
  profile: LiveProfessionalRow,
  location?: LiveLocationRow,
) {
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

function taxonomyTermsForLiveProfile(
  profile: LiveProfessionalRow,
  services: LiveServiceRow[],
) {
  const rawTerms = [
    profile.primary_specialty || '',
    ...(profile.specialties || []),
    ...services.flatMap((service) => [
      service.name,
      service.public_description || '',
    ]),
  ]
    .join(' ')
    .toLowerCase();

  const aliases: string[] = [];
  if (/\b(barber|fade|taper|beard|men|mens|line up)\b/.test(rawTerms)) {
    aliases.push(
      'Barber',
      'barbering',
      "men's cuts",
      'fades',
      'Beard Grooming',
      'beard services',
    );
  }
  if (
    /\b(colou?r|highlight|balayage|toner|blond|correction)\b/.test(rawTerms)
  ) {
    aliases.push(
      'Colourist',
      'colour',
      'color',
      'highlights',
      'balayage',
      'colour correction',
    );
  }
  if (/\b(curl|curly|texture|wave)\b/.test(rawTerms)) {
    aliases.push('Curly Hair', 'curls', 'curly cuts', 'texture');
  }
  if (/\b(extension|weave)\b/.test(rawTerms))
    aliases.push('Extensions', 'hair extensions');
  if (/\b(braid|protective)\b/.test(rawTerms))
    aliases.push('Braids', 'protective styles');
  if (/\b(bride|bridal|wedding|updo)\b/.test(rawTerms))
    aliases.push('Bridal Hair', 'wedding hair');
  if (/\b(manicure|nail)\b/.test(rawTerms)) aliases.push('Manicure', 'nails');
  if (/\b(lash|lashes)\b/.test(rawTerms))
    aliases.push('Lashes', 'lash extensions');
  if (/\b(brow|brows)\b/.test(rawTerms)) aliases.push('Brows', 'brow shaping');
  if (/\b(hair|cut|style|blowout|stylist)\b/.test(rawTerms))
    aliases.push('Hairstylist', 'Stylist', 'hair services');

  return Array.from(new Set(aliases));
}

async function loadLiveProfessionals(): Promise<Professional[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = createClient();
  const { data: liveProfiles, error: profileError } = await supabase
    .from('frizi_professionals')
    .select(
      'id, profile_id, display_name, professional_title, studio_name, bio, specialties, primary_specialty, profile_photo_url, hero_photo_url, public_profile_status, bookable, booking_settings, account_plan, subscription_status',
    )
    .eq('public_profile_status', 'published')
    .eq('bookable', true)
    .not('profile_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(12);

  if (profileError) throw profileError;
  if (!liveProfiles?.length) return [];

  const eligibleProfiles = (liveProfiles as LiveProfessionalRow[]).filter(
    (profile) =>
      resolveProfessionalCapabilities(profile).canAppearInDiscovery &&
      profile.public_profile_status === 'published' &&
      profile.bookable,
  );
  if (!eligibleProfiles.length) return [];

  const ids = eligibleProfiles.map((profile: LiveProfessionalRow) => profile.id);
  const [
    { data: locations, error: locationError },
    { data: services, error: serviceError },
    { data: promotions, error: promotionError },
  ] = await Promise.all([
    supabase
      .from('frizi_professional_locations')
      .select('professional_id, city, province, service_radius_km')
      .in('professional_id', ids)
      .eq('primary_location', true)
      .eq('active', true),
    supabase
      .from('frizi_services')
      .select(
        'id, professional_id, name, public_description, base_price_cents, pricing_type, duration_minutes, deposit_type, deposit_amount_cents, deposit_percentage, buffer_before_minutes, buffer_after_minutes, service_metadata',
      )
      .in('professional_id', ids)
      .eq('active', true)
      .eq('online_booking_enabled', true)
      .eq('new_clients_allowed', true)
      .eq('existing_clients_only', false)
      .order('display_order', { ascending: true }),
    supabase
      .from('frizi_promotions')
      .select(
        'id, created_by, name, client_headline, public_description, discount_type, discount_value, image_url, end_at, active, first_appointment_only, new_clients_only, show_on_profile, is_featured_profile_offer, requires_code, archived_at',
      )
      .in('created_by', ids)
      .eq('active', true)
      .eq('show_on_profile', true)
      .eq('is_featured_profile_offer', true)
      .eq('requires_code', false)
      .order('updated_at', { ascending: false }),
  ]);

  if (locationError) throw locationError;
  if (serviceError) throw serviceError;
  if (promotionError) throw promotionError;

  return eligibleProfiles.flatMap(
    (profile): Professional[] => {
      const capabilities = resolveProfessionalCapabilities(profile);
      const location = (locations as LiveLocationRow[] | null)?.find(
        (candidate) => candidate.professional_id === profile.id,
      );
      const profileServices = (
        (services as LiveServiceRow[] | null) || []
      ).filter((service) => service.professional_id === profile.id);
      const publicPromotion =
        capabilities.canCreatePromotions
          ? ((promotions as LivePromotionRow[] | null) || [])
              .filter((promotion) => promotion.created_by === profile.id)
              .map(publicPromotionFromRow)
              .find(Boolean) || null
          : null;
      const specialties = (profile.specialties || [])
        .map(cleanPublicProfessionalTitle)
        .filter(Boolean);
      const role = publicProfessionalTitle(profile);
      const publicServices = capabilities.canUseAdvancedServices
        ? profileServices.map((service) => ({
            name: service.name,
            duration: `${service.duration_minutes || 60} min`,
            price: formatServicePrice(service),
            priceCents: service.base_price_cents,
            id: service.id,
            durationMinutes: service.duration_minutes || 60,
            paymentRequirement: paymentRequirementForService(service),
            bufferBeforeMinutes: service.buffer_before_minutes || 0,
            bufferAfterMinutes: service.buffer_after_minutes || 0,
          }))
        : [basicBookingServiceFor(profile.id, profile.booking_settings)];
      if (!publicServices.length) return [];
      const bookingSlots = buildSlotsFromBookingSettings(
        profile.booking_settings,
        publicServices[0]?.durationMinutes || 45,
      );
      const searchTerms = [
        ...liveProfessionalSearchTerms(profile, location),
        ...(capabilities.canUseAdvancedServices
          ? profileServices.flatMap((service) => [
              service.name,
              service.public_description || '',
            ])
          : []),
        ...taxonomyTermsForLiveProfile(profile, profileServices),
      ].filter(Boolean);

      return [
        {
          id: `live-${profile.id}`,
          name: profile.display_name,
          role,
          studio: profile.studio_name || 'Independent professional',
          neighborhood: location
            ? `${location.city}, ${location.province}`
            : 'Local area',
          distance: location?.city ? location.city : 'Local area',
          heroImage:
            profile.hero_photo_url ||
            '/frizi-client-hero-salon.png',
          detailImage:
            profile.profile_photo_url ||
            '/frizi-icon.png',
          rating: 0,
          reviews: 0,
          repeatRate: 'New',
          nextAvailable: 'Request a time',
          specialties: specialties.length ? specialties.slice(0, 5) : [],
          accommodations: ['Book online', 'Frizi verified profile'],
          searchTerms,
          whyMatch: profile.studio_name || 'Independent professional',
          bio: profile.bio || 'This professional has not added a bio yet.',
          services: publicServices,
          bookingSlots,
          bookingSettings: profile.booking_settings,
          clientReviews: [],
          promotion: publicPromotion,
          capabilities,
        },
      ];
    },
  );
}

function paymentRequirementForService(service: LiveServiceRow) {
  const metadataRequirement = String(
    service.service_metadata?.payment_requirement || '',
  );
  if (
    [
      'pay_at_appointment',
      'frizi_payment_optional',
      'deposit_required',
      'full_prepayment_required',
    ].includes(metadataRequirement)
  ) {
    return metadataRequirement;
  }
  if (service.deposit_type && service.deposit_type !== 'none')
    return 'deposit_required';
  return 'pay_at_appointment';
}

function publicPromotionFromRow(row: LivePromotionRow): PublicPromotion | null {
  const headline = String(row.client_headline || row.name || '').trim();
  const description = String(row.public_description || '').trim();
  if (!headline || !description) return null;
  if (!row.active || row.requires_code || row.archived_at) return null;
  if (!row.show_on_profile || !row.is_featured_profile_offer) return null;
  if (row.end_at && new Date(row.end_at).getTime() < Date.now()) return null;
  if (!row.new_clients_only && !row.first_appointment_only) return null;

  return {
    id: row.id,
    headline,
    description,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value || 0),
    imageUrl: row.image_url || FRIZI_PROMO_FALLBACK_IMAGE,
    endAt: row.end_at || '',
    newClientsOnly: Boolean(row.new_clients_only),
    firstAppointmentOnly: Boolean(row.first_appointment_only),
  };
}

type AvailabilityShiftLike = {
  date?: string;
  startTime?: string;
  endTime?: string;
  breakStartTime?: string;
  breakEndTime?: string;
};

type BlockedAppointmentLike = {
  startsAt?: string;
  endsAt?: string;
  starts_at?: string;
  ends_at?: string;
};

function buildSlotsFromBookingSettings(
  settings: Record<string, unknown> | null,
  durationMinutes: number,
  options: {
    bufferBeforeMinutes?: number;
    bufferAfterMinutes?: number;
    blockedAppointments?: BlockedAppointmentLike[];
  } = {},
) {
  const availability = (settings?.availability || {}) as {
    shifts?: AvailabilityShiftLike[];
    bookingIntervalMinutes?: number;
  };
  const intervalMinutes = Number(
    (availability as { bookingIntervalMinutes?: number })
      .bookingIntervalMinutes || 30,
  );
  const shifts = Array.isArray(availability.shifts) ? availability.shifts : [];
  const blockedAppointments = Array.isArray(options.blockedAppointments)
    ? options.blockedAppointments
    : [];
  const bufferBeforeMinutes = Math.max(
    0,
    Number(options.bufferBeforeMinutes || 0),
  );
  const bufferAfterMinutes = Math.max(
    0,
    Number(options.bufferAfterMinutes || 0),
  );
  const now = new Date();
  const slots: string[] = [];

  for (const shift of shifts) {
    if (!shift.date || !shift.startTime || !shift.endTime) continue;
    const startMinutes = parseClockMinutes(shift.startTime);
    const endMinutes = parseClockMinutes(shift.endTime);
    if (startMinutes === null || endMinutes === null) continue;

    for (
      let cursor = startMinutes;
      cursor + durationMinutes <= endMinutes;
      cursor += intervalMinutes
    ) {
      const candidateStartMinutes = cursor - bufferBeforeMinutes;
      const candidateEndMinutes = cursor + durationMinutes + bufferAfterMinutes;
      if (shift.breakStartTime && shift.breakEndTime) {
        const breakStart = parseClockMinutes(shift.breakStartTime);
        const breakEnd = parseClockMinutes(shift.breakEndTime);
        if (
          breakStart !== null &&
          breakEnd !== null &&
          rangesOverlap(cursor, cursor + durationMinutes, breakStart, breakEnd)
        )
          continue;
      }
      const slot = dateTimeFromParts(shift.date, cursor);
      if (slot.getTime() <= now.getTime() + 12 * 60 * 60 * 1000) continue;
      if (
        blockedAppointments.some((blocked) =>
          appointmentOverlapsSlot(
            blocked,
            slot,
            candidateStartMinutes,
            candidateEndMinutes,
          ),
        )
      )
        continue;
      slots.push(slot.toISOString());
      if (slots.length >= 24) return slots;
    }
  }

  return slots.sort();
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) {
  return startA < endB && endA > startB;
}

function appointmentOverlapsSlot(
  blocked: BlockedAppointmentLike,
  slot: Date,
  startMinutes: number,
  endMinutes: number,
) {
  const blockedStartValue = blocked.startsAt || blocked.starts_at;
  const blockedEndValue = blocked.endsAt || blocked.ends_at;
  if (!blockedStartValue || !blockedEndValue) return false;
  const blockedStart = new Date(blockedStartValue);
  const blockedEnd = new Date(blockedEndValue);
  if (
    Number.isNaN(blockedStart.getTime()) ||
    Number.isNaN(blockedEnd.getTime())
  )
    return false;
  if (dateKey(startOfDay(blockedStart)) !== dateKey(startOfDay(slot)))
    return false;
  const blockedStartMinutes =
    blockedStart.getHours() * 60 + blockedStart.getMinutes();
  const blockedEndMinutes =
    blockedEnd.getHours() * 60 + blockedEnd.getMinutes();
  return rangesOverlap(
    startMinutes,
    endMinutes,
    blockedStartMinutes,
    blockedEndMinutes,
  );
}

function bookingSlotsForService(
  profile: Professional,
  service: Service | undefined,
) {
  if (!service) return profile.bookingSlots;
  const directSlots = service.id
    ? profile.bookingSlotsByService?.[service.id]
    : undefined;
  if (directSlots) return directSlots;
  return buildSlotsFromBookingSettings(
    profile.bookingSettings || null,
    service.durationMinutes || 60,
    {
      bufferBeforeMinutes: service.bufferBeforeMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
    },
  );
}

function parseClockMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours > 23 ||
    minutes > 59
  )
    return null;
  return hours * 60 + minutes;
}

function dateTimeFromParts(date: string, minutes: number) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
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
  const infoPageMatch = window.location.pathname.match(
    /^\/(help|policies)\/([^/?#]+)/,
  );
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [activeIndex, setActiveIndex] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [activeClientNav, setActiveClientNav] = useState<ClientNavKey | null>(
    null,
  );
  const [selectedService, setSelectedService] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [profileBookingSignal, setProfileBookingSignal] = useState(0);
  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<ClientAuthIntent>('default');
  const [authInitialMode, setAuthInitialMode] = useState<'signup' | 'signin'>(
    'signup',
  );
  const [clientSession, setClientSession] = useState<ClientSession | null>(
    null,
  );
  const [openBookingAfterAuth, setOpenBookingAfterAuth] = useState(false);
  const [liveProfessionals, setLiveProfessionals] = useState<Professional[]>(
    [],
  );
  const [connectedProfessionals, setConnectedProfessionals] = useState<
    Professional[]
  >([]);
  const [clientAppointments, setClientAppointments] = useState<
    BookingRequest[]
  >([]);
  const [clientConversations, setClientConversations] = useState<
    ClientConversation[]
  >([]);
  const [bookingProfile, setBookingProfile] = useState<Professional | null>(
    null,
  );
  const [professionalPickerOpen, setProfessionalPickerOpen] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingServicesLoading, setBookingServicesLoading] = useState(false);
  const [bookingServicesError, setBookingServicesError] = useState('');
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [, setSavingProfessionalId] = useState('');
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [clientNotifications, setClientNotifications] = useState<
    ClientNotification[]
  >([]);

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
        await ensureCanonicalClientProfile(
          data.session.user,
          session.name,
        ).catch((error) =>
          console.warn(
            '[frizi-client-profile-upsert]',
            error instanceof Error ? error.message : error,
          ),
        );
        setClientSession(session);
        window.localStorage.setItem(
          clientSessionStorageKey,
          JSON.stringify(session),
        );
        window.sessionStorage.removeItem(clientOAuthContextStorageKey);
        const pendingBooking = window.localStorage.getItem(
          pendingBookingStorageKey,
        );
        if (pendingBooking) {
          try {
            void submitBookingRequest(
              JSON.parse(pendingBooking) as BookingRequest,
              session,
            );
          } finally {
            window.localStorage.removeItem(pendingBookingStorageKey);
          }
        } else {
          void loadClientAppointments(session);
          void loadClientNotifications();
          void loadClientConversations(session);
          void savePendingProfessional(session);
          if (authContext?.intent === 'promo') {
            setOpenBookingAfterAuth(true);
          } else if (authContext?.intent === 'invite') {
            trackClientEvent('auth_completed', {
              intent: 'invite',
              route: authContext.returnPath,
            });
          } else if (authContext?.intent === 'save-pro') {
            setActiveClientNav(null);
          } else if (authContext && isAccountNavIntent(authContext.intent)) {
            setActiveClientNav(authContext.intent);
          }
        }
      })
      .catch((error) =>
        console.warn(
          '[frizi-client-auth-session]',
          error instanceof Error ? error.message : error,
        ),
      );
  }, []);

  useEffect(() => {
    loadLiveProfessionals()
      .then(setLiveProfessionals)
      .catch((error) =>
        console.warn(
          '[frizi-live-professionals]',
          error instanceof Error ? error.message : error,
        ),
      );
  }, []);

  const allProfessionals = liveProfessionals;
  const hasSearched = submittedQuery.trim().length > 0;
  const rankedProfiles = useMemo(
    () =>
      hasSearched
        ? rankProfessionals(allProfessionals, submittedQuery, filters)
        : [],
    [allProfessionals, filters, hasSearched, submittedQuery],
  );
  const activeProfile =
    rankedProfiles.length > 0
      ? rankedProfiles[activeIndex % rankedProfiles.length]
      : null;
  const lastOpenedProfileKey = useRef('');
  const activeBookingProfile = bookingProfile || activeProfile;
  const activeService = activeBookingProfile
    ? selectedService || activeBookingProfile.services[0]?.name || ''
    : '';
  const activeServiceRecord =
    activeBookingProfile?.services.find(
      (service) => service.name === activeService,
    ) || activeBookingProfile?.services[0];
  const activeBookingSlots =
    activeBookingProfile && activeServiceRecord
      ? bookingSlotsForService(activeBookingProfile, activeServiceRecord)
      : [];
  const activeTime = activeBookingProfile
    ? selectedTime || activeBookingSlots[0] || ''
    : '';
  const activeAvailabilityDays = useMemo(
    () => buildAvailabilityDays(activeBookingSlots),
    [activeBookingSlots],
  );
  const activeSelectedDay =
    activeAvailabilityDays.find((day) => day.times.includes(activeTime)) ||
    activeAvailabilityDays[0];
  const unreadClientNotificationCount = clientNotifications.filter(
    (notification) => !notification.readAt,
  ).length;

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
            window.localStorage.setItem(
              clientSessionStorageKey,
              JSON.stringify(session),
            );
          }}
          onContinueHome={(session) => {
            setClientSession(session);
            window.localStorage.setItem(
              clientSessionStorageKey,
              JSON.stringify(session),
            );
            setActiveClientNav('hair-profile');
            window.history.replaceState({}, '', '/');
            trackClientEvent('client_home_reached', {
              invitation_token: inviteToken,
              route: '/',
            });
          }}
        />
        {authModalOpen ? (
          <ClientAuthModal
            initialMode={authInitialMode}
            intent={authIntent}
            onClose={() => setAuthModalOpen(false)}
            onComplete={handleClientAuth}
          />
        ) : null}
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
    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
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
      setVoiceMessage(
        transcript
          ? `Searching for: ${transcript}`
          : 'No speech detected. Try again.',
      );
    };
    recognition.onerror = () => {
      setIsListening(false);
      setVoiceMessage(
        'Voice search could not hear you. Tap the mic and try again.',
      );
    };
    recognition.onend = () => setIsListening(false);

    try {
      setIsListening(true);
      setVoiceMessage('Listening...');
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceMessage(
        'Voice search is already starting. Try again in a second.',
      );
    }
  }

  function handleClientAuth(session: ClientSession, createdAccount = false) {
    setClientSession(session);
    window.localStorage.setItem(
      clientSessionStorageKey,
      JSON.stringify(session),
    );
    setAuthModalOpen(false);
    trackClientEvent('auth_completed', {
      intent: authIntent,
      route: window.location.pathname,
    });
    void loadClientAppointments(session);
    void loadClientNotifications();
    void loadClientConversations(session);
    void savePendingProfessional(session);
    if (authIntent === 'invite') {
      setAuthIntent('default');
      return;
    }
    if (
      createdAccount &&
      !window.localStorage.getItem(locationPromptStorageKey)
    ) {
      setLocationPromptOpen(true);
    }
    if (authIntent === 'booking') {
      const pendingBooking = window.localStorage.getItem(
        pendingBookingStorageKey,
      );
      if (pendingBooking) {
        try {
          void submitBookingRequest(
            JSON.parse(pendingBooking) as BookingRequest,
            session,
          );
          window.localStorage.removeItem(pendingBookingStorageKey);
        } catch {
          window.localStorage.removeItem(pendingBookingStorageKey);
        }
      }
    } else if (authIntent === 'promo') {
      setOpenBookingAfterAuth(true);
      setActiveClientNav(null);
      setBookingProfile(null);
    } else if (authIntent === 'save-pro') {
      setActiveClientNav(null);
    } else if (isAccountNavIntent(authIntent)) {
      setActiveClientNav(authIntent);
    } else {
      setActiveClientNav(null);
    }
    setAuthIntent('default');
  }

  function clearClientAccountBrowserState() {
    window.localStorage.removeItem(clientSessionStorageKey);
    window.localStorage.removeItem(pendingBookingStorageKey);
    window.localStorage.removeItem(pendingInviteStorageKey);
    window.localStorage.removeItem(pendingSaveProfessionalStorageKey);
    window.sessionStorage.removeItem(clientOAuthContextStorageKey);
    setClientSession(null);
    setClientAppointments([]);
    setClientConversations([]);
    setClientNotifications([]);
    setBooking(null);
    setOpenBookingAfterAuth(false);
    setAuthIntent('default');
    setAuthModalOpen(false);
    setDeleteAccountOpen(false);
    setActiveClientNav(null);
  }

  async function signOutClient() {
    await createClient()
      .auth.signOut()
      .catch(() => undefined);
    clearClientAccountBrowserState();
  }

  async function deleteClientAccount(confirmation: string) {
    const { data, error } = await createClient().auth.getSession();
    const accessToken =
      data.session?.access_token || clientSession?.accessToken;
    if (error || !accessToken)
      throw error || new Error('Sign in again before deleting your account.');

    const response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmation }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        payload.error || 'Account deletion could not be completed.',
      );
    await createClient()
      .auth.signOut()
      .catch(() => undefined);
    clearClientAccountBrowserState();
  }

  async function loadClientAppointments(session = clientSession) {
    if (!session?.accessToken) return;
    try {
      const response = await fetch('/api/client-appointments', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || 'Could not load appointments.');
      const appointments: BookingRequest[] = Array.isArray(payload.appointments)
        ? payload.appointments.map((appointment: Record<string, unknown>) =>
            bookingFromApiAppointment(appointment),
          )
        : [];
      const professionals: Professional[] = Array.isArray(
        payload.connectedProfessionals,
      )
        ? payload.connectedProfessionals.map(
            (profile: Record<string, unknown>) => professionalFromApi(profile),
          )
        : [];
      setClientAppointments(appointments);
      setConnectedProfessionals(professionals);
      setSavedIds((current) =>
        Array.from(
          new Set([
            ...current,
            ...professionals.map((professional) => professional.id),
          ]),
        ),
      );
      const nextAppointment = appointments.find(
        (appointment) =>
          !isAppointmentPast(appointment) &&
          (appointment.status === 'pending' ||
            appointment.status === 'confirmed'),
      );
      if (nextAppointment) setBooking(nextAppointment);
    } catch (error) {
      console.warn(
        '[frizi-client-appointments]',
        error instanceof Error ? error.message : error,
      );
    }
  }

  function profileIsSaved(profile: Professional) {
    const professionalId = normalizeClientProfessionalId(profile.id);
    return (
      savedIds.some((id) => normalizeClientProfessionalId(id) === professionalId) ||
      connectedProfessionals.some(
        (professional) =>
          normalizeClientProfessionalId(professional.id) === professionalId,
      )
    );
  }

  async function saveProfessional(profile: Professional, session = clientSession) {
    const professionalId = normalizeClientProfessionalId(profile.id);
    if (!session?.accessToken) {
      window.localStorage.setItem(
        pendingSaveProfessionalStorageKey,
        professionalId,
      );
      openClientAuth('save-pro', 'signup');
      return;
    }

    setSavingProfessionalId(professionalId);
    try {
      const response = await fetch('/api/save-professional', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ professionalId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || 'This professional could not be saved.');
      setSavedIds((current) =>
        current.some((id) => normalizeClientProfessionalId(id) === professionalId)
          ? current
          : [...current, profile.id],
      );
      window.localStorage.removeItem(pendingSaveProfessionalStorageKey);
      void loadClientAppointments(session);
    } catch (error) {
      console.warn(
        '[frizi-client-save-professional]',
        error instanceof Error ? error.message : error,
      );
    } finally {
      setSavingProfessionalId('');
    }
  }

  async function savePendingProfessional(session: ClientSession) {
    const professionalId = window.localStorage.getItem(
      pendingSaveProfessionalStorageKey,
    );
    if (!professionalId) return;
    await saveProfessional(
      {
        id: `live-${professionalId}`,
        name: 'Saved professional',
        role: '',
        studio: '',
        neighborhood: '',
        distance: '',
        heroImage: '',
        detailImage: '',
        rating: 0,
        reviews: 0,
        repeatRate: '',
        nextAvailable: '',
        specialties: [],
        accommodations: [],
        searchTerms: [],
        whyMatch: '',
        bio: '',
        services: [],
        bookingSlots: [],
        clientReviews: [],
        promotion: null,
        capabilities: resolveProfessionalCapabilities({ account_plan: 'pro_free' }),
      },
      session,
    );
  }

  async function loadClientConversations(session = clientSession) {
    if (!session?.accessToken) {
      setClientConversations([]);
      return;
    }
    try {
      const response = await fetch('/api/client-messages', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || 'Could not load messages.');
      const conversations: ClientConversation[] = Array.isArray(
        payload.conversations,
      )
        ? payload.conversations.map(
            (conversation: Record<string, unknown>) => ({
              id: String(conversation.id || ''),
              professionalId: String(conversation.professionalId || ''),
              professionalName: String(
                conversation.professionalName || 'Frizi Pro',
              ),
              studioName: String(conversation.studioName || ''),
              avatarUrl: String(conversation.avatarUrl || ''),
              avatarFallback: String(conversation.avatarFallback || 'FP'),
              latestMessage: String(
                conversation.latestMessage || 'No messages yet.',
              ),
              latestMessageAt: String(conversation.latestMessageAt || ''),
              messages: Array.isArray(conversation.messages)
                ? conversation.messages.map(messageFromApi)
                : [],
              unreadCount: Number(conversation.unreadCount || 0),
            }),
          )
        : [];
      setClientConversations(conversations);
    } catch (error) {
      console.warn(
        '[frizi-client-conversations]',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async function loadClientNotifications() {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await createClient()
        .from('frizi_notifications')
        .select(
          'id, notification_type, title, body, professional_id, appointment_id, message_id, promotion_id, action_path, read_at, created_at',
        )
        .eq('recipient_role', 'client')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setClientNotifications(
        (data || []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          type: String(row.notification_type || ''),
          title: String(row.title || 'Notification'),
          body: String(row.body || ''),
          professionalId: String(row.professional_id || ''),
          appointmentId: String(row.appointment_id || ''),
          messageId: String(row.message_id || ''),
          promotionId: String(row.promotion_id || ''),
          actionPath: String(row.action_path || ''),
          readAt: row.read_at ? String(row.read_at) : null,
          createdAt: String(row.created_at || ''),
        })),
      );
    } catch (error) {
      console.warn(
        '[frizi-client-notifications]',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async function openClientNotification(notification: ClientNotification) {
    if (!notification.readAt) {
      const readAt = new Date().toISOString();
      setClientNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt } : item,
        ),
      );
      const { error } = await createClient()
        .from('frizi_notifications')
        .update({ read_at: readAt, updated_at: readAt })
        .eq('id', notification.id);
      if (error) {
        console.warn('[frizi-client-notifications] read state', error.message);
      }
    }
    setNotificationCenterOpen(false);
    if (/message|promo/i.test(notification.type)) {
      setActiveClientNav('messages');
      void loadClientConversations();
      return;
    }
    setActiveClientNav('appointments');
    void loadClientAppointments();
  }

  async function refreshBookingProfileServices(
    profile: Professional,
    session = clientSession,
  ) {
    if (!session?.accessToken) return profile;
    setBookingServicesLoading(true);
    setBookingServicesError('');
    const professionalId = normalizeClientProfessionalId(profile.id);
    try {
      const response = await fetch(
        `/api/client-appointments?professionalId=${encodeURIComponent(professionalId)}`,
        {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error || 'We could not load services.');
      const refreshed = payload.professional
        ? professionalFromApi(payload.professional as Record<string, unknown>)
        : profile;
      console.info('[frizi-client-booking-services]', {
        professionalId,
        serviceCount: refreshed.services.length,
        requestedAt: new Date().toISOString(),
      });
      setBookingProfile((current) =>
        current && normalizeClientProfessionalId(current.id) === professionalId
          ? refreshed
          : current,
      );
      if (refreshed.services.length) {
        const firstService = refreshed.services[0];
        setSelectedService((current) => current || firstService.name);
        setSelectedTime(
          bookingSlotsForService(refreshed, firstService)[0] || '',
        );
      }
      return refreshed;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'We could not load services.';
      console.warn('[frizi-client-booking-services]', {
        professionalId,
        error: message,
        requestedAt: new Date().toISOString(),
      });
      setBookingServicesError(message);
      return profile;
    } finally {
      setBookingServicesLoading(false);
    }
  }

  async function submitBookingRequest(
    request: BookingRequest,
    session = clientSession,
  ) {
    setBookingError('');
    if (!session?.accessToken) {
      window.localStorage.setItem(
        pendingBookingStorageKey,
        JSON.stringify(request),
      );
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
      if (!response.ok)
        throw new Error(payload.error || 'Could not book that appointment.');
      const confirmedRequest = bookingFromApiAppointment(payload.appointment);
      setBooking(confirmedRequest);
      setClientAppointments((current) => [
        confirmedRequest,
        ...current.filter(
          (appointment) => appointment.id !== confirmedRequest.id,
        ),
      ]);
      setBookingProfile(null);
      setProfessionalPickerOpen(false);
      setActiveClientNav('appointments');
      void loadClientNotifications();
    } catch (error) {
      setBookingError(
        error instanceof Error
          ? error.message
          : 'Could not book that appointment.',
      );
      setActiveClientNav(null);
    }
  }

  async function cancelAppointmentRequest(appointmentId: string) {
    if (!clientSession?.accessToken) {
      openClientAuth('appointments');
      return;
    }
    const response = await fetch('/api/client-appointments', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${clientSession.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'cancel', appointmentId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(payload.error || "We couldn't cancel this request.");
    const updated = bookingFromApiAppointment(payload.appointment);
    setClientAppointments((current) =>
      current.map((appointment) =>
        appointment.id === updated.id ? updated : appointment,
      ),
    );
    if (booking?.id === updated.id) setBooking(updated);
    void loadClientNotifications();
  }

  async function sendClientAppointmentMessage(
    appointment: BookingRequest,
    body: string,
  ) {
    if (!clientSession?.accessToken) {
      openClientAuth('appointments');
      return;
    }
    const response = await fetch('/api/client-messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clientSession.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appointmentId: appointment.id,
        body,
        professionalId: appointment.professionalId,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(payload.error || "We couldn't send that message.");
    void loadClientNotifications();
    void loadClientConversations();
  }

  function openClientAuth(
    intent: ClientAuthIntent = 'default',
    initialMode: 'signup' | 'signin' = 'signup',
  ) {
    setAuthIntent(intent);
    setAuthInitialMode(initialMode);
    setAuthModalOpen(true);
  }

  function handleClientNavChange(nav: ClientNavKey) {
    if ((nav === 'settings' || nav === 'hair-profile') && !clientSession) {
      openClientAuth('hair-profile');
      return;
    }
    setActiveClientNav(nav);
    if (nav === 'appointments') void loadClientAppointments();
    if (nav === 'messages') void loadClientConversations();
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

  function startBooking(profile: Professional) {
    const firstService = profile.services[0];
    setBookingProfile(profile);
    setSelectedService(firstService?.name || '');
    setSelectedTime(
      firstService
        ? bookingSlotsForService(profile, firstService)[0] || ''
        : '',
    );
    setBookingError('');
    setBookingServicesError('');
    setBookingServicesLoading(Boolean(clientSession?.accessToken));
    setBooking(null);
    setActiveClientNav(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void refreshBookingProfileServices(profile);
  }

  function confirmBooking(profileOverride?: Professional | null) {
    const profile = profileOverride || activeBookingProfile;
    if (!profile) return;
    if (!activeTime) {
      setBookingError('Choose an available appointment time.');
      return;
    }
    const selectedService =
      profile.services.find((service) => service.name === activeService) ||
      profile.services[0];
    if (!selectedService) {
      setBookingError(
        "This professional doesn't have online-bookable services yet.",
      );
      return;
    }
    const selectedDay = buildAvailabilityDays(
      bookingSlotsForService(profile, selectedService),
    ).find((day) => day.times.includes(activeTime));
    const request: BookingRequest = {
      professionalId: profile.id,
      professional: profile.name,
      service: selectedService.name,
      serviceId:
        selectedService.id || serviceIdFor(profile.id, selectedService.name),
      servicePriceCents:
        selectedService.priceCents ?? parseMoneyToCents(selectedService.price),
      date: selectedDay
        ? selectedDay.date.toLocaleDateString('en-CA', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })
        : 'Selected date',
      time: activeTime,
      eventId: `appt_${Date.now().toString(36)}`,
      status: 'pending',
      scheduledStart: activeTime,
      paymentRequirement:
        selectedService.paymentRequirement || 'pay_at_appointment',
    };

    if (!clientSession) {
      window.localStorage.setItem(
        pendingBookingStorageKey,
        JSON.stringify(request),
      );
      openClientAuth('booking');
      return;
    }

    void submitBookingRequest(request);
  }

  const showResults = hasSearched && Boolean(activeProfile);

  useEffect(() => {
    if (!showResults || !activeProfile || activeClientNav || bookingProfile)
      return;
    const profileKey = `${submittedQuery}|${activeProfile.id}`;
    if (lastOpenedProfileKey.current === profileKey) return;
    lastOpenedProfileKey.current = profileKey;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  }, [
    activeClientNav,
    activeProfile,
    bookingProfile,
    showResults,
    submittedQuery,
  ]);

  return (
    <main className="clientApp min-h-screen bg-[#080808] pb-24 text-white">
      {!showResults ? (
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#080808]/88 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <button
              className="flex items-center gap-2"
              type="button"
              onClick={() => setActiveClientNav(null)}
            >
              <img
                className="h-10 w-10 rounded-xl border border-[#f4c430]/55 object-cover"
                src="/frizi-icon.png"
                alt=""
              />
              <span className="text-lg font-black text-[#f4c430]">Frizi</span>
            </button>
            <div className="flex items-center gap-2">
              {clientSession ? (
                <>
                  <button
                    aria-expanded={notificationCenterOpen}
                    aria-label={
                      unreadClientNotificationCount
                        ? `${unreadClientNotificationCount} notifications`
                        : 'Open notifications'
                    }
                    className="relative grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white"
                    type="button"
                    onClick={() => {
                      setNotificationCenterOpen((open) => !open);
                      setProfileMenuOpen(false);
                    }}
                  >
                    <Bell size={18} />
                    {unreadClientNotificationCount ? (
                      <span className="friziGoldBadge absolute right-1.5 top-1.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4">
                        {formatUnreadBadgeCount(unreadClientNotificationCount)}
                      </span>
                    ) : null}
                  </button>
                  <div className="relative">
                    <button
                      aria-expanded={profileMenuOpen}
                      aria-label="Open client profile menu"
                      className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-[#f4c430]/50 bg-white/[0.06] text-sm font-black text-[#f4c430]"
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen((open) => !open);
                        setNotificationCenterOpen(false);
                      }}
                    >
                      {clientSession.name?.slice(0, 1).toUpperCase() || (
                        <User size={18} />
                      )}
                    </button>
                    {profileMenuOpen ? (
                      <div className="absolute right-0 top-13 z-[90] w-56 rounded-3xl border border-white/12 bg-[#151519] p-2 shadow-2xl shadow-black/40">
                        <button
                          className="w-full rounded-2xl px-4 py-3 text-left text-sm font-black text-white hover:bg-white/[0.06]"
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setActiveClientNav('hair-profile');
                          }}
                        >
                          My Hair Profile
                        </button>
                        <button
                          className="w-full rounded-2xl px-4 py-3 text-left text-sm font-black text-white hover:bg-white/[0.06]"
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            setActiveClientNav('settings');
                          }}
                        >
                          Settings
                        </button>
                        <button
                          className="w-full rounded-2xl px-4 py-3 text-left text-sm font-black text-white hover:bg-white/[0.06]"
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            signOutClient();
                          }}
                        >
                          Log out
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-black text-white"
                  type="button"
                  onClick={() => openClientAuth('hair-profile')}
                >
                  Sign in/up
                </button>
              )}
            </div>
          </div>
        </header>
      ) : null}
      {notificationCenterOpen ? (
        <ClientNotificationSheet
          onClose={() => setNotificationCenterOpen(false)}
          onOpenAppointments={() => {
            setNotificationCenterOpen(false);
            setActiveClientNav('appointments');
          }}
          notifications={clientNotifications}
          onOpenNotification={openClientNotification}
        />
      ) : null}

      {bookingProfile ? (
        <BookingCalendarPage
          availabilityDays={activeAvailabilityDays}
          booking={booking}
          bookingError={bookingError}
          clientSession={clientSession}
          onBack={() => setBookingProfile(null)}
          onBook={() => confirmBooking(bookingProfile)}
          profile={bookingProfile}
          selectedDay={activeSelectedDay}
          selectedService={activeService}
          selectedTime={activeTime}
          servicesError={bookingServicesError}
          servicesLoading={bookingServicesLoading}
          onRetryServices={() =>
            void refreshBookingProfileServices(bookingProfile)
          }
          setSelectedService={(value) => {
            setSelectedService(value);
            const nextService =
              bookingProfile.services.find(
                (service) => service.name === value,
              ) || bookingProfile.services[0];
            setSelectedTime(
              nextService
                ? bookingSlotsForService(bookingProfile, nextService)[0] || ''
                : '',
            );
          }}
          setSelectedTime={setSelectedTime}
        />
      ) : activeClientNav ? (
        <ClientNavScreen
          activeNav={activeClientNav}
          booking={booking}
          appointments={clientAppointments}
          conversations={clientConversations}
          connectedProfessionals={connectedProfessionals}
          clientSession={clientSession}
          isDemo={false}
          isListening={isListening}
          onBookProfessional={(profile) => startBooking(profile)}
          onCancelRequest={cancelAppointmentRequest}
          onCreateAccount={() => openClientAuth('default', 'signup')}
          onMic={startVoiceSearch}
          onMessageAppointment={sendClientAppointmentMessage}
          onOpenMessages={() => {
            setActiveClientNav('messages');
            void loadClientConversations();
          }}
          onOpenProfessional={(profile) => {
            setSubmittedQuery(profile.name);
            setQuery(profile.name);
            const index = allProfessionals.findIndex(
              (candidate) => candidate.id === profile.id,
            );
            if (index >= 0) setActiveIndex(index);
            setActiveClientNav(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onSearch={submitSearch}
          onSignIn={() => openClientAuth('default', 'signin')}
          onDeleteAccount={() => setDeleteAccountOpen(true)}
          onSignOut={signOutClient}
          notifications={clientNotifications}
          query={query}
          savedProfiles={allProfessionals.filter((profile) =>
            savedIds.includes(profile.id),
          )}
          setQuery={setQuery}
          voiceMessage={voiceMessage}
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
                  isSaved={profileIsSaved(activeProfile)}
                  onMic={startVoiceSearch}
                  onBook={() => setProfileBookingSignal((value) => value + 1)}
                  onMessage={() =>
                    clientSession
                      ? setActiveClientNav('messages')
                      : openClientAuth('messages', 'signup')
                  }
                  onNext={() => moveDeck('next')}
                  onSearch={submitSearch}
                  onPrevious={() => moveDeck('previous')}
                  onToggleSaved={() => void saveProfessional(activeProfile)}
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
                  bookingOpenSignal={profileBookingSignal}
                  onPromoSignupRequired={() => openClientAuth('promo')}
                  openBookingAfterAuth={openBookingAfterAuth}
                  profile={activeProfile}
                  selectedService={activeService}
                  selectedTime={activeTime}
                  onBookingAfterAuthHandled={() =>
                    setOpenBookingAfterAuth(false)
                  }
                  setSelectedService={setSelectedService}
                  setSelectedTime={setSelectedTime}
                />
              }
            />
          ) : null}
          {hasSearched && !activeProfile ? <NoLocalMatches /> : null}
        </>
      )}
      {authModalOpen ? (
        <ClientAuthModal
          initialMode={authInitialMode}
          intent={authIntent}
          onClose={() => setAuthModalOpen(false)}
          onComplete={handleClientAuth}
        />
      ) : null}
      {professionalPickerOpen ? (
        <ProfessionalPickerSheet
          onClose={() => setProfessionalPickerOpen(false)}
          onChoose={(profile) => startBooking(profile)}
          professionals={connectedProfessionals}
        />
      ) : null}
      {deleteAccountOpen ? (
        <ClientDeleteAccountModal
          onClose={() => setDeleteAccountOpen(false)}
          onDelete={deleteClientAccount}
        />
      ) : null}
      {locationPromptOpen ? (
        <LocationPrompt onClose={() => setLocationPromptOpen(false)} />
      ) : null}
      <DesktopMobilePrompt
        canonicalOrigin="https://frizi.ca"
        storageKey="frizi-client-mobile-prompt-dismissed"
      />
      <ClientFooter
        activeNav={activeClientNav}
        onChange={handleClientNavChange}
      />
    </main>
  );
}

function DesktopMobilePrompt({
  canonicalOrigin,
  storageKey,
}: {
  canonicalOrigin: string;
  storageKey: string;
}) {
  const [dismissed, setDismissed] = useState(
    () => window.localStorage.getItem(storageKey) === '1',
  );
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 900px)').matches,
  );

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
    QRCode.toDataURL(`${canonicalOrigin}${path}`, {
      margin: 2,
      width: 164,
      color: { dark: '#23201c', light: '#fffaf0' },
    })
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
      {qrDataUrl ? (
        <img src={qrDataUrl} alt="QR code for frizi.ca" />
      ) : (
        <div className="desktopQrFallback">
          <QrCode size={42} />
        </div>
      )}
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
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4c430]">
            {activePage.eyebrow}
          </p>
        </div>
        <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
          {activePage.title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-white/72">
          {activePage.summary}
        </p>
        <div className="mt-6 grid gap-3">
          {activePage.points.map((point) => (
            <div
              key={point}
              className="flex gap-3 rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <CheckCircle2
                className="mt-1 shrink-0 text-[#f4c430]"
                size={18}
              />
              <p className="leading-7 text-white/82">{point}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {activePage.cta ? (
            <a
              className="rounded-2xl bg-[#f4c430] px-5 py-4 text-center font-black text-black"
              href={activePage.cta.href}
            >
              {activePage.cta.label}
            </a>
          ) : null}
          <a
            className="rounded-2xl border border-white/15 px-5 py-4 text-center font-black text-white"
            href="/"
          >
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

function makeFriziTraceId() {
  const source = window.crypto?.getRandomValues
    ? window.crypto.getRandomValues(new Uint8Array(6))
    : null;
  const value = source
    ? Array.from(source, (byte) => byte.toString(36).padStart(2, '0'))
        .join('')
        .slice(0, 6)
    : Math.random().toString(36).slice(2, 8);
  return `FRZ-${value.toUpperCase()}`;
}

function maskEmail(email: string) {
  const [localPart = '', domain = ''] = email.trim().split('@');
  if (!domain) return email.trim();
  const visible = localPart.slice(0, 2);
  return `${visible || '*'}***@${domain}`;
}

function getAuthErrorStatus(error: unknown) {
  const authError = error as {
    status?: number;
    code?: string;
    name?: string;
    message?: string;
  } | null;
  return {
    status: typeof authError?.status === 'number' ? authError.status : null,
    code: String(authError?.code || authError?.name || ''),
    message: String(authError?.message || ''),
  };
}

async function recordClientAuthDiagnostic(payload: Record<string, unknown>) {
  const safePayload = {
    ...payload,
    route: window.location.pathname,
    timestamp: new Date().toISOString(),
  };
  console.info('[frizi-client-auth-diagnostic]', safePayload);
  try {
    await fetch('/api/client-auth-diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload),
      keepalive: true,
    });
  } catch {
    // Diagnostics are best-effort and must never block auth.
  }
}

function getClientDisplayName(user: SupabaseUser, fallback = 'Frizi client') {
  return String(
    user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      fallback,
  ).trim();
}

function clientSessionFromSupabaseSession(
  session: SupabaseSession,
): ClientSession {
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

function readFriziAccountIntent(user: SupabaseUser) {
  const metadata = user.user_metadata ?? {};
  const roleList = Array.isArray(metadata.frizi_roles) ? metadata.frizi_roles : [];
  const rawIntent = metadata.frizi_account_type ?? metadata.account_type ?? roleList[0];
  return typeof rawIntent === 'string' ? rawIntent : '';
}

async function ensureCanonicalClientProfile(
  user: SupabaseUser,
  fallbackName?: string,
) {
  if (!isSupabaseConfigured) return;
  const accountIntent = readFriziAccountIntent(user);
  if (accountIntent && accountIntent !== 'client') {
    throw new Error('This account belongs to another Frizi app. Sign in with a Frizi Client account to continue.');
  }

  const email = user.email || '';
  const displayName = getClientDisplayName(
    user,
    fallbackName || email || 'Frizi client',
  );
  const { firstName, lastName } = splitClientName(displayName);
  const supabase = createClient();
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('frizi_profiles')
    .select('id, account_type')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (existingProfileError) throw existingProfileError;
  if (existingProfile && existingProfile.account_type !== 'client') {
    throw new Error('This account belongs to another Frizi app. Sign in with a Frizi Client account to continue.');
  }

  const profileMutation = existingProfile
    ? supabase
        .from('frizi_profiles')
        .update({
          display_name: displayName,
          email,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id)
    : supabase.from('frizi_profiles').insert({
        auth_user_id: user.id,
        account_type: 'client',
        display_name: displayName,
        email,
        status: 'active',
        updated_at: new Date().toISOString(),
      });

  const { data: profile, error: profileError } = await profileMutation.select('id').single();

  if (profileError) throw profileError;

  const { data: existingClient, error: existingClientError } = await supabase
    .from('frizi_clients')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();
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
    ? await supabase
        .from('frizi_clients')
        .update(clientMutation)
        .eq('id', existingClient.id)
    : await supabase.from('frizi_clients').insert(clientMutation);
  if (clientError) throw clientError;
}

function getSafeClientOAuthReturnPath() {
  const { pathname } = window.location;
  if (/^\/invite\/[A-Za-z0-9_-]+\/?$/.test(pathname))
    return pathname.replace(/\/$/, '');
  return '/';
}

function professionalInvitePhrase(role: string) {
  const normalizedRole = role.toLowerCase();
  if (normalizedRole.includes('barber')) return 'barber';
  if (normalizedRole.includes('colour') || normalizedRole.includes('color'))
    return 'colourist';
  if (
    normalizedRole.includes('hairdresser') ||
    normalizedRole.includes('stylist')
  )
    return 'hairstylist';
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
  const [connectionState, setConnectionState] = useState<
    'idle' | 'success' | 'already' | 'error'
  >('idle');
  const autoAcceptAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      setLoading(true);
      setInviteError('');
      try {
        const response = await fetch(
          `/api/invite?token=${encodeURIComponent(token)}`,
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(payload.error || 'This invitation is not available.');
        if (!cancelled) {
          setInviteData(payload as LiveInvite);
          trackClientEvent('invite_opened', {
            invitation_token: token,
            professional_slug: (payload as LiveInvite).professional.id,
          });
        }
      } catch (error) {
        if (!cancelled)
          setInviteError(
            error instanceof Error
              ? error.message
              : 'This invitation is not available.',
          );
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
    if (
      !inviteData ||
      !clientSession?.accessToken ||
      pendingInvite?.token !== token ||
      autoAcceptAttempted.current
    )
      return;
    autoAcceptAttempted.current = true;
    void acceptInvite(clientSession);
  }, [clientSession, inviteData, token]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080808] px-4 py-6 text-white">
        <section className="mx-auto flex min-h-[82vh] max-w-lg flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <QrCode className="mx-auto text-[#f4c430]" size={42} />
          <h1 className="mt-5 text-3xl font-black">Opening invite...</h1>
          <p className="mt-3 text-white/70">
            Checking this Frizi invite securely.
          </p>
        </section>
      </main>
    );
  }

  if (!inviteData) {
    return (
      <main className="min-h-screen bg-[#080808] px-4 py-6 text-white">
        <section className="mx-auto flex min-h-[82vh] max-w-lg flex-col justify-center rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <QrCode className="mx-auto text-[#f4c430]" size={42} />
          <h1 className="mt-5 text-3xl font-black">
            This invitation is not available.
          </h1>
          <p className="mt-3 text-white/70">
            {inviteError ||
              'This invitation is no longer available. Ask your professional for a new Frizi invite.'}
          </p>
          <a
            className="mt-6 rounded-2xl bg-[#f4c430] px-5 py-4 text-center font-black text-black"
            href="/"
          >
            Open Frizi
          </a>
        </section>
      </main>
    );
  }

  const invitingProfessional = inviteData.professional;
  const professionalPhrase = professionalInvitePhrase(
    invitingProfessional.role,
  );

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
      if (!response.ok)
        throw new Error(
          payload.error ||
            'We could not connect this invite. Please try again.',
        );

      const alreadyConnected = Boolean(
        (payload as { alreadyConnected?: boolean }).alreadyConnected,
      );
      const nextState = alreadyConnected ? 'already' : 'success';
      setConnectionState(nextState);
      setConnectMessage(
        alreadyConnected
          ? `You're already connected to ${invitingProfessional.name}.`
          : `You're now connected to ${invitingProfessional.name}.`,
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
      setConnectMessage(
        error instanceof Error
          ? error.message
          : 'We could not connect this invite. Please try again.',
      );
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
          <h1 className="mt-5 text-center text-3xl font-black leading-tight">
            {invitingProfessional.name}
          </h1>
          <p className="mt-2 text-center text-sm font-bold text-[#f4c430]">
            {invitingProfessional.role} at {invitingProfessional.studio}
          </p>
          <p className="mx-auto mt-5 max-w-sm text-center text-lg font-bold leading-7 text-white/82">
            Your {professionalPhrase} wants to connect with you on Frizi.
          </p>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-white/62">
            Connect free so they can recognize your Frizi profile when you book,
            message, or share hair notes with them.
          </p>

          <button
            className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-5 text-base font-black text-black disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={
              connecting ||
              connectionState === 'success' ||
              connectionState === 'already'
            }
            onClick={startConnection}
          >
            <QrCode size={19} />
            {connecting
              ? 'Connecting...'
              : connectionState === 'success' || connectionState === 'already'
                ? 'Connected'
                : 'Connect free'}
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
            <p className="mt-3 text-center text-xs font-semibold text-white/52">
              Taking you to your Frizi home...
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function clientAuthContent(intent: ClientAuthIntent, mode: 'signup' | 'signin') {
  if (intent === 'save-pro') {
    return {
      eyebrow: 'Save this Pro',
      title: mode === 'signup' ? 'Create your free account' : 'Sign in to save this Pro',
      description:
        'Save this professional to My Pros so you can find them again later.',
    };
  }
  if (intent === 'booking' || intent === 'promo') {
    return {
      eyebrow: 'Book on Frizi',
      title: mode === 'signup' ? 'Create your free account' : 'Sign in to book',
      description:
        'Your booking context will stay saved while you sign in.',
    };
  }
  if (intent === 'messages') {
    return {
      eyebrow: 'Message on Frizi',
      title: mode === 'signup' ? 'Create your free account' : 'Sign in to message',
      description:
        'Message a professional through your Frizi account.',
    };
  }
  return {
    eyebrow: mode === 'signup' ? 'Free client account' : 'Welcome back',
    title: mode === 'signup' ? 'Create your Frizi account' : 'Sign in to Frizi',
    description: '',
  };
}

function ClientAuthModal({
  initialMode,
  intent,
  onClose,
  onComplete,
}: {
  initialMode: 'signup' | 'signin';
  intent: ClientAuthIntent;
  onClose: () => void;
  onComplete: (session: ClientSession, createdAccount?: boolean) => void;
}) {
  const [mode, setMode] = useState<'signup' | 'signin'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [authTraceId, setAuthTraceId] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visibleHeight, setVisibleHeight] = useState('100dvh');
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    function updateVisibleHeight() {
      const viewportHeight =
        window.visualViewport?.height || window.innerHeight;
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

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function keepFieldVisible(event: FocusEvent<HTMLInputElement>) {
    window.setTimeout(() => {
      event.currentTarget.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }, 90);
  }

  function switchMode(nextMode: 'signup' | 'signin') {
    setMode(nextMode);
    setError('');
    setNotice('');
    setVerificationEmail('');
    setAuthTraceId('');
  }

  function focusNextField(nextField: 'email' | 'password') {
    window.setTimeout(() => {
      const input =
        nextField === 'email'
          ? emailInputRef.current
          : passwordInputRef.current;
      input?.focus();
      input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 10);
  }

  function handleFieldKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    nextField?: 'email' | 'password',
  ) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (nextField) {
      focusNextField(nextField);
      return;
    }
    void submitAuth();
  }

  function setUnexpectedSignupError(
    traceId: string,
    message = "We couldn't create your account.",
  ) {
    setError(`${message} Error ID: ${traceId}`);
  }

  function inviteReturnPath() {
    return getSafeClientOAuthReturnPath();
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
          hasPendingBooking: Boolean(
            window.localStorage.getItem(pendingBookingStorageKey),
          ),
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
      setError(
        authError instanceof Error
          ? authError.message
          : 'Frizi could not start Google sign-in.',
      );
      setLoading(false);
    }
  }

  async function submitAuth() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    setError('');
    setNotice('');
    setVerificationEmail('');

    if (mode === 'signup' && !trimmedName) {
      setError('Add your name to continue.');
      nameInputRef.current?.focus();
      return;
    }

    if (!trimmedEmail.includes('@') || password.length < 6) {
      setError(
        'Enter a valid email and a password with at least 6 characters.',
      );
      (!trimmedEmail.includes('@')
        ? emailInputRef.current
        : passwordInputRef.current
      )?.focus();
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Frizi account signup is not configured yet.');
      return;
    }

    setLoading(true);
    const traceId = makeFriziTraceId();
    const startedAt = Date.now();
    setAuthTraceId(traceId);
    try {
      const supabase = createClient();
      const returnPath = inviteReturnPath();
      const redirectUrl = `${window.location.origin}${returnPath}`;
      if (intent === 'invite') writePendingInviteContext(inviteTokenFromPath());
      trackClientEvent('auth_started', {
        intent,
        method: mode,
        route: returnPath,
      });
      void recordClientAuthDiagnostic({
        event: 'signup_submit_started',
        traceId,
        intent,
        method: mode,
        stage: 'validation_passed',
        redirectUrl,
      });
      window.sessionStorage.setItem(
        clientOAuthContextStorageKey,
        JSON.stringify({
          intent,
          returnPath,
          hasPendingBooking: Boolean(
            window.localStorage.getItem(pendingBookingStorageKey),
          ),
          startedAt: new Date().toISOString(),
        }),
      );
      if (mode === 'signup') {
        void recordClientAuthDiagnostic({
          event: 'signup_supabase_call_started',
          traceId,
          intent,
          method: mode,
          stage: 'supabase_sign_up',
          redirectUrl,
        });
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: trimmedName,
              account_type: 'client',
              frizi_account_type: 'client',
              frizi_signup_origin: 'client',
              frizi_roles: ['client'],
            },
            emailRedirectTo: redirectUrl,
          },
        });

        const identitiesCount = Array.isArray(data.user?.identities)
          ? data.user.identities.length
          : null;
        const emailConfirmed = Boolean(data.user?.email_confirmed_at);
        const existingAccountLikely = Boolean(
          data.user &&
          identitiesCount === 0 &&
          !data.session &&
          !emailConfirmed,
        );
        void recordClientAuthDiagnostic({
          event: 'signup_supabase_call_returned',
          traceId,
          intent,
          method: mode,
          stage: 'supabase_returned',
          elapsedMs: Date.now() - startedAt,
          status: getAuthErrorStatus(error).status,
          errorCode: getAuthErrorStatus(error).code,
          message: getAuthErrorStatus(error).message,
          hasUser: Boolean(data.user),
          hasSession: Boolean(data.session),
          identitiesCount,
          emailConfirmed,
          existingAccountLikely,
          redirectUrl,
        });

        if (error) {
          const authError = getAuthErrorStatus(error);
          const lowerMessage = authError.message.toLowerCase();
          void recordClientAuthDiagnostic({
            event: 'signup_failed',
            traceId,
            intent,
            method: mode,
            stage: 'supabase_error',
            elapsedMs: Date.now() - startedAt,
            status: authError.status,
            errorCode: authError.code,
            message: authError.message,
            redirectUrl,
          });
          if (authError.status === 429 || lowerMessage.includes('rate limit')) {
            setUnexpectedSignupError(
              traceId,
              "We couldn't send the verification email right now. Please try again in a few minutes.",
            );
          } else if (
            lowerMessage.includes('email') &&
            (lowerMessage.includes('send') ||
              lowerMessage.includes('smtp') ||
              lowerMessage.includes('mailer'))
          ) {
            setUnexpectedSignupError(
              traceId,
              "We couldn't send the verification email right now. Please try again in a few minutes.",
            );
          } else if (
            authError.status === 400 ||
            lowerMessage.includes('password') ||
            lowerMessage.includes('invalid')
          ) {
            setError(
              authError.message ||
                'Please check the highlighted fields and try again.',
            );
          } else {
            setUnexpectedSignupError(traceId);
          }
          return;
        }

        if (existingAccountLikely) {
          setMode('signin');
          setNotice(
            'An account may already exist with this email. Sign in instead, or use Continue with Google if that is how you created it.',
          );
          setVerificationEmail('');
          window.setTimeout(() => passwordInputRef.current?.focus(), 50);
          return;
        }

        if (!data.session) {
          setVerificationEmail(trimmedEmail);
          setNotice(
            `We sent a verification link to ${maskEmail(trimmedEmail)}.`,
          );
          setResendCooldown(60);
          return;
        }

        void recordClientAuthDiagnostic({
          event: 'signup_user_created',
          traceId,
          intent,
          method: mode,
          stage: 'session_created',
          elapsedMs: Date.now() - startedAt,
          hasUser: true,
          hasSession: true,
          identitiesCount,
          emailConfirmed,
          redirectUrl,
        });
        onComplete(
          {
            name: trimmedName,
            email: trimmedEmail,
            accessToken: data.session.access_token,
          },
          true,
        );
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        const authError = getAuthErrorStatus(error);
        void recordClientAuthDiagnostic({
          event: 'signin_failed',
          traceId,
          intent,
          method: mode,
          stage: 'supabase_error',
          elapsedMs: Date.now() - startedAt,
          status: authError.status,
          errorCode: authError.code,
          message: authError.message,
        });
        throw error;
      }
      if (!data.session) {
        setNotice(
          'Sign in needs email verification first. Check your inbox, then try again.',
        );
        return;
      }

      onComplete(
        {
          name:
            data.user.user_metadata?.full_name ||
            trimmedEmail.split('@')[0] ||
            'Frizi client',
          email: trimmedEmail,
          accessToken: data.session.access_token,
        },
        false,
      );
    } catch (authError) {
      if (mode === 'signin') {
        setError(
          authError instanceof Error
            ? authError.message
            : 'Frizi could not sign you in.',
        );
      } else {
        setUnexpectedSignupError(authTraceId || traceId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function resendVerificationEmail() {
    const trimmedEmail = (verificationEmail || email).trim();
    if (!trimmedEmail || resending || resendCooldown > 0) return;

    setError('');
    setNotice('');
    setResending(true);
    const traceId = authTraceId || makeFriziTraceId();
    const startedAt = Date.now();
    setAuthTraceId(traceId);

    try {
      const returnPath = inviteReturnPath();
      const redirectUrl = `${window.location.origin}${returnPath}`;
      if (intent === 'invite') writePendingInviteContext(inviteTokenFromPath());
      void recordClientAuthDiagnostic({
        event: 'signup_resend_started',
        traceId,
        intent,
        method: 'resend',
        stage: 'resend_signup',
        redirectUrl,
      });
      const { error } = await createClient().auth.resend({
        type: 'signup',
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      const authError = getAuthErrorStatus(error);
      void recordClientAuthDiagnostic({
        event: error ? 'signup_resend_failed' : 'signup_resend_succeeded',
        traceId,
        intent,
        method: 'resend',
        stage: 'resend_returned',
        elapsedMs: Date.now() - startedAt,
        status: authError.status,
        errorCode: authError.code,
        message: authError.message,
        redirectUrl,
      });

      if (error) {
        if (
          authError.status === 429 ||
          authError.message.toLowerCase().includes('rate limit')
        ) {
          setError('Please wait a moment before requesting another email.');
        } else {
          setError("We couldn't send another verification email right now.");
        }
        return;
      }

      setNotice(
        `Verification email sent to ${maskEmail(trimmedEmail)}. Please check your inbox and spam folder.`,
      );
      setResendCooldown(60);
    } finally {
      setResending(false);
    }
  }

  const sheetStyle = {
    '--frizi-client-auth-visible-height': visibleHeight,
    maxHeight:
      'calc(var(--frizi-client-auth-visible-height) - max(0.75rem, env(safe-area-inset-top)) - max(0.75rem, env(safe-area-inset-bottom)))',
  } as CSSProperties;
  const content = clientAuthContent(intent, mode);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center overflow-hidden bg-black/72 px-3 backdrop-blur-sm sm:items-center sm:px-4"
      style={{
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
      }}
    >
      <section
        className="flex w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#151519] shadow-2xl shadow-black/60"
        style={sheetStyle}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
          <div>
            <p className="text-sm font-black text-[#f4c430]">
              {content.eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">
              {verificationEmail
                ? 'Check your email'
                : content.title}
            </h2>
            {!verificationEmail && content.description ? (
              <p className="mt-2 max-w-xs text-sm font-semibold leading-5 text-white/62">
                {content.description}
              </p>
            ) : null}
          </div>
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-white/70"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 [-webkit-overflow-scrolling:touch] sm:px-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAuth();
          }}
        >
          {verificationEmail ? (
            <div className="rounded-3xl border border-[#f4c430]/25 bg-[#f4c430]/10 p-4">
              <p className="text-sm font-bold leading-6 text-white/75">
                We sent a verification link to:
              </p>
              <p className="mt-2 text-lg font-black text-[#f4c430]">
                {maskEmail(verificationEmail)}
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-white/65">
                Click the link in your email, then return to Frizi. Your invite
                connection is saved.
              </p>
              <button
                className="mt-4 flex min-h-11 w-full items-center justify-center rounded-2xl border border-[#f4c430]/35 px-4 text-sm font-black text-[#f4c430] disabled:opacity-50"
                type="button"
                onClick={resendVerificationEmail}
                disabled={resending || resendCooldown > 0}
              >
                {resending
                  ? 'Sending...'
                  : resendCooldown > 0
                    ? `Resend available in ${resendCooldown}s`
                    : 'Resend email'}
              </button>
              <button
                className="mt-3 w-full text-center text-sm font-black text-white/70 underline decoration-white/25 underline-offset-4"
                type="button"
                onClick={() => {
                  setVerificationEmail('');
                  setNotice('');
                  setError('');
                }}
              >
                Change email address
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-black/30 p-1">
                <button
                  className="col-span-2 mb-2 flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-white px-4 font-black text-black disabled:opacity-60"
                  type="button"
                  onClick={continueWithGoogle}
                  disabled={loading}
                >
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full bg-black text-sm text-[#f4c430]"
                    aria-hidden="true"
                  >
                    G
                  </span>
                  Continue with Google
                </button>
                <div
                  className="col-span-2 mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs font-black lowercase text-white/50"
                  aria-hidden="true"
                >
                  <span className="h-px bg-white/10" />
                  <strong>or</strong>
                  <span className="h-px bg-white/10" />
                </div>
                {(['signup', 'signin'] as const).map((item) => (
                  <button
                    key={item}
                    className={`rounded-xl px-3 py-3 text-sm font-black ${mode === item ? 'bg-[#f4c430] text-black' : 'text-white/70'}`}
                    type="button"
                    onClick={() => switchMode(item)}
                  >
                    {item === 'signup' ? 'Create account' : 'Sign in'}
                  </button>
                ))}
              </div>

              {mode === 'signup' ? (
                <>
                  <label
                    className="mt-4 block text-sm font-black text-white"
                    htmlFor="client-auth-name"
                  >
                    Name
                  </label>
                  <input
                    id="client-auth-name"
                    ref={nameInputRef}
                    className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-3 font-semibold text-white outline-none placeholder:text-white/38"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onFocus={keepFieldVisible}
                    onKeyDown={(event) => handleFieldKeyDown(event, 'email')}
                    placeholder="Your name"
                    autoComplete="name"
                    enterKeyHint="next"
                  />
                </>
              ) : null}

              <label
                className="mt-4 block text-sm font-black text-white"
                htmlFor="client-auth-email"
              >
                Email
              </label>
              <input
                id="client-auth-email"
                ref={emailInputRef}
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-3 font-semibold text-white outline-none placeholder:text-white/38"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onFocus={keepFieldVisible}
                onKeyDown={(event) => handleFieldKeyDown(event, 'password')}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="next"
              />

              <label
                className="mt-4 block text-sm font-black text-white"
                htmlFor="client-auth-password"
              >
                {mode === 'signup' ? 'Create password' : 'Password'}
              </label>
              <input
                id="client-auth-password"
                ref={passwordInputRef}
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-3 font-semibold text-white outline-none placeholder:text-white/38"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onFocus={keepFieldVisible}
                onKeyDown={(event) => handleFieldKeyDown(event)}
                placeholder={mode === 'signup' ? 'Create password' : 'Password'}
                type="password"
                autoComplete={
                  mode === 'signup' ? 'new-password' : 'current-password'
                }
                enterKeyHint="done"
              />

              {error ? (
                <p className="mt-3 rounded-2xl bg-red-500/12 px-3 py-2 text-sm font-bold text-red-100">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="mt-3 rounded-2xl border border-[#f4c430]/35 bg-[#f4c430]/10 px-3 py-2 text-sm font-bold text-[#f4c430]">
                  {notice}
                </p>
              ) : null}

              <button
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-5 py-3 font-black text-black disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                <User size={18} />
                {loading
                  ? mode === 'signup'
                    ? 'Creating account...'
                    : 'Signing in...'
                  : mode === 'signup'
                    ? 'Create free account'
                    : 'Sign in'}
              </button>
              <p className="mt-3 text-center text-sm font-semibold leading-6 text-white/55">
                {mode === 'signup' ? 'Existing account?' : 'New to Frizi?'}{' '}
                <button
                  className="font-black text-[#f4c430]"
                  type="button"
                  onClick={() =>
                    switchMode(mode === 'signup' ? 'signin' : 'signup')
                  }
                >
                  {mode === 'signup' ? 'Sign in' : 'Create account'}
                </button>
              </p>
            </>
          )}
        </form>
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
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Account deletion could not be completed.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/78 px-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[32px] border border-red-300/25 bg-[#151519] p-5 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Trash2 className="text-red-100" size={30} />
            <h2 className="mt-4 text-3xl font-black">
              Delete your Frizi account?
            </h2>
            <p className="mt-3 text-sm font-bold leading-6 text-white/68">
              You will lose access to your account. Profile data will be removed
              or deactivated according to Frizi retention rules, and this cannot
              simply be undone.
            </p>
          </div>
          <button
            className="rounded-full border border-white/10 px-3 py-2 text-sm font-black text-white/70"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>
        <label className="mt-5 block">
          <span className="text-sm font-black text-white">
            Type DELETE to confirm
          </span>
          <input
            className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 font-semibold text-white outline-none"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        {error ? (
          <p className="mt-4 rounded-2xl border border-red-300/35 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
            {error}
          </p>
        ) : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            className="min-h-12 rounded-2xl border border-white/15 px-4 text-sm font-black text-white"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
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
      () =>
        setMessage('Location was not shared. You can still book without it.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60 * 60 * 1000 },
    );
  }

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-black/72 px-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-[32px] border border-white/12 bg-[#151519] p-5 shadow-2xl shadow-black/60">
        <MapPin className="text-[#f4c430]" size={30} />
        <h2 className="mt-4 text-3xl font-black">
          Share your location to find professionals near you
        </h2>
        <p className="mt-3 leading-7 text-white/68">
          Frizi can use your approximate location to improve local search. You
          can skip this and book normally.
        </p>
        <div className="mt-5 grid gap-3">
          <button
            className="min-h-14 rounded-2xl bg-[#f4c430] px-5 font-black text-black"
            type="button"
            onClick={shareLocation}
          >
            Share location
          </button>
          <button
            className="min-h-14 rounded-2xl border border-white/15 px-5 font-black text-white"
            type="button"
            onClick={finish}
          >
            Not now
          </button>
        </div>
        {message ? (
          <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm font-bold text-white/68">
            {message}
          </p>
        ) : null}
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
  const [suggestionLimit, setSuggestionLimit] = useState(5);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const matchingSuggestions = normalizedQuery
    ? searchSuggestionCategories.filter((suggestion) =>
        [suggestion.label, suggestion.query, ...suggestion.aliases].some(
          (term) => term.toLowerCase().includes(normalizedQuery),
        ),
      )
    : searchSuggestionCategories;
  const visibleSuggestions = matchingSuggestions.slice(0, suggestionLimit);
  const suggestionsId = `${id}-suggestions`;

  function updateSuggestionLimit() {
    const viewportHeight =
      window.visualViewport?.height || window.innerHeight || 720;
    setSuggestionLimit(viewportHeight < 520 ? 3 : viewportHeight < 620 ? 4 : 5);
  }

  function scrollSearchIntoView() {
    updateSuggestionLimit();
    window.setTimeout(() => {
      const element = containerRef.current;
      if (!element) return;
      const viewportOffset = window.visualViewport?.offsetTop || 0;
      const headerOffset = 92;
      const targetTop = viewportOffset + headerOffset;
      const rect = element.getBoundingClientRect();
      const delta = rect.top - targetTop;
      if (Math.abs(delta) > 12) {
        window.scrollBy({ top: delta, behavior: 'smooth' });
      }
    }, 80);
  }

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

  useEffect(() => {
    if (!suggestionsOpen) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    viewport.addEventListener('resize', updateSuggestionLimit);
    viewport.addEventListener('scroll', updateSuggestionLimit);
    return () => {
      viewport.removeEventListener('resize', updateSuggestionLimit);
      viewport.removeEventListener('scroll', updateSuggestionLimit);
    };
  }, [suggestionsOpen]);

  function chooseSuggestion(nextQuery: string) {
    setQuery(nextQuery);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    onSubmit(nextQuery);
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-[22px] border border-white/10 bg-white/8 px-3 ${compact ? 'py-2' : 'py-2'}`}
      >
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
          onFocus={() => {
            setSuggestionsOpen(true);
            scrollSearchIntoView();
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setSuggestionsOpen(true);
              setActiveSuggestionIndex((current) =>
                Math.min(current + 1, visibleSuggestions.length - 1),
              );
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveSuggestionIndex((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Escape') {
              setSuggestionsOpen(false);
              setActiveSuggestionIndex(-1);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const activeSuggestion =
                visibleSuggestions[activeSuggestionIndex];
              if (suggestionsOpen && activeSuggestion) {
                chooseSuggestion(activeSuggestion.query);
                return;
              }
              setSuggestionsOpen(false);
              onSubmit();
            }
          }}
          placeholder="I am looking for..."
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
          className="absolute left-0 right-0 top-[calc(100%+2px)] z-40 overflow-hidden rounded-xl border border-[#d9d9d9] bg-white text-[#151519] shadow-lg shadow-black/15"
          role="listbox"
        >
          {visibleSuggestions.length ? (
            visibleSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.label}
                aria-selected={activeSuggestionIndex === index}
                className={`flex min-h-11 w-full items-center px-4 text-left text-[15px] font-semibold text-[#151519] ${
                  activeSuggestionIndex === index
                    ? 'bg-[#f5f5f5]'
                    : 'bg-white hover:bg-[#f5f5f5]'
                } ${index > 0 ? 'border-t border-[#eeeeee]' : ''}`}
                role="option"
                type="button"
                onMouseEnter={() => setActiveSuggestionIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseSuggestion(suggestion.query)}
              >
                <span>{suggestion.label}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm font-semibold text-[#55565c]">
              Press Enter to search your exact phrase.
            </p>
          )}
        </div>
      ) : null}
      {isListening || voiceMessage ? (
        <p
          className={`mt-2 rounded-2xl bg-[#f4c430]/14 px-3 py-2 font-black text-[#f4c430] ${compact ? 'text-xs' : 'text-sm'}`}
        >
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

  function updateFilter<Key extends keyof FilterState>(
    key: Key,
    value: FilterState[Key],
  ) {
    setFilters({ ...filters, [key]: value });
  }

  return (
    <section className="friziClientHome pt-[72px]">
      <div className="friziClientHero">
        <img
          className="friziClientHeroImage"
          src="/frizi-client-hero-salon.png"
          alt=""
        />
        <div className="friziClientHeroCopy">
          <h1>Great Hair Starts With The Right Professional</h1>
          <p>Find a hair pro who gets your style and stay connected</p>
          <div className="friziClientHeroActions">
            <button
              className="friziClientPrimaryCta"
              type="button"
              onClick={() => document.getElementById('frizi-search')?.focus()}
            >
              Find a pro
            </button>
            <a className="friziClientSecondaryCta" href="/learn">
              Learn more
            </a>
          </div>
        </div>
      </div>
      <div className="friziClientSearchCard">
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
        <div className="mt-3 rounded-2xl border border-black/10 bg-white">
          <button
            className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-[#17130c]"
            type="button"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <span>
              <span className="block text-sm font-black">Filters</span>
              <span className="block text-xs font-semibold text-[#6f665d]">
                Within {filters.distanceKm} km of your current location
              </span>
            </span>
            <ChevronDown
              className={`text-[var(--frizi-gold)] transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
              size={20}
            />
          </button>
          {filtersOpen ? (
            <div className="grid gap-3 border-t border-black/10 p-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-black text-[#17130c]">
                Distance
                <select
                  className="h-12 rounded-2xl border border-black/10 bg-white px-3 font-semibold text-[#17130c] outline-none"
                  value={filters.distanceKm}
                  onChange={(event) =>
                    updateFilter('distanceKm', Number(event.target.value))
                  }
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
          <p className="mt-3 rounded-2xl bg-[#17130c]/8 px-3 py-2 text-sm font-bold text-[#6f665d]">
            {resultCount} local {resultCount === 1 ? 'match' : 'matches'} near
            your current location.
          </p>
        ) : null}
      </div>
      <WhyFriziSection />
    </section>
  );
}

const whyFriziCards = [
  {
    icon: UsersRound,
    title: 'Find a pro who fits your style',
    description:
      'Search local hair professionals by style, services, or your specific needs. Find the right fit and never lose them.',
  },
  {
    icon: CalendarDays,
    title: 'Book directly with your professional',
    description:
      'Make sure you get the pro you want. See their availability, choose a time, and book directly online.',
  },
  {
    icon: MessageCircle,
    title: 'Message your pro directly',
    description:
      'Move or cancel appointments, get product and hair advice, and receive exclusive offers-all directly from your pro.',
  },
  {
    icon: Scissors,
    title: 'Never explain your style again',
    description:
      "Build your hair profile together so your pro knows your hair, your preferences, and how you like it before you're in the chair.",
  },
] as const;

function WhyFriziSection() {
  return (
    <section className="friziWhySection" aria-labelledby="why-frizi-title">
      <h2 id="why-frizi-title">Why Frizi?</h2>
      <div className="friziWhyList">
        {whyFriziCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="friziWhyCard" key={card.title}>
              <div className="friziWhyIcon" aria-hidden="true">
                <Icon size={30} strokeWidth={2.4} />
              </div>
              <div className="friziWhyContent">
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </div>
            </article>
          );
        })}
      </div>
      <a className="friziWhyLearnMore" href="/learn">
        Learn more
      </a>
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
    <label className="grid gap-2 text-sm font-black text-[#17130c]">
      {label}
      <select
        className="h-12 rounded-2xl border border-black/10 bg-white px-3 font-semibold text-[#17130c] outline-none"
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

function ResultsExperience({
  deck,
  details,
}: {
  deck: ReactNode;
  details: ReactNode;
}) {
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
  onBook,
  onMessage,
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
  onBook: () => void;
  onMessage: () => void;
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
  const canMessage = profile.capabilities.canMessageClients;
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
    if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15)
      return;

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

        if (
          Math.abs(deltaX) > 14 &&
          Math.abs(deltaX) > Math.abs(deltaY) * 1.2
        ) {
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
        <div className="absolute inset-0 bg-gradient-to-b from-black/8 via-black/12 to-black/92" />
        <div className="absolute inset-x-0 bottom-0 h-[56%] bg-gradient-to-t from-black/96 via-black/72 to-transparent" />
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
            aria-label={
              isSaved
                ? `${profile.name} is saved`
                : `Save ${profile.name}`
            }
            className={`grid h-12 w-12 place-items-center rounded-full border backdrop-blur ${
              isSaved
                ? 'border-[#f4c430] bg-[#f4c430] text-black'
                : 'border-white/20 bg-black/35 text-white'
            }`}
            type="button"
            onClick={onToggleSaved}
          >
            <Star size={22} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:p-8 sm:pb-8">
          <div className="flex items-center gap-4">
            <img
              alt={`${profile.name} profile`}
              className="h-[110px] w-[110px] shrink-0 rounded-full border-4 border-white object-cover shadow-2xl shadow-black/45 sm:h-[128px] sm:w-[128px]"
              src={profile.detailImage}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-[clamp(2rem,8.4vw,2.35rem)] font-black leading-[0.95] drop-shadow-2xl sm:text-5xl">
                {profile.name}
              </h2>
              {profile.role ? (
                <p className="mt-2 text-base font-black leading-5 text-white/92 drop-shadow sm:text-xl">
                  {profile.role}
                </p>
              ) : null}
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold leading-5 text-white/86 drop-shadow">
                <MapPin className="text-[#f4c430]" size={16} />
                {profile.neighborhood || profile.distance}
              </p>
              {profile.reviews > 0 ? (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/45 px-3 py-1 text-sm font-black text-white backdrop-blur">
                  <Star className="text-[#f4c430]" size={15} fill="currentColor" />
                  {profile.rating} ({profile.reviews})
                </p>
              ) : null}
            </div>
          </div>
          <div className={`mt-6 grid ${canMessage ? 'grid-cols-[1.25fr_1fr_1fr]' : 'grid-cols-[1.25fr_1fr]'} gap-2`}>
            <button
              className="flex min-h-12 items-center justify-center rounded-xl bg-[#f4c430] px-2 text-[13px] font-black leading-tight text-black sm:text-sm"
              type="button"
              onClick={onBook}
            >
              Book appointment
            </button>
            <button
              className={`flex min-h-12 items-center justify-center gap-1 rounded-xl border px-2 text-sm font-black backdrop-blur ${
                isSaved
                  ? 'border-[#f4c430] bg-[#f4c430] text-black'
                  : 'border-white/35 bg-black/35 text-white'
              }`}
              type="button"
              onClick={onToggleSaved}
            >
              <Star size={16} fill={isSaved ? 'currentColor' : 'none'} />
              {isSaved ? 'Saved' : 'Save Pro'}
            </button>
            {canMessage ? (
              <button
                className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-white/35 bg-black/35 px-2 text-sm font-black text-white backdrop-blur"
                type="button"
                onClick={onMessage}
              >
                <MessageCircle size={16} />
                Message
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileDetails({
  booking,
  bookingError,
  bookingOpenSignal,
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
  bookingOpenSignal: number;
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
  const bookingSignalSeen = useRef(bookingOpenSignal);
  const selectedServiceRecord =
    profile.services.find((service) => service.name === selectedService) ||
    profile.services[0];
  const availabilityDays = useMemo(
    () =>
      buildAvailabilityDays(
        bookingSlotsForService(profile, selectedServiceRecord),
      ),
    [profile, selectedServiceRecord],
  );
  const selectedDay =
    availabilityDays.find((day) => day.times.includes(selectedTime)) ||
    availabilityDays[0];

  useEffect(() => {
    if (!openBookingAfterAuth || !isClientSignedIn) return;
    setBookingOpen(true);
    onBookingAfterAuthHandled();
  }, [isClientSignedIn, onBookingAfterAuthHandled, openBookingAfterAuth]);

  useEffect(() => {
    if (bookingOpenSignal === bookingSignalSeen.current) return;
    bookingSignalSeen.current = bookingOpenSignal;
    setBookingOpen(true);
    window.setTimeout(() => {
      document
        .getElementById('booking')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);
  }, [bookingOpenSignal]);

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
        servicesError=""
        servicesLoading={false}
        onRetryServices={() => undefined}
        setSelectedService={setSelectedService}
        setSelectedTime={setSelectedTime}
      />
    );
  }

  return (
    <section className="min-h-screen bg-[#080808] pb-28" id="booking">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        {profile.promotion ? (
          <div className="overflow-hidden rounded-[28px] border border-[#f4c430]/30 bg-[#f4c430]/10">
            <img
              alt=""
              className="h-40 w-full object-cover"
              src={profile.promotion.imageUrl || FRIZI_PROMO_FALLBACK_IMAGE}
            />
            <div className="p-4">
              <p className="inline-flex items-center rounded-full bg-[#f4c430] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-black">
                {promoOfferLabel(profile.promotion) || 'New client offer'}
              </p>
              <p className="mt-2 text-lg font-black text-white">
                {profile.promotion.headline}
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
                {profile.promotion.description}
              </p>
            {profile.promotion.endAt ? (
              <p className="mt-2 text-xs font-bold text-white/52">
                Ends {formatPromoDate(profile.promotion.endAt)}
              </p>
            ) : null}
            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 font-black text-black"
              type="button"
              onClick={applyPromotion}
            >
              <Send size={18} />
              Book with offer
            </button>
            </div>
          </div>
        ) : null}

        <button
          className="inline-flex items-center gap-2 px-1 py-2 text-sm font-black text-[#f4c430]"
          type="button"
          onClick={() => setShowReviews((current) => !current)}
        >
          {profile.reviews > 0
            ? `Reviews ${profile.rating} (${profile.reviews})`
            : 'Reviews'}
          <Star size={16} fill="currentColor" />
        </button>

        {showReviews ? (
          <Panel title="Reviews">
            {profile.clientReviews.length ? (
              <div className="space-y-3">
                {profile.clientReviews.map((review) => (
                  <article
                    key={review.name}
                    className="rounded-2xl bg-white/[0.05] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black">{review.name}</p>
                      <p className="flex items-center gap-1 text-sm font-black text-[#f4c430]">
                        <Star size={15} fill="currentColor" />
                        {review.rating}.0
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      {review.text}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="leading-7 text-white/64">No public reviews yet.</p>
            )}
          </Panel>
        ) : null}

        <Panel title="About">
          <p className="leading-7 text-white/70">
            {profile.bio || 'This professional has not added a bio yet.'}
          </p>
        </Panel>

        {profile.specialties.length ? (
          <Panel title="Specialties">
            <div className="flex flex-wrap gap-2">
              {profile.specialties.map((specialty) => (
                <span
                  className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-2 text-sm font-black text-white/82"
                  key={specialty}
                >
                  {specialty}
                </span>
              ))}
            </div>
          </Panel>
        ) : null}

        {profile.services.length ? (
          <Panel title="Services">
            <div className="space-y-3">
              {profile.services.map((service) => (
                <article
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.05] p-4"
                  key={service.id || service.name}
                >
                  <div>
                    <p className="font-black">{service.name}</p>
                    <p className="mt-1 text-sm font-semibold text-white/58">
                      {service.duration}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-[#f4c430]">
                    {service.price}
                  </p>
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
  bookingError,
  clientSession,
  onBack,
  onBook,
  profile,
  selectedDay,
  selectedService,
  selectedTime,
  servicesError,
  servicesLoading,
  onRetryServices,
  setSelectedService,
  setSelectedTime,
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
  servicesError: string;
  servicesLoading: boolean;
  onRetryServices: () => void;
  setSelectedService: (value: string) => void;
  setSelectedTime: (value: string) => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() =>
    startOfMonth(selectedDay?.date ?? new Date()),
  );
  const [timeSheetDay, setTimeSheetDay] = useState<
    ReturnType<typeof buildAvailabilityDays>[number] | null
  >(null);
  const [servicesOpen, setServicesOpen] = useState(true);
  const availableByDate = useMemo(
    () => new Map(availabilityDays.map((day) => [dateKey(day.date), day])),
    [availabilityDays],
  );
  const selectedServiceRecord =
    profile.services.find((service) => service.name === selectedService) ||
    profile.services[0];
  const selectedPaymentRequirement =
    selectedServiceRecord?.paymentRequirement || 'pay_at_appointment';
  const hasBookableServices = profile.services.length > 0;
  const paymentBlocksBooking =
    selectedPaymentRequirement === 'deposit_required' ||
    selectedPaymentRequirement === 'full_prepayment_required';
  const monthCells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);
  const monthLabel = monthCursor.toLocaleDateString('en-CA', {
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <section className="min-h-screen bg-[#080808] px-4 pb-28 pt-5 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <button
          className="mb-5 inline-flex items-center gap-2 py-2 text-sm font-black text-[#f4c430]"
          type="button"
          onClick={onBack}
        >
          <ChevronLeft size={18} />
          Back to profile
        </button>

        <div className="mb-5 flex items-center gap-4 rounded-[28px] border border-white/10 bg-[#151519] p-4">
          <img
            className="h-16 w-16 rounded-2xl object-cover"
            src={profile.detailImage}
            alt=""
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#f4c430]">
              {profile.studio}
            </p>
            <h2 className="text-2xl font-black">{profile.name}</h2>
            {profile.role ? (
              <p className="text-sm font-semibold text-white/58">
                {profile.role}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mb-5 space-y-3 rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <button
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-left"
            type="button"
            onClick={() => setServicesOpen((current) => !current)}
          >
            <span>
              <span className="block text-sm font-black text-white">
                Choose service
              </span>
              <span className="block text-sm font-semibold text-white/58">
                {selectedService ||
                  profile.services[0]?.name ||
                  'Select a service'}
              </span>
            </span>
            <ChevronDown
              className={`text-[#f4c430] transition-transform ${servicesOpen ? 'rotate-180' : ''}`}
              size={20}
            />
          </button>

          {servicesOpen ? (
            <div className="space-y-2">
              {servicesLoading ? (
                <ServiceStateCard message="Loading services..." />
              ) : servicesError ? (
                <ServiceStateCard
                  actionLabel="Try again"
                  message="We couldn't load services."
                  onAction={onRetryServices}
                />
              ) : hasBookableServices ? (
                profile.services.map((service) => (
                  <button
                    key={service.id || service.name}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left ${
                      selectedService === service.name
                        ? 'border-[#f4c430] bg-[#f4c430]/12 ring-1 ring-[#f4c430]/45'
                        : 'border-white/10 bg-white/[0.04]'
                    }`}
                    type="button"
                    onClick={() => {
                      setSelectedService(service.name);
                      setSelectedTime(
                        bookingSlotsForService(profile, service)[0] || '',
                      );
                      setServicesOpen(false);
                    }}
                  >
                    <span>
                      <span className="block font-black">{service.name}</span>
                      <span className="text-sm font-semibold text-white/52">
                        {service.duration}
                      </span>
                    </span>
                    {service.price ? (
                      <span className="text-lg font-black text-[#f4c430]">
                        {service.price}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <ServiceStateCard message="This professional doesn't have online-bookable services yet." />
              )}
            </div>
          ) : null}
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
              const availableDay = cell
                ? availableByDate.get(dateKey(cell))
                : undefined;
              const isSelected = availableDay?.label === selectedDay?.label;
              return (
                <button
                  key={cell ? dateKey(cell) : `blank-${index}`}
                  className={`aspect-square rounded-xl border text-center text-lg font-black sm:rounded-2xl sm:text-2xl ${
                    isSelected
                      ? 'border-[#f4c430] bg-[#f4c430]/12 text-white ring-2 ring-[#f4c430]/80'
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
                      {availableDay ? (
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#f4c430]" />
                      ) : null}
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
          <h2 className="text-2xl font-black">Review</h2>
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <ReceiptRow label="Professional" value={profile.name} />
            <ReceiptRow
              label="Service"
              value={
                selectedService ||
                profile.services[0]?.name ||
                'Select a service'
              }
            />
            <ReceiptRow
              label="Date"
              value={
                selectedDay
                  ? selectedDay.date.toLocaleDateString('en-CA', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Select a day'
              }
            />
            <ReceiptRow
              label="Time"
              value={
                selectedTime ? formatSlotTime(selectedTime) : 'Select a time'
              }
            />
            <ReceiptRow
              label="Duration"
              value={selectedServiceRecord?.duration || 'Set by professional'}
            />
            {selectedServiceRecord?.price ? (
              <ReceiptRow
                label="Price"
                value={selectedServiceRecord.price}
                strong
              />
            ) : null}
          </div>
          <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-black text-[#f4c430]">
            {selectedDay
              ? selectedDay.date.toLocaleDateString('en-CA', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select a day'}
            {selectedTime ? (
              <span className="ml-2 text-white">
                at {formatSlotTime(selectedTime)}
              </span>
            ) : null}
          </p>

          {selectedPaymentRequirement === 'frizi_payment_optional' ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/64">
              Payment through Frizi is optional for this service. You can book
              now and pay at the appointment.
            </p>
          ) : null}
          {paymentBlocksBooking ? (
            <p className="rounded-2xl border border-amber-300/35 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">
              This service requires online{' '}
              {selectedPaymentRequirement === 'deposit_required'
                ? 'deposit'
                : 'prepayment'}{' '}
              before booking. Frizi checkout is not live for this service yet.
            </p>
          ) : null}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 text-base font-black text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/38"
            type="button"
            onClick={onBook}
            disabled={
              paymentBlocksBooking ||
              !selectedTime ||
              servicesLoading ||
              !hasBookableServices
            }
          >
            <CalendarDays size={20} />
            {selectedPaymentRequirement === 'pay_at_appointment'
              ? 'Request appointment'
              : 'Book an appointment'}
          </button>
          {bookingError ? (
            <p className="rounded-2xl bg-red-500/12 px-4 py-3 text-sm font-bold text-red-100">
              {bookingError}
            </p>
          ) : null}
          {booking ? (
            <BookingConfirmation
              booking={booking}
              clientSession={clientSession}
            />
          ) : null}
        </div>
      </div>

      {timeSheetDay ? (
        <div
          className="fixed inset-0 z-[75] flex items-end bg-black/68 px-3 pb-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
          onClick={() => setTimeSheetDay(null)}
        >
          <section
            aria-modal="true"
            className="w-full rounded-[28px] border border-white/12 bg-[#151519] p-5 shadow-2xl shadow-black/60 sm:max-w-md"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-black text-[#f4c430]">Choose a time</p>
            <h2 className="mt-1 text-2xl font-black">
              {timeSheetDay.date.toLocaleDateString('en-CA', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {timeSheetDay.times.map((slot) => (
                <button
                  key={slot}
                  className={`rounded-2xl border px-3 py-4 text-sm font-black ${
                    selectedTime === slot
                      ? 'border-[#f4c430] bg-[#f4c430]/12 text-white ring-1 ring-[#f4c430]/70'
                      : 'border-white/10 bg-white/[0.04] text-white'
                  }`}
                  type="button"
                  onClick={() => setSelectedTime(slot)}
                >
                  {formatSlotTime(slot)}
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="min-h-12 rounded-2xl border border-white/15 px-4 font-black text-white"
                type="button"
                onClick={() => setTimeSheetDay(null)}
              >
                Cancel
              </button>
              <button
                className="min-h-12 rounded-2xl bg-[#f4c430] px-4 font-black text-black"
                type="button"
                onClick={() => {
                  setTimeSheetDay(null);
                }}
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ProfessionalPickerSheet({
  onChoose,
  onClose,
  professionals,
}: {
  onChoose: (profile: Professional) => void;
  onClose: () => void;
  professionals: Professional[];
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-black/68 px-3 pb-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onClick={onClose}
    >
      <section
        aria-modal="true"
        className="max-h-[82svh] w-full overflow-y-auto rounded-[28px] border border-white/12 bg-[#151519] p-5 text-white shadow-2xl shadow-black/60 sm:max-w-lg"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#f4c430]">
              Book an appointment
            </p>
            <h2 className="mt-1 text-2xl font-black">Choose a professional</h2>
          </div>
          <button
            className="grid h-11 w-11 place-items-center rounded-full border border-white/12 bg-white/[0.05]"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {professionals.map((profile) => (
            <button
              key={profile.id}
              className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
              type="button"
              onClick={() => onChoose(profile)}
            >
              <img
                className="h-16 w-16 rounded-2xl object-cover"
                src={profile.detailImage}
                alt=""
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-black">
                  {profile.name}
                </span>
                {profile.role ? (
                  <span className="block truncate text-sm font-semibold text-white/62">
                    {profile.role}
                  </span>
                ) : null}
                <span className="block truncate text-sm font-semibold text-white/48">
                  {profile.neighborhood}
                </span>
              </span>
              <ChevronRight className="shrink-0 text-[#f4c430]" size={22} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClientFooter({
  activeNav,
  onChange,
}: {
  activeNav: ClientNavKey | null;
  onChange: (nav: ClientNavKey) => void;
}) {
  const items: Array<{
    key: Extract<
      ClientNavKey,
      'appointments' | 'my-pros' | 'messages' | 'products'
    >;
    label: string;
    icon: typeof CalendarDays;
  }> = [
    { key: 'appointments', label: 'Appointments', icon: CalendarDays },
    { key: 'my-pros', label: 'My Pros', icon: UsersRound },
    { key: 'messages', label: 'Messages', icon: MessageCircle },
    { key: 'products', label: 'Products', icon: ShoppingBag },
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

function ClientNotificationSheet({
  notifications,
  onClose,
  onOpenAppointments,
  onOpenNotification,
}: {
  notifications: ClientNotification[];
  onClose: () => void;
  onOpenAppointments: () => void;
  onOpenNotification: (notification: ClientNotification) => void;
}) {
  const unreadCount = notifications.filter(
    (notification) => !notification.readAt,
  ).length;
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/45 px-4 pt-20"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="ml-auto w-full max-w-sm rounded-[28px] border border-white/10 bg-[#151519] p-4 text-white shadow-2xl shadow-black/45"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-notifications-title"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="client-notifications-title" className="text-xl font-black">
              Notifications
            </h2>
            <p className="mt-1 text-sm font-semibold text-white/55">
              Booking, message and promo alerts will appear here.
            </p>
          </div>
          <button
            className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-white"
            type="button"
            aria-label="Close notifications"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {notifications.length ? (
          <div className="mt-4 space-y-2">
            {notifications.map((notification) => (
              <button
                className={`w-full rounded-3xl border p-4 text-left ${
                  notification.readAt
                    ? 'border-white/10 bg-black/18 text-white/66'
                    : 'border-[#f4c430]/35 bg-[#f4c430]/10 text-white'
                }`}
                key={notification.id}
                type="button"
                onClick={() => void onOpenNotification(notification)}
              >
                <span className="flex items-start justify-between gap-3">
                  <strong>{notification.title}</strong>
                  {!notification.readAt ? (
                    <i className="mt-1 h-2.5 w-2.5 rounded-full bg-[#f4c430]" />
                  ) : null}
                </span>
                {notification.body ? (
                  <span className="mt-1 block text-sm font-semibold leading-6 text-white/66">
                    {notification.body}
                  </span>
                ) : null}
                <span className="mt-2 block text-xs font-black text-[#f4c430]">
                  {formatNotificationDate(notification.createdAt)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
            <Bell className="text-[#f4c430]" size={24} />
            <p className="mt-3 font-black">No recent notifications.</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/62">
              Frizi will only show real appointment updates, messages and
              eligible promo alerts here.
            </p>
            <button
              className="mt-4 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white"
              type="button"
              onClick={onOpenAppointments}
            >
              View appointments
            </button>
          </div>
        )}
        {unreadCount ? (
          <p className="mt-3 text-center text-xs font-semibold text-white/45">
            {unreadCount} unread
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ClientNavScreen({
  activeNav,
  appointments,
  booking,
  conversations,
  connectedProfessionals,
  clientSession,
  isListening,
  isDemo,
  onBookProfessional,
  onCancelRequest,
  onCreateAccount,
  onMic,
  onMessageAppointment,
  onOpenMessages,
  onDeleteAccount,
  onOpenProfessional,
  onSearch,
  onSignIn,
  onSignOut,
  notifications,
  query,
  savedProfiles,
  setQuery,
  voiceMessage,
}: {
  activeNav: ClientNavKey;
  appointments: BookingRequest[];
  booking: BookingRequest | null;
  conversations: ClientConversation[];
  connectedProfessionals: Professional[];
  clientSession: ClientSession | null;
  isListening: boolean;
  isDemo: boolean;
  onBookProfessional: (profile: Professional) => void;
  onCancelRequest: (appointmentId: string) => Promise<void>;
  onCreateAccount: () => void;
  onMic: () => void;
  onMessageAppointment: (
    appointment: BookingRequest,
    body: string,
  ) => Promise<void>;
  onOpenMessages: () => void;
  onDeleteAccount: () => void;
  onOpenProfessional: (profile: Professional) => void;
  onSearch: (nextQuery?: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  notifications: ClientNotification[];
  query: string;
  savedProfiles: Professional[];
  setQuery: (value: string) => void;
  voiceMessage: string;
}) {
  const titleMap: Record<ClientNavKey, string> = {
    appointments: 'Appointments',
    'my-pros': 'My Pros',
    messages: 'Messages',
    products: 'Products',
    'hair-profile': 'My Hair Profile',
    settings: 'Settings',
  };
  const subtitleMap: Partial<Record<ClientNavKey, string>> = {
    appointments: clientSession
      ? ''
      : 'Sign up for free to track your appointments and get reminders.',
    'my-pros': 'Saved and connected professionals stay here.',
    messages: 'Conversations and offers from your professionals.',
    products: 'Recommended products will live here when commerce launches.',
  };

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-4 pb-28 pt-24 sm:px-6 lg:px-8">
      <header className="mb-5">
        <h1 className="text-[clamp(2rem,9vw,2.8rem)] font-black leading-none">
          {titleMap[activeNav]}
        </h1>
        {subtitleMap[activeNav] ? (
          <p className="mt-2 max-w-xl text-base font-semibold leading-6 text-white/62">
            {subtitleMap[activeNav]}
          </p>
        ) : null}
      </header>
      {activeNav === 'appointments' ? (
        <AppointmentsPanel
          appointments={appointments}
          booking={booking}
          isListening={isListening}
          isDemo={isDemo}
          onMic={onMic}
          onCancelRequest={onCancelRequest}
          onMessageAppointment={onMessageAppointment}
          onSearch={onSearch}
          query={query}
          setQuery={setQuery}
          voiceMessage={voiceMessage}
        />
      ) : null}
      {activeNav === 'my-pros' ? (
        <MyProsPanel
          clientSession={clientSession}
          connectedProfiles={connectedProfessionals}
          isListening={isListening}
          savedProfiles={savedProfiles}
          notifications={notifications}
          onBookProfessional={onBookProfessional}
          onMic={onMic}
          onOpenMessages={onOpenMessages}
          onOpenProfessional={onOpenProfessional}
          onSearch={onSearch}
          query={query}
          setQuery={setQuery}
          voiceMessage={voiceMessage}
        />
      ) : null}
      {activeNav === 'messages' ? (
        <MessagesPanel
          clientSession={clientSession}
          conversations={conversations}
          connectedProfessionals={connectedProfessionals}
          onBookProfessional={onBookProfessional}
          onCreateAccount={onCreateAccount}
          onSignIn={onSignIn}
        />
      ) : null}
      {activeNav === 'products' ? <ProductsPanel isDemo={isDemo} /> : null}
      {activeNav === 'hair-profile' ? (
        <ClientPassportPanel clientSession={clientSession} isDemo={isDemo} />
      ) : null}
      {activeNav === 'settings' ? (
        <ClientSettingsPanel
          clientSession={clientSession}
          onDeleteAccount={onDeleteAccount}
          onSignOut={onSignOut}
        />
      ) : null}
      {clientSession ? <ClientPushPermissionPrompt /> : null}
    </section>
  );
}

function ClientPushPermissionPrompt() {
  const storageKey = 'frizi-client-push-prompt-dismissed';
  const [dismissed, setDismissed] = useState(
    () => window.localStorage.getItem(storageKey) === '1',
  );
  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus | null>(
    null,
  );
  const [message, setMessage] = useState('');
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!pushSupported()) return;
    void getPushSubscriptionStatus()
      .then((status) => {
        if (!cancelled) setPushStatus(status);
      })
      .catch(() => {
        if (!cancelled)
          setPushStatus({
            browserSubscribed: false,
            enabled: false,
            permission: notificationPermission(),
            savedSubscriptionCount: 0,
            supported: pushSupported(),
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (
    dismissed ||
    !pushSupported() ||
    notificationPermission() === 'denied' ||
    pushStatus?.enabled
  )
    return null;

  async function enable() {
    setEnabling(true);
    setMessage('');
    try {
      const status = await enablePushNotifications();
      setPushStatus(status);
      window.localStorage.setItem(storageKey, '1');
      setDismissed(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Notifications could not be enabled.',
      );
    } finally {
      setEnabling(false);
    }
  }

  function dismiss() {
    window.localStorage.setItem(storageKey, '1');
    setDismissed(true);
  }

  return (
    <article className="mt-4 box-border grid w-full max-w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-[22px] border border-[#f4c430]/25 bg-white/[0.055] p-3 text-white shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
      <Bell className="mt-0.5 text-[#f4c430]" size={18} />
      <div className="min-w-0">
        <strong className="block text-base font-black">Stay updated</strong>
        <span className="mt-1 block text-sm font-semibold leading-5 text-white/62">
          Get notifications for appointment updates and messages from your Pros.
        </span>
        {message ? (
          <em className="mt-1 block text-xs font-bold text-[#f4c430]">
            {message}
          </em>
        ) : null}
      </div>
      <div className="col-span-2 grid gap-2 sm:col-start-2 sm:col-end-3 sm:grid-cols-2">
        {/* prettier-ignore */}
        <button className="friziGoldButton min-h-11 rounded-2xl px-4 py-3 text-sm font-black" type="button" disabled={enabling} onClick={() => void enable()}>
          {enabling ? 'Enabling...' : 'Enable notifications'}
        </button>
        <button
          className="min-h-11 rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm font-black text-white"
          type="button"
          disabled={enabling}
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
    </article>
  );
}

function AppointmentsPanel({
  appointments,
  booking,
  isListening,
  onMic,
  onCancelRequest,
  onMessageAppointment,
  onSearch,
  query,
  setQuery,
  voiceMessage,
}: {
  appointments: BookingRequest[];
  booking: BookingRequest | null;
  isDemo: boolean;
  isListening: boolean;
  onMic: () => void;
  onCancelRequest: (appointmentId: string) => Promise<void>;
  onMessageAppointment: (
    appointment: BookingRequest,
    body: string,
  ) => Promise<void>;
  onSearch: (nextQuery?: string) => void;
  query: string;
  setQuery: (value: string) => void;
  voiceMessage: string;
}) {
  const [detailAppointment, setDetailAppointment] =
    useState<BookingRequest | null>(null);
  const [messageAppointment, setMessageAppointment] =
    useState<BookingRequest | null>(null);
  const visibleAppointments = appointments.length
    ? appointments
    : booking
      ? [booking]
      : [];
  const upcomingAppointments = visibleAppointments.filter(
    (appointment) =>
      !isAppointmentPast(appointment) && appointment.status === 'confirmed',
  );
  const pendingAppointments = visibleAppointments.filter(
    (appointment) =>
      !isAppointmentPast(appointment) &&
      (appointment.status === 'pending' || appointment.status === 'requested'),
  );
  const pastAppointments = visibleAppointments.filter(
    (appointment) =>
      isAppointmentPast(appointment) ||
      ['declined', 'cancelled', 'completed', 'expired'].includes(
        appointment.status,
      ),
  );

  return (
    <div className="mt-5 space-y-4">
      <SearchInputWithSuggestions
        compact
        id="frizi-appointments-search"
        isListening={isListening}
        onMic={onMic}
        onSubmit={onSearch}
        query={query}
        setQuery={setQuery}
        voiceMessage={voiceMessage}
      />

      <section className="rounded-[24px] border border-white/10 bg-[#151519] p-4">
        <h2 className="text-xl font-black">Upcoming</h2>
        {upcomingAppointments.length ? (
          <div className="mt-3 space-y-3">
            {upcomingAppointments.map((appointment) => (
              <AppointmentEventCard
                key={appointment.eventId}
                booking={appointment}
                onDetails={() => setDetailAppointment(appointment)}
                onMessage={() => setMessageAppointment(appointment)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-white/58">
            No upcoming appointments.
          </p>
        )}
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[#151519] p-4">
        <h2 className="text-xl font-black">Pending</h2>
        {pendingAppointments.length ? (
          <div className="mt-3 space-y-3">
            {pendingAppointments.map((appointment) => (
              <AppointmentEventCard
                key={appointment.eventId}
                booking={appointment}
                onDetails={() => setDetailAppointment(appointment)}
                onMessage={() => setMessageAppointment(appointment)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-white/58">
            No pending requests.
          </p>
        )}
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[#151519] p-4">
        <h2 className="text-xl font-black">History</h2>
        {pastAppointments.length ? (
          <div className="mt-3 space-y-3">
            {pastAppointments.map((appointment) => (
              <AppointmentEventCard
                key={appointment.eventId}
                booking={appointment}
                onDetails={() => setDetailAppointment(appointment)}
                onMessage={() => setMessageAppointment(appointment)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-white/58">
            No appointment history yet.
          </p>
        )}
      </section>

      {detailAppointment ? (
        <AppointmentDetailSheet
          booking={detailAppointment}
          onClose={() => setDetailAppointment(null)}
          onCancelRequest={onCancelRequest}
          onCancelled={(updated) => {
            setDetailAppointment(updated);
          }}
          onMessage={() => setMessageAppointment(detailAppointment)}
        />
      ) : null}
      {messageAppointment ? (
        <ClientAppointmentMessageSheet
          booking={messageAppointment}
          onClose={() => setMessageAppointment(null)}
          onSend={onMessageAppointment}
        />
      ) : null}
    </div>
  );
}

function AppointmentEventCard({
  booking,
  onDetails,
  onMessage,
}: {
  booking: BookingRequest;
  onDetails: () => void;
  onMessage: () => void;
}) {
  const status = appointmentStatusLabel(booking.status);
  const isPending = booking.status === 'pending';
  const isConfirmed = booking.status === 'confirmed';
  const isCancelled =
    booking.status === 'cancelled' || booking.status === 'declined';

  return (
    <article
      className={`rounded-2xl border bg-white/[0.04] p-4 ${
        isPending
          ? 'border-l-4 border-l-[#f4c430]'
          : isConfirmed
            ? 'border-l-4 border-l-emerald-400/80'
            : isCancelled
              ? 'border-white/10 opacity-72'
              : 'border-white/10'
      }`}
    >
      <button className="w-full text-left" type="button" onClick={onDetails}>
        <p className="text-sm font-black text-white/62">
          {formatAppointmentDayShort(booking)}
        </p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black">{booking.service}</h3>
            <p className="mt-1 truncate text-sm font-semibold text-white/58">
              {booking.professional}
              {booking.scheduledEnd ? (
                <> · {appointmentDurationLabel(booking)}</>
              ) : null}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${
              isPending
                ? 'border-[#f4c430]/35 bg-[#f4c430]/10 text-[#f4c430]'
                : isConfirmed
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.05] text-white/58'
            }`}
          >
            {status.short}
          </span>
        </div>
      </button>
      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-white/62">
        <Clock3 className="text-[#f4c430]" size={16} />
        {status.detail}
      </p>
      <div className="mt-4 flex gap-3">
        <button
          className="text-sm font-black text-[#f4c430]"
          type="button"
          onClick={onDetails}
        >
          View details
        </button>
        <button
          className="text-sm font-black text-white/72"
          type="button"
          onClick={onMessage}
        >
          Message
        </button>
      </div>
    </article>
  );
}

function AppointmentDetailSheet({
  booking,
  onClose,
  onCancelRequest,
  onCancelled,
  onMessage,
}: {
  booking: BookingRequest;
  onClose: () => void;
  onCancelRequest: (appointmentId: string) => Promise<void>;
  onCancelled: (booking: BookingRequest) => void;
  onMessage: () => void;
}) {
  const status = appointmentStatusLabel(booking.status);
  const [busy, setBusy] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [error, setError] = useState('');
  const canCancel =
    booking.status === 'pending' ||
    booking.status === 'requested' ||
    booking.status === 'confirmed';
  const cancelLabel =
    booking.status === 'confirmed' ? 'Cancel appointment' : 'Cancel request';

  async function cancelRequest() {
    if (!booking.id) return;
    setBusy(true);
    setError('');
    try {
      await onCancelRequest(booking.id);
      onCancelled({ ...booking, status: 'cancelled' });
      setConfirmCancelOpen(false);
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "We couldn't cancel this appointment.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end bg-black/58 px-3 pb-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onClick={onClose}
    >
      <section
        aria-modal="true"
        className="w-full rounded-[28px] border border-white/12 bg-[#151519] p-5 shadow-2xl shadow-black/60 sm:max-w-md"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#f4c430]">
              Appointment details
            </p>
            <h2 className="mt-1 text-2xl font-black">{booking.service}</h2>
          </div>
          <button
            aria-label="Close appointment details"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/[0.05]"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
          <ReceiptRow label="Professional" value={booking.professional} />
          <ReceiptRow label="Date" value={formatAppointmentDateLong(booking)} />
          <ReceiptRow
            label="Time"
            value={booking.time ? formatSlotTime(booking.time) : 'Set time'}
          />
          <ReceiptRow
            label="Duration"
            value={appointmentDurationLabel(booking)}
          />
          <ReceiptRow label="Status" value={status.detail} strong />
        </div>

        <div className="mt-4 grid gap-2">
          <button
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 font-black text-black"
            type="button"
            onClick={onMessage}
          >
            <MessageCircle size={18} />
            Message
          </button>
          {canCancel ? (
            <button
              className="min-h-12 rounded-2xl border border-white/15 px-4 font-black text-white"
              type="button"
              disabled={busy}
              onClick={() => setConfirmCancelOpen(true)}
            >
              {busy ? 'Cancelling...' : cancelLabel}
            </button>
          ) : null}
          {booking.status === 'cancelled' || booking.status === 'completed' ? (
            <button
              className="min-h-12 rounded-2xl border border-white/15 px-4 font-black text-white"
              type="button"
            >
              Book again later
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="mt-3 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
            {error}
          </p>
        ) : null}
        {confirmCancelOpen ? (
          <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 p-4">
            <h3 className="text-lg font-black">Cancel this appointment?</h3>
            <p className="mt-1 text-sm font-semibold text-white/70">
              The appointment will move to cancelled and your professional will
              be notified.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                className="min-h-11 rounded-2xl border border-white/15 px-4 font-black text-white"
                type="button"
                disabled={busy}
                onClick={() => setConfirmCancelOpen(false)}
              >
                Keep appointment
              </button>
              <button
                className="min-h-11 rounded-2xl bg-red-200 px-4 font-black text-red-950"
                type="button"
                disabled={busy}
                onClick={() => void cancelRequest()}
              >
                {busy ? 'Cancelling...' : 'Cancel appointment'}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ClientAppointmentMessageSheet({
  booking,
  onClose,
  onSend,
}: {
  booking: BookingRequest;
  onClose: () => void;
  onSend: (appointment: BookingRequest, body: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError('');
    try {
      await onSend(booking, body);
      setSent(true);
      setBody('');
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "We couldn't send that message.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end bg-black/58 px-3 pb-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onClick={onClose}
    >
      <section
        aria-modal="true"
        className="w-full rounded-[28px] border border-white/12 bg-[#151519] p-5 shadow-2xl shadow-black/60 sm:max-w-md"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#f4c430]">Message</p>
            <h2 className="mt-1 text-2xl font-black">{booking.professional}</h2>
            <p className="mt-1 text-sm font-semibold text-white/58">
              {booking.service} · {formatAppointmentDateLong(booking)}
            </p>
          </div>
          <button
            aria-label="Close message composer"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/[0.05]"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <label className="mt-4 block">
          <span className="text-sm font-black text-white/62">Message</span>
          <textarea
            className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-base font-semibold text-white outline-none placeholder:text-white/35"
            maxLength={1000}
            placeholder="Can I come 10 minutes early?"
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setSent(false);
            }}
          />
        </label>
        {sent ? (
          <p className="mt-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
            Message sent.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-100">
            {error}
          </p>
        ) : null}
        <button
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 font-black text-black disabled:opacity-55"
          type="button"
          disabled={busy || body.trim().length < 1}
          onClick={() => void send()}
        >
          <MessageCircle size={18} />
          {busy ? 'Sending...' : 'Send message'}
        </button>
      </section>
    </div>
  );
}

function MyProsPanel({
  clientSession,
  connectedProfiles,
  isListening,
  notifications,
  onBookProfessional,
  onMic,
  onOpenMessages,
  onOpenProfessional,
  onSearch,
  query,
  savedProfiles,
  setQuery,
  voiceMessage,
}: {
  clientSession: ClientSession | null;
  connectedProfiles: Professional[];
  isListening: boolean;
  notifications: ClientNotification[];
  onBookProfessional: (profile: Professional) => void;
  onMic: () => void;
  onOpenMessages: () => void;
  onOpenProfessional: (profile: Professional) => void;
  onSearch: (nextQuery?: string) => void;
  query: string;
  savedProfiles: Professional[];
  setQuery: (value: string) => void;
  voiceMessage: string;
}) {
  const connectedIds = new Set(connectedProfiles.map((profile) => profile.id));
  const unreadByProfessional = new Map<string, number>();
  const promoByProfessional = new Set<string>();
  notifications.forEach((notification) => {
    if (!notification.professionalId || notification.readAt) return;
    unreadByProfessional.set(
      notification.professionalId,
      (unreadByProfessional.get(notification.professionalId) || 0) + 1,
    );
    if (/promo/i.test(notification.type))
      promoByProfessional.add(notification.professionalId);
  });
  const profiles = [
    ...connectedProfiles,
    ...savedProfiles.filter((profile) => !connectedIds.has(profile.id)),
  ].sort(
    (a, b) =>
      (unreadByProfessional.get(b.id) || 0) -
      (unreadByProfessional.get(a.id) || 0),
  );

  return (
    <div className="mt-5 grid gap-3">
      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">
          {clientSession ? 'Search your Pros' : 'Find a Pro'}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-white/62">
          {clientSession
            ? 'Search your saved Pros or find another local professional.'
            : "Search for Pros now. Create a free account when you're ready to save your favourites."}
        </p>
        <div className="mt-4">
          <SearchInputWithSuggestions
            compact
            id="frizi-my-pros-search"
            isListening={isListening}
            onMic={onMic}
            onSubmit={onSearch}
            query={query}
            setQuery={setQuery}
            voiceMessage={voiceMessage}
          />
        </div>
      </div>
      {profiles.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <UsersRound className="text-[#f4c430]" size={30} />
          <h2 className="mt-4 text-2xl font-black">
            {clientSession
              ? 'No Pros yet'
              : "You don't have any saved Pros yet."}
          </h2>
          <p className="mt-2 leading-7 text-white/68">
            {clientSession
              ? 'Connect with a professional through their QR code, or tap the star on a profile hero to keep them here.'
              : 'Search local professionals and sign in when you want to save or connect with one.'}
          </p>
        </div>
      ) : (
        profiles.map((profile) => {
          const connected = connectedIds.has(profile.id);
          const unreadCount = unreadByProfessional.get(profile.id) || 0;
          const hasPromo = promoByProfessional.has(profile.id);
          return (
            <article
              key={profile.id}
              className="rounded-[24px] border border-white/10 bg-[#151519] p-3"
            >
              <button
                className="flex w-full items-center gap-4 text-left"
                type="button"
                onClick={() => onOpenProfessional(profile)}
              >
                <img
                  className="h-20 w-20 rounded-2xl object-cover"
                  src={profile.heroImage}
                  alt=""
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-black">
                    {profile.name}
                  </span>
                  <span className="block text-sm font-semibold text-white/60">
                    {[profile.role, profile.neighborhood].filter(Boolean).join(' · ')}
                  </span>
                  <span className="mt-1 block text-sm font-black text-[#f4c430]">
                    {connected ? 'Connected' : 'Saved'}
                  </span>
                </span>
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {unreadCount ? (
                  <span className="rounded-full border border-[#f4c430]/35 bg-[#f4c430] px-3 py-1 text-xs font-black text-black">
                    {unreadCount} new
                  </span>
                ) : null}
                {hasPromo ? (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-black text-white">
                    Deal
                  </span>
                ) : null}
                <button
                  className="min-h-10 rounded-2xl border border-white/15 px-4 text-sm font-black text-white"
                  type="button"
                  onClick={() => onOpenProfessional(profile)}
                >
                  View profile
                </button>
                {connected ? (
                  <>
                    <button
                      className="min-h-10 rounded-2xl bg-[#f4c430] px-4 text-sm font-black text-black"
                      type="button"
                      onClick={() => onBookProfessional(profile)}
                    >
                      Book
                    </button>
                    <button
                      className="min-h-10 rounded-2xl border border-white/15 px-4 text-sm font-black text-white"
                      type="button"
                      onClick={onOpenMessages}
                    >
                      Message
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

function MessagesPanel({
  clientSession,
  conversations,
  connectedProfessionals,
  onBookProfessional,
  onCreateAccount,
  onSignIn,
}: {
  clientSession: ClientSession | null;
  conversations: ClientConversation[];
  connectedProfessionals: Professional[];
  onBookProfessional: (profile: Professional) => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
}) {
  const [openConversation, setOpenConversation] =
    useState<ClientConversation | null>(null);

  if (!clientSession) {
    return (
      <div className="mt-5 rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <MessageCircle className="text-[#f4c430]" size={32} />
        <h2 className="mt-4 text-2xl font-black">Messages</h2>
        <p className="mt-2 leading-7 text-white/68">
          Sign in to see your conversations with your Pros.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            className="min-h-12 rounded-2xl bg-[#f4c430] px-5 font-black text-black"
            type="button"
            onClick={onSignIn}
          >
            Sign in
          </button>
          <button
            className="min-h-12 rounded-2xl border border-white/15 px-5 font-black text-white"
            type="button"
            onClick={onCreateAccount}
          >
            Create free account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {conversations.length ? (
        conversations.map((conversation) => (
          <button
            className="flex w-full items-center gap-4 rounded-[24px] border border-white/10 bg-[#151519] p-4 text-left"
            key={conversation.id}
            type="button"
            onClick={() => setOpenConversation(conversation)}
          >
            {conversation.avatarUrl ? (
              <img
                className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                src={conversation.avatarUrl}
                alt=""
              />
            ) : (
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#f4c430] text-lg font-black text-black">
                {conversation.avatarFallback}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-3">
                <strong className="block truncate text-xl">
                  {conversation.professionalName}
                </strong>
                {conversation.latestMessageAt ? (
                  <span className="shrink-0 text-xs font-black text-white/42">
                    {formatNotificationDate(conversation.latestMessageAt)}
                  </span>
                ) : null}
              </span>
              {conversation.studioName ? (
                <span className="mt-0.5 block truncate text-xs font-black text-[#f4c430]">
                  {conversation.studioName}
                </span>
              ) : null}
              <span className="mt-1 block truncate text-sm font-semibold text-white/62">
                {conversation.latestMessage}
              </span>
            </span>
            {conversation.unreadCount > 0 ? (
              <span
                aria-label={`${conversation.unreadCount} unread messages`}
                className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-[#f4c430] px-2 text-xs font-black text-black"
              >
                {conversation.unreadCount > 99
                  ? '99+'
                  : conversation.unreadCount}
              </span>
            ) : null}
          </button>
        ))
      ) : (
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <MessageCircle className="text-[#f4c430]" size={32} />
          <h2 className="mt-4 text-2xl font-black">No messages yet.</h2>
          <p className="mt-2 leading-7 text-white/68">
            When you message a Pro or they message you, the conversation will
            appear here.
          </p>
        </div>
      )}
      {openConversation ? (
        <ConversationPreviewSheet
          conversation={openConversation}
          onBookProfessional={(professionalId) => {
            const profile = connectedProfessionals.find(
              (candidate) => normalizeClientProfessionalId(candidate.id) === normalizeClientProfessionalId(professionalId),
            );
            if (profile) {
              setOpenConversation(null);
              onBookProfessional(profile);
            }
          }}
          onClose={() => setOpenConversation(null)}
        />
      ) : null}
    </div>
  );
}

function ConversationPreviewSheet({
  conversation,
  onBookProfessional,
  onClose,
}: {
  conversation: ClientConversation;
  onBookProfessional: (professionalId: string) => void;
  onClose: () => void;
}) {
  const messages = conversation.messages.length
    ? [...conversation.messages].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    : [
        {
          id: 'latest',
          body: conversation.latestMessage,
          createdAt: conversation.latestMessageAt,
          isFromProfessional: true,
          messageType: 'text',
          promotion: null,
        },
      ];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end bg-black/58 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      onClick={onClose}
    >
      <section
        aria-modal="true"
        className="flex h-[min(92svh,760px)] w-full flex-col overflow-hidden rounded-t-[28px] border border-black/10 bg-white text-[#17130c] shadow-2xl shadow-black/45 sm:max-w-md sm:rounded-[28px]"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {conversation.avatarUrl ? (
              <img
                className="h-12 w-12 shrink-0 rounded-full border-2 border-[#ffc107] object-cover"
                src={conversation.avatarUrl}
                alt=""
              />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[#ffc107] bg-[#17130c] font-black text-white">
                {conversation.avatarFallback}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black">
                {conversation.professionalName}
              </h2>
              <p className="truncate text-sm font-semibold text-[#6f665d]">
                Professional
              </p>
            </div>
          </div>
          <button
            aria-label="Close conversation"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/10 bg-white"
            type="button"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-5 text-center text-sm font-semibold text-[#8a8278]">
            {conversation.latestMessageAt
              ? formatConversationDay(conversation.latestMessageAt)
              : 'Messages'}
          </p>
          <div className="grid gap-4">
            {messages.map((message) => (
              <div key={message.id} className="grid gap-3">
                {message.body ? (
                  <p
                    className={`max-w-[82%] rounded-[22px] px-4 py-3 text-base leading-6 shadow-sm ${
                      message.isFromProfessional
                        ? 'justify-self-start bg-[#f1f1f1] text-[#17130c]'
                        : 'justify-self-end bg-[#17130c] text-white'
                    }`}
                  >
                    {message.body}
                  </p>
                ) : null}
                {message.promotion ? (
                  <ClientPromoMessageCard
                    conversation={conversation}
                    promotion={message.promotion}
                    onBook={() => onBookProfessional(conversation.professionalId)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-black/10 bg-white px-4 py-3">
          <div className="flex min-h-12 items-center gap-3 rounded-full border border-black/12 bg-white px-3">
            <Camera size={22} />
            <span className="min-w-0 flex-1 truncate text-[#9a938b]">
              Message {conversation.professionalName}...
            </span>
            <Send className="text-[#9a938b]" size={20} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ClientPromoMessageCard({
  conversation,
  onBook,
  promotion,
}: {
  conversation: ClientConversation;
  onBook: () => void;
  promotion: ClientPromoMessage;
}) {
  const imageUrl = promotion.imageUrl || FRIZI_PROMO_FALLBACK_IMAGE;
  const expired =
    promotion.expired ||
    Boolean(promotion.endAt && new Date(promotion.endAt).getTime() < Date.now());
  return (
    <article className="overflow-hidden rounded-[26px] border border-black/10 bg-[#f7f2e8] shadow-xl shadow-black/10">
      <div className="clientPromoCreative relative min-h-[480px] overflow-hidden bg-[#080808] text-white">
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          src={imageUrl}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/8 via-black/20 to-black/94" />
        <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-[#ffc107]/86 px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-black">
          <Sparkles size={17} />
          Special offer
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h3 className="max-w-[310px] text-[clamp(2.4rem,12vw,4rem)] font-black leading-[0.98] text-white">
            <PromoHeadlineText promotion={promotion} />
          </h3>
          <div className="mt-5 h-px w-56 bg-[#ffc107]" />
          {promotion.description ? (
            <p className="mt-5 max-w-[330px] text-lg font-medium leading-7 text-white/90">
              {promotion.description}
            </p>
          ) : null}
          <button
            className="mt-7 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#ffc107] px-4 text-lg font-black text-black disabled:cursor-not-allowed disabled:bg-white/28 disabled:text-white/70"
            type="button"
            disabled={expired}
            onClick={onBook}
          >
            <CalendarDays size={22} />
            {expired ? 'Offer expired' : 'Book now'}
          </button>
        </div>
      </div>
      {promotion.endAt ? (
        <div className="flex items-center gap-4 bg-[#fffaf0] px-5 py-5 text-[#17130c]">
          <CalendarDays className="shrink-0 text-[#c69200]" size={34} />
          <div>
            <p className="text-base font-semibold text-[#80766d]">
              {expired ? 'Offer expired' : 'Offer expires'}
            </p>
            <p className="mt-1 text-xl font-black">
              {formatPromoExpiryDate(promotion.endAt)}
            </p>
            <p className="text-base font-semibold text-[#6f665d]">
              {formatPromoExpiryTime(promotion.endAt)}
            </p>
          </div>
        </div>
      ) : null}
      <p className="px-5 py-4 text-center text-sm font-semibold text-[#8a8278]">
        Tap the button above to book your appointment
        {conversation.professionalName ? ` with ${conversation.professionalName}` : ''}.
      </p>
    </article>
  );
}

function PromoHeadlineText({ promotion }: { promotion: ClientPromoMessage }) {
  const headline = promotion.headline || promoOfferLabel(promotion);
  const label = promoOfferLabel(promotion);
  if (label && headline.toLowerCase().startsWith(label.toLowerCase())) {
    return (
      <>
        <span className="text-[#ffc107]">{headline.slice(0, label.length)}</span>
        {headline.slice(label.length)}
      </>
    );
  }
  return <>{headline}</>;
}

function ClientSettingsPanel({
  clientSession,
  onDeleteAccount,
  onSignOut,
}: {
  clientSession: ClientSession | null;
  onDeleteAccount: () => void;
  onSignOut: () => void;
}) {
  const [appointmentNotifications, setAppointmentNotifications] =
    useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [promotionalNotifications, setPromotionalNotifications] =
    useState(false);
  const [promotionalNotificationState, setPromotionalNotificationState] =
    useState<'unknown' | 'opted_in' | 'opted_out'>('unknown');
  const [pushStatus, setPushStatus] = useState<PushSubscriptionStatus | null>(
    null,
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [radius, setRadius] = useState('15');
  const [clientId, setClientId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      if (!clientSession || !isSupabaseConfigured) return;
      try {
        const supabase = createClient();
        const { data: userResult, error: userError } =
          await supabase.auth.getUser();
        if (userError || !userResult.user) return;
        const { data: profile } = await supabase
          .from('frizi_profiles')
          .select('id')
          .eq('auth_user_id', userResult.user.id)
          .maybeSingle();
        if (!profile?.id) return;
        const { data: client, error } = await supabase
          .from('frizi_clients')
          .select('id, notification_preferences, search_preferences')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (error) throw error;
        if (!client || cancelled) return;
        const notifications = (client.notification_preferences || {}) as Record<
          string,
          unknown
        >;
        const search = (client.search_preferences || {}) as Record<
          string,
          unknown
        >;
        setClientId(String(client.id));
        setAppointmentNotifications(
          notifications.appointment_notifications_enabled !== false,
        );
        setMessageNotifications(
          notifications.message_notifications_enabled !== false,
        );
        const promoState =
          notifications.promotional_notifications_state === 'opted_in' ||
          notifications.promotional_notifications_state === 'opted_out'
            ? notifications.promotional_notifications_state
            : 'unknown';
        setPromotionalNotificationState(promoState);
        setPromotionalNotifications(
          promoState === 'opted_in'
            ? true
            : promoState === 'opted_out'
              ? false
              : notifications.promotional_notifications_enabled === true,
        );
        setRadius(String(search.search_radius_km || '15'));
        const status = await getPushSubscriptionStatus();
        if (!cancelled) setPushStatus(status);
      } catch (error) {
        if (!cancelled)
          setMessage(
            error instanceof Error ? error.message : 'Could not load settings.',
          );
      }
    }

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [clientSession]);

  async function savePreference(
    next: Partial<{
      appointmentNotifications: boolean;
      messageNotifications: boolean;
      promotionalNotifications: boolean;
      radius: string;
    }>,
  ) {
    if (!clientId || !isSupabaseConfigured) return;
    const nextAppointment =
      next.appointmentNotifications ?? appointmentNotifications;
    const nextMessages = next.messageNotifications ?? messageNotifications;
    const nextPromos =
      next.promotionalNotifications ?? promotionalNotifications;
    const promoPreferenceChanged = Object.prototype.hasOwnProperty.call(
      next,
      'promotionalNotifications',
    );
    const nextPromoState = promoPreferenceChanged
      ? nextPromos
        ? 'opted_in'
        : 'opted_out'
      : promotionalNotificationState;
    const nextRadius = next.radius ?? radius;
    const notificationPreferences: Record<string, unknown> = {
      appointment_notifications_enabled: nextAppointment,
      message_notifications_enabled: nextMessages,
      promotional_notifications_enabled: nextPromos,
    };
    if (nextPromoState !== 'unknown') {
      notificationPreferences.promotional_notifications_state = nextPromoState;
    }
    setMessage('');
    const supabase = createClient();
    const { error } = await supabase
      .from('frizi_clients')
      .update({
        notification_preferences: notificationPreferences,
        search_preferences: {
          search_radius_km: Number(nextRadius) || 15,
          location_mode: 'approximate',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', clientId);
    if (error) {
      setMessage(error.message);
      return;
    }
    setPromotionalNotificationState(nextPromoState);
    setMessage('Settings saved.');
  }

  async function enablePushFromSettings() {
    setPushBusy(true);
    setMessage('');
    try {
      const status = await enablePushNotifications();
      setPushStatus(status);
      setMessage(
        status.enabled
          ? 'Push notifications are enabled on this device.'
          : 'Push notifications are not fully enabled yet.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Notifications could not be enabled.',
      );
    } finally {
      setPushBusy(false);
    }
  }

  const pushSupportedLabel = pushStatus?.supported ?? pushSupported();
  const pushPermission = pushStatus?.permission ?? notificationPermission();
  const pushEnabled = Boolean(pushStatus?.enabled);

  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">Notifications</h2>
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="block text-base font-black">
                  Push notifications
                </strong>
                <span className="mt-1 block text-sm font-semibold text-white/58">
                  {pushEnabled
                    ? 'Enabled on this device'
                    : pushPermission === 'denied'
                      ? 'Blocked in this browser'
                      : pushSupportedLabel
                        ? 'Not enabled on this device'
                        : 'Not available in this browser'}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                  pushEnabled
                    ? 'bg-emerald-400 text-black'
                    : 'bg-[#f4c430] text-black'
                }`}
              >
                {pushEnabled ? 'Enabled' : 'Not enabled'}
              </span>
            </div>
            {!pushEnabled &&
            pushSupportedLabel &&
            pushPermission !== 'denied' ? (
              /* prettier-ignore */
              <button className="friziGoldButton mt-3 min-h-11 w-full rounded-2xl px-4 text-sm font-black" type="button" disabled={pushBusy} onClick={() => void enablePushFromSettings()}>
                {pushBusy ? 'Enabling...' : 'Enable push notifications'}
              </button>
            ) : null}
          </div>
          <PreferenceToggle
            checked={appointmentNotifications}
            label="Appointment notifications"
            onChange={(checked) => {
              setAppointmentNotifications(checked);
              void savePreference({ appointmentNotifications: checked });
            }}
          />
          <PreferenceToggle
            checked={messageNotifications}
            label="Messages"
            onChange={(checked) => {
              setMessageNotifications(checked);
              void savePreference({ messageNotifications: checked });
            }}
          />
          <PreferenceToggle
            checked={promotionalNotifications}
            label="Promotions and offers"
            onChange={(checked) => {
              setPromotionalNotifications(checked);
              void savePreference({ promotionalNotifications: checked });
            }}
          />
        </div>
        <p className="mt-3 text-xs font-semibold leading-5 text-white/45">
          Promotional opt-out is stored separately from booking and direct
          message notifications.
        </p>
      </section>
      <section className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">Location & Search Preferences</h2>
        <label className="mt-4 block">
          <span className="text-sm font-black text-white/62">
            Search radius
          </span>
          <select
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-bold text-white"
            value={radius}
            onChange={(event) => {
              setRadius(event.target.value);
              void savePreference({ radius: event.target.value });
            }}
          >
            <option value="5">5 km</option>
            <option value="15">15 km</option>
            <option value="30">30 km</option>
            <option value="50">50 km</option>
          </select>
        </label>
        <p className="mt-3 text-sm leading-6 text-white/58">
          Frizi can use approximate location for local search. Exact location is
          not required for discovery.
        </p>
      </section>
      <section className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">Account</h2>
        <button
          className="mt-4 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white"
          type="button"
          onClick={onSignOut}
          disabled={!clientSession}
        >
          Log out
        </button>
        <button
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/35 px-4 py-3 text-sm font-black text-red-100"
          type="button"
          onClick={onDeleteAccount}
          disabled={!clientSession}
        >
          <Trash2 size={16} />
          Delete account
        </button>
      </section>
      {message ? (
        <p className="rounded-2xl border border-[#f4c430]/35 bg-[#f4c430]/10 px-4 py-3 text-sm font-bold text-[#f4c430]">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function PreferenceToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4">
      <span className="font-black">{label}</span>
      <input
        className="h-5 w-5 accent-[#f4c430]"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function ProductsPanel({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) {
    return (
      <div className="mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-[#151519]">
        <div className="relative p-6">
          <div className="absolute right-5 top-5 rounded-full bg-[#f4c430] px-3 py-2 text-xs font-black text-black">
            Coming Soon
          </div>
          <ShoppingBag className="text-[#f4c430]" size={32} />
          <h2 className="mt-4 max-w-sm text-3xl font-black">
            Product recommendations
          </h2>
          <p className="mt-3 max-w-xl leading-7 text-white/68">
            Soon, your stylist will be able to recommend products directly
            through Frizi. Product purchasing is not active yet.
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
              <article
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 opacity-80"
              >
                <p className="font-black">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {item.copy}
                </p>
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
        const response = await fetch(
          `/api/commerce-catalog?customerId=${encodeURIComponent(customerId)}`,
        );
        const payload = await response.json();
        if (!cancelled) {
          setCatalogue(payload.catalogue || []);
        }
      } catch (error) {
        if (!cancelled) {
          setCommerceError(
            error instanceof Error
              ? error.message
              : 'Could not load product catalogue.',
          );
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
          setCommerceError(
            error instanceof Error
              ? error.message
              : 'Could not calculate cart.',
          );
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
      const existing = current.find(
        (cartItem) => cartItem.variantId === item.variant.id,
      );
      if (existing) {
        return current.map((cartItem) =>
          cartItem.variantId === item.variant.id
            ? { ...cartItem, quantity: Math.min(cartItem.quantity + 1, 12) }
            : cartItem,
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
    setCommerceError(
      'Product checkout is disabled. Product purchasing is coming soon.',
    );
  }

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-3">
        <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
          <ShoppingBag className="text-[#f4c430]" size={28} />
          <h2 className="mt-3 text-2xl font-black">Recommended for you</h2>
          <p className="mt-2 leading-7 text-white/68">
            Products are sold by Frizi, not sent to an outside affiliate
            checkout. Only Canadian-sale-approved variants can be added to cart.
          </p>
        </div>

        {catalogue.map((item) => (
          <article
            key={item.variant.id}
            className="overflow-hidden rounded-[28px] border border-white/10 bg-[#151519]"
          >
            <div className="grid gap-4 p-4 sm:grid-cols-[128px,1fr]">
              <img
                className="aspect-square w-full rounded-3xl object-cover"
                src={item.product.primaryImage}
                alt=""
              />
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#f4c430]">
                      {item.product.brandName}
                    </p>
                    <h3 className="mt-1 text-xl font-black">
                      {item.product.productName}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-white/58">
                      {item.variant.variantName}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-black text-[#f4c430]">
                    {formatCurrency(item.variant.priceCents)}
                  </p>
                </div>

                {item.recommendation ? (
                  <div className="mt-3 rounded-2xl border border-[#f4c430]/30 bg-[#f4c430]/10 p-3">
                    <p className="text-sm font-black text-[#f4c430]">
                      Recommended by your professional
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/72">
                      {item.recommendation.reason}
                    </p>
                    <p className="mt-1 text-xs font-bold text-white/48">
                      {item.recommendation.frequency}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-white/62">
                    {item.product.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/12 px-3 py-1 text-xs font-bold text-white/64">
                    {item.product.complianceState}
                  </span>
                  <span className="rounded-full border border-white/12 px-3 py-1 text-xs font-bold text-white/64">
                    {item.variant.inventoryMode}
                  </span>
                  {item.product.productCategories
                    .slice(0, 2)
                    .map((category) => (
                      <span
                        key={category}
                        className="rounded-full border border-white/12 px-3 py-1 text-xs font-bold text-white/64"
                      >
                        {category.replace(/_/g, ' ')}
                      </span>
                    ))}
                </div>

                {!item.purchasable ? (
                  <p className="mt-3 rounded-2xl bg-red-500/12 p-3 text-sm font-bold text-red-100">
                    {item.blockedReason}
                  </p>
                ) : null}

                <button
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 font-black ${
                    item.purchasable
                      ? 'bg-[#f4c430] text-black'
                      : 'bg-white/10 text-white/42'
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
            <p className="mt-3 leading-7 text-white/64">
              Add an approved recommended product to preview shipping, tax,
              commission attribution, and Stripe checkout.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {summary?.items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex gap-3 rounded-2xl bg-white/[0.05] p-3"
                >
                  <img
                    className="h-16 w-16 rounded-2xl object-cover"
                    src={item.primaryImage}
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{item.productName}</p>
                    <p className="text-sm font-semibold text-white/55">
                      Qty {item.quantity} - {formatCurrency(item.lineNetCents)}
                    </p>
                    {item.professionalName ? (
                      <p className="text-xs font-bold text-[#f4c430]">
                        Commission tracked for {item.professionalName}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <label>
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/42">
                Province
              </span>
              <select
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-bold text-white"
                value={province}
                onChange={(event) => setProvince(event.target.value)}
              >
                {[
                  'ON',
                  'BC',
                  'AB',
                  'QC',
                  'NS',
                  'NB',
                  'MB',
                  'SK',
                  'PE',
                  'NL',
                  'NT',
                  'YT',
                  'NU',
                ].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/42">
                Postal code
              </span>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-3 font-bold text-white outline-none"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
              />
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <label
              className="text-xs font-black uppercase tracking-[0.14em] text-white/42"
              htmlFor="product-promo-code"
            >
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
              <button
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-black"
                type="button"
                onClick={() =>
                  setAppliedPromoCode(promoCodeDraft.trim().toUpperCase())
                }
              >
                Apply
              </button>
            </div>
            {summary?.promotion ? (
              <button
                className="mt-3 text-sm font-black text-[#f4c430]"
                type="button"
                onClick={() => {
                  setAppliedPromoCode('');
                  setPromoCodeDraft('');
                }}
              >
                {summary.promotion.name} applied. Remove
              </button>
            ) : null}
          </div>

          {summary ? (
            <div className="mt-4 rounded-2xl bg-black/28 p-4">
              <ReceiptRow
                label="Merchandise"
                value={formatCurrency(summary.merchandiseSubtotalCents)}
              />
              {summary.productDiscountCents > 0 ? (
                <ReceiptRow
                  label="Product discount"
                  value={`-${formatCurrency(summary.productDiscountCents)}`}
                  highlight
                />
              ) : null}
              <ReceiptRow
                label="Shipping"
                value={formatCurrency(summary.shipping.shippingCents)}
              />
              {summary.shipping.shippingDiscountCents > 0 ? (
                <ReceiptRow
                  label="Shipping promo"
                  value={`-${formatCurrency(summary.shipping.shippingDiscountCents)}`}
                  highlight
                />
              ) : null}
              <ReceiptRow
                label="Tax"
                value={formatCurrency(summary.taxCents)}
              />
              <ReceiptRow
                label="Total"
                value={formatCurrency(summary.totalCents)}
                strong
              />
              <p className="mt-3 text-xs font-bold text-white/48">
                {summary.shipping.service}.{' '}
                {summary.shipping.estimatedTransitDays}. Quote expires{' '}
                {new Date(summary.quoteExpiresAt).toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                .
              </p>
            </div>
          ) : null}

          {commerceError ? (
            <p className="mt-3 rounded-2xl bg-red-500/12 px-3 py-2 text-sm font-bold text-red-100">
              {commerceError}
            </p>
          ) : null}

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
            Product checkout is separated from appointment payment. Unapproved
            products are blocked, returns and recalls remain operational
            workflows, and legal/tax/product-safety review is still required
            before live launch.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ClientPassportPanel({
  clientSession,
  isDemo,
}: {
  clientSession: ClientSession | null;
  isDemo: boolean;
}) {
  return isDemo ? (
    <LegacyPreviewClientPassportPanel />
  ) : (
    <ProductionClientPassportPanel clientSession={clientSession} />
  );
}

function ProductionClientPassportPanel({
  clientSession,
}: {
  clientSession: ClientSession | null;
}) {
  const [clientId, setClientId] = useState('');
  const [currentHairPhoto, setCurrentHairPhoto] = useState<ClientPhoto | null>(
    null,
  );
  const [inspirationPhotos, setInspirationPhotos] = useState<ClientPhoto[]>([]);
  const [hairPhotos, setHairPhotos] = useState<ClientPhoto[]>([]);
  const [passport, setPassport] = useState<ClientPassport | null>(null);
  const [mediaMessage, setMediaMessage] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [passportBusy, setPassportBusy] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  const [hairProfile, setHairProfile] = useState<ClientHairProfile>(
    emptyClientHairProfile,
  );
  const [hairProfileBusy, setHairProfileBusy] = useState(false);
  const [hairProfileMessage, setHairProfileMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadClientMedia() {
      if (!clientSession?.accessToken || !isSupabaseConfigured) return;
      setMediaMessage('');
      try {
        const supabase = createClient();
        const { data: userResult, error: userError } =
          await supabase.auth.getUser();
        if (userError || !userResult.user) return;
        const ensuredClientId = await ensureClientRecord(
          userResult.user.id,
          clientSession.name,
          clientSession.email,
        );
        if (cancelled) return;
        setClientId(ensuredClientId);
        const photos = await loadSignedClientPhotos(ensuredClientId);
        const { data: clientRow, error: clientProfileError } = await supabase
          .from('frizi_clients')
          .select('hair_profile')
          .eq('id', ensuredClientId)
          .maybeSingle();
        if (clientProfileError) throw clientProfileError;
        const nextPassport = await loadClientPassport();
        if (cancelled) return;
        setHairProfile(normalizeClientHairProfile(clientRow?.hair_profile));
        setCurrentHairPhoto(
          photos.find((photo) => photo.photoType === 'hair_history') || null,
        );
        setInspirationPhotos(
          photos.filter((photo) => photo.photoType === 'example_reference'),
        );
        setHairPhotos(
          photos.filter((photo) => photo.photoType === 'hair_history'),
        );
        setPassport(nextPassport);
      } catch (error) {
        if (!cancelled)
          setMediaMessage(
            error instanceof Error
              ? error.message
              : 'Could not load your photos.',
          );
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
    if (!response.ok)
      throw new Error(payload.error || 'Could not prepare your passport QR.');
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
      if (!response.ok)
        throw new Error(payload.error || 'Could not update your passport QR.');
      setPassport((payload.passport || null) as ClientPassport | null);
      setMediaMessage(
        action === 'rotate'
          ? 'New passport QR created. The old one no longer works.'
          : 'Passport QR revoked.',
      );
    } catch (error) {
      setMediaMessage(
        error instanceof Error
          ? error.message
          : 'Could not update your passport QR.',
      );
    } finally {
      setPassportBusy(false);
    }
  }

  async function ensureClientRecord(
    authUserId: string,
    displayName: string,
    email: string,
  ) {
    const supabase = createClient();
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('frizi_profiles')
      .select('id, account_type')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (existingProfileError) throw existingProfileError;
    if (existingProfile && existingProfile.account_type !== 'client') {
      throw new Error('This account belongs to another Frizi app. Sign in with a Frizi Client account to continue.');
    }

    const profileMutation = existingProfile
      ? supabase
          .from('frizi_profiles')
          .update({
            display_name: displayName,
            email,
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingProfile.id)
      : supabase.from('frizi_profiles').insert({
          auth_user_id: authUserId,
          account_type: 'client',
          display_name: displayName,
          email,
          status: 'active',
          updated_at: new Date().toISOString(),
        });

    const { data: savedProfile, error: savedProfileError } = await profileMutation
      .select('id')
      .single();
    if (savedProfileError) throw savedProfileError;

    const { data: existingClient, error: existingClientError } = await supabase
      .from('frizi_clients')
      .select('id')
      .eq('profile_id', savedProfile.id)
      .maybeSingle();
    if (existingClientError) throw existingClientError;
    if (existingClient?.id) return String(existingClient.id);

    const { data: client, error: clientError } = await supabase
      .from('frizi_clients')
      .insert({
        profile_id: savedProfile.id,
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
        const { data: signedUrl } = await supabase.storage
          .from('frizi-client-media')
          .createSignedUrl(path, 60 * 30);
        return {
          id: String(row.id),
          imagePath: path,
          imageUrl: signedUrl?.signedUrl || '',
          label:
            row.photo_type === 'hair_history'
              ? 'Current hair photo'
              : 'Inspiration photo',
          note: String(row.caption || ''),
          photoType: String(
            row.photo_type || 'example_reference',
          ) as ClientPhoto['photoType'],
        };
      }),
    );

    return signed.filter((photo) => photo.imageUrl);
  }

  async function uploadClientPhoto(
    file: File,
    photoType: ClientPhoto['photoType'],
  ) {
    if (!clientSession || !isSupabaseConfigured) {
      setMediaMessage('Sign in before uploading photos.');
      return;
    }
    setMediaBusy(true);
    setMediaMessage('');
    try {
      const supabase = createClient();
      const { data: userResult, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userResult.user)
        throw new Error('Sign in again before uploading photos.');
      const ensuredClientId =
        clientId ||
        (await ensureClientRecord(
          userResult.user.id,
          clientSession.name,
          clientSession.email,
        ));
      setClientId(ensuredClientId);

      const safeName =
        file.name
          .toLowerCase()
          .replace(/[^a-z0-9.]+/g, '-')
          .replace(/^-|-$/g, '') || 'photo.jpg';
      const path = `${userResult.user.id}/${photoType}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('frizi-client-media')
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: inserted, error: photoError } = await supabase
        .from('frizi_client_photos')
        .insert({
          client_id: ensuredClientId,
          image_url: path,
          photo_type: photoType,
          consent_status:
            photoType === 'hair_history'
              ? 'private'
              : 'shared_with_professional',
          caption:
            photoType === 'example_reference'
              ? captionDraft.trim() || null
              : null,
          updated_at: new Date().toISOString(),
        })
        .select('id, image_url, photo_type, caption')
        .single();
      if (photoError) throw photoError;

      const { data: signedUrl } = await supabase.storage
        .from('frizi-client-media')
        .createSignedUrl(path, 60 * 30);
      const nextPhoto: ClientPhoto = {
        id: String(inserted.id),
        imagePath: path,
        imageUrl: signedUrl?.signedUrl || '',
        label:
          photoType === 'hair_history'
            ? 'Current hair photo'
            : 'Inspiration photo',
        note: String(inserted.caption || ''),
        photoType,
      };
      if (photoType === 'hair_history') {
        setCurrentHairPhoto(nextPhoto);
        setHairPhotos((current) => [nextPhoto, ...current]);
      }
      if (photoType === 'example_reference') {
        setInspirationPhotos((current) => [nextPhoto, ...current]);
        setCaptionDraft('');
      }
      setMediaMessage(
        photoType === 'hair_history'
          ? 'Hair photo uploaded.'
          : 'Inspiration photo uploaded.',
      );
    } catch (error) {
      setMediaMessage(
        error instanceof Error ? error.message : 'Photo upload failed.',
      );
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
      await supabase.storage
        .from('frizi-client-media')
        .remove([photo.imagePath]);
      const { error } = await supabase
        .from('frizi_client_photos')
        .delete()
        .eq('id', photo.id);
      if (error) throw error;
      if (photo.photoType === 'hair_history') {
        setHairPhotos((current) =>
          current.filter((item) => item.id !== photo.id),
        );
        if (currentHairPhoto?.id === photo.id) {
          setCurrentHairPhoto(
            hairPhotos.find((item) => item.id !== photo.id) || null,
          );
        }
      }
      if (photo.photoType === 'example_reference')
        setInspirationPhotos((current) =>
          current.filter((item) => item.id !== photo.id),
        );
      setMediaMessage('Photo removed.');
    } catch (error) {
      setMediaMessage(
        error instanceof Error ? error.message : 'Could not remove photo.',
      );
    } finally {
      setMediaBusy(false);
    }
  }

  async function saveHairProfile() {
    if (!clientId || !isSupabaseConfigured) {
      setHairProfileMessage('Sign in before saving your hair profile.');
      return;
    }
    setHairProfileBusy(true);
    setHairProfileMessage('');
    try {
      const { error } = await createClient()
        .from('frizi_clients')
        .update({
          hair_profile: hairProfile,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);
      if (error) throw error;
      setHairProfileMessage('Hair profile saved.');
    } catch (error) {
      setHairProfileMessage(
        error instanceof Error
          ? error.message
          : 'Could not save your hair profile.',
      );
    } finally {
      setHairProfileBusy(false);
    }
  }

  function updateHairProfile(field: keyof ClientHairProfile, value: string) {
    setHairProfile((current) => ({ ...current, [field]: value }));
    setHairProfileMessage('');
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[#151519] p-4">
        <div>
          <h2 className="text-2xl font-black">Hair Profile</h2>
          <p className="mt-1 text-sm font-semibold text-white/55">
            Your current hair photo and inspiration photos.
          </p>
        </div>
        <button
          className="grid h-12 w-12 place-items-center rounded-2xl border border-[#f4c430]/35 text-[#f4c430]"
          type="button"
          aria-label="Open Hair Profile QR"
          onClick={() => setPassportOpen(true)}
        >
          <QrCode size={22} />
        </button>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">Hair details</h2>
        <p className="mt-2 leading-7 text-white/68">
          Add only what you want. Your connected professional can use this before
          an appointment.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ['color', 'Hair colour'],
            ['texture', 'Texture'],
            ['density', 'Density'],
            ['length', 'Length'],
            ['currentStyle', 'Current style'],
            ['products', 'Products used'],
            ['treatmentHistory', 'Treatment history'],
          ].map(([field, label]) => (
            <label className="block" key={field}>
              <span className="text-sm font-black text-white/72">{label}</span>
              <input
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 font-semibold text-white outline-none placeholder:text-white/38"
                value={hairProfile[field as keyof ClientHairProfile]}
                onChange={(event) =>
                  updateHairProfile(
                    field as keyof ClientHairProfile,
                    event.target.value,
                  )
                }
              />
            </label>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="text-sm font-black text-white/72">
            Goals and notes
          </span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-[#0d0d10] px-4 py-3 font-semibold text-white outline-none placeholder:text-white/38"
            placeholder="What you want next, what to avoid, or anything your professional should remember"
            value={hairProfile.goals}
            onChange={(event) => updateHairProfile('goals', event.target.value)}
          />
        </label>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            className="flex min-h-12 items-center justify-center rounded-2xl bg-[#f4c430] px-4 font-black text-black disabled:opacity-60"
            type="button"
            disabled={hairProfileBusy}
            onClick={() => void saveHairProfile()}
          >
            {hairProfileBusy ? 'Saving...' : 'Continue'}
          </button>
          <button
            className="min-h-12 rounded-2xl border border-white/15 px-4 font-black text-white"
            type="button"
            onClick={() => setHairProfileMessage('Skipped for now.')}
          >
            Skip for now
          </button>
        </div>
        {hairProfileMessage ? (
          <p className="mt-3 rounded-2xl border border-[#f4c430]/35 bg-[#f4c430]/10 px-4 py-3 text-sm font-bold text-[#f4c430]">
            {hairProfileMessage}
          </p>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <div className="flex items-center gap-4">
          {currentHairPhoto ? (
            <img
              className="h-20 w-20 rounded-3xl object-cover"
              src={currentHairPhoto.imageUrl}
              alt="Current hair"
            />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/[0.06]">
              <User className="text-[#f4c430]" size={30} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black">Upload a profile image</h2>
          </div>
        </div>
        <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 font-black text-black">
          <Camera size={18} />
          {currentHairPhoto ? 'Change image' : 'Upload image'}
          <input
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            disabled={mediaBusy || !clientSession}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadClientPhoto(file, 'hair_history');
              event.currentTarget.value = '';
            }}
          />
        </label>
        {currentHairPhoto ? (
          <button
            className="mt-3 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white"
            type="button"
            disabled={mediaBusy}
            onClick={() => void removeClientPhoto(currentHairPhoto)}
          >
            Remove image
          </button>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <h2 className="text-2xl font-black">Inspiration photos</h2>
        <p className="mt-2 leading-7 text-white/68">
          Add photos of cuts, colours, and styles you want your professional to
          see.
        </p>
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
        <PhotoBoard
          description=""
          onRemove={(photo) => void removeClientPhoto(photo as ClientPhoto)}
          photos={inspirationPhotos}
          title=""
        />
      </div>

      {passportOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end bg-black/58 px-3 pb-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPassportOpen(false);
          }}
        >
          <section
            className="w-full rounded-[28px] border border-white/12 bg-[#151519] p-5 shadow-2xl shadow-black/60 sm:max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hair-passport-qr-title"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="hair-passport-qr-title" className="text-2xl font-black">
                Hair Profile QR
              </h2>
              <button
                className="grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/[0.05]"
                type="button"
                aria-label="Close Hair Profile QR"
                onClick={() => setPassportOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            {clientSession && passport ? (
              <>
                <p className="mt-2 leading-7 text-white/68">
                  Share this with a professional so they can request access to
                  your hair profile. You can rotate or revoke this QR any time.
                </p>
                <div className="mx-auto mt-5 max-w-xs rounded-3xl bg-white p-4">
                  <img
                    className="aspect-square w-full"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=720x720&margin=18&data=${encodeURIComponent(passport.passportUrl)}`}
                    alt="Client hair passport QR code"
                  />
                </div>
                <p className="mt-4 break-all rounded-2xl bg-black/30 p-3 text-sm font-semibold text-white/62">
                  {passport.passportUrl}
                </p>
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
                  Professional scan access still requires the Pro-side passport
                  acceptance screen before private profile details are shown.
                </p>
              </>
            ) : (
              <p className="mt-2 leading-7 text-white/68">
                {clientSession
                  ? 'Preparing your secure passport QR...'
                  : 'Sign in to prepare your client hair passport.'}
              </p>
            )}
          </section>
        </div>
      ) : null}

      {mediaMessage ? (
        <p className="rounded-2xl border border-[#f4c430]/35 bg-[#f4c430]/10 px-4 py-3 text-sm font-bold text-[#f4c430]">
          {mediaMessage}
        </p>
      ) : null}
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
    imageUrl:
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80',
    label: 'Uploaded example',
    note: 'Client-added inspiration photo shared with the professional before booking.',
  };
  const visibleExamples = exampleUploaded
    ? [...clientExamplePhotos, previewExample]
    : clientExamplePhotos;

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
        <div className="flex items-center gap-4">
          <img
            className="h-20 w-20 rounded-3xl object-cover"
            src={clientProfilePhoto}
            alt="Client profile"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black">Current hair photo</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-white/62">
              This is an actual hair photo. Inspiration photos stay separate
              from your current/post-cut hair history.
            </p>
          </div>
        </div>
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 font-black text-black"
          type="button"
          onClick={() => setProfileUpdated((value) => !value)}
        >
          <Camera size={18} />
          {profileUpdated ? 'Hair photo updated' : 'Update hair photo'}
        </button>
      </div>

      <PhotoBoard
        actionLabel={
          exampleUploaded ? 'Example photo uploaded' : 'Upload example photo'
        }
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
          Share this with your hairdresser so they can see your haircut photos,
          preferences, example photos, product notes, and appointment history if
          they are not on Frizi yet.
        </p>
        <div className="mx-auto mt-5 max-w-xs rounded-3xl bg-white p-4">
          <img
            className="aspect-square w-full"
            src={qrUrl}
            alt="Client hair passport QR code"
          />
        </div>
        <p className="mt-4 break-all rounded-2xl bg-black/30 p-3 text-sm font-semibold text-white/62">
          {passportUrl}
        </p>
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
  onRemove?: (photo: {
    id: string;
    imageUrl: string;
    label: string;
    note: string;
  }) => void;
  photos: Array<{ id: string; imageUrl: string; label: string; note: string }>;
  title: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#151519] p-5">
      {title ? <h2 className="text-2xl font-black">{title}</h2> : null}
      {description ? (
        <p className="mt-2 leading-7 text-white/68">{description}</p>
      ) : null}
      {photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {photos.map((photo) => (
            <article
              key={photo.id}
              className="overflow-hidden rounded-3xl bg-white/[0.06]"
            >
              <img
                className="aspect-[4/5] w-full object-cover"
                src={photo.imageUrl}
                alt=""
              />
              <div className="p-3">
                <p className="font-black">{photo.label}</p>
                <p className="mt-1 text-sm font-semibold leading-5 text-white/58">
                  {photo.note}
                </p>
                {onRemove ? (
                  <button
                    className="mt-3 rounded-xl border border-white/15 px-3 py-2 text-xs font-black text-white"
                    type="button"
                    onClick={() => onRemove(photo)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/58">
          {title.toLowerCase().includes('completed')
            ? 'No haircut photos yet'
            : 'No photos uploaded yet'}
        </div>
      )}
      {actionLabel && onAction ? (
        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f4c430] px-4 py-4 font-black text-black"
          type="button"
          onClick={onAction}
        >
          <Camera size={18} />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function Panel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
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

function ServiceStateCard({
  actionLabel,
  message,
  onAction,
}: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/62">
      {message}
      {actionLabel && onAction ? (
        <button
          className="mt-3 block rounded-full border border-white/15 px-4 py-2 text-sm font-black text-[#f4c430]"
          type="button"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function BookingConfirmation({
  booking,
}: {
  booking: BookingRequest;
  clientSession: ClientSession | null;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
      <p className="flex items-center gap-2 font-black text-emerald-700">
        <CheckCircle2 size={19} />
        Appointment request sent
      </p>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Your request for {booking.service} with {booking.professional} has been
        sent.
      </p>
    </div>
  );
}

function normalizeClientProfessionalId(value: string) {
  return value.replace(/^live-/, '');
}

function appointmentStatusLabel(status: BookingRequest['status']) {
  if (status === 'expired')
    return { short: 'Expired', detail: 'Not confirmed' };
  if (status === 'requested')
    return { short: 'Pending', detail: 'Waiting for confirmation' };
  if (status === 'confirmed')
    return { short: 'Confirmed', detail: 'Confirmed' };
  if (status === 'cancelled')
    return { short: 'Cancelled', detail: 'Cancelled' };
  if (status === 'declined') return { short: 'Declined', detail: 'Declined' };
  if (status === 'completed')
    return { short: 'Completed', detail: 'Completed' };
  return { short: 'Pending', detail: 'Waiting for confirmation' };
}

function appointmentStartDate(booking: BookingRequest) {
  const source = booking.scheduledStart || booking.time;
  const date = source ? new Date(source) : new Date(booking.date);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function isAppointmentPast(booking: BookingRequest) {
  const endSource =
    booking.scheduledEnd || booking.scheduledStart || booking.time;
  const date = endSource ? new Date(endSource) : appointmentStartDate(booking);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatConversationDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Messages';
  return date.toLocaleDateString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    weekday: 'long',
  });
}

function formatPromoExpiryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPromoExpiryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function promoOfferLabel(promotion: ClientPromoMessage | PublicPromotion) {
  if (promotion.discountType === 'percentage')
    return `${Math.max(0, promotion.discountValue || 0)}% OFF`;
  if (promotion.discountType === 'fixed_amount')
    return `${formatCurrency(Math.max(0, promotion.discountValue || 0) * 100)} OFF`;
  if (promotion.discountType === 'free_item') return 'FREE OFFER';
  return '';
}

function formatUnreadBadgeCount(count: number) {
  return count > 99 ? '99+' : String(count);
}

function formatAppointmentDayShort(booking: BookingRequest) {
  const date = appointmentStartDate(booking);
  return `${date.toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })} · ${formatSlotTime(date.toISOString())}`;
}

function formatAppointmentDateLong(booking: BookingRequest) {
  return appointmentStartDate(booking).toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function appointmentDurationLabel(booking: BookingRequest) {
  if (!booking.scheduledStart || !booking.scheduledEnd) return 'Set by service';
  const start = new Date(booking.scheduledStart);
  const end = new Date(booking.scheduledEnd);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  return Number.isFinite(minutes) && minutes > 0
    ? `${minutes} min`
    : 'Set by service';
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
    <div
      className={`flex items-center justify-between gap-3 py-1 ${strong ? 'border-t border-white/10 pt-3 text-lg' : 'text-sm'}`}
    >
      <span
        className={
          strong ? 'font-black text-white' : 'font-semibold text-white/62'
        }
      >
        {label}
      </span>
      <span
        className={`font-black ${highlight ? 'text-[#f4c430]' : 'text-white'}`}
      >
        {value}
      </span>
    </div>
  );
}

function parseMoneyToCents(value: string) {
  const parsed = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function bookingFromApiAppointment(
  appointment: Record<string, unknown>,
): BookingRequest {
  const scheduledStart = String(
    appointment.scheduledStart || appointment.starts_at || '',
  );
  const startDate = scheduledStart ? new Date(scheduledStart) : new Date();
  const status = String(
    appointment.status || 'pending',
  ) as BookingRequest['status'];
  return {
    id: String(appointment.id || ''),
    professionalId: String(
      appointment.professionalId || appointment.professional_id || '',
    ),
    professional: String(appointment.professional || 'Professional'),
    service: String(appointment.service || 'Appointment'),
    serviceId: String(appointment.serviceId || appointment.service_id || ''),
    servicePriceCents: 0,
    date: startDate.toLocaleDateString('en-CA', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    time: scheduledStart,
    eventId: String(appointment.id || `appt_${Date.now().toString(36)}`),
    status: [
      'pending',
      'requested',
      'confirmed',
      'declined',
      'cancelled',
      'completed',
      'expired',
    ].includes(status)
      ? status
      : 'pending',
    scheduledStart,
    scheduledEnd: String(appointment.scheduledEnd || appointment.ends_at || ''),
    paymentRequirement: String(
      appointment.paymentRequirement ||
        appointment.payment_requirement ||
        'pay_at_appointment',
    ),
    paymentStatus: String(
      appointment.paymentStatus || appointment.payment_status || 'not_required',
    ),
  };
}

function professionalFromApi(profile: Record<string, unknown>): Professional {
  const rawServices = Array.isArray(profile.services)
    ? (profile.services as Array<Record<string, unknown>>)
    : [];
  const services = rawServices.map((service) => ({
    id: typeof service.id === 'string' ? service.id : undefined,
    name: String(service.name || 'Service'),
    duration: String(
      service.duration || `${Number(service.durationMinutes || 60)} min`,
    ),
    price:
      typeof service.price === 'string'
        ? service.price
        : formatCurrency(Number(service.priceCents || 0)),
    durationMinutes: Number(service.durationMinutes || 60),
    bufferBeforeMinutes: Number(service.bufferBeforeMinutes || 0),
    bufferAfterMinutes: Number(service.bufferAfterMinutes || 0),
    paymentRequirement: String(
      service.paymentRequirement || 'pay_at_appointment',
    ),
  }));
  const promotion =
    profile.promotion && typeof profile.promotion === 'object'
      ? (profile.promotion as Record<string, unknown>)
      : null;
  const capabilities =
    profile.capabilities && typeof profile.capabilities === 'object'
      ? (profile.capabilities as ReturnType<typeof resolveProfessionalCapabilities>)
      : resolveProfessionalCapabilities(profile);
  return {
    id: String(profile.id || ''),
    name: String(profile.name || 'Professional'),
    role: cleanPublicProfessionalTitle(String(profile.role || '')),
    studio: String(profile.studio || 'Independent professional'),
    neighborhood: String(profile.neighborhood || 'Local area'),
    distance: String(profile.distance || 'Local area'),
    heroImage: String(
      profile.heroImage || '/frizi-client-hero-salon.png',
    ),
    detailImage: String(
      profile.detailImage || '/frizi-icon.png',
    ),
    rating: Number(profile.rating || 0),
    reviews: Number(profile.reviews || 0),
    repeatRate: String(profile.repeatRate || 'Connected'),
    nextAvailable: String(profile.nextAvailable || 'Check calendar'),
    specialties: Array.isArray(profile.specialties)
      ? profile.specialties.map(String)
      : [],
    accommodations: Array.isArray(profile.accommodations)
      ? profile.accommodations.map(String)
      : ['Book online'],
    searchTerms: Array.isArray(profile.searchTerms)
      ? profile.searchTerms.map(String)
      : [],
    whyMatch: String(profile.whyMatch || 'Connected professional'),
    bio: String(profile.bio || ''),
    services,
    bookingSlots: Array.isArray(profile.bookingSlots)
      ? profile.bookingSlots.map(String)
      : [],
    bookingSlotsByService:
      profile.bookingSlotsByService &&
      typeof profile.bookingSlotsByService === 'object'
        ? Object.fromEntries(
            Object.entries(
              profile.bookingSlotsByService as Record<string, unknown>,
            ).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.map(String) : [],
            ]),
          )
        : {},
    bookingSettings:
      profile.bookingSettings && typeof profile.bookingSettings === 'object'
        ? (profile.bookingSettings as Record<string, unknown>)
        : null,
    clientReviews: [],
    promotion: promotion
      ? {
          id: String(promotion.id || ''),
          headline: String(promotion.headline || ''),
          description: String(promotion.description || ''),
          discountType: String(promotion.discountType || ''),
          discountValue: Number(promotion.discountValue || 0),
          imageUrl: String(promotion.imageUrl || FRIZI_PROMO_FALLBACK_IMAGE),
          endAt: String(promotion.endAt || ''),
          newClientsOnly: Boolean(promotion.newClientsOnly),
          firstAppointmentOnly: Boolean(promotion.firstAppointmentOnly),
        }
      : null,
    capabilities,
  };
}

function messageFromApi(message: Record<string, unknown>): ClientConversationMessage {
  const promotion =
    message.promotion && typeof message.promotion === 'object'
      ? (message.promotion as Record<string, unknown>)
      : null;
  return {
    id: String(message.id || ''),
    body: String(message.body || ''),
    createdAt: String(message.createdAt || ''),
    isFromProfessional: Boolean(message.isFromProfessional),
    messageType: String(message.messageType || 'text'),
    promotion: promotion
      ? {
          id: String(promotion.id || ''),
          headline: String(promotion.headline || ''),
          description: String(promotion.description || ''),
          discountType: String(promotion.discountType || ''),
          discountValue: Number(promotion.discountValue || 0),
          imageUrl: String(
            promotion.imageUrl || FRIZI_PROMO_FALLBACK_IMAGE,
          ),
          endAt: String(promotion.endAt || ''),
          expired: Boolean(promotion.expired),
        }
      : null,
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

function formatPromoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

function buildAvailabilityDays(slots: string[]) {
  const grouped = slots.reduce<
    Array<{
      date: Date;
      label: string;
      times: string[];
      weekday: string;
      dayNumber: number;
    }>
  >((days, slot) => {
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
  }, []);

  return grouped.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function buildMonthCells(monthCursor: Date) {
  const firstDay = startOfMonth(monthCursor);
  const daysInMonth = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth() + 1,
    0,
  ).getDate();
  const cells: Array<Date | null> = Array.from(
    { length: firstDay.getDay() },
    () => null,
  );

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
    return parsedSlot.toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return slot.replace(/^(today|tomorrow|mon|tue|wed|thu|fri|sat|sun)\s+/i, '');
}

function rankProfessionals(
  profileList: Professional[],
  query: string,
  filters: FilterState,
) {
  const tokens = expandSearchTokens(query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean));

  return filterLocalProfiles(profileList, filters).sort(
    (a, b) => scoreProfile(b, tokens) - scoreProfile(a, tokens),
  );
}

function expandSearchTokens(tokens: string[]) {
  const synonyms: Record<string, string[]> = {
    barber: ['barbering', 'fade', 'beard', 'mens'],
    barbers: ['barbering', 'fade', 'beard', 'mens'],
    balayage: ['colour', 'color', 'highlights'],
    blonde: ['blonding', 'colour', 'color'],
    color: ['colour', 'colourist'],
    colour: ['color', 'colourist'],
    curly: ['curls', 'curly hair', 'texture'],
    fade: ['barber', 'barbering', 'skin fade', 'taper'],
    fades: ['barber', 'barbering', 'skin fade', 'taper'],
    haircut: ['cut', 'haircuts', 'stylist'],
    muslim: ['private', 'modest', 'women only', 'hijab'],
    thin: ['fine', 'fine hair'],
  };
  return Array.from(new Set(tokens.flatMap((token) => [token, ...(synonyms[token] || [])])));
}

function filterLocalProfiles(profiles: Professional[], filters: FilterState) {
  return profiles.filter((profile) => {
    if (distanceToKm(profile.distance) > filters.distanceKm) return false;
    if (!profileMatchesFilter(profile, filters.serviceType, 'service'))
      return false;
    if (!profileMatchesFilter(profile, filters.specialty, 'specialty'))
      return false;
    if (!profileMatchesFilter(profile, filters.accessibility, 'accessibility'))
      return false;
    return true;
  });
}

function distanceToKm(distance: string) {
  const parsed = Number(distance.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function profileMatchesFilter(
  profile: Professional,
  option: string,
  kind: 'service' | 'specialty' | 'accessibility',
) {
  if (option.startsWith('Any')) return true;
  const normalized = option.toLowerCase();
  const haystacks = {
    service: [
      ...profile.services.map((service) => service.name),
      ...profile.searchTerms,
    ],
    specialty: [
      ...profile.specialties,
      ...profile.services.map((service) => service.name),
      ...profile.searchTerms,
    ],
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
    if (profile.searchTerms.some((term) => term.toLowerCase() === token)) return score + 8;
    if (haystack.includes(token)) return score + 3;
    return score;
  }, 0);
}

export default App;
