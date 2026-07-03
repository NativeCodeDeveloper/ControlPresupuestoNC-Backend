import dotenv from 'dotenv';
import crypto from 'crypto';
import mercadopago, * as mpNamed from 'mercadopago';
import MercadoPago from '../model/MercadoPago.js';
import PedidoComprasController from "../controller/PedidoComprasController.js";
import PedidoCompras from "../model/PedidoCompras.js";
import PedidoDetalle from "../model/PedidoDetalle.js";
import Pacientes from "../model/Pacientes.js";

dotenv.config();

const BACKEND = process.env.BACKEND_URL;


//SE DEFINE LA FUNCION CREATE ORDER ESTA FUNCION PERMITE CREAR LA ORDEN DE PAGO
export const createOrder = async (req, res) => {
    try {
        const {productosDelCarrito = [], comprador = {},} = req.body;

        if (!Array.isArray(productosDelCarrito) || productosDelCarrito.length === 0) {
            return res.status(400).json({ error: 'No se recibieron productos en el carrito' });
        }



        // Normalizamos los items para Mercado Pago
        const items = productosDelCarrito.map((p, index) => ({
            title: p.tituloProducto ?? p.titulo ?? p.nombre ?? `Producto ${index + 1}`,
            unit_price: Number(p.precio ?? 0),
            quantity: Number(p.cantidad ?? 1),
        }));

        const totalPedido = items.reduce(
            (acc, item) => acc + (Number(item.unit_price) * Number(item.quantity)),
            0
        );

        const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
        if (!ACCESS_TOKEN) {
            return res.status(500).json({ error: 'No hay access token configurado en el servidor' });
        }



        // Preparar el objeto 'preference' usando los items y metadata
        const preference = {
            items,
            back_urls: {
                success: `${BACKEND}/pagosMercadoPago/success`,
                failure: `${BACKEND}/pagosMercadoPago/failure`,
                pending: `${BACKEND}/pagosMercadoPago/pending`,
            },
            metadata: {

            },
            auto_return: "approved",
            notification_url: `${BACKEND}/pagosMercadoPago/notificacionPago`,
        };


        //resultBody: donde se va a guardar la respuesta correcta de Mercado Pago.
        let resultBody;

        const client = new mpNamed.MercadoPagoConfig({ accessToken: ACCESS_TOKEN });
        const prefClient = new mpNamed.Preference(client);

        const resp = await prefClient.create({ body: preference });
        resultBody = resp;

        if (!resultBody) {
            console.error('No se pudo crear la preferencia. Detalles');
            return res.status(500).json({ error: 'Error al crear la orden de pago' });

        } else {

            const nombre_comprador = comprador.nombre_comprador;
            const apellidosComprador = comprador.apellidosComprador;
            const telefono_comprador = comprador.telefono_comprador;
            const email_Comprador = comprador.email_Comprador;
            const identificacion_comprador = comprador.identificacion_comprador;
            const direccion_despacho = comprador.direccion_despacho;
            const comuna = comprador.comuna;
            const regionPais = comprador.regionPais;
            const comentarios = comprador.comentarios;
            const totalPagado = comprador.totalPagado ?? totalPedido;
            const preference_id = resultBody.id;

            let id_pedido;

            try {
                const fecha_pedido = new Date().toISOString().slice(0, 19).replace('T', ' ');
                const pedidoComprasModel = new PedidoCompras();
                const resultadoInsert = await pedidoComprasModel.insertarPedidoCompra(fecha_pedido, nombre_comprador, apellidosComprador, telefono_comprador, email_Comprador, identificacion_comprador, direccion_despacho, comuna, regionPais, comentarios, totalPagado, preference_id);



                if (resultadoInsert.affectedRows > 0) {
                    id_pedido = resultadoInsert.insertId;

                    for (const producto of productosDelCarrito) {
                        const id_producto = producto.id_producto;
                        const tituloProducto = producto.tituloProducto;
                        const cantidad = producto.cantidad;
                        const precio_unitario = producto.precio; // o precio_unitario si así viene realmente

                        const pedidoDetalleObjeto = new PedidoDetalle();
                        await pedidoDetalleObjeto.insertarPedidoDetalle(
                            id_pedido,
                            id_producto,
                            tituloProducto,
                            cantidad,
                            precio_unitario
                        );
                    }
                }

                return res.status(200).json({id: resultBody.id, init_point: resultBody.init_point, sandbox_init_point: resultBody.sandbox_init_point,});

            } catch (insertErr) {
                console.error('Error insertando pedido desde createOrder:', insertErr);
                // Aunque falle la inserción, devolvemos la preferencia para que el flujo de pago no se bloquee.
                return res.status(200).json({id: resultBody.id, init_point: resultBody.init_point, sandbox_init_point: resultBody.sandbox_init_point, insert_error: true});
            }

        }

    } catch (error) {
        console.error('Error creando preferencia:', error);
        const message = error?.response?.body || error.message || 'Error al crear la orden de pago';
        return res.status(500).json({ error: 'Error al crear la orden de pago', details: message });
    }
};


