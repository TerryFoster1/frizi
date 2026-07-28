/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createSupabaseClient, isSupabaseConfigured } from './_supabase.mjs';

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed' });
  }

  if (!isSupabaseConfigured()) {
    return sendJson(response, 501, {
      configured: false,
      error: 'Supabase is not configured.',
      requiredEnv: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'],
    });
  }

  try {
    const supabase = createSupabaseClient();
    const { error } = await supabase.auth.getSession();
    if (error) {
      return sendJson(response, 502, { configured: true, reachable: false, error: error.message });
    }
    return sendJson(response, 200, { configured: true, reachable: true });
  } catch (error) {
    return sendJson(response, 500, {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : 'Supabase health check failed.',
    });
  }
}
