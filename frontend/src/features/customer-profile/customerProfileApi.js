import { apiClient } from '../../shared/api/apiClient.js';
import { ApiError } from '../../shared/api/ApiError.js';

// GDP01: the authenticated Customer's own record, allergens and consents
// (Sprint 2 Table 1: "manage their own optional consents").
export const customerProfileApi = Object.freeze({
  /** GET /customers/me — 404 while the profile is not completed. */
  getMine: (token, { signal } = {}) =>
    apiClient.get('/customers/me', { accessToken: token, signal }),

  /** POST /customers/me — first external sign-in: the phone number is missing. */
  completeMine: (token, phoneNumber) =>
    apiClient.post('/customers/me', {
      accessToken: token,
      body: { phoneNumber },
    }),

  /** PUT /customers/me — name and phone number (the e-mail is the account's). */
  updateMine: (token, { name, phoneNumber }) =>
    apiClient.put('/customers/me', {
      accessToken: token,
      body: { name, phoneNumber },
    }),

  /** PUT /customers/me/allergens — explicit consent (GDPR Art. 9(2)(a)). */
  updateAllergens: (token, { healthDataConsent, allergenIds }) =>
    apiClient.put('/customers/me/allergens', {
      accessToken: token,
      body: { healthDataConsent, allergenIds },
    }),

  /** PUT /auth/me/marketing-consent — give or withdraw (GDPR Art. 7(3)). */
  updateMarketingConsent: (token, marketingConsent) =>
    apiClient.put('/auth/me/marketing-consent', {
      accessToken: token,
      body: { marketingConsent },
    }),

  /** GET /allergens — public BCK04 catalogue (14 allergens). */
  listAllergens: ({ signal } = {}) =>
    apiClient.get('/allergens', { skipAuthFailureHandler: true, signal }),

  /**
   * AA02 clarification: after a Google sign-in, true when the account still has
   * to provide its phone number. Any other answer (403 for staff without the
   * Customer role, network errors) never blocks the sign-in.
   */
  async needsCompletion(token) {
    if (!token) return false;
    try {
      await apiClient.get('/customers/me', {
        accessToken: token,
        skipAuthFailureHandler: true,
      });
      return false;
    } catch (error) {
      return error instanceof ApiError && error.status === 404;
    }
  },
});