/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseServiceClient, isSupabaseServiceConfigured } from './_supabase.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function publicProfessionalPayload(professional: Record<string, any>, services: Array<Record<string, any>>, promotion: Record<string, any> | null) {
  const location = professional.location && typeof professional.location === 'object' ? professional.location : {};
  const publicServices = services.map((service) => ({
    id: service.id,
    name: service.name,
    duration: service.duration_minutes ? `${service.duration_minutes} min` : 'Book online',
    price: service.pricing_type === 'free_consultation' ? 'Free consultation' : `$${(Number(service.base_price_cents || 0) / 100).toFixed(0)}`,
    priceCents: Number(service.base_price_cents || 0),
  }));

  return {
    id: professional.id,
    name: professional.display_name,
    role: professional.primary_specialty || professional.specialties?.[0] || 'Hair professional',
    studio: professional.studio_name || 'Independent professional',
    neighborhood: location.city || '',
    distance: 'Local',
    heroImage: professional.profile_photo_url || professional.hero_photo_url || '/frizi-icon.png',
    detailImage: professional.hero_photo_url || professional.profile_photo_url || '/frizi-icon.png',
    rating: 5,
    reviews: 0,
    repeatRate: '',
    nextAvailable: 'Check calendar',
    specialties: professional.specialties || [],
    accommodations: [],
    searchTerms: [professional.display_name, professional.studio_name, ...(professional.specialties || [])].filter(Boolean),
    whyMatch: professional.studio_name || 'Connected by invite',
    bio: professional.bio || 'This professional invited you to connect on Frizi.',
    services: publicServices,
    bookingSlots: ['Choose a date'],
    clientReviews: [],
    promotion: promotion?.name || '',
  };
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!(await enforceRateLimit(request, response, 'invite_lookup'))) return;

  if (!isSupabaseServiceConfigured()) {
    return sendJson(response, 501, { error: 'Frizi invite lookup is not configured.' });
  }

  const base = `https://${request.headers.host || 'frizi.ca'}`;
  const url = new URL(request.url || '/', base);
  const token = (url.searchParams.get('token') || '').trim();

  if (!/^[a-zA-Z0-9_-]{8,160}$/.test(token)) {
    return sendJson(response, 400, { error: 'Invite link is invalid.' });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data: invite, error: inviteError } = await supabase
      .from('frizi_professional_invites')
      .select('id, token, status, source, expires_at, professional_id')
      .eq('token', token)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite || invite.status !== 'active' || (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())) {
      return sendJson(response, 404, { error: 'This invitation is not available.' });
    }

    const { data: professional, error: professionalError } = await supabase
      .from('frizi_professionals')
      .select('id, display_name, studio_name, bio, specialties, primary_specialty, location, profile_photo_url, hero_photo_url, public_profile_status, bookable')
      .eq('id', invite.professional_id)
      .maybeSingle();

    if (professionalError) throw professionalError;
    if (!professional) return sendJson(response, 404, { error: 'This professional is not available.' });

    const [{ data: services, error: servicesError }, { data: promotions, error: promotionsError }] = await Promise.all([
      supabase
        .from('frizi_services')
        .select('id, name, duration_minutes, base_price_cents, pricing_type')
        .eq('professional_id', invite.professional_id)
        .eq('active', true)
        .eq('online_booking_enabled', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('frizi_promotions')
        .select('id, name, public_description, active, start_at, end_at')
        .eq('created_by', String(invite.professional_id))
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(1),
    ]);

    if (servicesError) throw servicesError;
    if (promotionsError) throw promotionsError;

    return sendJson(response, 200, {
      invitation: {
        id: invite.id,
        token: invite.token,
        source: invite.source,
        expiresAt: invite.expires_at,
      },
      professional: publicProfessionalPayload(professional, services || [], promotions?.[0] || null),
    });
  } catch (error) {
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Invite lookup failed.',
    });
  }
}
