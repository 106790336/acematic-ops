/**
 * Genie API - Shared constants and base URL configuration
 *
 * All Genie public API endpoints share the same base URL.
 * Define it once here to avoid scattering the URL across files.
 *
 * Environment variable override: GENIE_API_BASE_URL
 * Default: https://genie.codebuddy.ai
 */

/** Genie platform base URL (no trailing slash). */
export const GENIE_API_BASE_URL =
  process.env.GENIE_API_BASE_URL || 'https://genie.codebuddy.ai';

/** OAuth Relay proxy endpoint. */
export const GENIE_OAUTH_RELAY_URL = `${GENIE_API_BASE_URL}/api/public/oauth`;
