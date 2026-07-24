import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Heart,
  MapPin,
  Mic,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

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

const sampleQuery =
  'I am looking for a muslim friendly barber near me who is good at fades.';

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
      'Connected to the Hairline Pro demo profile, including reviews, promotion, and available bookings.',
    bio: 'Mara is the professional shown in the Hairline Pro app. Her client notes, photo history, reviews, promotions, and booking requests sync into the pro-side demo.',
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

function App() {
  const [query, setQuery] = useState(sampleQuery);
  const [submittedQuery, setSubmittedQuery] = useState(sampleQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [passedIds, setPassedIds] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [booking, setBooking] = useState<BookingRequest | null>(null);
  const [isListening, setIsListening] = useState(false);

  const rankedProfiles = useMemo(() => rankProfessionals(submittedQuery), [submittedQuery]);
  const activeProfile = rankedProfiles[activeIndex % rankedProfiles.length];
  const activeService = selectedService || activeProfile.services[0].name;
  const activeTime = selectedTime || activeProfile.bookingSlots[0];

  function submitSearch() {
    setSubmittedQuery(query.trim() || sampleQuery);
    setActiveIndex(0);
    setSelectedService('');
    setSelectedTime('');
    setBooking(null);
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

  function moveDeck(direction: 'pass' | 'like') {
    if (direction === 'like') {
      setLikedIds((current) =>
        current.includes(activeProfile.id) ? current : [...current, activeProfile.id],
      );
    } else {
      setPassedIds((current) =>
        current.includes(activeProfile.id) ? current : [...current, activeProfile.id],
      );
    }
    setSelectedService('');
    setSelectedTime('');
    setBooking(null);
    setActiveIndex((current) => (current + 1) % rankedProfiles.length);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <main className="min-h-screen bg-[#080808] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-40 -mx-4 border-b border-white/10 bg-[#080808]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4c430]">Hairline</p>
              <h1 className="text-2xl font-black leading-none sm:text-3xl">Find your person</h1>
            </div>
            <div className="rounded-full border border-[#f4c430]/50 px-3 py-1 text-sm font-black text-[#f4c430]">
              Client app
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-5 lg:grid-cols-[420px_1fr] lg:items-start">
          <aside className="lg:sticky lg:top-24">
            <SearchPanel
              isListening={isListening}
              likedCount={likedIds.length}
              onMic={demoMicSearch}
              onSubmit={submitSearch}
              passedCount={passedIds.length}
              query={query}
              resultCount={rankedProfiles.length}
              setQuery={setQuery}
            />
            <DeckCard
              activeIndex={activeIndex}
              onLike={() => moveDeck('like')}
              onPass={() => moveDeck('pass')}
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
        </div>
      </section>
    </main>
  );
}

function SearchPanel({
  isListening,
  likedCount,
  onMic,
  onSubmit,
  passedCount,
  query,
  resultCount,
  setQuery,
}: {
  isListening: boolean;
  likedCount: number;
  onMic: () => void;
  onSubmit: () => void;
  passedCount: number;
  query: string;
  resultCount: number;
  setQuery: (value: string) => void;
}) {
  return (
    <section className="mb-4 rounded-[28px] border border-white/10 bg-[#151519] p-3 shadow-2xl shadow-black/40">
      <label className="sr-only" htmlFor="hairline-search">
        Search for a hair professional
      </label>
      <div className="flex items-center gap-2 rounded-[22px] border border-white/10 bg-black/45 px-3 py-2">
        <Search className="shrink-0 text-[#f4c430]" size={20} />
        <input
          id="hairline-search"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/38"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onSubmit();
            }
          }}
          placeholder="Tell Hairline exactly what you need"
        />
        <button
          aria-label="Demo voice search"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
            isListening ? 'bg-[#f4c430] text-black' : 'bg-white/10 text-white'
          }`}
          type="button"
          onClick={onMic}
        >
          <Mic size={18} />
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          className="flex-1 rounded-2xl bg-[#f4c430] px-4 py-3 text-sm font-black text-black"
          type="button"
          onClick={onSubmit}
        >
          Search
        </button>
        <button
          className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white"
          type="button"
          onClick={() => setQuery(sampleQuery)}
        >
          Use demo
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold text-white/58">
        <Metric label="Matches" value={String(resultCount)} />
        <Metric label="Liked" value={String(likedCount)} />
        <Metric label="Passed" value={String(passedCount)} />
      </div>
      {isListening ? (
        <p className="mt-3 rounded-2xl bg-[#f4c430]/12 px-3 py-2 text-sm font-bold text-[#f4c430]">
          Listening demo: filling the sample search...
        </p>
      ) : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-2 py-3">
      <p className="text-lg font-black text-white">{value}</p>
      <p>{label}</p>
    </div>
  );
}

function DeckCard({
  activeIndex,
  onLike,
  onPass,
  profile,
  total,
}: {
  activeIndex: number;
  onLike: () => void;
  onPass: () => void;
  profile: Professional;
  total: number;
}) {
  return (
    <section className="overflow-hidden rounded-[34px] border border-white/10 bg-[#151519] shadow-2xl shadow-black/50">
      <div className="relative min-h-[68svh] lg:min-h-[650px]">
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
          <span className="rounded-full bg-[#f4c430] px-3 py-1 text-sm font-black text-black">
            {matchPercent(profile)}% match
          </span>
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
          <div className="mt-5 grid grid-cols-[64px_1fr_64px] items-center gap-3">
            <button
              aria-label="Pass on this professional"
              className="grid h-16 w-16 place-items-center rounded-full border border-white/12 bg-white/10 text-white"
              type="button"
              onClick={onPass}
            >
              <X size={30} />
            </button>
            <a
              className="rounded-full bg-[#f4c430] px-5 py-4 text-center text-base font-black text-black"
              href="#booking"
            >
              See details and book
            </a>
            <button
              aria-label="Like this professional"
              className="grid h-16 w-16 place-items-center rounded-full bg-white text-black"
              type="button"
              onClick={onLike}
            >
              <Heart size={30} />
            </button>
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
            <ChevronDown size={16} />
            Swipe with buttons, then scroll
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
        Synced to Hairline Pro booking queue for the professional app demo.
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
