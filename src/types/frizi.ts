import type { LucideIcon } from 'lucide-react';

export type ComfortFilter =
  | 'Queer friendly'
  | 'Gender affirming'
  | 'Curly specialist'
  | 'Textured hair'
  | 'Color safe'
  | 'Quiet appointment'
  | 'Hijab-friendly space'
  | 'Wheelchair accessible'
  | 'On public transit'
  | 'Free parking nearby'
  | 'Private room available'
  | 'Fragrance aware';

export type HairType = 'Straight' | 'Wavy' | 'Curly' | 'Coily' | 'Locs';

export type StyleGoal =
  | 'Fade'
  | 'Protective style'
  | 'Shag'
  | 'Pixie'
  | 'Color correction'
  | 'Natural curls'
  | 'Beard trim'
  | 'Blowout';

export type PortfolioPhoto = {
  id: string;
  src: string;
  alt: string;
  style: StyleGoal;
  hairType: HairType;
  consent: 'approved' | 'pending' | 'private';
};

export type Review = {
  id: string;
  customer: string;
  rating: number;
  text: string;
  tags: string[];
  date: string;
};

export type Stylist = {
  id: string;
  name: string;
  pronouns: string;
  role: string;
  studio: string;
  neighborhood: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  repeatRate: number;
  nextAvailable: string;
  priceRange: string;
  services: string[];
  availability: string[];
  bio: string;
  image: string;
  specialties: StyleGoal[];
  hairTypes: HairType[];
  comfortFilters: ComfortFilter[];
  proofTags: string[];
  portfolio: PortfolioPhoto[];
  reviews: Review[];
  promotion?: string;
  demoVideo?: string;
};

export type StylistMetric = {
  label: string;
  value: string;
  icon: LucideIcon;
};

export type ClientMoment = {
  id: string;
  client: string;
  service: string;
  photo: string;
  hairType: HairType;
  style: StyleGoal;
  status: 'sent for consent' | 'approved for marketing' | 'private only';
  review?: string;
};
