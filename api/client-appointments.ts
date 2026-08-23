/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from './_supabase.mjs';
import { dispatchNotificationPush } from './_notifications.mjs';
import { enforceRateLimit } from './_rate-limit.mjs';

type AppointmentPayload = {
  action?: 'cancel';
  appointmentId?: string;
  professionalId?: string;
  serviceId?: string;
  scheduledStart?: string;
  clientNotes?: string;
  referencePhotoUrls?: string[];
};

type ServiceRow = {
  id: string;
  professional_id: string;
  name: string;
  public_description: string | null;
  base_price_cents: number;
  currency: string;
  duration_minutes: number | null;
  pricing_type: string;
  deposit_type: string;
  deposit_amount_cents: number;
  deposit_percentage: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  online_booking_enabled: boolean;
  new_clients_allowed: boolean;
  existing_clients_only: boolean;
  service_metadata: Record<string, unknown> | null;
};

type ProfessionalRow = {
  id: string;
  profile_id?: string | null;
  display_name: string;
  studio_name?: string | null;
  bio?: string | null;
  specialties?: string[] | null;
  primary_specialty?: string | null;
  profile_photo_url?: string | null;
  hero_photo_url?: string | null;
  public_profile_status: string;
  bookable: boolean;
  subscription_status: string;
  booking_settings: Record<string, unknown> | null;
};

type AppointmentRow = {
  professional_id: string;
  starts_at: string;
  ends_at: string;
  status?: string;
};

type LocationRow = {
  professional_id: string;
  city: string;
  province: string;
};

type RelationshipRow = {
  professional_id: string;
};

type ProfileIdentityRow = {
  auth_user_id: string | null;
};

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function readJson(
  request: IncomingMessage & { body?: unknown },
): Promise<AppointmentPayload> {
  if (request.body && typeof request.body === 'object')
    return request.body as AppointmentPayload;

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? (JSON.parse(rawBody) as AppointmentPayload) : {};
}

function bearerToken(request: IncomingMessage) {
  const header = request.headers.authorization || '';
  const match = Array.isArray(header)
    ? header[0]?.match(/^Bearer\s+(.+)$/i)
    : header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
}

function splitName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

function normalizeProfessionalId(value: string) {
  return value.replace(/^live-/, '');
}

