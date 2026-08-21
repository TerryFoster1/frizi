import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const canonicalSupabaseProjectRef = 'rdddcpuvgpaztrgovdnz';

export function getSupabaseProjectRef(url = supabaseUrl) {
  const match = String(url || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
  return match?.[1] || '';
}

export function validateSupabaseConfig() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }

  if (/localhost|127\.0\.0\.1|hairline|demo/i.test(supabaseUrl)) {
    throw new Error('Frizi Supabase URL points to a local or demo backend.');
  }

  const projectRef = getSupabaseProjectRef();
  if (projectRef !== canonicalSupabaseProjectRef) {
    throw new Error(`Frizi Supabase project mismatch. Expected ${canonicalSupabaseProjectRef}.`);
  }

  return { projectRef };
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey && getSupabaseProjectRef() === canonicalSupabaseProjectRef);

export function createClient() {
  validateSupabaseConfig();

  return createBrowserClient(supabaseUrl, supabaseKey);
}
