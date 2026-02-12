import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// RUTAS NUEVAS - CONTROL PRESUPUESTARIO
import sociosRoutes from "./view/sociosRoutes.js";
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


const app = express();
app.use(express.json());
app.use(cookieParser());


const corsConfig = {
    origin: true,           // refleja el origin de la petición (permite cualquier origen)
    credentials: true,      // permite envío de cookies; poner false si no quieres cookies
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization']
};

app.use(cors(corsConfig));

app.get("/", (req, res) => { res.send("Backend Control Presupuestario - Running OK"); });

// ========================================
// RUTAS NUEVAS - CONTROL PRESUPUESTARIO
// ========================================
app.use("/api/socios", sociosRoutes);
app.use("/api/proyectos", proyectosRoutes);
app.use("/api/costos-fijos", costosFixosRoutes);
app.use("/api/costos-variables", costosVariablesRoutes);
app.use("/api/servicios", serviciosRoutes);
app.use("/api/config/financiera", configuracionRoutes);
app.use("/api/catalogos", catalogosRoutes);
app.use("/api/socios", retirosSociosRoutes);
app.use("/api/finanzas", finanzasRoutes);
app.use("/api/inversiones", inversionesRoutes);
// Rutas alternativas para tipos de costos variables (frontend costsService usa /api/tipos-costos)
app.get("/api/tipos-costos", CatalogosController.obtenerTiposCostosVariables);
app.post("/api/tipos-costos", CatalogosController.crearTipoCostoVariable);
app.delete("/api/tipos-costos/:id", CatalogosController.eliminarTipoCostoVariable);

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
    try {
        const resultado = await ejecutarRecordatoriosAutomaticos();
        res.json({ ok: true, ...resultado });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`BACKEND CORRIENDO SIN PROBLEMAS EN --->  http://localhost:${PORT}`);

    // CRON JOB: Ejecutar recordatorios automáticos cada 5 minutos
    console.log("[CRON] Iniciando cron job de recordatorios (cada 5 minutos)...");
    setInterval(async () => {
        await ejecutarRecordatoriosAutomaticos();
    }, 5 * 60 * 1000); // 5 minutos en milisegundos

    // Ejecutar una vez al iniciar el servidor
    setTimeout(async () => {
        console.log("[CRON] Ejecutando primera revisión de recordatorios...");
        await ejecutarRecordatoriosAutomaticos();
    }, 10000); // Esperar 10 segundos después de iniciar
})