/*
INFORMACIÓN RECIBIDA DESDE EL WEEBHOOK

Webhook:
→ Es un “mensaje automático” que un servicio externo envía a tu servidor cuando ocurre un evento.
→ Es una notificación en tiempo real.
→ Cuando ocurre un evento, ese servicio (Mercado Pago, Stripe, Clerk, GitHub, etc.)
→ Te manda un POST a esa URL automáticamente.
→ Tú respondes 200 OK rápido para que no lo reenvíen.
→ Tu backend recibe un body con información en el maso de mercado pago:

{
  action: "payment.updated",
  api_version: "v1",
  data: {"id":"123456"},
  date_created: "2021-11-01T02:02:02Z",
  id: "123456",
  live_mode: false,
  type: "payment",
  user_id: 2964661140
                       }

IMPORTANTE
1. paymentId = body.data.id, que es el ID del pago en Mercado Pago.
2. Igual de devuelve un status 200 para que Mercado Pago no re-intente el webhook como loco.
3. Con se consulta a la API de mercado pago por la transacción realizada Si va bien, payment es un objeto gigantesco con toda la info del pago.


 * */


export const recibirPago = async (req, res) => {
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    const WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;
    const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA;

    if (!ACCESS_TOKEN) {
        return res.status(500).json({ error: 'No hay access token configurado en el servidor' });
    }

    // Verificar firma HMAC-SHA256 de MercadoPago (solo si el secret está configurado)
    if (WEBHOOK_SECRET) {
        const xSignature = req.headers['x-signature'];
        const xRequestId = req.headers['x-request-id'];
        const dataId = req.query?.['data.id'] || req.body?.data?.id || '';

        if (!xSignature) {
            return res.status(401).json({ error: 'Firma de webhook ausente' });
        }

        const signatureParts = xSignature.split(',').reduce((acc, part) => {
            const [k, v] = part.trim().split('=');
            if (k && v) acc[k] = v;
            return acc;
        }, {});

        const ts = signatureParts['ts'];
        const v1 = signatureParts['v1'];
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
        const expectedSignature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(v1 || ''), Buffer.from(expectedSignature))) {
            console.warn('[MP Webhook] Firma inválida — posible request falsificado');
            return res.status(401).json({ error: 'Firma de webhook inválida' });
        }
    }

    const body = req.body;

