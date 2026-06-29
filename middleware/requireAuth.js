import { requireAuth as clerkRequireAuth } from '@clerk/express';

/**
 * Middleware que verifica el JWT de Clerk en el header Authorization.
 * Adjunta auth.userId a req.auth si el token es válido.
 * Rechaza con 401 si falta o es inválido.
 */
export const requireAuth = clerkRequireAuth();
