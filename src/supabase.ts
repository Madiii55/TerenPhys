import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/database.ts';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
if (!supabaseUrl || !publishableKey?.startsWith('sb_publishable_')) {
  throw new Error('Настройте публичный адрес и publishable key Supabase в окружении сборки.');
}
export const supabase = createClient<Database>(supabaseUrl, publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Callback parameters are captured, scrubbed and processed by our own page.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

export async function googleProviderEnabled(): Promise<boolean> {
  const response = await fetch(supabaseUrl + '/auth/v1/settings', { headers: { apikey: publishableKey }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Auth settings unavailable');
  const settings = await response.json();
  return settings.external?.google === true;
}

export function avatarUrl(path: string | null | undefined, version?: string): string | undefined {
  if (!path || !/^[0-9a-f-]{36}\/profile\.jpg$/i.test(path)) return undefined;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl + (version ? '?v=' + encodeURIComponent(version) : '');
}
