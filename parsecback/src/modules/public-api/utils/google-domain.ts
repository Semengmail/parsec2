// src/modules/public-api/utils/google-domain.ts
import {
  GOOGLE_DOMAIN_ID,
  GOOGLE_ID_DOMAIN,
} from '../constants/google-domains';

export function normalizeGoogleDomain(
  input?: string,
  inputId?: number,
): {
  domain: string | null;
  domainId: number | null;
} {
  // приоритет: явный id
  if (Number.isInteger(inputId) && inputId! in GOOGLE_ID_DOMAIN) {
    const code = GOOGLE_ID_DOMAIN[inputId!];
    return { domain: code, domainId: inputId! };
  }

  if (typeof input === 'string') {
    const s = input.trim().toLowerCase();

    // если пришло числом в строке — трактуем как id
    if (/^\d+$/.test(s)) {
      const id = Number(s);
      const code = GOOGLE_ID_DOMAIN[id];
      return code
        ? { domain: code, domainId: id }
        : { domain: null, domainId: null };
    }

    // иначе — это код домена
    const id = GOOGLE_DOMAIN_ID[s];
    return typeof id === 'number'
      ? { domain: s, domainId: id }
      : { domain: null, domainId: null };
  }

  return { domain: null, domainId: null };
}
