---
name: genie-auth-integrator
description: Implement user authentication (email/password, OTP, OAuth via relay proxy) for web apps. Use this skill when the application needs login, signup, OAuth, session management, or protected routes. Triggers on requests for login, signup, sign-out, user accounts, OAuth, or access control. Powered by self-hosted Supabase Auth + OAuth Relay.
_meta_type: sdk
---

# Genie Auth Integration

Implement authentication using self-hosted Supabase Auth with OAuth Relay proxy support.

## Scenarios

- **Email/Password**: Sign up and sign in with email and password
- **Email OTP**: Passwordless login via 6-digit verification code
- **OAuth (Google/GitHub)**: Social login via Genie OAuth Relay proxy
- **Protected Routes**: Frontend route guards with `useAuthContext`
- **Protected APIs**: Backend JWT verification with `requireAuth` middleware
- **Session Management**: Automatic token refresh and persistence

**Not recommended for:**
- Frontend-only projects without a backend service
- Projects that don't need user authentication

## Prerequisites

**Required: Both frontend and backend services must exist.**

This SDK requires:
- Frontend: React app (for AuthContext and Supabase client)
- Backend: Express app (for JWT middleware and OAuth callback endpoint)

If backend is missing, inform user: "Auth integration requires a backend service for JWT verification and OAuth callback handling. Please initialize the project with a backend template first."

## Setup

### 0. Start Supabase

**Supabase does NOT start automatically with the sandbox.** You must start it before using auth features.

#### Run the startup script:

```bash
bash /opt/geniekit/scripts/start-supabase.sh
```

This script performs the following:
1. **Generates JWT keys** — Creates `jwt_secret`, `anon_key`, and `service_role_key` using official Supabase method (pure openssl)
2. **Writes .env file** — Saves keys and config to `/opt/geniekit/supabase_docker/.env`
3. **Exports environment variables** — Writes to shell configs (`/etc/bash.bashrc`, `/etc/zshenv`, `~/.zshrc`):
   - `SUPABASE_URL=http://localhost:8000`
   - `SUPABASE_ANON_KEY=<generated>`
   - `SUPABASE_SERVICE_ROLE_KEY=<generated>`
   - `VITE_SUPABASE_ANON_KEY=<generated>`
   - `DATABASE_URL=postgresql://postgres:<password>@localhost:5432/genie?schema=public`
4. **Configures database JWT** — Sets `app.settings.jwt_secret` on the supabase database
5. **Starts Docker containers** — `docker compose up -d` (Kong API gateway :8000, GoTrue auth :9999, PostgREST :3000)
6. **Health check** — Waits for `http://localhost:8000/auth/v1/health` to return 200 or 401

#### Load environment variables in current shell:

```bash
source /etc/zshenv
```

Or restart the terminal. New shell sessions load env vars automatically.

#### Verify Supabase is running:

```bash
curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/auth/v1/health
# Returns 200 or 401 = running OK
```

**Important notes:**
- PostgreSQL is already running on port 5432 (starts with the sandbox)
- The script waits for PostgreSQL to be ready before proceeding
- Re-running the script regenerates all keys (existing JWT tokens become invalid)
- Frontend and backend services must be restarted after running this script to pick up new env vars

### 1. Write .env Files

`start-supabase.sh` exports environment variables to shell configs (`/etc/zshenv` etc.), but **it does NOT write project `.env` files**. Backend reads `.env` via dotenv, and frontend reads via Vite — both need explicit `.env` files.

**Backend `.env`:**
```bash
source /etc/zshenv
cat > backend/.env << EOF
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
EOF
```

**Frontend `.env`:**
```bash
source /etc/zshenv
cat > frontend/.env << EOF
VITE_SUPABASE_URL=/supabase
VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
EOF
```

**CRITICAL:** The frontend `VITE_SUPABASE_URL` must be set to `/supabase` (the proxy path). The frontend supabase client will automatically prepend `window.location.origin` to build a full URL. Do NOT use `http://localhost:8000` — it won't work in the browser via the external sandbox URL.

### 2. Install Dependencies

**Frontend:**
```bash
cd frontend && npm install @supabase/supabase-js
```

**Backend:**
```bash
cd backend && npm install @supabase/supabase-js
```

### 3. Copy SDK Files

Read the following files from this skill's `lib/` directory and copy them to the project:

| Source (this skill) | Target (project) | Used by |
|---------------------|-------------------|---------|
| `lib/genie-api.ts` | `backend/src/lib/genie-api.ts` | Backend |
| `lib/supabase-client-frontend.ts` | `frontend/src/lib/supabase.ts` | Frontend |
| `lib/supabase-client-backend.ts` | `backend/src/lib/supabase.ts` | Backend |
| `lib/auth-context.tsx` | `frontend/src/contexts/AuthContext.tsx` | Frontend |
| `lib/auth-middleware.ts` | `backend/src/middleware/auth.middleware.ts` | Backend |
| `lib/oauth-relay.ts` | `backend/src/routes/oauth-relay.ts` | Backend |
| `lib/email-relay.ts` | `backend/src/routes/email-relay.ts` | Backend |

**CRITICAL: Frontend and backend use DIFFERENT supabase client files.**
- Frontend version uses `import.meta.env` (Vite) and `window.location.origin` for URL construction.
- Backend version uses `process.env` (Node.js) and includes `createAdminClient()`.
- Do NOT use a single "universal" file — it causes TypeScript compilation errors (`process` is not defined in frontend Vite builds).

### 4. Vite Proxy for Supabase

Check if `/supabase` proxy rule already exists in `frontend/vite.config.ts`. If not, add it to the `server.proxy` section:

```typescript
'/supabase': {
  target: 'http://localhost:8000',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/supabase/, ''),
},
```

**Note:** The project template may already include this proxy rule. Only add it if it's missing.

### 5. Wrap App with AuthProvider and Route Guards

In `frontend/src/App.tsx`:

```typescript
import { AuthProvider, ProtectedRoute, GuestRoute } from '@/contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public: accessible to everyone */}
          <Route path="/" element={<Home />} />

          {/* Protected: redirect to /login if not authenticated */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Guest-only: redirect to / if already authenticated */}
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

**CRITICAL:** Always wrap login/register routes with `<GuestRoute>`. Without it, users who click the email verification link will land on `/register` with a valid session but see no UI change — because the page doesn't check auth state. `GuestRoute` automatically redirects authenticated users to `/`.

**Note:** Not all pages need route guards. Use `ProtectedRoute` only on pages that require authentication (e.g., `/dashboard`, `/settings`, `/profile`). Public pages like the home page can remain unwrapped.

### 6. Register OAuth Relay Router

In `backend/src/app.ts` (or main Express file), mount with the API prefix:

```typescript
import oauthRelayRouter from './routes/oauth-relay.js';

// env.API_PREFIX defaults to '/api', so the full path becomes /api/auth/oauth-callback
app.use(env.API_PREFIX, oauthRelayRouter);
```

### 7. Register Email Relay Router

In `backend/src/app.ts`, mount the email relay hook endpoint. GoTrue calls this endpoint when sending emails (signup, OTP, recovery, etc.).

**CRITICAL:** GoTrue's hook URI is configured as `http://host.docker.internal:5173/api/auth/email-hook`. This request goes through the Vite dev server proxy (`/api` → `localhost:3000`), so the backend receives it at `/api/auth/email-hook`. You **MUST** mount the email relay router with the API prefix to match this path:

```typescript
import emailRelayRouter from './routes/email-relay.js';

// Mount with API prefix — GoTrue calls via Vite proxy at /api/auth/email-hook
app.use(env.API_PREFIX, emailRelayRouter);
```

**Why not mount without prefix?** GoTrue inside Docker cannot reach the Express backend directly on port 3000. It calls `host.docker.internal:5173` (the Vite dev server), which proxies `/api/*` to Express. So the email hook arrives at Express as `/api/auth/email-hook`, not `/auth/email-hook`.

The email relay forwards requests through the sandbox auth-proxy (`email-relay.auth-proxy.local`), which automatically handles authentication. No additional environment variables are needed.

To override the default email relay URL, set `EMAIL_RELAY_URL` in `backend/.env`.

### 8. Database Schema

Add User model to `backend/prisma/schema.prisma`:

```prisma
model User {
  id        String   @id           // Matches Supabase user.id (UUID)
  email     String   @unique
  name      String
  avatarUrl String?  @map("avatar_url")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt     @map("updated_at")

  // Add your relations here, e.g.:
  // todos Todo[]

  @@map("users")
}
```

