/**
 * Auth Middleware - Express JWT verification + automatic user sync
 *
 * Verifies Supabase JWT tokens from the Authorization header and
 * automatically creates/updates the user in the local database.
 *
 * @example
 * ```typescript
 * import { requireAuth } from '../middleware/auth.middleware.js';
 *
 * // Protect all routes in a router
 * router.use(requireAuth);
 *
 * // Or protect a single route
 * router.get('/profile', requireAuth, (req, res) => {
 *   res.json({ user: req.user });
 * });
 *
 * // Access user info in protected routes
 * router.get('/todos', requireAuth, async (req, res) => {
 *   const todos = await prisma.todo.findMany({
 *     where: { userId: req.user!.id }
 *   });
 *   res.json(todos);
 * });
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { createAdminClient } from '../lib/supabase.js';
import { prisma } from '../config/database.js';

// --- Extend Express Request type ---
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        avatarUrl?: string;
      };
    }
  }
}

// Admin client for JWT verification (lazy-initialized to avoid
// empty SUPABASE_SERVICE_ROLE_KEY at module import time)
let _supabaseAdmin: ReturnType<typeof createAdminClient> | null = null;

function getAdminClient() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createAdminClient();
  }
  return _supabaseAdmin;
}

/**
 * Express middleware that requires a valid Supabase JWT token.
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Verify token with Supabase (getUser)
 * 3. Upsert user in local database (auto-sync)
 * 4. Attach user info to req.user
 *
 * Returns 401 if token is missing, invalid, or expired.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Extract token
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        status: 'error',
        message: 'No authorization token provided',
      });
      return;
    }

    const token = authHeader.slice(7); // Remove 'Bearer '

    // 2. Verify JWT with Supabase
    const {
      data: { user },
      error,
    } = await getAdminClient().auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token',
      });
      return;
    }

    // 3. Auto-sync user to local database (upsert)
    const name =
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User';

    const avatarUrl = user.user_metadata?.avatar_url || null;

    const localUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email!,
        name,
        ...(avatarUrl && { avatarUrl }),
      },
      create: {
        id: user.id,
        email: user.email!,
        name,
        avatarUrl,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    // 4. Attach user to request
    req.user = {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name,
      avatarUrl: localUser.avatarUrl ?? undefined,
    };

    next();
  } catch (error) {
    console.error('[auth-middleware] Authentication error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Authentication failed',
    });
  }
}
