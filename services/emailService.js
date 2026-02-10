// services/emailService.js
import nodemailer from "nodemailer";

// OJO: idealmente estas cosas van en variables de entorno (.env)
const transporter = nodemailer.createTransport({
    service: "gmail", // o smtp de tu proveedor
    auth: {
        user: process.env.EMAIL_USER,      // tu correo
        pass: process.env.EMAIL_PASSWORD,  // contraseña o app password
    },
});

export async function enviarCorreoComprobante({ correoDestino, nombre }) {
    const mailOptions = {
        from: `"Tu Tienda" <${process.env.EMAIL_USER}>`,
        to: correoDestino,
        subject: "Gracias por tu compra",
        html: `
      <h1>Hola ${nombre}</h1>
      <p>Gracias por tu compra. Estamos procesando tu pedido.</p>
    `,
    };

    await transporter.sendMail(mailOptions);
}