/*

* */

    try {
        // 1) CASO PAYMENT (como ya lo tenías)
        if (body.type === 'payment' || body.topic === 'payment') {
            const paymentId = body.data && body.data.id;
            if (!paymentId) {
                console.error('No viene data.id en webhook de payment');
                return res.status(200).json({ received: true, lookup_error: true });
            }

            const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
            const resp = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });

            const payment = await resp.json();

            // Aquí podrías usar payment.order.id o payment.external_reference, etc.
            // TODO: actualizar pedido según payment

            return res.status(200).json({ received: true });
        }

        // 2) CASO MERCHANT_ORDER
        if (body.topic === 'merchant_order' && body.resource) {
            // SEGURIDAD: extraer solo el ID numérico del resource para evitar SSRF.
            // body.resource llega como "https://api.mercadopago.com/merchant_orders/12345"
            const resourceMatch = String(body.resource).match(/\/merchant_orders\/(\d+)/);
            if (!resourceMatch) {
                console.error('merchant_order resource con formato inesperado:', body.resource);
                return res.status(200).json({ received: true, lookup_error: true });
            }
            const merchantOrderId = resourceMatch[1];
            const merchantOrderUrl = `https://api.mercadopago.com/merchant_orders/${merchantOrderId}`;

            const resp = await fetch(merchantOrderUrl, {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!resp.ok) {
                const txt = await resp.text();
                console.error('Error consultando merchant_order:', resp.status, txt);
                return res.status(200).json({ received: true, lookup_error: true });
            }

            const merchantOrder = await resp.json();

            const preferenceId = merchantOrder.preference_id;
            const payments = merchantOrder.payments || [];
            const pagoAprobado = payments.some(p => p.status === 'approved');
            const preference_id = merchantOrder.preference_id;

            // Ejemplo de log rápido

            // 👉 AQUÍ VA TU LÓGICA DE NEGOCIO
            // Buscar el pedido en MySQL por preference_id y actualizar el estado.

            //SE DEBE CONSIDERAR SI O SI EL ESTADO DE PAGO A APROVED PARA PRODUCCION

            try{

                const instanciaPedidoCompra = new PedidoCompras();
                const resultadoQuery = await instanciaPedidoCompra.cambiarEstadoaPagado(preference_id)

                if(resultadoQuery.affectedRows > 0){



                    // --- Buscar datos del pedido y sus productos para enviar comprobante ---
                    try {
                        // buscar el pedido por preference_id
                        const pedidos = await instanciaPedidoCompra.buscarPreferenceID_mercadoPago(preference_id);
                        const pedido = Array.isArray(pedidos) && pedidos.length > 0 ? pedidos[0] : null;

                        if (pedido) {
                            // obtener detalles del pedido e insertar paciente en data
                            const instanciaPacientes = new Pacientes();
                            const instanciaPedidoDetalle = new PedidoDetalle();
                            const productos = await instanciaPedidoDetalle.seleccionarPedidosDetallePorID(pedido.id_pedido) || [];



                                let nombre = pedido.nombre_comprador ;
                                let apellido = pedido.apellidosComprador ;
                                let rut = pedido.identificacion_comprador ;
                                let nacimiento = null;
                                let sexo = '---' ;
                                let prevision_id = 0;
                                let telefono = pedido.telefono_comprador ?? pedido.telefono ?? 'NO INGRESADO';
                                let correo = pedido.email_Comprador ?? pedido.email_Comprador ?? pedido.correo ?? 'NO INGRESADO';
                                let direccion = '---';
                                let pais = '---';


                            const insertarPacienteQuePago = await instanciaPacientes.insertPacientemp(
                                nombre,
                                apellido,
                                rut,
                                nacimiento,
                                sexo,
                                prevision_id,
                                telefono,
                                correo,
                                direccion,
                                pais
                            );

                            if (insertarPacienteQuePago.affectedRows > 0) {
                            }else{
                            }


                            const cliente = {
                                nombre: pedido.nombre_comprador,
                                email: pedido.email_Comprador,
                                telefono: pedido.telefono_comprador,
                            };

                            // seleccionar payment aprobado del merchantOrder (si está disponible en el scope)
                            const pagoAprobadoObj = (merchantOrder && merchantOrder.payments)
                                ? merchantOrder.payments.find(p => p.status === 'approved') || merchantOrder.payments[0]
                                : null;

                            const venta = {
                                id: pedido.id_pedido,
                                codigo: pedido.id_pedido,
                                total: pedido.totalPagado || pedido.totalPagado,
                                fecha: pedido.fecha_pedido,
                                medioPago: 'Mercado Pago',
                                preference_id: preference_id,
                                merchant_order_id: merchantOrder ? merchantOrder.id : undefined,
                                pago: pagoAprobadoObj ? {
                                    id: pagoAprobadoObj.id,
                                    status: pagoAprobadoObj.status,
                                    transaction_amount: pagoAprobadoObj.transaction_amount,
                                    payment_method_id: pagoAprobadoObj.payment_method_id,
                                    payment_type_id: pagoAprobadoObj.payment_type_id,
                                    installments: pagoAprobadoObj.installments,
                                    status_detail: pagoAprobadoObj.status_detail
                                } : null
                            };

                            // Llamamos a la función que envía el comprobante por correo
                            await enviarComprobanteCompraInterno({ cliente, venta, productos, pago: pagoAprobadoObj, merchantOrder });

                            // Enviar notificación al dueño con datos completos del cliente y compra
                            await enviarNotificacionCompraDueno({
                                cliente: {
                                    nombre: pedido.nombre_comprador,
                                    apellidos: pedido.apellidosComprador,
                                    email: pedido.email_Comprador,
                                    telefono: pedido.telefono_comprador,
                                    identificacion: pedido.identificacion_comprador,
                                    direccion: pedido.direccion_despacho,
                                    comuna: pedido.comuna,
                                    region: pedido.regionPais,
                                    comentarios: pedido.comentarios
                                },
                                venta,
                                productos,
                                pago: pagoAprobadoObj
                            });
                        } else {
                            console.warn('No se encontró pedido para preference_id al enviar comprobante:', preference_id);
                        }
                    } catch (errComprobante) {
                        console.error('Error al intentar enviar comprobante tras webhook:', errComprobante);
                        // No interrumpimos el flujo del webhook: respondemos 200 igualmente.
                    }

                    return res.status(200).json({ received: true });

                }else{

                    return res.status(200).json({ received: true });

                }

            }catch(error){
                return console.error('Error al validar preference_id:', error);
            }



            return res.status(200).json({ received: true });
        }

        // 3) CUALQUIER OTRO TIPO
        return res.status(200).json({ received: true, ignored: true });

    } catch (err) {
        console.error('Error en recibirPago:', err);
        return res.status(500).json({ error: 'Error interno al procesar webhook' });
    }
};




