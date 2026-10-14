# 04 — Feature flags

**Proyecto**: Pacurucu Dental Care

## 1. Flags definidos

| Flag | Default (env) | Override DB | Efecto cuando está ON |
|---|---|---|---|
| `WHATSAPP_ENABLED` | `false` | `FeatureFlag` table | Envío real de mensajes vía WhatsApp Business Cloud API (al odontólogo al recibir solicitud, y al paciente al confirmar cita). |
| `STRIPE_ENABLED` | `false` | `FeatureFlag` table | Muestra el paso de pago online en el flujo de reserva y habilita `/api/public/payments/checkout`. |

## 2. Jerarquía de evaluación

```
valor efectivo = fila de FeatureFlag si existe
                 si no, process.env[FLAG] === "true"
                 si no, false (default)
```

Implementado en `src/modules/settings/flags.ts` con `getEffectiveFlag(key)`.

## 3. Cómo activarlos

**Variable de entorno** (default del deployment):

```bash
# .env
WHATSAPP_ENABLED=true
STRIPE_ENABLED=true
```

**Panel admin** (override sin redeploy): Configuración → Feature flags → toggle.

## 4. Variables de entorno relacionadas

```bash
# WhatsApp Business Cloud API (requeridas solo con el flag ON)
WHATSAPP_TOKEN=            # token de acceso permanente del app de Meta
WHATSAPP_PHONE_NUMBER_ID=  # id del número de WhatsApp Business
CLINIC_WHATSAPP_NUMBER=    # número del odontólogo (destinatario de solicitudes)

# Stripe (requeridas solo con el flag ON)
STRIPE_SECRET_KEY=

# Email (historial clínico)
SMTP_HOST=; SMTP_PORT=; SMTP_USER=; SMTP_PASSWORD=; EMAIL_FROM=

# Admin seed
ADMIN_EMAIL=; ADMIN_PASSWORD=; ADMIN_NAME=
```

## 5. Comportamiento con flag OFF (v1, modo actual)

- **Reservas**: la solicitud se persiste en DB (`Appointment` PENDING + `BookingRequest`). El paciente ve: "Tu solicitud ha sido recibida. El odontólogo te contactará por WhatsApp para confirmar."
- **Confirmación admin**: al confirmar, `NotificationLog` registra la notificación como `SIMULATED` (auditable, sin envío real).
- **Pago**: el paso de pago no aparece en el flujo; el endpoint de checkout responde `501` con mensaje claro.

## 6. Declaración de honestidad

El código de WhatsApp y Stripe está **implementado pero NO probado contra las APIs reales** (no existen credenciales en el sandbox). Activar los flags en producción requiere completar `docs/07-whatsapp-integration.md`.
