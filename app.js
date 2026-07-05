import { createServer } from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import { initSocket } from "./config/socket.js";
import { clerkMiddleware } from "@clerk/express";
import { requireAuth } from "./middleware/requireAuth.js";

// RUTAS NUEVAS - CONTROL PRESUPUESTARIO
import sociosRoutes from "./view/sociosRoutes.js";
import synapseRoutes from "./view/synapseRoutes.js";
import soporteRoutes from "./view/soporteRoutes.js";
import workspaceRoutes from "./view/workspaceRoutes.js";
import adjuntosRoutes from "./view/adjuntosRoutes.js";
import adminRoutes from "./view/adminRoutes.js";
import proyectosRoutes from "./view/proyectosRoutes.js";
import costosFixosRoutes from "./view/costosFixosRoutes.js";
import costosVariablesRoutes from "./view/costosVariablesRoutes.js";
import serviciosRoutes from "./view/serviciosRoutes.js";
import configuracionRoutes from "./view/configuracionRoutes.js";
import catalogosRoutes from "./view/catalogosRoutes.js";
import retirosSociosRoutes from "./view/retirosSociosRoutes.js";
import finanzasRoutes from "./view/finanzasRoutes.js";
import inversionesRoutes from "./view/inversionesRoutes.js";
import CatalogosController from "./controller/CatalogosController.js";
import rateLimit from "express-rate-limit";

// RUTAS ANTIGUAS - innovaDent (mantener por ahora)
import productoRoute from "./view/productoRoutes.js";
import tituloRoutes from "./view/tituloRoutes.js";
import textosRoutes from "./view/textosRoutes.js";
import categoriaRoutes from "./view/categoriaRoutes.js";
import publicacionesRoutes from "./view/publicacionesRoutes.js";
import contactoRouter from "./view/contactoRoutes.js";
import mercadoPagoRouter from "./view/mercadoPagoRoutes.js";
import pedidosRoutes from "./view/pedidosRoutes.js";
import cuponesRoutes from "./view/cuponesRoutes.js";
import correosRoutes from "./view/correosRoutes.js";
import cloudflareRoutes from "./view/CloudflareRoutes.js";
import subCategoriasRoutes from "./view/subCategoriaRoutes.js";
import reservaPacienteRoutes from "./view/reservaPacienteRoutes.js";
import pacienteRoutes from "./view/pacientesRoutes.js";
import fichaRoutes from "./view/fichaRoutes.js";
import carruselPortadaRoutes from "./view/carruselPortadaRoutes.js";
import subSubCategoriaRoutes from "./view/subSubCategoriaRoutes.js";
import especificacionProductoRoutes from "./view/especificacionProductoRoutes.js";
import notificacionAgendamientoRoutes from "./view/notificacionAgendamientoRoutes.js";
import { ejecutarRecordatoriosAutomaticos } from "./services/notificacionPreviaDia.js";
import { ejecutarRecordatoriosCobro } from "./services/billingReminderService.js";
import { ejecutarRecordatorioF29 } from "./services/f29ReminderService.js";
import { ejecutarRecordatoriosCliente } from "./services/clientReminderService.js";
import calendarioRoutes from "./view/calendarioRoutes.js";
import { ejecutarRecordatoriosCalendario } from "./services/calendarioReminderService.js";


const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(rateLimit({
    windowMs: 60_000, // 1 minute
    max: 500 // Limit each IP to 500 requests per windowMs
}));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());
const ENABLE_REMINDERS_CRON = String(process.env.ENABLE_REMINDERS_CRON ?? "true").toLowerCase() === "true";

const RECORDATORIOS_MANUAL_KEY = process.env.RECORDATORIOS_MANUAL_KEY || "";
let recordatoriosEnEjecucion = false;
let ultimaEjecucionRecordatorios = null;

function estaAutorizadoRecordatorioManual(req) {
    // En producción siempre exige llave. En desarrollo se permite si no está configurada.
    if (process.env.NODE_ENV !== "production" && !RECORDATORIOS_MANUAL_KEY) {
        return true;
    }

    if (!RECORDATORIOS_MANUAL_KEY) return false;

    const providedKey = req.header("x-recordatorios-key") || req.query.key;
    return providedKey === RECORDATORIOS_MANUAL_KEY;
}

