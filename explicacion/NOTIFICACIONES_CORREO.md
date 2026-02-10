# Sistema de Notificaciones por Correo - Macar Repuestos

## Resumen de Funcionalidades Implementadas

### 1. Comprobante de compra al cliente
Cuando se confirma un pago a través de Mercado Pago, el sistema envía automáticamente un correo electrónico al cliente con:
- Datos de la compra (código de pedido, método de pago, fecha)
- Detalles del pago (ID, estado, monto, método, cuotas)
- Tabla con productos comprados (nombre, cantidad, precio, subtotal)
- Total pagado

### 2. Notificación al dueño de la tienda
Además del comprobante al cliente, se envía un correo paralelo al dueño de la tienda con:
- **Datos completos del cliente:**
  - Nombre y apellidos
  - Email y teléfono
  - Dirección de despacho
  - Comuna y región
  - RUT/Identificación
  - Comentarios adicionales del cliente
- **Información de la compra:**
  - Código de pedido
  - Método de pago y detalles
  - Productos con cantidades y precios
  - Total pagado

### 3. Formulario de contacto
Sistema de contacto que envía mensajes de clientes directamente al correo del dueño.

---

## Configuración Requerida

### Variables de Entorno (.env)

Asegúrate de tener estas variables configuradas en tu archivo `.env`:

```env
# Brevo API Key (servicio de emails)
BREVO_API_KEY=tu_api_key_brevo

# Correo del dueño de la tienda (recibe notificaciones)
CORREO_RECEPTOR=tucorreo@ejemplo.com

# Mercado Pago Access Token
MP_ACCESS_TOKEN=tu_access_token_mercadopago

# Backend URL (para webhooks)
BACKEND_URL=http://localhost:3000
```

### Obtener BREVO_API_KEY
1. Crea una cuenta en [Brevo (ex Sendinblue)](https://www.brevo.com)
2. Ve a **Settings** → **SMTP & API** → **API Keys**
3. Genera una nueva API Key
4. Copia la key y pégala en tu `.env`

### Configurar CORREO_RECEPTOR
Simplemente coloca el correo del dueño de la tienda donde quieres recibir notificaciones de nuevas compras.

---

## Flujo de Funcionamiento

### Cuando se realiza una compra:

1. **Cliente completa el pago en Mercado Pago**
2. **Mercado Pago envía webhook al backend**
   - URL: `http://tudominio.com/pagosMercadoPago/notificacionPago`
3. **Backend procesa el webhook:**
   - Busca el pedido en la base de datos
   - Cambia el estado a "Pagado"
   - Obtiene datos del cliente y productos
   - **Envía 2 correos simultáneos:**
     - ✅ Comprobante al cliente
     - ✅ Notificación al dueño (CORREO_RECEPTOR)

### Archivos modificados:
- `backend/controller/MercadoPagoController.js`
  - Función: `enviarComprobanteCompraInterno()` - Envía comprobante al cliente
  - Función: `enviarNotificacionCompraDueno()` - Envía notificación al dueño
  - Se llaman automáticamente en el webhook `recibirPago()`

---

## Pruebas

### Prueba con compra real:
1. Realiza una compra de prueba desde el frontend
2. Completa el pago en Mercado Pago
3. Verifica que lleguen ambos correos:
   - Al cliente (email ingresado en el checkout)
   - Al dueño (CORREO_RECEPTOR)

### Revisar logs:
```bash
# Ver logs del servidor
tail -f backend/server.log

# Buscar estas líneas:
# "Comprobante enviado (intento) para preference_id: ..."
# "Notificación enviada al dueño para preference_id: ..."
```

### Solución de problemas:

**No llegan correos:**
- Verifica que `BREVO_API_KEY` esté configurado correctamente
- Revisa que `CORREO_RECEPTOR` tenga un email válido
- Consulta los logs del servidor para ver errores de Brevo

**Webhook no se ejecuta:**
- Confirma que la URL del webhook esté registrada en Mercado Pago
- Verifica que `MP_ACCESS_TOKEN` sea válido
- Revisa que el servidor backend esté accesible públicamente (usa ngrok para pruebas locales)

**Campos vacíos en el correo:**
- Asegúrate de que los campos del pedido estén completos en la base de datos
- Revisa la tabla `pedidoCompras` y `pedidoDetalle`

---

## Estructura de Correos

### Correo al Cliente:
```
Asunto: Comprobante de compra #123

Contenido:
- Gracias por tu compra
- Datos de la compra (código, método, fecha)
- Detalles de pago
- Tabla de productos
- Total pagado
```

### Correo al Dueño:
```
Asunto: Nueva compra realizada - Comprobante #123

Contenido:
- Datos completos del cliente (nombre, email, teléfono, dirección, comuna, región, comentarios)
- Datos de la compra (código, método, fecha)
- Detalles de pago
- Tabla de productos
- Total pagado
- Llamado a acción: "Revise los detalles y proceda con el envío"
```

---

## Próximos Pasos Opcionales

- [ ] Añadir plantillas HTML más estilizadas con branding
- [ ] Implementar adjuntos PDF del comprobante
- [ ] Sistema de notificaciones SMS al cliente
- [ ] Panel de administración para ver correos enviados
- [ ] Integración con sistema de tracking de envíos

---

## Soporte

Para cualquier problema o mejora, contacta al equipo de desarrollo.

