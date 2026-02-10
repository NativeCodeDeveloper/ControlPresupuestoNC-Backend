// CloudflareController.js
// Subida de imágenes a Cloudflare Images (API v1)
// Requiere Node 18+ (fetch, FormData, Blob)

const CF_API = "https://api.cloudflare.com/client/v4";

export default class CloudflareController {
    constructor(){

    }

    //  Usas buildDeliveryUrl SOLO cuando ya existe una imagen en Cloudflare
    // y necesitas la URL para MOSTRARLA o GUARDARLA.
    static buildDeliveryUrl({ accountHash, imageId, variantName }) {
        return `https://imagedelivery.net/${accountHash}/${imageId}/${variantName}`;
    }

    /**
     * POST /api/cloudflare/images
     * Requiere middleware tipo multer: upload.single('image') (en memoria)
     * Body opcional: { variantName?: string, requireSignedURLs?: boolean, metadata?: object }
     */
    static async uploadImage(req, res) {
        try {

            const API_TOKEN_CLOUDFLARE = process.env.API_TOKEN_CLOUDFLARE;
            const ACCOUNT_ID = process.env.ACCOUNT_ID;
            const ACCOUNT_HASH = process.env.ACCOUNT_HASH;


            if (!API_TOKEN_CLOUDFLARE || !ACCOUNT_ID || !ACCOUNT_HASH) {
                return res.status(500).json({
                    message: "sinenv"
                });
            }

            if (!req.file) {
                return res.status(400).json({message: "sinimagen"});
            }

            console.log(req.file);

            const variantName = req.body?.variantName || "public";

            // Cloudflare Images requiere multipart/form-data
            const form = new FormData();

            // Adjuntar archivo (multer memoryStorage -> req.file.buffer)
            const blob = new Blob([req.file.buffer], { type: req.file.mimetype || "application/octet-stream" });
            form.append("file", blob, req.file.originalname || "upload");

            // Opcional: metadata (debe ir como JSON string)
            if (req.body?.metadata) {

                try {
                    const metadataObj = typeof req.body.metadata === "string"
                        ? JSON.parse(req.body.metadata)
                        : req.body.metadata;
                    form.append("metadata", JSON.stringify(metadataObj));
                } catch {
                    return res.status(400).json({ ok: false, error: "metadata debe ser JSON válido" });
                }

            }


            // Llamada a Cloudflare
            const url = `${CF_API}/accounts/${ACCOUNT_ID}/images/v1`;
            const cfRes = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${API_TOKEN_CLOUDFLARE}`,
                    // NO setear Content-Type acá; fetch lo pone con el boundary
                },
                body: form,
            });

            let data;
            try {
                data = await cfRes.json();
            } catch (e) {
                const rawText = await cfRes.text().catch(() => "");
                return res.status(cfRes.status || 500).json({
                    ok: false,
                    error: "Cloudflare no devolvió JSON válido",
                    details: {
                        status: cfRes.status,
                        rawText,
                    },
                });
            }

            // Cloudflare normalmente responde con { success, errors, messages, result }
            if (!cfRes.ok || data?.success === false) {
                return res.status(cfRes.status || 500).json({
                    ok: false,
                    error: "Cloudflare upload falló",
                    details: data,
                });
            }

            const imageId = data?.result?.id;
            if (!imageId) {
                return res.status(502).json({
                    ok: false,
                    error: "Cloudflare respondió OK pero no entregó result.id",
                    details: data,
                });
            }

            const deliveryUrl = CloudflareController.buildDeliveryUrl({
                accountHash: ACCOUNT_HASH,
                imageId,
                variantName,
            });

            console.log("[CloudflareController.uploadImage] Respuesta al frontend:", {
                ok: true,
                imageId,
                deliveryUrl,
                variants: data?.result?.variants || [],
                raw: data?.result,
            });

            return res.json({
                ok: true,
                imageId,
                deliveryUrl,
                variants: data?.result?.variants || [],
                raw: data?.result,
            });



        } catch (err) {
            return res.status(500).json({
                ok: false,
                error: "Error interno subiendo a Cloudflare",
                details: err?.message || String(err),
            });
        }
    }

    /**
     * POST /api/cloudflare/images/direct-upload
     * Genera una URL de subida directa (one-time) para que el frontend suba sin pasar el archivo por tu backend.
     * Útil si quieres que tu backend actúe como "intermediario" y el frontend suba directo a Cloudflare.
     * Body opcional: { expirySeconds?: number, requireSignedURLs?: boolean, metadata?: object }
     */
    static async createDirectUploadUrl(req, res) {
        try {
            const {
                API_TOKEN_CLOUDFLARE,
                ACCOUNT_ID,
            } = process.env;

            if (!API_TOKEN_CLOUDFLARE || !ACCOUNT_ID) {
                return res.status(500).json({
                    ok: false,
                    error: "Faltan variables .env: API_TOKEN_CLOUDFLARE, ACCOUNT_ID",
                });
            }

            const expirySeconds = Number(req.body?.expirySeconds || 600); // 10 min

            const payload = {
                expiry: new Date(Date.now() + expirySeconds * 1000).toISOString(),
            };

            if (req.body?.requireSignedURLs !== undefined) {
                const v = req.body.requireSignedURLs;
                payload.requireSignedURLs = v === true || v === "true" || v === "1";
            }

            if (req.body?.metadata) {
                payload.metadata = typeof req.body.metadata === "string"
                    ? JSON.parse(req.body.metadata)
                    : req.body.metadata;
            }

            const url = `${CF_API}/accounts/${ACCOUNT_ID}/images/v2/direct_upload`;
            const cfRes = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${API_TOKEN_CLOUDFLARE}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await cfRes.json();

            if (!cfRes.ok || data?.success === false) {
                return res.status(cfRes.status || 500).json({
                    ok: false,
                    error: "No se pudo crear direct_upload",
                    details: data,
                });
            }

            // data.result.uploadURL -> URL a la que el frontend sube el archivo
            // data.result.id -> image_id
            return res.json({
                ok: true,
                imageId: data?.result?.id,
                uploadURL: data?.result?.uploadURL,
                raw: data?.result,
            });
        } catch (err) {
            return res.status(500).json({
                ok: false,
                error: "Error interno creando direct_upload",
                details: err?.message || String(err),
            });
        }
    }

}