async function ejecutarRecordatoriosSeguro(source = "cron") {
    if (recordatoriosEnEjecucion) {
        return {
            ok: false,
            skipped: true,
            source,
            reason: "recordatorios_already_running",
            started_at: ultimaEjecucionRecordatorios
        };
    }

    recordatoriosEnEjecucion = true;
    ultimaEjecucionRecordatorios = new Date().toISOString();

    try {
        const resultado = await ejecutarRecordatoriosAutomaticos();
        return {
            ok: true,
            source,
            started_at: ultimaEjecucionRecordatorios,
            ...resultado
        };
    } catch (error) {
        return {
            ok: false,
            source,
            started_at: ultimaEjecucionRecordatorios,
            error: error?.message || "Error ejecutando recordatorios"
        };
    } finally {
        recordatoriosEnEjecucion = false;
    }
}


const allowedOrigins = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const isProduction = process.env.NODE_ENV === "production";

const corsConfig = {
    origin: (origin, callback) => {
        // Sin lista configurada: permisivo en desarrollo, bloqueante en producción.
        if (allowedOrigins.length === 0) {
            if (isProduction) return callback(new Error("CORS_ORIGINS no configurado en producción"));
            return callback(null, true);
        }
        // Permitir requests sin origin (curl, scripts internos, health checks).
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin no permitido por CORS"));
    },
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
};

app.use(cors(corsConfig));
app.use(clerkMiddleware());

app.get("/", (req, res) => { res.send("Backend Control Presupuestario - Running OK"); });

// ========================================
// RUTAS NUEVAS - CONTROL PRESUPUESTARIO (protegidas con Clerk JWT)
// ========================================
app.use("/api/socios", requireAuth, sociosRoutes);
app.use("/api/proyectos", requireAuth, proyectosRoutes);
app.use("/api/costos-fijos", requireAuth, costosFixosRoutes);
app.use("/api/costos-variables", requireAuth, costosVariablesRoutes);
app.use("/api/servicios", requireAuth, serviciosRoutes);
app.use("/api/config/financiera", requireAuth, configuracionRoutes);
app.use("/api/catalogos", requireAuth, catalogosRoutes);
app.use("/api/socios", requireAuth, retirosSociosRoutes);
app.use("/api/finanzas", requireAuth, finanzasRoutes);
app.use("/api/inversiones", requireAuth, inversionesRoutes);
app.use("/api/synapse",  requireAuth, synapseRoutes);
app.use("/api/soporte", requireAuth, soporteRoutes);
app.use("/api/workspace", requireAuth, workspaceRoutes);
app.use("/api/adjuntos", requireAuth, adjuntosRoutes);
app.use("/api/admin",      requireAuth, adminRoutes);
app.use("/api/calendario", requireAuth, calendarioRoutes);
// Rutas alternativas para tipos de costos variables (frontend costsService usa /api/tipos-costos)
app.get("/api/tipos-costos", requireAuth, CatalogosController.obtenerTiposCostosVariables);
app.post("/api/tipos-costos", requireAuth, CatalogosController.crearTipoCostoVariable);
app.delete("/api/tipos-costos/:id", requireAuth, CatalogosController.eliminarTipoCostoVariable);

// ========================================
// RUTAS ANTIGUAS - innovaDent (mantener por ahora)
// ========================================
app.use("/pedidos", pedidosRoutes);
app.use("/especificacionProducto", especificacionProductoRoutes);
app.use("/subsubcategorias", subSubCategoriaRoutes);
app.use("/carruselPortada", carruselPortadaRoutes);
app.use('/pacientes', pacienteRoutes);
app.use('/ficha', fichaRoutes);
app.use("/reservaPacientes", reservaPacienteRoutes);
app.use("/cloudflare", cloudflareRoutes);
app.use("/correo", correosRoutes);
app.use("/cupon", cuponesRoutes);
app.use("/pagosMercadoPago", mercadoPagoRouter);
app.use("/producto", productoRoute);
app.use("/titulo", tituloRoutes);
app.use("/textos", textosRoutes);
app.use("/categorias", categoriaRoutes);
app.use("/subcategorias", subCategoriasRoutes);
app.use("/publicaciones", publicacionesRoutes);
app.use('/contacto', contactoRouter );
app.use('/notificacion', notificacionAgendamientoRoutes);

