import "dotenv/config";

export default class CorreosAutomaticosController {

    constructor() {

    }


    static async enviarSeguimiento(req, res) {
        try {
            const { asunto, email, mensaje } = req.body;
            console.log(req.body);

            // Validación básica
            if (!asunto || !email || !mensaje) {
                return res.status(400).json({ message: 'sindato' });
            }

            const apiKey = process.env.BREVO_API_KEY;
            const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA;

            if (!apiKey) {
                console.error("Falta BREVO_API_KEY en .env");
                return res.status(500).json({ mensaje: 'sindato' });
            }

            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
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
                        {
                            email: email, // email del cliente
                            name: "Cliente",
                        },
                    ],
                    replyTo: {
                        email: "contacto@nativecode.cl",
                        name: NOMBRE_EMPRESA,
                    },
                    subject: asunto,
                    htmlContent: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #0369a1;">${NOMBRE_EMPRESA}</h2>
                            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px;">
                                ${mensaje.replace(/\n/g, '<br/>')}
                            </div>
                            <p style="margin-top: 20px; color: #64748b; font-size: 14px;">
                                Si tienes alguna consulta adicional, no dudes en contactarnos en nuestros canales regulares.
                            </p>
                        </div>
                    `,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error Brevo:", data);
                return res.status(500).json({ mensaje: false });
            }

            return res.json({
                message: true,
            });

        } catch (error) {
            console.error("Error servidor:", error);
            return res.status(500).json({ ok: false, error: "Error del servidor al enviar correo" });
        }
    }







    static async enviarFormularioContacto(req, res) {
        try {
            const { nombre, email, mensaje } = req.body;
            const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA;
            console.log(req.body);

            // Validación básica
            if (!nombre || !email || !mensaje) {
                return res.status(400).json({ message: 'sindato' });
            }

            const apiKey = process.env.BREVO_API_KEY;
            if (!apiKey) {
                console.error("Falta BREVO_API_KEY en .env");
                return res.status(500).json({ mensaje: 'sindato' });}

            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "api-key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sender: {
                        name: "E-Commerce ProSuite",
                        email: "contacto@nativecode.cl", // remitente de TU dominio
                    },
                    to: [
                        {
                            email: "contacto@nativecode.cl", // donde recibes tú
                            name: "NativeCode",
                        },
                    ],
                    replyTo: {
                        email,
                        name: nombre,
                    },
                    subject: `Nuevo mensaje de ${nombre}`,
                    htmlContent: `

            <h2>Nueva consulta de Cliente desde E-Commerce Pro (Formulario de Contacto):</h2>
            <p><strong>Nombre:</strong> ${nombre}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Mensaje:</strong><br/>${mensaje}</p>
          `,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error Brevo:", data);
                return res.status(500).json({ mensaje:false });
            }

            return res.json({
                message: true,});

        } catch (error) {
            console.error("Error servidor:", error);
            return res.status(500).json({ ok: false, error: "Error del servidor al enviar correo" });
        }
    }






    static async enviarComprobanteCompra(req, res) {
        try {
            const { cliente, venta, productos } = req.body;
            console.log("BODY COMPROBANTE:", req.body);
            const NOMBRE_EMPRESA = process.env.NOMBRE_EMPRESA;

            // Validación básica
            if (!cliente || !venta || !Array.isArray(productos) || productos.length === 0) {
                return res.status(400).json({ message: 'sindato' });
            }

            const apiKey = process.env.BREVO_API_KEY;
            if (!apiKey) {
                console.error("Falta BREVO_API_KEY en .env");
                return res.status(500).json({ message: 'sindato' });
            }

            // Armamos tabla HTML con el detalle de la compra
            const filasProductos = productos.map((producto) => {
                const subtotal = Number(producto.cantidad) * Number(producto.precioUnitario || producto.precio);
                return `
                <tr>
                    <td>${producto.nombre}</td>
                    <td style="text-align:center;">${producto.cantidad}</td>
                    <td style="text-align:right;">$${Number(producto.precioUnitario || producto.precio).toLocaleString('es-CL')}</td>
                    <td style="text-align:right;">$${subtotal.toLocaleString('es-CL')}</td>
                </tr>
            `;
            }).join("");

            const totalTexto = Number(venta.total).toLocaleString('es-CL');

            const response = await fetch("https://api.brevo.com/v3/smtp/email", {
                method: "POST",
                headers: {
                    "api-key": apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sender: {
                        name: "E-Commerce ProSuite",
                        email: "contacto@nativecode.cl", // remitente de TU dominio
                    },
                    to: [
                        {
                            email: cliente.email,         // cliente que compró
                            name: cliente.nombre,
                        },
                        {
                            email: "contacto@nativecode.cl", // copia para ti
                            name: "NativeCode",
                        },
                    ],
                    replyTo: {
                        email: "contacto@nativecode.cl",
                        name: "Soporte ProSuite",
                    },
                    subject: `Comprobante de compra #${venta.codigo || venta.id || ""}`,
                    htmlContent: `
                    <h2>Gracias por tu compra, ${cliente.nombre}</h2>
                    <p>Este es el comprobante de tu compra realizada en <strong> ${NOMBRE_EMPRESA} </strong>.</p>

                    <h3>Datos de la compra</h3>
                    <p><strong>Código de pedido:</strong> ${venta.codigo || "-"}<br/>
                    <strong>Método de pago:</strong> ${venta.medioPago || "-"}<br/>
                    <strong>Fecha:</strong> ${venta.fecha || new Date().toLocaleString('es-CL')}</p>

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

                    <p>Ante cualquier duda sobre tu compra, porfavor contacta a nuestros canales de ventas oficiales.</p>
                `,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Error Brevo comprobante:", data);
                return res.status(500).json({ message: false });
            }

            return res.json({ message: true });

        } catch (error) {
            console.error("Error servidor (comprobante):", error);
            return res.status(500).json({ message: false, error: "Error del servidor al enviar comprobante" });
        }
    }
}
