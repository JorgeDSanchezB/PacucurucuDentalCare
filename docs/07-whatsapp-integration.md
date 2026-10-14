# 07 — Integración WhatsApp Business Cloud API

**Proyecto**: Pacurucu Dental Care
**Estado v1**: implementado con `WHATSAPP_ENABLED = false`. **No se ha probado contra la API real** (sin credenciales en sandbox).

---

## 1. Qué está listo hoy (v1, flag OFF)

| Evento | Comportamiento actual |
|---|---|
| Paciente solicita cita en la web | Se crea `Appointment` (PENDING) + `BookingRequest`. `NotificationLog` registra `WHATSAPP_DOCTOR` = `SIMULATED`. El paciente ve: "Tu solicitud ha sido recibida. El odontólogo te contactará por WhatsApp para confirmar." |
| Odontólogo confirma en el panel | La cita pasa a CONFIRMED. `NotificationLog` registra `WHATSAPP_PATIENT` = `SIMULATED`. |
| Envío de historial por email | Fallback a descarga del PDF (ver `lib/email.ts`). |

El botón "Escribir por WhatsApp" del sitio usa un enlace directo `wa.me` (sin API), que funciona sin configuración alguna.

## 2. Arquitectura del wrapper

```
src/lib/whatsapp.ts
  sendWhatsAppMessage(to, body)        → POST graph.facebook.com/v21.0/{phoneNumberId}/messages
  notifyDoctorOfBooking(appointment)   → mensaje al número de la clínica
  notifyPatientOfConfirmation(appt)    → mensaje al teléfono del paciente
```

- Cada intento queda en `NotificationLog` (tipo, estado, destinatario, payload, error).
- Fallo de la API **nunca** rompe el flujo: la cita ya está persistida; el log marca `FAILED`.
- Evaluación del flag: `src/modules/settings/flags.ts` (DB con prioridad sobre `.env`).

## 3. Pasos para activar en producción

1. **Meta Business**: crear app en [developers.facebook.com](https://developers.facebook.com) → tipo Business → añadir producto WhatsApp.
2. **Número**: registrar el número de la clínica (+593 …) como número de WhatsApp Business (o migrar el número actual con el flujo de Meta).
3. **Credenciales**: copiar el *token de acceso permanente* y el *Phone Number ID* del panel de Meta.
4. **Variables de entorno**:
   ```bash
   WHATSAPP_ENABLED=true
   WHATSAPP_TOKEN=EAAG…
   WHATSAPP_PHONE_NUMBER_ID=123456789012345
   CLINIC_WHATSAPP_NUMBER=+593986124470
   ```
5. **Activar**: panel admin → Configuración → Feature flags → `WHATSAPP_ENABLED` (el override de DB manda sobre `.env`).
6. **Probar**: crear una reserva de prueba desde la web y verificar en el panel de Meta → WhatsApp → API Setup que el mensaje salió. Revisar `NotificationLog` (estado `SENT`).

## 4. Plantillas de mensaje (texto libre → plantillas oficiales)

En modo test (primeros 24 h / 1,000 conversaciones) se puede enviar texto libre a números verificados. Para producción sin restricciones se requieren **plantillas aprobadas por Meta**:

| Uso | Plantilla sugerida | Variables |
|---|---|---|
| Solicitud al odontólogo | `solicitud_cita` | nombre paciente, teléfono, servicios, fecha, hora |
| Confirmación al paciente | `cita_confirmada` | nombre, fecha, hora, servicios, dirección |
| Recordatorio (roadmap) | `recordatorio_cita` | nombre, fecha, hora |

Al aprobarlas, sustituir el `text` del payload por `template: { name, language: { code: "es" }, components: […] }` en `lib/whatsapp.ts` (única función que toca la API: `sendWhatsAppMessage`).

## 5. Coste y límites (referencia)

- Servicio de conversaciones de Meta: las conversaciones iniciadas por el usuario (el paciente escribe primero) tienen ventana de 24 h para respuesta libre.
- Plantillas de utilidad (confirmaciones/recordatorios): tarifa por conversación según país (Ecuador ~USD 0.01–0.05).
- Límite de velocidad: 80 mensajes/segundo por número (mucho mayor que el volumen de la clínica).

## 6. Supuesto declarado

`// SUPUESTO: el odontólogo usa un solo número de WhatsApp (clínica). Confirmar con el cliente.
// El modelo ya soporta multi-número futuro: settings.clinic.whatsapp es un dato editable.