// Ruta para ejecutar recordatorios manualmente (útil para testing)
app.get('/recordatorios/ejecutar', async (req, res) => {
    if (!estaAutorizadoRecordatorioManual(req)) {
        return res.status(403).json({
            ok: false,
            message: "No autorizado para ejecutar recordatorios manuales"
        });
    }

    try {
        const resultado = await ejecutarRecordatoriosSeguro("manual");
        if (resultado.skipped) {
            return res.status(409).json(resultado);
        }
        if (!resultado.ok) {
            return res.status(500).json(resultado);
        }
        return res.json(resultado);
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
});

// Manejador global de errores Express (debe ir después de todas las rutas)
// Captura cualquier error que llegue con next(error) o lanzado en middleware
app.use((err, req, res, _next) => {
    console.error('[Express Error Handler]', err);
    if (res.headersSent) return;
    res.status(err.status || 500).json({ message: err.message || 'Error interno del servidor' });
});

// Capturar errores no manejados para evitar que el proceso caiga silenciosamente
process.on('uncaughtException', (error) => {
    console.error('[FATAL] uncaughtException - el servidor seguirá corriendo:', error);
});
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] unhandledRejection - el servidor seguirá corriendo:', reason);
});

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);
initSocket(httpServer, allowedOrigins.length > 0 ? allowedOrigins : '*');

httpServer.listen(PORT, () => {
    console.log(`BACKEND CORRIENDO SIN PROBLEMAS EN --->  http://localhost:${PORT}`);

    if (!ENABLE_REMINDERS_CRON) {
        console.warn("[CRON] Recordatorios automáticos deshabilitados por ENABLE_REMINDERS_CRON=false");
        return;
    }

    // CRON JOB: Ejecutar recordatorios automáticos cada 5 minutos
    console.log("[CRON] Iniciando cron job de recordatorios (cada 5 minutos)...");
    const cronHandle = setInterval(() => {
        ejecutarRecordatoriosSeguro("cron").then((resultado) => {
            if (resultado.skipped) {
                console.warn("[CRON] Se omitió ejecución por proceso en curso.");
            } else if (!resultado.ok) {
                console.error("[CRON] Error en ejecución automática:", resultado.error);
            }
        }).catch((error) => {
            console.error("[CRON] Error inesperado en scheduler:", error?.message || error);
        });
    }, 5 * 60 * 1000); // 5 minutos en milisegundos

    if (typeof cronHandle.unref === "function") {
        cronHandle.unref();
    }

    // CRON BILLING: Recordatorios de cobro al equipo — cada 6 horas
    // Las columnas rem_* evitan duplicados por ciclo de facturación
    const billingHandle = setInterval(() => {
        ejecutarRecordatoriosCobro().catch((err) => {
            console.error('[BILLING] Error inesperado en cron:', err?.message || err);
        });
        ejecutarRecordatorioF29().catch((err) => {
            console.error('[F29] Error inesperado en cron:', err?.message || err);
        });
    }, 6 * 60 * 60 * 1000);

    if (typeof billingHandle.unref === "function") {
        billingHandle.unref();
    }

    // CRON CALENDARIO: Recordatorios de eventos — cada minuto
    const calendarioHandle = setInterval(() => {
        ejecutarRecordatoriosCalendario().catch((err) => {
            console.error('[CALENDARIO] Error inesperado en cron:', err?.message || err);
        });
    }, 5 * 60 * 1000); // 5 minutos (antes: 1 min — quemaba CPU)

    if (typeof calendarioHandle.unref === "function") {
        calendarioHandle.unref();
    }

    // CRON CLIENT: desactivado — los avisos al cliente se envían manualmente desde el cockpit

    // Ejecutar billing una vez al iniciar para no esperar 6 horas
    setTimeout(() => {
        ejecutarRecordatoriosCobro().catch((err) => {
            console.error('[BILLING] Error en primera ejecución:', err?.message || err);
        });
    }, 15000);

    // Ejecutar una vez al iniciar el servidor
    setTimeout(() => {
        console.log("[CRON] Ejecutando primera revisión de recordatorios...");
        ejecutarRecordatoriosSeguro("startup").then((resultado) => {
            if (!resultado.ok && !resultado.skipped) {
                console.error("[CRON] Error en primera ejecución:", resultado.error);
            }
        }).catch((error) => {
            console.error("[CRON] Error inesperado en primera ejecución:", error?.message || error);
        });
    }, 10000); // Esperar 10 segundos después de iniciar
});