Then run migration:
```bash
cd backend && npx prisma db push
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | `http://localhost:8000` | Supabase API URL (backend) |
| `SUPABASE_ANON_KEY` | (generated) | Public anon key (backend) |
| `SUPABASE_SERVICE_ROLE_KEY` | (generated) | Admin key, bypasses RLS (backend) |
| `DATABASE_URL` | `postgresql://postgres:<password>@localhost:5432/genie?schema=public` | Prisma database connection string (auto-exported) |
| `VITE_SUPABASE_URL` | `/supabase` | Supabase API URL (frontend, relative path proxied by Vite) |
| `VITE_SUPABASE_ANON_KEY` | (generated) | Public anon key (frontend) |
| `GENIE_API_BASE_URL` | `https://genie.codebuddy.ai` | Genie platform base URL (used by OAuth relay) |
| `OAUTH_RELAY_URL` | `https://genie.codebuddy.ai/api/public/oauth` | OAuth Relay proxy base URL |
| `EMAIL_RELAY_URL` | `http://email-relay.auth-proxy.local/send` | Email Relay endpoint (via auth-proxy) |

## Architecture Overview

```
Frontend (React + Supabase SDK)          Backend (Express + JWT)
├── Email/Password (Supabase SDK)        ├── requireAuth middleware (JWT verify)
├── Email OTP (Supabase SDK)             ├── POST /api/auth/oauth-callback (OAuth relay)
├── OAuth → redirect to relay proxy      ├── POST /api/auth/email-hook (GoTrue hook → Email relay, via Vite proxy)
├── AuthContext (global user state)       ├── Auto-sync user to local DB
└── Session management                   └── Protected API routes
```

### Key Principles

1. **Email/Password and OTP**: Handled by Supabase SDK on frontend. GoTrue triggers the Send Email Hook via the Vite dev server proxy (→ Express backend), which forwards to the Genie Email Relay via auth-proxy for actual SMTP delivery.
2. **OAuth**: Goes through the Genie OAuth Relay proxy (`genie.codebuddy.ai/api/public/oauth/*`). Backend exchanges the auth code for user info.
3. **Backend role**: Verify JWT tokens via `requireAuth` middleware + handle OAuth callback + relay emails via GoTrue hook.
4. **Single source of truth**: Supabase manages all user sessions and auth state.
5. **Zero-config email**: Email relay is handled entirely by the platform via auth-proxy, no secrets needed in the sandbox app.

## OAuth Relay Flow

OAuth authentication uses the Genie public relay proxy instead of direct Supabase OAuth:

```
1. Frontend checks if running inside an iframe (window.self !== window.top):
   - NOT in iframe → window.location.href redirect (standard flow)
   - IN iframe → window.open() popup (avoids X-Frame-Options restrictions)
     Callback URL includes ?mode=popup to signal popup mode.
     (Relay preserves all query params in callback_url when redirecting back.)

   GET https://genie.codebuddy.ai/api/public/oauth/authorize
     ?provider=google
     &callback_url=https://xxx:5173/auth/callback[?mode=popup]

2. User authorizes on Google/GitHub

3. Relay redirects back to frontend (or popup window):
   https://xxx:5173/auth/callback?code=AUTH_CODE&provider=google[&mode=popup]

4. Frontend (or popup) sends code to backend:
   POST /api/auth/oauth-callback { code: "AUTH_CODE", provider: "google" }

5. Backend exchanges code via relay:
   POST https://genie.codebuddy.ai/api/public/oauth/exchange
   Body: { code: "AUTH_CODE", provider: "google" }
   Response: { email, name, avatar_url, provider, provider_id }

6. Backend creates/finds user in Supabase, generates session,
   returns { access_token, refresh_token, user } to frontend

7. Frontend stores session:
   - Normal mode: supabase.auth.setSession() directly
   - Popup mode: send tokens to parent via postMessage, parent calls setSession(), popup closes
```

## Email Relay Flow

Email sending (signup confirmation, OTP, password recovery) uses the Genie Email Relay via GoTrue's Send Email Hook:

