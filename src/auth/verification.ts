/** Use the server's user record, never editable metadata or a cached JWT alone. */
export function isVerifiedAccount(user: { email?: string | null; email_confirmed_at?: string | null; is_anonymous?: boolean } | null): boolean {
  return !!user?.email && typeof user.email_confirmed_at === 'string'
    && user.email_confirmed_at.length > 0 && user.is_anonymous !== true;
}

export async function readVerifiedSession<U extends { id: string; email?: string; email_confirmed_at?: string; is_anonymous?: boolean }, P>(
  cached: U,
  dependencies: { reload: (account: U) => Promise<U>; profile: (account: U) => Promise<P> },
): Promise<{ status: 'pending'; email: string } | { status: 'verified'; account: U; profile: P }> {
  const fresh = await dependencies.reload(cached);
  if (fresh.id !== cached.id) throw new Error('Account changed while checking the session');
  if (!isVerifiedAccount(fresh)) return { status: 'pending', email: fresh.email || '' };
  return { status: 'verified', account: fresh, profile: await dependencies.profile(fresh) };
}

export class InvalidAuthLink extends Error {}
export function capturedAuthLink(value: string): string | null {
  const url = new URL(value);
  const hash = new URLSearchParams(url.hash.slice(1));
  return url.pathname.startsWith('/auth/')
    || ['mode', 'code', 'token_hash', 'error', 'error_code'].some(key => url.searchParams.has(key))
    || ['access_token', 'error', 'error_code'].some(key => hash.has(key)) ? url.href : null;
}
export function authCallbackKind(url: URL): 'email' | 'recovery' | 'oauth' {
  const type = url.searchParams.get('type') || new URLSearchParams(url.hash.slice(1)).get('type');
  return type === 'recovery' || url.pathname === '/auth/reset-password' ? 'recovery'
    : type === 'email' || type === 'signup' || url.pathname === '/auth/confirm' ? 'email' : 'oauth';
}
export type AuthCallback = { kind: 'email' | 'recovery' | 'oauth' } & (
  | { method: 'otp'; tokenHash: string; type: 'email' | 'signup' | 'recovery' }
  | { method: 'code'; code: string }
  | { method: 'tokens'; accessToken: string; refreshToken: string }
);
export function authCallbackFromLink(value: string, expectedOrigin: string): AuthCallback {
  let url: URL;
  try { url = new URL(value); } catch { throw new InvalidAuthLink('Некорректная ссылка. Запросите новое письмо.'); }
  if (url.origin !== expectedOrigin || url.username || url.password
    || !['http:', 'https:'].includes(url.protocol)) {
    throw new InvalidAuthLink('Эта ссылка относится к другому адресу сайта.');
  }
  const hash = new URLSearchParams(url.hash.slice(1));
  const type = url.searchParams.get('type') || hash.get('type');
  const kind = authCallbackKind(url);
  if (url.searchParams.has('error') || hash.has('error')) {
    if (kind === 'oauth') throw new InvalidAuthLink('Вход через Google отменён или ссылка устарела. Попробуйте войти ещё раз.');
    if (kind === 'recovery') throw new InvalidAuthLink('Ссылка сброса пароля истекла или уже использована. Запросите новую ссылку.');
    throw new InvalidAuthLink('Ссылка истекла, уже использована или вход был отменён. Запросите новое письмо.');
  }
  if (type && !['email', 'signup', 'recovery'].includes(type)) throw new InvalidAuthLink('Неизвестное действие в ссылке.');
  const tokenHash = url.searchParams.get('token_hash'), code = url.searchParams.get('code');
  const accessToken = hash.get('access_token'), refreshToken = hash.get('refresh_token');
  const count = Number(!!tokenHash) + Number(!!code) + Number(!!accessToken || !!refreshToken);
  const valid = (s: string | null, max = 2048): s is string => !!s && s.length <= max && !/\s/.test(s);
  if (count !== 1) throw new InvalidAuthLink('В ссылке нет действительного кода. Запросите новое письмо.');
  if (tokenHash && valid(tokenHash) && type) return { kind, method: 'otp', tokenHash, type: type as 'email' | 'signup' | 'recovery' };
  if (code && valid(code)) return { kind, method: 'code', code };
  if (valid(accessToken, 16384) && valid(refreshToken)) return { kind, method: 'tokens', accessToken, refreshToken };
  throw new InvalidAuthLink('Некорректный код в ссылке. Запросите новое письмо.');
}
export function verificationError(error: unknown, action?: 'email' | 'recovery' | 'oauth'): string {
  if (error instanceof InvalidAuthLink) return error.message;
  switch ((error as { code?: string })?.code) {
    case 'otp_expired':
      if (action === 'recovery') return 'Ссылка сброса пароля истекла или уже использована. Запросите новую ссылку.';
      return 'Ссылка истекла или уже использована. Запросите новое письмо.';
    case 'flow_state_not_found':
    case 'bad_code_verifier':
    case 'flow_state_expired':
    case 'bad_oauth_state':
      if (action === 'recovery') return 'Откройте письмо в браузере, где запросили сброс пароля. Если это невозможно, запросите новую ссылку в этом браузере.';
      if (action === 'oauth') return 'Вход через Google не завершён. Попробуйте ещё раз в этом браузере.';
      return 'Откройте ссылку в браузере, где начали регистрацию или сброс пароля. Если почта уже подтверждена, войдите по почте и паролю.';
    case 'email_not_confirmed': return 'Подтвердите почту, чтобы войти в аккаунт.';
    case 'invalid_credentials': return 'Неверная почта или пароль.';
    case 'email_address_invalid': return 'Введите корректный адрес электронной почты.';
    case 'weak_password': return 'Используйте более надёжный пароль — не менее 8 символов.';
    case 'reauthentication_needed':
    case 'reauthentication_not_valid': return 'Откройте новую ссылку сброса пароля из письма.';
    case 'user_already_exists':
    case 'email_exists': return 'Аккаунт с этой почтой уже существует. Попробуйте войти.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return 'Слишком много запросов. Подождите и попробуйте снова.';
    case 'email_address_not_authorized': return 'Отправка писем посетителям пока не настроена. Администратору нужно подключить SMTP в Supabase.';
    case 'provider_disabled': return 'Этот способ входа пока не настроен. Используйте почту или обратитесь к администратору.';
    default: return 'Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.';
  }
}
