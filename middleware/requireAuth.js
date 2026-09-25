import { getAuth } from '@clerk/express';

// Bypass de autenticación para desarrollo local.
//
// Requiere DOS condiciones simultáneas: no estar en producción y tener
// AUTH_DISABLED=true en el entorno. El servidor corre con NODE_ENV=production
// (fijado en ecosystem.config.cjs) y sin esa variable, y los .env no se
// versionan, así que desplegar este archivo no puede abrir la API por accidente.
//
// Para usarlo en local: AUTH_DISABLED=true en control-back/.env
const authDeshabilitada =
    process.env.NODE_ENV !== 'production' && process.env.AUTH_DISABLED === 'true';

export const requireAuth = (req, res, next) => {
    if (authDeshabilitada) return next();

    const { userId } = getAuth(req);
    if (!userId) {
        return res.status(401).json({ message: 'No autorizado' });
    }
    next();
};