```
1. User triggers auth action (signup, OTP, recovery, email_change)
   → Supabase SDK call from frontend

2. GoTrue processes the request and triggers the Send Email Hook:
   POST http://host.docker.internal:5173/api/auth/email-hook
   (Vite proxies /api/* → Express on port 3000, so Express receives /api/auth/email-hook)
   Body: { user: { email }, email_data: { token, token_hash, redirect_to, site_url, email_action_type } }

3. Sandbox backend (email-relay.ts) translates and forwards:
   POST http://email-relay.auth-proxy.local/send
   Body: { to, type, vars: { token, token_hash, redirect_to, site_url } }

4. Auth-proxy handles authentication and forwards to api-server:
   POST https://genie.codebuddy.ai/api/public/auth-proxy/email/send

5. API server renders branded HTML template and sends via SMTP

6. User receives email with OTP code + verification link
```

**Important**: GoTrue's `GOTRUE_MAILER_AUTOCONFIRM` is set to `false`. Email confirmation is required for signup. The OTP code and verification link are delivered via the Email Relay.

## Quick Start

### Email/Password Sign Up (with OTP Verification)

Signup requires email verification. After calling `signUp`, the user receives a 6-digit OTP code via email **and a verification link**. You should:
1. Provide a UI for the user to enter the OTP code manually, OR
2. The user can click the verification link in the email — `AuthContext` automatically detects the URL hash tokens and establishes the session.

**Email verification link handling**: When the user clicks the verification link, Supabase redirects back to the app with `access_token` and `refresh_token` in the URL hash (e.g., `/register#access_token=xxx&refresh_token=yyy`). The `AuthProvider` component automatically detects these hash tokens on mount, calls `supabase.auth.setSession()`, and cleans up the URL. The `onAuthStateChange` listener then updates the UI to reflect the logged-in state. **No additional code is needed** — just ensure `AuthProvider` wraps your app.

```typescript
// Frontend
import { supabase } from '@/lib/supabase';

// Step 1: Register — user is created but unverified
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
  options: { data: { name: 'John' } }
});
// If error, signup failed (e.g. email relay down → user NOT created)
// If success, show OTP input UI

// Step 2: User enters the 6-digit code from the verification email
const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
  email: 'user@example.com',
  token: '305805',   // 6-digit code from email
  type: 'email'
});
// If success, user is verified and logged in
```

### Email/Password Sign In

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword'
});
```

### Email OTP

```typescript
// Step 1: Send code
await supabase.auth.signInWithOtp({ email: 'user@example.com' });

// Step 2: Verify code
const { data, error } = await supabase.auth.verifyOtp({
  email: 'user@example.com',
  token: '123456',
  type: 'email'
});
```

### OAuth (via Relay Proxy)

**iframe compatibility:** The app may run inside an iframe (e.g. sandbox preview). Use `window.self !== window.top` to detect iframe. If in iframe, use `window.open()` popup instead of redirect, and append `?mode=popup` to callback URL. The callback page checks `mode=popup` param to decide whether to use `postMessage` + `window.close()` (popup) or `setSession()` + `navigate()` (normal).

```typescript
// Frontend: trigger OAuth login
const isInIframe = window.self !== window.top;
const callbackUrl = isInIframe
  ? `${window.location.origin}/auth/callback?mode=popup`
  : `${window.location.origin}/auth/callback`;
const oauthUrl = `https://genie.codebuddy.ai/api/public/oauth/authorize?provider=google&callback_url=${encodeURIComponent(callbackUrl)}`;

if (!isInIframe) {
  window.location.href = oauthUrl; // direct redirect
} else {
  const popup = window.open(oauthUrl, 'oauth_popup', 'width=500,height=600');
  // Listen for postMessage { type: 'oauth_callback', access_token, refresh_token }
  // Then call supabase.auth.setSession({ access_token, refresh_token })
}

