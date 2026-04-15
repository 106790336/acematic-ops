/**
 * OAuth Relay - Backend endpoint for OAuth callback handling
 *
 * Handles the OAuth code exchange flow via the Genie public relay proxy.
 * Frontend redirects user to the relay for OAuth authorization, then
 * sends the auth code to this endpoint for server-side exchange.
 *
 * Flow:
 * 1. Frontend redirects user to: GET https://genie.codebuddy.ai/api/public/oauth/authorize?provider=google&callback_url=...
 * 2. After OAuth, user redirected back to frontend with ?code=xxx&provider=google
 * 3. Frontend calls: POST /auth/oauth-callback { code, provider }
 * 4. This endpoint exchanges code for user info via relay proxy
 * 5. Creates/finds user in Supabase, generates session, returns tokens
 *
 * @example
 * ```typescript
 * // In backend app.ts or routes file
 * import oauthRelayRouter from './routes/oauth-relay.js';
 * // env.API_PREFIX defaults to '/api', full path: /api/auth/oauth-callback
 * app.use(env.API_PREFIX, oauthRelayRouter);
 * ```
 */

import { Router, Request, Response, IRouter } from 'express';
import { isAuthApiError } from '@supabase/supabase-js';
import { createAdminClient } from '../lib/supabase.js';
import { GENIE_OAUTH_RELAY_URL } from '../lib/genie-api.js';

const OAUTH_RELAY_URL =
  process.env.OAUTH_RELAY_URL || GENIE_OAUTH_RELAY_URL;

const router: IRouter = Router();

/**
 * POST /auth/oauth-callback
 *
 * Receives auth code from frontend, exchanges it via the relay proxy
 * for user info, then creates a Supabase session.
 *
 * Request body: { code: string, provider: string }
 * Response: { access_token, refresh_token, user: { id, email, name, avatar_url } }
 */
router.post('/auth/oauth-callback', async (req: Request, res: Response) => {
  try {
    const { code, provider } = req.body;

    // 1. Validate inputs
    if (!code || !provider) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required fields: code and provider',
      });
      return;
    }

    // 2. Exchange code for user info via relay proxy
    const exchangeResponse = await fetch(`${OAUTH_RELAY_URL}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, provider }),
    });

    if (!exchangeResponse.ok) {
      const errorText = await exchangeResponse.text();
      console.error('[oauth-relay] Exchange failed:', exchangeResponse.status, errorText);
      res.status(401).json({
        status: 'error',
        message: 'OAuth code exchange failed',
      });
      return;
    }

    const oauthResponse = (await exchangeResponse.json()) as {
      data?: { email?: string; name?: string; avatar_url?: string; provider?: string; provider_id?: string };
      email?: string; name?: string; avatar_url?: string; provider?: string; provider_id?: string;
    };
    // Relay may return { email, ... } or { data: { email, ... } }
    const oauthUser = oauthResponse.data || oauthResponse;

    if (!oauthUser.email) {
      console.error('[oauth-relay] No email in response:', JSON.stringify(oauthResponse));
      res.status(401).json({
        status: 'error',
        message: 'OAuth provider did not return an email address',
      });
      return;
    }

    // 3. Create or sign in user in Supabase
    const supabaseAdmin = createAdminClient();

    // Try to create user; if email already exists, createUser returns
    // an AuthApiError with code 'email_exists' — that's expected.
    const { error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: oauthUser.email,
        email_confirm: true,
        user_metadata: {
          name: oauthUser.name,
          avatar_url: oauthUser.avatar_url,
          provider: oauthUser.provider,
          provider_id: oauthUser.provider_id,
        },
      });

    // If createUser failed for a reason other than "email already exists", bail out
    if (createError && !(isAuthApiError(createError) && createError.code === 'email_exists')) {
      console.error('[oauth-relay] Failed to create user:', createError);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create user account',
      });
      return;
    }

    // 4. Generate session via admin.generateLink + verifyOtp.
    //    generateLink works for both new and existing users, and returns
    //    the user object (with id), so no separate lookup is needed.
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: oauthUser.email,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('[oauth-relay] Failed to generate link:', linkError);
      res.status(500).json({
        status: 'error',
        message: 'Failed to generate authentication session',
      });
      return;
    }

    // For existing users (email_exists), update OAuth metadata
    if (createError?.code === 'email_exists' && linkData.user) {
      await supabaseAdmin.auth.admin.updateUserById(linkData.user.id, {
        user_metadata: {
          name: oauthUser.name || linkData.user.user_metadata?.name,
          avatar_url: oauthUser.avatar_url || linkData.user.user_metadata?.avatar_url,
          provider: oauthUser.provider,
          provider_id: oauthUser.provider_id,
        },
      });
    }

    // Exchange the hashed token for a real session
    const { data: sessionData, error: verifyError } =
      await supabaseAdmin.auth.verifyOtp({
        token_hash: linkData.properties.hashed_token,
        type: 'magiclink',
      });

    if (verifyError || !sessionData.session) {
      console.error('[oauth-relay] Failed to verify OTP:', verifyError);
      res.status(500).json({
        status: 'error',
        message: 'Failed to create authentication session',
      });
      return;
    }

    // 5. Return session to frontend
    // Note: Local DB user sync (Prisma upsert) is NOT done here.
    // It happens lazily on the user's first protected API call via
    // the requireAuth middleware in auth-middleware.ts.
    res.json({
      status: 'success',
      data: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in,
        user: {
          id: sessionData.user?.id || linkData.user?.id,
          email: oauthUser.email,
          name: oauthUser.name,
          avatar_url: oauthUser.avatar_url,
        },
      },
    });
  } catch (error) {
    console.error('[oauth-relay] Unexpected error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during OAuth callback',
    });
  }
});

export default router;