function isActiveSubscription(status: string | null | undefined) {
  return status === 'active' || status === 'trialing';
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function timeToMinutes(value: string) {
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

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isWithinAvailability(
  professional: ProfessionalRow,
  start: Date,
  end: Date,
) {
  const settings = professional.booking_settings as {
    availability?: {
      shifts?: Array<{
        date?: string;
        startTime?: string;
        endTime?: string;
        breakStartTime?: string;
        breakEndTime?: string;
      }>;
    };
  } | null;
  const shifts = settings?.availability?.shifts;
  if (!Array.isArray(shifts) || shifts.length === 0) return false;

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const selectedDateKey = dateKey(start);

  return shifts.some((shift) => {
    if (shift.date !== selectedDateKey) return false;
    const shiftStart = timeToMinutes(String(shift.startTime || ''));
    const shiftEnd = timeToMinutes(String(shift.endTime || ''));
    if (shiftStart === null || shiftEnd === null) return false;
    if (shift.breakStartTime && shift.breakEndTime) {
      const breakStart = timeToMinutes(String(shift.breakStartTime || ''));
      const breakEnd = timeToMinutes(String(shift.breakEndTime || ''));
      if (
        breakStart !== null &&
        breakEnd !== null &&
        rangesOverlap(startMinutes, endMinutes, breakStart, breakEnd)
      )
        return false;
    }
    return startMinutes >= shiftStart && endMinutes <= shiftEnd;
  });
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) {
  return startA < endB && endA > startB;
}

function paymentRequirementFor(service: ServiceRow) {
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
  if (service.deposit_type !== 'none') return 'deposit_required';
  return 'pay_at_appointment';
}

function paymentRequiredCentsFor(
  service: ServiceRow,
  paymentRequirement: string,
) {
  if (paymentRequirement === 'full_prepayment_required')
    return service.base_price_cents;
  if (paymentRequirement !== 'deposit_required') return 0;
  if (service.deposit_type === 'fixed') return service.deposit_amount_cents;
  if (service.deposit_type === 'percentage')
    return Math.round(
      service.base_price_cents * (service.deposit_percentage / 100),
    );
  return 0;
}

function appointmentStatusFor(paymentRequirement: string) {
  return paymentRequirement === 'pay_at_appointment' ||
    paymentRequirement === 'frizi_payment_optional'
    ? 'pending'
    : 'pending';
}

function formatNotificationDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

async function createNotification(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    recipientUserId?: string | null;
    recipientRole: 'client' | 'professional';
    notificationType: string;
    title: string;
    body?: string | null;
    professionalId?: string | null;
    clientId?: string | null;
    relationshipId?: string | null;
    appointmentId?: string | null;
    actionPath?: string | null;
    sourceKey: string;
    metadata?: Record<string, unknown>;
    required?: boolean;
  },
) {
  if (!input.recipientUserId) {
    if (input.required) {
      throw new Error(
        'Notification recipient could not be resolved for this appointment event.',
      );
    }
    return null;
  }
  const { data, error } = await supabase.from('frizi_notifications').upsert(
    {
      recipient_user_id: input.recipientUserId,
      recipient_role: input.recipientRole,
      notification_type: input.notificationType,
      title: input.title,
      body: input.body || null,
      professional_id: input.professionalId || null,
      client_id: input.clientId || null,
      relationship_id: input.relationshipId || null,
      appointment_id: input.appointmentId || null,
      action_path: input.actionPath || null,
      source_key: input.sourceKey,
      metadata: input.metadata || {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'source_key' },
  ).select('id').single();
  if (error) throw error;
  if (data?.id) await dispatchNotificationPush(supabase, String(data.id));
  return data?.id ? String(data.id) : null;
}

async function profileAuthUserId(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  profileId?: string | null,
) {
  if (!profileId) return null;
  const { data, error } = await supabase
    .from('frizi_profiles')
    .select('auth_user_id')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw error;
  return ((data || null) as ProfileIdentityRow | null)?.auth_user_id || null;
}

function mapAppointment(row: Record<string, unknown>) {
  const serviceSnapshot = (row.service_snapshot || {}) as Record<
    string,
    unknown
  >;
  const professional = Array.isArray(row.frizi_professionals)
    ? row.frizi_professionals[0]
    : row.frizi_professionals;
  const professionalRow =
    professional && typeof professional === 'object'
      ? (professional as { display_name?: string })
      : null;
  return {
    id: row.id,
    professionalId: row.professional_id,
    clientId: row.client_id,
    serviceId: row.service_id,
    service: String(serviceSnapshot.name || 'Appointment'),
    professional: String(
      row.professional_name || professionalRow?.display_name || 'Professional',
    ),
    servicePriceCents: Number(serviceSnapshot.price_cents || 0),
    scheduledStart: row.starts_at,
    scheduledEnd: row.ends_at,
    status: row.status,
    paymentRequirement: row.payment_requirement,
    paymentStatus: row.payment_status,
  };
}

function formatServicePrice(service: ServiceRow) {
  if (service.pricing_type === 'free_consultation') return 'Free';
  if (service.pricing_type === 'price_varies') return 'Varies';
  const dollars = Math.round(Number(service.base_price_cents || 0) / 100);
  return service.pricing_type === 'starting_at'
    ? `From $${dollars}`
    : `$${dollars}`;
}

function appointmentBlocksSlot(
  row: AppointmentRow,
  slot: Date,
  startMinutes: number,
  endMinutes: number,
) {
  const startsAt = new Date(String(row.starts_at || ''));
  const endsAt = new Date(String(row.ends_at || ''));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))
    return false;
  if (dateKey(startsAt) !== dateKey(slot)) return false;
  const blockedStart = startsAt.getHours() * 60 + startsAt.getMinutes();
  const blockedEnd = endsAt.getHours() * 60 + endsAt.getMinutes();
  return rangesOverlap(startMinutes, endMinutes, blockedStart, blockedEnd);
}

