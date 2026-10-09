import { useEffect, useState } from 'react';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const RECOVERY_KEY = 'terenphys.recovery-state';
const cooldownEvent = 'terenphys:email-cooldown';
const recoveryLifetime = 30 * 60 * 1000;
export type RecoveryState = { userId: string; sessionId: string; expiresAt: number };

function browserStorage(): BrowserStorage | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}

/** Read a session identifier, not an authorization claim. getUser must verify the JWT separately. */
export function sessionIdentifier(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.session_id === 'string' && payload.session_id.length > 0 ? payload.session_id : null;
  } catch { return null; }
}

export function rememberRecovery(userId: string, sessionId: string, storage = browserStorage(), now = Date.now()): RecoveryState {
  const state = { userId, sessionId, expiresAt: now + recoveryLifetime };
  try { storage?.setItem(RECOVERY_KEY, JSON.stringify(state)); } catch { /* The in-memory state still works. */ }
  return state;
}

export function restoredRecovery(storage = browserStorage(), now = Date.now()): RecoveryState | null {
  try {
    const state = JSON.parse(storage?.getItem(RECOVERY_KEY) || 'null');
    if (typeof state?.userId === 'string' && typeof state.sessionId === 'string'
      && Number.isFinite(state.expiresAt) && state.expiresAt > now && state.expiresAt <= now + recoveryLifetime) return state;
  } catch { /* Missing, unavailable or malformed storage. */ }
  return null;
}

export function clearRecovery(storage = browserStorage()): void {
  try { storage?.removeItem(RECOVERY_KEY); } catch { /* Optional UI persistence. */ }
}

/** This marker only resumes the UI; it cannot grant Supabase permissions or replace server verification. */
export function matchesRecovery(state: RecoveryState | null, userId: string, sessionId: string | null, now = Date.now()): boolean {
  return !!state && !!sessionId && state.userId === userId && state.sessionId === sessionId && state.expiresAt > now;
}

function cooldownKey(email: string, action: 'signup' | 'recovery'): string {
  return 'terenphys.email-cooldown.' + action + '.' + encodeURIComponent(email.trim().toLowerCase());
}
export function emailCooldown(email: string, action: 'signup' | 'recovery', storage = browserStorage(), now = Date.now()): number {
  try {
    const deadline = Number(storage?.getItem(cooldownKey(email, action)));
    return Number.isFinite(deadline) && deadline > now ? Math.min(3600, Math.ceil((deadline - now) / 1000)) : 0;
  } catch { return 0; }
}
export function rememberEmailSend(email: string, action: 'signup' | 'recovery', seconds = 60, storage = browserStorage(), now = Date.now()): void {
  try { storage?.setItem(cooldownKey(email, action), String(now + seconds * 1000)); } catch { /* Server limits still apply. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new window.Event(cooldownEvent));
}
export function useEmailCooldown(email: string, action: 'signup' | 'recovery'): number {
  const [remaining, setRemaining] = useState(() => emailCooldown(email, action));
  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => {
      window.clearTimeout(timer);
      const seconds = emailCooldown(email, action);
      setRemaining(seconds);
      if (seconds > 0) timer = window.setTimeout(refresh, 1000);
    };
    refresh();
    window.addEventListener(cooldownEvent, refresh);
    return () => { window.clearTimeout(timer); window.removeEventListener(cooldownEvent, refresh); };
  }, [email, action]);
  return remaining;
}
