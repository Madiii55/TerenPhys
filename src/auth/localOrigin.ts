/** Keep a single local origin so PKCE and sessions survive numeric loopback links. */
export function canonicalLocalUrl(value: string): string | null {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (url.hostname !== '127.0.0.1' && url.hostname !== '[::1]') return null;
  url.hostname = 'localhost';
  return url.href;
}
/** Never follow continue/redirect parameters supplied by an email link. */
export function emailReturnUrl(currentUrl: string, publicSiteUrl?: string, action: 'callback' | 'confirm' | 'reset-password' = 'callback'): string {
  const url = new URL(publicSiteUrl || currentUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('Адрес сайта для писем должен использовать HTTPS.');
  if (url.username || url.password) throw new Error('Некорректный адрес сайта для писем.');
  if (local) url.hostname = 'localhost';
  url.pathname = '/auth/' + action; url.search = ''; url.hash = '';
  return url.href;
}

/** OAuth PKCE must return to the initiating origin, even when mail uses a public production URL. */
export function oauthReturnUrl(currentUrl: string): string {
  return emailReturnUrl(currentUrl, undefined, 'callback');
}
