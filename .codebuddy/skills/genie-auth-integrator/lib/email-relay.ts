/**
 * Email Relay - Backend endpoint for Supabase GoTrue Send Email Hook
 *
 * Receives email send requests from GoTrue (via GOTRUE_HOOK_SEND_EMAIL)
 * and forwards them to the Genie Email Relay API via auth-proxy.
 *
 * Auth-proxy automatically injects X-Email-Relay-Token and X-Runtime-Id,
 * so no credentials are needed in the sandbox application.
 *
 * GoTrue Hook Flow:
 * 1. User triggers auth action (signup, OTP, recovery, email_change)
 * 2. GoTrue calls this hook endpoint: POST /auth/email-hook
 *    Body: { user, email_data: { token, token_hash, redirect_to, site_url, ... } }
 * 3. This endpoint translates the request and forwards to auth-proxy:
 *    POST http://email-relay.auth-proxy.local/send
 *    Body: { to, type, vars: { token, token_hash, ... } }
 * 4. Auth-proxy injects auth headers and forwards to api-server
 * 5. Returns success to GoTrue so it proceeds with the auth flow.
 *
 * GoTrue env vars (configured in start-supabase.sh):
 *   GOTRUE_HOOK_SEND_EMAIL_ENABLED=true
 *   GOTRUE_HOOK_SEND_EMAIL_URI=http://host.docker.internal:5173/api/auth/email-hook
 *   (GoTrue → Vite dev server :5173 → proxy /api/* → Express :3000)
 */

import { Router, Request, Response, IRouter } from 'express';

// 邮件中继地址：通过 auth-proxy 转发，认证由平台自动处理
const EMAIL_RELAY_URL =
  process.env.EMAIL_RELAY_URL || 'http://email-relay.auth-proxy.local/send';

/**
 * Get the sandbox external preview base URL (port 5173).
 * Format: https://5173-{spaceKey}.e2b.{region}.{host}
 * Returns empty string in local dev (no rewriting needed).
 */
function getPreviewBaseUrl(): string {
  const key = process.env.X_IDE_SPACE_KEY;
  const region = process.env.X_IDE_SPACE_REGION;
  const host = process.env.X_IDE_SPACE_HOST;
  if (key && region && host) {
    return `https://5173-${key}.e2b.${region}.${host}`;
  }
  return '';
}

/**
 * Rewrite localhost:5173 URLs to sandbox preview URLs.
 * Both site_url and redirect_to are unified to use localhost:5173
 * (via Supabase API_EXTERNAL_URL=http://localhost:5173/supabase),
 * so a single replacement handles both.
 */
function rewriteUrl(url: string, previewBase: string): string {
  if (!url || !previewBase) return url;
  return url.replace(/https?:\/\/(localhost|127\.0\.0\.1):5173/g, previewBase);
}

const router: IRouter = Router();

/**
 * Map GoTrue email action types to our relay email types.
 * GoTrue sends various action types; we map them to our 4 supported types.
 */
const ACTION_TYPE_MAP: Record<string, string> = {
  signup: 'signup',
  confirmation: 'signup',
  magiclink: 'magiclink',
  magic_link: 'magiclink',
  recovery: 'recovery',
  invite: 'signup',
  email_change: 'email_change',
  email_change_current: 'email_change',
  email_change_new: 'email_change',
};

/**
 * POST /auth/email-hook
 *
 * Receives GoTrue Send Email Hook requests and forwards to Genie Email Relay
 * via auth-proxy. Returns 500 on failure to prevent GoTrue from creating
 * unverified users.
 *
 * GoTrue hook payload:
 * {
 *   user: { id, email, ... },
 *   email_data: {
 *     token: string,           // OTP code (e.g. "305805")
 *     token_hash: string,      // hashed token for verify URL
 *     redirect_to: string,     // where to redirect after verification
 *     site_url: string,        // Supabase external URL
 *     email_action_type: string // "signup" | "magiclink" | "recovery" | "email_change" | ...
 *   }
 * }
 */
router.post('/auth/email-hook', async (req: Request, res: Response) => {
  try {
    const { user, email_data } = req.body;

    if (!user?.email || !email_data) {
      console.error('[email-relay] Invalid hook payload:', JSON.stringify(req.body).slice(0, 200));
      res.status(400).json({ status: 'error', message: 'Invalid hook payload' });
      return;
    }

    // Map GoTrue action type to our relay type
    const actionType = email_data.email_action_type || '';
    const relayType = ACTION_TYPE_MAP[actionType] || 'signup';

    // In sandbox, rewrite localhost:5173 URLs to external preview URLs
    const previewBase = getPreviewBaseUrl();

    // Build relay request — must match api-server SendEmailRequest format
    const relayPayload = {
      to: user.email,
      type: relayType,
      vars: {
        token: email_data.token || '',
        token_hash: email_data.token_hash || '',
        redirect_to: rewriteUrl(email_data.redirect_to || '', previewBase),
        site_url: rewriteUrl(email_data.site_url || '', previewBase),
        token_new: email_data.token_new || '',
        token_hash_new: email_data.token_hash_new || '',
      },
    };

    console.log(`[email-relay] Forwarding ${relayType} email for ${user.email}`);

    // Forward to auth-proxy — no auth headers needed, auth-proxy injects them
    const relayResponse = await fetch(EMAIL_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(relayPayload),
    });

    if (!relayResponse.ok) {
      const errorText = await relayResponse.text();
      console.error(
        '[email-relay] Relay failed:',
        relayResponse.status,
        errorText.slice(0, 200),
      );
      res.status(500).json({ status: 'error', message: 'Failed to send email' });
      return;
    }

    console.log('[email-relay] Email sent via relay:', relayType, '→', user.email);

    // GoTrue expects a 200 response to proceed with the auth flow
    res.json({ success: true });
  } catch (error) {
    console.error('[email-relay] Unexpected error:', error);
    res.status(500).json({ status: 'error', message: 'Email service error' });
  }
});

export default router;