async function enviarComprobanteCompraInterno({ cliente, venta, productos }) {
    const apiKey = process.env.BREVO_API_KEY;
    const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA;
    if (!apiKey) {
        console.error("Falta BREVO_API_KEY en .env");
        return;
    }

    // Normalizar productos: usar campos que vienen de la DB (tituloProducto, precio_unitario)
    const filasProductos = productos.map((p) => {
        const titulo = p.tituloProducto || p.nombre || p.titulo || `Producto ${p.id_producto || ''}`;
        const precio = Number(p.precio_unitario ?? p.precio ?? p.precioUnitario ?? 0);
        const cantidad = Number(p.cantidad ?? 1);
        const subtotal = cantidad * precio;
        return `
            <tr>
                <td>${titulo}</td>
                <td style="text-align:center;">${cantidad}</td>
                <td style="text-align:right;">$${precio.toLocaleString('es-CL')}</td>
                <td style="text-align:right;">$${subtotal.toLocaleString('es-CL')}</td>
            </tr>
        `;
    }).join("");

    const totalTexto = Number(venta.total ?? 0).toLocaleString('es-CL');

    // Información de pago si viene
    const pago = venta.pago || null;

    const detallesPagoHTML = pago ? `
        <h3>Detalles de pago</h3>
        <p>
            <strong>ID pago:</strong> ${pago.id || '-'}<br/>
            <strong>Estado:</strong> ${pago.status || '-'}<br/>
            <strong>Monto:</strong> $${Number(pago.transaction_amount ?? 0).toLocaleString('es-CL')} CLP<br/>
            <strong>Método:</strong> ${pago.payment_method_id || pago.payment_type_id || '-'}<br/>
            <strong>Cuotas:</strong> ${pago.installments ?? '-'}<br/>
            <strong>Detalle:</strong> ${pago.status_detail || '-'}
        </p>
    ` : '';

    const merchantOrderLine = venta.merchant_order_id ? `<p><strong>Merchant Order ID:</strong> ${venta.merchant_order_id}</p>` : '';
    const nombreEmpresa = process.env.NOMBRE_EMPRESA;

    try {
        const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sender: {
                    name: NOMBRE_EMPRESA,
                    email: "contacto@nativecode.cl",
                },
                to: [
                    { email: cliente.email, name: cliente.nombre },
                    { email: "contacto@nativecode.cl", name: "NativeCode" },
                ],
                replyTo: {
                    email: "contacto@nativecode.cl",
                    name: NOMBRE_EMPRESA,
                },
                subject: `Comprobante de compra #${venta.codigo || venta.id || ""}`,
                htmlContent: `
                    <h2>Gracias por tu compra, ${cliente.nombre}</h2>
                    <p>Este es el comprobante de tu compra realizada en <strong>${NOMBRE_EMPRESA}</strong>.</p>

                    <h3>Datos de la compra</h3>
                    <p><strong>Código de pedido:</strong> ${venta.codigo || "-"}<br/>
                    <strong>Método de pago:</strong> ${venta.medioPago || "Mercado Pago"}<br/>
                    <strong>Fecha:</strong> ${venta.fecha || new Date().toLocaleString('es-CL')}</p>
                    ${merchantOrderLine}

                    ${detallesPagoHTML}

                    <h3>Detalle de productos</h3>
                    <table width="100%" border="1" cellspacing="0" cellpadding="8" style="border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th align="left">Producto</th>
                                <th>Cant.</th>
                                <th align="right">Precio</th>
                                <th align="right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasProductos}
                        </tbody>
                    </table>

                    <h3 style="text-align:right; margin-top:16px;">
                        Total pagado: $${totalTexto} CLP
                    </h3>

                    <p>Ante cualquier duda sobre tu compra, puedes contactarnos atravez de nuestros canales de contacto.</p>
                `,
            }),
        });

        const data = await resp.json();
        if (!resp.ok) {
            console.error("Error Brevo comprobante:", data);
        } else {
        }
    } catch (err) {
        console.error("Error enviando comprobante (Brevo):", err);
    }
}