function buildSlotsForService(
  professional: Pick<ProfessionalRow, 'booking_settings'>,
  service: ServiceRow,
  appointments: AppointmentRow[],
) {
  const settings = professional.booking_settings as {
    availability?: {
      bookingIntervalMinutes?: number;
      shifts?: Array<{
        date?: string;
        startTime?: string;
        endTime?: string;
        breakStartTime?: string;
        breakEndTime?: string;
      }>;
    };
  } | null;
  const availability = settings?.availability;
  const shifts = Array.isArray(availability?.shifts) ? availability.shifts : [];
  const intervalMinutes = Number(availability?.bookingIntervalMinutes || 30);
  const durationMinutes = service.duration_minutes || 60;
  const bufferBeforeMinutes = service.buffer_before_minutes || 0;
  const bufferAfterMinutes = service.buffer_after_minutes || 0;
  const now = Date.now();
  const slots: string[] = [];

  for (const shift of shifts) {
    if (!shift.date || !shift.startTime || !shift.endTime) continue;
    const shiftStart = timeToMinutes(String(shift.startTime));
    const shiftEnd = timeToMinutes(String(shift.endTime));
    if (shiftStart === null || shiftEnd === null) continue;
    const breakStart = shift.breakStartTime
      ? timeToMinutes(String(shift.breakStartTime))
      : null;
    const breakEnd = shift.breakEndTime
      ? timeToMinutes(String(shift.breakEndTime))
      : null;

    for (
      let cursor = shiftStart;
      cursor + durationMinutes <= shiftEnd;
      cursor += intervalMinutes
    ) {
      const slot = dateTimeFromParts(shift.date, cursor);
      if (slot.getTime() <= now + 12 * 60 * 60 * 1000) continue;
      const blockedStart = cursor - bufferBeforeMinutes;
      const blockedEnd = cursor + durationMinutes + bufferAfterMinutes;
      if (
        breakStart !== null &&
        breakEnd !== null &&
        rangesOverlap(cursor, cursor + durationMinutes, breakStart, breakEnd)
      )
        continue;
      if (
        appointments.some((appointment) =>
          appointmentBlocksSlot(appointment, slot, blockedStart, blockedEnd),
        )
      )
        continue;
      slots.push(slot.toISOString());
      if (slots.length >= 24) return slots;
    }
  }

  return slots.sort();
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

async function loadConnectedProfessionals(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  clientId: string,
) {
  const { data: relationships, error: relationshipError } = await supabase
    .from('frizi_client_professional_relationships')
    .select('professional_id')
    .eq('client_id', clientId)
    .eq('status', 'active');

  if (relationshipError) throw relationshipError;
  const professionalIds = Array.from(
    new Set(
      (relationships || [])
        .map((relationship: RelationshipRow) =>
          String(relationship.professional_id),
        )
        .filter(Boolean),
    ),
  );
  if (!professionalIds.length) return [];

  const [
    { data: professionals, error: professionalError },
    { data: locations, error: locationError },
    { data: services, error: serviceError },
    { data: appointments, error: appointmentError },
  ] = await Promise.all([
    supabase
      .from('frizi_professionals')
      .select(
        'id, display_name, studio_name, bio, specialties, primary_specialty, profile_photo_url, hero_photo_url, public_profile_status, bookable, subscription_status, booking_settings',
      )
      .in('id', professionalIds),
    supabase
      .from('frizi_professional_locations')
      .select('professional_id, city, province')
      .in('professional_id', professionalIds)
      .eq('primary_location', true)
      .eq('active', true),
    supabase
      .from('frizi_services')
      .select(
        'id, professional_id, name, public_description, base_price_cents, currency, duration_minutes, pricing_type, deposit_type, deposit_amount_cents, deposit_percentage, buffer_before_minutes, buffer_after_minutes, online_booking_enabled, new_clients_allowed, existing_clients_only, service_metadata',
      )
      .in('professional_id', professionalIds)
      .eq('active', true)
      .eq('online_booking_enabled', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('frizi_appointments')
      .select('professional_id, starts_at, ends_at, status')
      .in('professional_id', professionalIds)
      .in('status', ['pending', 'confirmed']),
  ]);

  if (professionalError) throw professionalError;
  if (locationError) throw locationError;
  if (serviceError) throw serviceError;
  if (appointmentError) throw appointmentError;

  return ((professionals || []) as ProfessionalRow[])
    .filter(
      (professional) =>
        professional.public_profile_status === 'published' &&
        Boolean(professional.bookable) &&
        isActiveSubscription(String(professional.subscription_status || '')),
    )
    .map((professional) => {
      const professionalServices = ((services || []) as ServiceRow[]).filter(
        (service) => service.professional_id === professional.id,
      );
      const professionalAppointments = (
        (appointments || []) as AppointmentRow[]
      ).filter(
        (appointment) => appointment.professional_id === professional.id,
      );
      const location = ((locations || []) as LocationRow[]).find(
        (candidate) => candidate.professional_id === professional.id,
      );
      const bookingSlotsByService = Object.fromEntries(
        professionalServices.map((service) => [
          service.id,
          buildSlotsForService(
            professional as ProfessionalRow,
            service,
            professionalAppointments,
          ),
        ]),
      );
      const firstService = professionalServices[0];
      return {
        id: professional.id,
        name: professional.display_name,
        role:
          professional.primary_specialty ||
          professional.specialties?.[0] ||
          'Frizi professional',
        studio: professional.studio_name || 'Independent professional',
        neighborhood: location
          ? `${location.city}, ${location.province}`
          : 'Local area',
        distance: location?.city || 'Local area',
        heroImage:
          professional.hero_photo_url ||
          professional.profile_photo_url ||
          '/frizi-icon.png',
        detailImage:
          professional.profile_photo_url ||
          professional.hero_photo_url ||
          '/frizi-icon.png',
        rating: 0,
        reviews: 0,
        repeatRate: 'Connected',
        nextAvailable:
          firstService && bookingSlotsByService[firstService.id]?.[0]
            ? bookingSlotsByService[firstService.id][0]
            : 'Check calendar',
        specialties: professional.specialties || [],
        accommodations: ['Connected professional', 'Book online'],
        searchTerms: [
          professional.display_name,
          professional.studio_name,
          ...(professional.specialties || []),
        ].filter(Boolean),
        whyMatch: professional.studio_name || 'Connected professional',
        bio: professional.bio || '',
        services: professionalServices.map((service) => ({
          id: service.id,
          name: service.name,
          duration: `${service.duration_minutes || 60} min`,
          durationMinutes: service.duration_minutes || 60,
          price: formatServicePrice(service),
          priceCents: service.base_price_cents,
          bufferBeforeMinutes: service.buffer_before_minutes || 0,
          bufferAfterMinutes: service.buffer_after_minutes || 0,
          paymentRequirement: paymentRequirementFor(service),
        })),
        bookingSlots: firstService
          ? bookingSlotsByService[firstService.id] || []
          : [],
        bookingSlotsByService,
        bookingSettings: professional.booking_settings || null,
        clientReviews: [],
        promotion: null,
      };
    });
}

export default async function handler(
  request: IncomingMessage & { body?: unknown },
  response: ServerResponse,
) {
  if (!['GET', 'POST', 'PATCH'].includes(request.method || '')) {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (
    !(await enforceRateLimit(request, response, 'client_booking', {
      limit: request.method === 'GET' ? 60 : 10,
    }))
  )
    return;

  if (!isSupabaseServiceConfigured()) {
    return sendJson(response, 501, {
      error: 'Frizi booking is not configured.',
    });
  }

  const accessToken = bearerToken(request);
  if (!accessToken)
    return sendJson(response, 401, {
      error: 'Sign in before booking an appointment.',
    });

  const supabase = createSupabaseServiceClient();
  const { data: userResult, error: userError } =
    await supabase.auth.getUser(accessToken);
  if (userError || !userResult.user) {
    return sendJson(response, 401, {
      error: 'Sign in again before booking an appointment.',
    });
  }

  if (request.method === 'GET') {
    const requestUrl = new URL(request.url || '/', 'https://frizi.ca');
    const requestedProfessionalId = normalizeProfessionalId(
      requestUrl.searchParams.get('professionalId') || '',
    );
    const { data: profile, error: profileError } = await supabase
      .from('frizi_profiles')
      .select('id')
      .eq('auth_user_id', userResult.user.id)
      .maybeSingle();
    if (profileError)
      return sendJson(response, 500, { error: profileError.message });
    if (!profile) return sendJson(response, 200, { appointments: [] });

    const { data: client, error: clientError } = await supabase
      .from('frizi_clients')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (clientError)
      return sendJson(response, 500, { error: clientError.message });
    if (!client)
      return sendJson(response, 200, {
        appointments: [],
        connectedProfessionals: [],
      });

    const nowIso = new Date().toISOString();
    await supabase
      .from('frizi_appointments')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('client_id', client.id)
      .in('status', ['pending', 'requested'])
      .lt('ends_at', nowIso);

    if (requestedProfessionalId) {
      if (!/^[0-9a-f-]{36}$/i.test(requestedProfessionalId)) {
        return sendJson(response, 400, {
          error: 'Choose a valid professional.',
        });
      }
      const connectedProfessionals = await loadConnectedProfessionals(
        supabase,
        client.id,
      );
      const professional = connectedProfessionals.find(
        (candidate) => candidate.id === requestedProfessionalId,
      );
      if (!professional) {
        return sendJson(response, 404, {
          error:
            'This professional is not connected or is not available for booking.',
        });
      }
      return sendJson(response, 200, {
        professional,
        diagnostics: {
          professionalId: requestedProfessionalId,
          serviceCount: professional.services.length,
        },
      });
    }

    const [{ data, error }, connectedProfessionals] = await Promise.all([
      supabase
        .from('frizi_appointments')
        .select(
          'id, professional_id, client_id, service_id, starts_at, ends_at, status, payment_requirement, payment_status, service_snapshot, frizi_professionals(display_name)',
        )
        .eq('client_id', client.id)
        .order('starts_at', { ascending: true })
        .limit(100),
      loadConnectedProfessionals(supabase, client.id),
    ]);
    if (error) return sendJson(response, 500, { error: error.message });
    return sendJson(response, 200, {
      appointments: (data || []).map(mapAppointment),
      connectedProfessionals,
    });
  }

  if (request.method === 'PATCH') {
    const payload = await readJson(request);
    const appointmentId = String(payload.appointmentId || '').trim();
    if (payload.action !== 'cancel' || !/^[0-9a-f-]{36}$/i.test(appointmentId)) {
      return sendJson(response, 400, {
        error: 'Choose a valid appointment request to cancel.',
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('frizi_profiles')
      .select('id')
      .eq('auth_user_id', userResult.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return sendJson(response, 404, { error: 'Client profile was not found.' });

    const { data: client, error: clientError } = await supabase
      .from('frizi_clients')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) return sendJson(response, 404, { error: 'Client profile was not found.' });

    const { data: appointment, error: appointmentLookupError } = await supabase
      .from('frizi_appointments')
      .select(
        'id, professional_id, client_id, service_id, starts_at, ends_at, status, payment_requirement, payment_status, service_snapshot, frizi_professionals(display_name, profile_id)',
      )
      .eq('id', appointmentId)
      .eq('client_id', client.id)
      .maybeSingle();
    if (appointmentLookupError) throw appointmentLookupError;
    if (!appointment) return sendJson(response, 404, { error: 'Appointment request was not found.' });
    if (!['pending', 'requested', 'confirmed'].includes(String(appointment.status || ''))) {
      return sendJson(response, 409, { error: 'This appointment cannot be cancelled from the app.' });
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('frizi_appointments')
      .update({ status: 'cancelled', updated_at: now })
      .eq('id', appointmentId)
      .eq('client_id', client.id)
      .in('status', ['pending', 'requested', 'confirmed'])
      .select(
        'id, professional_id, client_id, service_id, starts_at, ends_at, status, payment_requirement, payment_status, service_snapshot, frizi_professionals(display_name, profile_id)',
      )
      .single();
    if (updateError) throw updateError;

    const professionalRaw = Array.isArray(updated.frizi_professionals)
      ? updated.frizi_professionals[0]
      : updated.frizi_professionals;
    const professionalProfileId =
      professionalRaw && typeof professionalRaw === 'object'
        ? String((professionalRaw as Record<string, unknown>).profile_id || '')
        : '';
    const proUserId = await profileAuthUserId(supabase, professionalProfileId);
    await createNotification(supabase, {
      recipientUserId: proUserId,
      recipientRole: 'professional',
      notificationType: 'appointment_cancelled',
      title: 'Appointment cancelled',
      body: `${String(userResult.user.user_metadata?.full_name || userResult.user.email || 'A client')} cancelled ${formatNotificationDateTime(new Date(String(updated.starts_at || '')))}.`,
      professionalId: String(updated.professional_id || ''),
      clientId: String(updated.client_id || ''),
      appointmentId,
      actionPath: `/calendar?appointment=${appointmentId}`,
      sourceKey: `appointment_cancelled:${appointmentId}:client`,
      metadata: { status: 'cancelled' },
      required: true,
    });

    return sendJson(response, 200, { appointment: mapAppointment(updated) });
  }

  try {
    const payload = await readJson(request);
    const professionalId = normalizeProfessionalId(
      String(payload.professionalId || '').trim(),
    );
    const serviceId = String(payload.serviceId || '').trim();
    const scheduledStart = new Date(String(payload.scheduledStart || ''));

    if (!/^[0-9a-f-]{36}$/i.test(professionalId)) {
      return sendJson(response, 400, { error: 'Choose a valid professional.' });
    }
    if (!serviceId || Number.isNaN(scheduledStart.getTime())) {
      return sendJson(response, 400, {
        error: 'Choose a valid service and appointment time.',
      });
    }

    const { data: professionalResult, error: professionalError } =
      await supabase
        .from('frizi_professionals')
        .select(
          'id, profile_id, display_name, public_profile_status, bookable, subscription_status, booking_settings',
        )
        .eq('id', professionalId)
        .maybeSingle();

    const professional = professionalResult as ProfessionalRow | null;

    if (professionalError) throw professionalError;
    if (
      !professional ||
      professional.public_profile_status !== 'published' ||
      !professional.bookable ||
      !isActiveSubscription(professional.subscription_status)
    ) {
      return sendJson(response, 409, {
        error:
          'This professional is not available for online booking right now.',
      });
    }

    const { data: serviceResult, error: serviceError } = await supabase
      .from('frizi_services')
      .select(
        'id, professional_id, name, public_description, base_price_cents, currency, duration_minutes, pricing_type, deposit_type, deposit_amount_cents, deposit_percentage, buffer_before_minutes, buffer_after_minutes, online_booking_enabled, new_clients_allowed, existing_clients_only, service_metadata',
      )
      .eq('id', serviceId)
      .eq('professional_id', professionalId)
      .eq('active', true)
      .eq('online_booking_enabled', true)
      .maybeSingle();

    const service = serviceResult as ServiceRow | null;

    if (serviceError) throw serviceError;
    if (!service)
      return sendJson(response, 409, {
        error: 'This service is not available for online booking.',
      });

    const durationMinutes = service.duration_minutes || 60;
    const startsAt = addMinutes(
      scheduledStart,
      -(service.buffer_before_minutes || 0),
    );
    const endsAt = addMinutes(
      scheduledStart,
      durationMinutes + (service.buffer_after_minutes || 0),
    );

    if (
      !isWithinAvailability(
        professional,
        scheduledStart,
        addMinutes(scheduledStart, durationMinutes),
      )
    ) {
      return sendJson(response, 409, {
        error: 'That time is no longer available. Please choose another time.',
      });
    }

    const displayName = String(
      userResult.user.user_metadata?.full_name ||
        userResult.user.email ||
        'Frizi client',
    ).trim();
    const { firstName, lastName } = splitName(displayName);
    const now = new Date().toISOString();

    const { data: profile, error: profileError } = await supabase
      .from('frizi_profiles')
      .upsert(
        {
          auth_user_id: userResult.user.id,
          account_type: 'client',
          display_name: displayName,
          email: userResult.user.email,
          status: 'active',
          updated_at: now,
        },
        { onConflict: 'auth_user_id' },
      )
      .select('id')
      .single();
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
      email: userResult.user.email,
      account_claimed_at: now,
      updated_at: now,
    };

    const { data: client, error: clientError } = existingClient
      ? await supabase
          .from('frizi_clients')
          .update(clientMutation)
          .eq('id', existingClient.id)
          .select('id')
          .single()
      : await supabase
          .from('frizi_clients')
          .insert(clientMutation)
          .select('id')
          .single();
    if (clientError) throw clientError;

    const { data: existingRelationship, error: existingRelationshipError } =
      await supabase
        .from('frizi_client_professional_relationships')
        .select('id, source')
        .eq('client_id', client.id)
        .eq('professional_id', professional.id)
        .eq('status', 'active')
        .maybeSingle();
    if (existingRelationshipError) throw existingRelationshipError;

    if (
      (!service.new_clients_allowed || service.existing_clients_only) &&
      !existingRelationship
    ) {
      return sendJson(response, 409, {
        error: 'This service is available to connected clients only.',
      });
    }

    const paymentRequirement = paymentRequirementFor(service);
    const paymentRequiredCents = paymentRequiredCentsFor(
      service,
      paymentRequirement,
    );
    if (paymentRequiredCents > 0) {
      return sendJson(response, 409, {
        error:
          'This service requires online payment before booking. Frizi payment checkout is not available for this service yet.',
      });
    }
    const status = appointmentStatusFor(paymentRequirement);
    const paymentStatus =
      paymentRequiredCents > 0 ? 'awaiting_payment' : 'not_required';

    const serviceSnapshot = {
      id: service.id,
      name: service.name,
      description: service.public_description,
      price_cents: service.base_price_cents,
      currency: service.currency,
      duration_minutes: durationMinutes,
      pricing_type: service.pricing_type,
    };

    const { data: appointment, error: appointmentError } = await supabase
      .from('frizi_appointments')
      .insert({
        client_id: client.id,
        professional_id: professional.id,
        service_id: service.id,
        service_snapshot: serviceSnapshot,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status,
        payment_status: paymentStatus,
        booking_source: 'client_app',
        client_notes: String(payload.clientNotes || '').trim() || null,
        reference_photo_urls: Array.isArray(payload.referencePhotoUrls)
          ? payload.referencePhotoUrls.slice(0, 8)
          : [],
        payment_requirement: paymentRequirement,
        payment_required_cents: paymentRequiredCents,
        updated_at: now,
      })
      .select(
        'id, professional_id, client_id, service_id, starts_at, ends_at, status, payment_requirement, payment_status, service_snapshot',
      )
      .single();

    if (appointmentError) {
      if ((appointmentError as { code?: string }).code === '23P01') {
        return sendJson(response, 409, {
          error: 'That time was just booked. Please choose another time.',
        });
      }
      throw appointmentError;
    }

    const { data: relationship, error: relationshipError } = await supabase
      .from('frizi_client_professional_relationships')
      .upsert(
        {
          client_id: client.id,
          professional_id: professional.id,
          status: 'active',
          source: existingRelationship?.source || 'booking',
          account_claimed_status: 'claimed',
          next_appointment_at: startsAt.toISOString(),
          last_service: service.name,
          updated_at: now,
        },
        { onConflict: 'client_id,professional_id' },
      )
      .select('id, source')
      .single();
    if (relationshipError) throw relationshipError;

    const proUserId = await profileAuthUserId(supabase, professional.profile_id);
    await createNotification(supabase, {
      recipientUserId: proUserId,
      recipientRole: 'professional',
      notificationType: 'appointment_requested',
      title: 'New booking request',
      body: `${displayName} requested ${service.name} for ${formatNotificationDateTime(startsAt)}.`,
      professionalId: professional.id,
      clientId: client.id,
      relationshipId: relationship?.id || existingRelationship?.id || null,
      appointmentId: String(appointment.id || ''),
      actionPath: `/calendar?appointment=${appointment.id}`,
      sourceKey: `appointment_requested:${appointment.id}`,
      metadata: {
        serviceName: service.name,
        startsAt: startsAt.toISOString(),
        clientName: displayName,
      },
      required: true,
    });

    return sendJson(response, 201, {
      appointment: {
        ...mapAppointment({
          ...appointment,
          professional_name: professional.display_name,
        }),
        professional: professional.display_name,
      },
    });
  } catch (error) {
    return sendJson(response, 500, {
      error:
        error instanceof Error ? error.message : 'Appointment booking failed.',
    });
  }
}
