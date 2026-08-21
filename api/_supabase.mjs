import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const canonicalSupabaseProjectRef = 'rdddcpuvgpaztrgovdnz';

function getSupabaseProjectRef(url = supabaseUrl) {
  const match = String(url || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return match?.[1] || '';
}

function validateSupabaseProject() {
  if (/localhost|127\.0\.0\.1|hairline|demo/i.test(String(supabaseUrl || ''))) {
    throw new Error('Frizi Supabase URL points to a local or demo backend.');
  }

  const projectRef = getSupabaseProjectRef();
  if (projectRef !== canonicalSupabaseProjectRef) {
    throw new Error(`Frizi Supabase project mismatch. Expected ${canonicalSupabaseProjectRef}.`);
  }
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey && getSupabaseProjectRef() === canonicalSupabaseProjectRef);
}

export function createSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
  validateSupabaseProject();

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function isSupabaseServiceConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey && getSupabaseProjectRef() === canonicalSupabaseProjectRef);
}

export function createSupabaseServiceClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase service access is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
  }
  validateSupabaseProject();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