// Frontend: /auth/callback page
const code = params.get('code');
const isPopup = params.get('mode') === 'popup';
const { data } = await fetch('/api/auth/oauth-callback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, provider }) }).then(r => r.json());

if (isPopup && window.opener) {
  window.opener.postMessage({ type: 'oauth_callback', access_token: data.access_token, refresh_token: data.refresh_token }, origin);
  window.close();
} else {
  await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  navigate('/dashboard');
}
```

### Route Guards (Frontend)

`ProtectedRoute` and `GuestRoute` are exported from `AuthContext.tsx` — just import and use:

```typescript
import { ProtectedRoute, GuestRoute } from '@/contexts/AuthContext';

// In App.tsx routes:
<Route path="/" element={<Home />} />                                           {/* Public */}
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /> {/* Auth required */}
<Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />             {/* Guest only */}
<Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />       {/* Guest only */}
```

### Protected API (Backend)

```typescript
import { requireAuth } from '../middleware/auth.middleware.js';

router.use(requireAuth);

router.get('/todos', async (req, res) => {
  const todos = await prisma.todo.findMany({
    where: { userId: req.user!.id }
  });
  res.json({ status: 'success', data: todos });
});
```

### Sign Out

```typescript
// Via AuthContext (recommended)
const { signOut } = useAuthContext();
await signOut();

// Or directly via Supabase client
await supabase.auth.signOut();
```

## Auth Methods Reference

| Method | Frontend Code | Backend Needed? |
|--------|---------------|-----------------|
| Email Sign Up | `supabase.auth.signUp({ email, password })` | No |
| Email Sign In | `supabase.auth.signInWithPassword({ email, password })` | No |
| Send OTP | `supabase.auth.signInWithOtp({ email })` | No |
| Verify OTP | `supabase.auth.verifyOtp({ email, token, type: 'email' })` | No |
| OAuth (Google/GitHub) | Redirect to relay proxy URL | Yes (`POST /auth/oauth-callback`) |
| Sign Out | `useAuthContext().signOut()` or `supabase.auth.signOut()` | No |
| Get Session | `supabase.auth.getSession()` | No |
| Get User | `supabase.auth.getUser(token)` | Used in middleware |

## Security Best Practices

1. **`SUPABASE_SERVICE_ROLE_KEY` 严禁暴露给前端** — 该密钥可绕过 RLS（Row Level Security），拥有数据库完全访问权限。绝不能在前端代码、`VITE_` 前缀环境变量、或任何客户端可访问的位置使用。仅限后端 `process.env` 读取。
2. **Never commit `.env` files** — Add to `.gitignore`
3. **Backend only verifies JWT** — No backend auth routes for email/password/OTP
4. **OAuth codes are single-use** — The relay exchange endpoint only accepts each code once
5. **Session tokens expire** — Supabase auto-refreshes tokens via the SDK
6. **Environment variable safety** — `start-supabase.sh` 导出的变量中，只有 `VITE_SUPABASE_ANON_KEY` 带 `VITE_` 前缀（会被 Vite 打包到前端）。`SUPABASE_SERVICE_ROLE_KEY` 无 `VITE_` 前缀，不会泄露到前端 bundle

## Troubleshooting

### Supabase Not Running

**Symptom:** Connection refused on `localhost:8000`

**Solution:**
```bash
bash /opt/geniekit/scripts/start-supabase.sh
source /etc/zshenv
```

### Environment Variables Not Set

**Symptom:** `SUPABASE_ANON_KEY` is empty, auth operations fail

**Solution:** After running `start-supabase.sh`, reload env vars:
```bash
source /etc/zshenv
```
Then restart frontend/backend dev servers.

### OAuth Callback Returns Error

**Symptom:** `POST /auth/oauth-callback` returns 401

**Possible causes:**
- Auth code already used (codes are single-use)
- Auth code expired (try the OAuth flow again)
- `OAUTH_RELAY_URL` env var incorrect

### JWT Token Invalid

**Symptom:** Backend returns 401 on API calls

**Possible causes:**
- Supabase was restarted with new keys (old tokens are invalid)
- Token expired and wasn't refreshed (check frontend Supabase client config)
- `SUPABASE_SERVICE_ROLE_KEY` doesn't match current Supabase instance

### User Not Created in Database

**Symptom:** `req.user` is undefined in protected routes

**Possible causes:**
- Prisma User model doesn't match expected schema (run `npx prisma db push`)
- `requireAuth` middleware not applied to the route
- Database connection issue

## Resources

- **SDK Files**: `lib/genie-api.ts`, `lib/supabase-client-frontend.ts`, `lib/supabase-client-backend.ts`, `lib/auth-context.tsx`, `lib/auth-middleware.ts`, `lib/oauth-relay.ts`, `lib/email-relay.ts`
- **Supabase Startup**: `/opt/geniekit/scripts/start-supabase.sh`
- **OAuth Relay Flow**: See `docs/oauth-relay-flow.puml`
