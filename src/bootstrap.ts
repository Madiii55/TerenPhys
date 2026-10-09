import { canonicalLocalUrl } from './auth/localOrigin.ts';

const canonical = canonicalLocalUrl(window.location.href);
if (canonical) window.location.replace(canonical);
else void import('./main.tsx');
