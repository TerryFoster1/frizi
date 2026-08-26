import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const deleteEndpoint = readFileSync(new URL('../api/delete-account.ts', import.meta.url), 'utf8');

test('client logout and delete clear account-scoped browser state', () => {
  assert.match(appSource, /function clearClientAccountBrowserState\(\)/);
  assert.match(appSource, /localStorage\.removeItem\(clientSessionStorageKey\)/);
  assert.match(appSource, /localStorage\.removeItem\(pendingBookingStorageKey\)/);
  assert.match(appSource, /sessionStorage\.removeItem\(clientOAuthContextStorageKey\)/);
});

test('client delete account endpoint derives the user from the bearer token', () => {
  assert.match(deleteEndpoint, /supabase\.auth\.getUser\(accessToken\)/);
  assert.doesNotMatch(deleteEndpoint, /payload\.(userId|user_id|email|clientId|client_id)/);
  assert.match(deleteEndpoint, /auth\.admin\.deleteUser\(userResult\.user\.id, true\)/);
});

test('client signup and profile persistence stay client-scoped', () => {
  assert.match(appSource, /account_type:\s*'client'/);
  assert.match(appSource, /frizi_account_type:\s*'client'/);
  assert.match(appSource, /frizi_signup_origin:\s*'client'/);
  assert.match(appSource, /frizi_roles:\s*\['client'\]/);
  assert.match(appSource, /function readFriziAccountIntent\(user: SupabaseUser\)/);
  assert.match(appSource, /accountIntent && accountIntent !== 'client'/);
  assert.match(appSource, /existingProfile && existingProfile\.account_type !== 'client'/);
  assert.doesNotMatch(appSource, /\.upsert\([\s\S]*account_type:\s*'client'[\s\S]*onConflict:\s*'auth_user_id'/);
});
