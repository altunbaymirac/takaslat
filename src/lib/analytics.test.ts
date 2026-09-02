import { beforeEach, describe, expect, it } from 'vitest';
import { getConsentPreferences, saveConsentPreferences } from './analytics';

const CONSENT_KEY = 'takaslat-cookie-consent-v1';

describe('cookie consent persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${CONSENT_KEY}=; Max-Age=0; Path=/`;
  });

  it('stores and restores accepted preferences', () => {
    saveConsentPreferences({ analytics: true, marketing: false });

    expect(getConsentPreferences()).toEqual({ analytics: true, marketing: false });
    expect(document.cookie).toContain(`${CONSENT_KEY}=`);
  });

  it('restores preferences from the cookie when local storage is empty', () => {
    saveConsentPreferences({ analytics: false, marketing: false });
    localStorage.clear();

    expect(getConsentPreferences()).toEqual({ analytics: false, marketing: false });
    expect(localStorage.getItem(CONSENT_KEY)).toBe(JSON.stringify({ analytics: false, marketing: false }));
  });
});