// NUEVA FUNCIÓN PARA ENVIAR NOTIFICACIÓN AL DUEÑO DE LA TIENDA
async function enviarNotificacionCompraDueno({ cliente, venta, productos }) {
    const apiKey = process.env.BREVO_API_KEY;
    const CORREO_RECEPTOR = process.env.CORREO_RECEPTOR;
    const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA;

    if (!apiKey) {
        console.error("Falta BREVO_API_KEY en .env");
        return;
    }

    if (!CORREO_RECEPTOR) {
        console.error("Falta CORREO_RECEPTOR en .env");
        return;
    }

    // Normalizar productos: usar campos que vienen de la DB (tituloProducto, precio_unitario)
    const filasProductos = productos.map((p) => {
        const titulo = p.tituloProducto || p.nombre || p.titulo || `Producto ${p.id_producto || ''}`;
        const precio = Number(p.precio_unitario ?? p.precio ?? p.precioUnitario ?? 0);
        const cantidad = Number(p.cantidad ?? 1);
        const subtotal = cantidad * precio;
        return `
            <tr>
                <td>${titulo}</td>
                <td style="text-align:center;">${cantidad}</td>
                <td style="text-align:right;">$${precio.toLocaleString('es-CL')}</td>
                <td style="text-align:right;">$${subtotal.toLocaleString('es-CL')}</td>
            </tr>
        `;
    }).join("");

    const totalTexto = Number(venta.total ?? 0).toLocaleString('es-CL');

    // Información de pago si viene
    const pago = venta.pago || null;

    const detallesPagoHTML = pago ? `
        <h3>Detalles de pago</h3>
        <p>
            <strong>ID pago:</strong> ${pago.id || '-'}<br/>
            <strong>Estado:</strong> ${pago.status || '-'}<br/>
            <strong>Monto:</strong> $${Number(pago.transaction_amount ?? 0).toLocaleString('es-CL')} CLP<br/>
            <strong>Método:</strong> ${pago.payment_method_id || pago.payment_type_id || '-'}<br/>
            <strong>Cuotas:</strong> ${pago.installments ?? '-'}<br/>
            <strong>Detalle:</strong> ${pago.status_detail || '-'}
        </p>
    ` : '';

    try {
        const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "api-key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sender: {
                    name: NOMBRE_EMPRESA,
                    email: "contacto@nativecode.cl",
                },
                to: [
                    { email: CORREO_RECEPTOR, name: "Administrador/a" },
                    { email: "contacto@nativecode.cl", name: "NativeCode" },
                ],
                replyTo: {
                    email: "contacto@nativecode.cl",
                    name: "Soporte",
                },
                subject: `Nueva compra realizada - Comprobante #${venta.codigo || venta.id || ""}`,
                htmlContent: `
                    <h2>Se ha realizado una nueva compra a través de E-Commerce Pro.</h2>
                    <p>Detalles de la compra:</p>

                    <h3>Datos del cliente</h3>
                    <p>
                        <strong>Nombre:</strong> ${cliente.nombre}<br/>
                        <strong>Apellidos:</strong> ${cliente.apellidos}<br/>
                        <strong>Email:</strong> ${cliente.email}<br/>
                        <strong>Teléfono:</strong> ${cliente.telefono}<br/>
                        <strong>Dirección:</strong> ${cliente.direccion}<br/>
                        <strong>Comuna:</strong> ${cliente.comuna}<br/>
                        <strong>Región:</strong> ${cliente.region}<br/>
                        <strong>Comentarios:</strong> ${cliente.comentarios}
                    </p>

                    <h3>Datos de la compra</h3>
                    <p><strong>Código de pedido:</strong> ${venta.codigo || "-"}<br/>
                    <strong>Método de pago:</strong> ${venta.medioPago || "Mercado Pago"}<br/>
                    <strong>Fecha:</strong> ${venta.fecha || new Date().toLocaleString('es-CL')}</p>

                    ${detallesPagoHTML}

                    <h3>Detalle de productos</h3>
                    <table width="100%" border="1" cellspacing="0" cellpadding="8" style="border-collapse:collapse;">
                        <thead>
                            <tr>
                                <th align="left">Producto</th>
                                <th>Cant.</th>
                                <th align="right">Precio</th>
                                <th align="right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasProductos}
                        </tbody>
                    </table>

                    <h3 style="text-align:right; margin-top:16px;">
                        Total pagado: $${totalTexto} CLP
                    </h3>

                    <p>Revise los detalles y proceda con el envío.</p>
                `,
            }),
        });

        const data = await resp.json();
        if (!resp.ok) {
            console.error("Error Brevo notificación dueño:", data);
        } else {
        }
    } catch (err) {
        console.error("Error enviando notificación (Brevo):", err);
    }
}
