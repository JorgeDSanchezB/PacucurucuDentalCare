# 03 — Contratos de API

**Proyecto**: Pacurucu Dental Care
**Convención general**:
- Todas las rutas usan **rutas relativas** (mismo origen).
- Respuestas JSON con `{ ok: boolean, ... }` o `NextResponse` con código HTTP apropiado.
- Errores de validación: `400` + `{ ok: false, error: string, issues?: ZodIssue[] }`.
- Sin sesión en rutas `/api/admin/*`: `401` + `{ ok: false, error: "No autorizado" }`.
- Errores no controlados: `500` genérico (sin stack interno); el detalle se registra en log del servidor.

---

## 1. Autenticación (NextAuth v4)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/[...nextauth]` | Login credentials (email + password). Sesión JWT, cookie httpOnly. |
| GET | `/api/auth/session` | Consulta de sesión activa. |
| POST | `/api/auth/[...nextauth]` (signout) | Cierre de sesión. |

El `authorize()` valida contra `User.passwordHash` (bcryptjs). Ningún dato sensible se expone al cliente.

---

## 2. API pública (sin sesión)

### GET `/api/public/services`
Devuelve servicios activos para el sitio público y el selector de reserva.

```ts
// Response 200
{
  ok: true
  services: {
    id: string; name: string; slug: string; description: string
    duration: number      // minutos
    price: number         // USD
    category: string
    imageUrl: string | null
    sortOrder: number
  }[]
}
```

### GET `/api/public/availability?date=YYYY-MM-DD&duration=90`
Calcula franjas disponibles para una duración total (suma de servicios elegidos).

```ts
// Response 200
{
  ok: true
  date: string           // "YYYY-MM-DD"
  closed: boolean        // true si día inactivo o bloqueado
  slots: string[]        // ["09:00", "09:30", ...] vacío → sin disponibilidad
}
// Response 400: fecha inválida o pasada → { ok: false, error }
```

Reglas del cálculo (server-side, fuente de verdad):
1. Día sin `Schedule.isActive` → `closed: true`.
2. Fecha en `DateBlock` → `closed: true`.
3. Fecha pasada → `400`.
4. Rejilla de 30 min entre apertura y cierre; válida la franja si `inicio + duration ≤ cierre` y no solapa citas `PENDING`/`CONFIRMED`/`COMPLETED` existentes.

### POST `/api/public/bookings`
Crea la solicitud de reserva (v1: modo sin WhatsApp real).

```ts
// Request
{
  serviceIds: string[]                 // ≥1
  patient: {
    firstName: string; lastName: string
    email: string; phone: string
  }
  date: string                         // "YYYY-MM-DD", futura
  startTime: string                    // "HH:MM" de la rejilla
  notes?: string                       // comentarios del paciente
}
// Response 201
{
  ok: true
  appointmentId: string
  message: string  // "Tu solicitud ha sido recibida. El odontólogo te
                    //  contactará por WhatsApp para confirmar."
}
// Response 400: validación Zod o franja ya ocupada
// Response 409: la franja quedó ocupada entre la consulta y el envío
```

Efectos: find-or-create `Patient` por email → create `Appointment` (PENDING) + `AppointmentService` (snapshot) + `BookingRequest`. Si `WHATSAPP_ENABLED=true`, intenta notificar al odontólogo vía Cloud API (registro en `NotificationLog`); si falla, la solicitud permanece en DB (tolerancia a fallos).

### POST `/api/public/contact`
```ts
// Request
{ name: string; email: string; phone?: string; message: string }
// Response 201
{ ok: true; message: "Mensaje enviado. Te responderemos pronto." }
```
Persiste en `ContactMessage` (bandeja del panel admin).

### POST `/api/public/payments/checkout`
Módulo Stripe (flag OFF en v1).
```
STRIPE_ENABLED=false → 501 { ok: false, error: "El pago online no está activo." }
STRIPE_ENABLED=true  → (futuro) crea Checkout Session y devuelve url.
```

---

## 3. API admin (requiere sesión)

### Dashboard

**GET `/api/admin/stats`**
```ts
{
  ok: true
  today: { count: number; list: AppointmentRow[] }
  week: { count: number }
  newPatientsThisMonth: number
  monthRevenue: number            // suma de facturas del mes actual
  pendingRequests: number         // citas PENDING
  unreadMessages: number
  appointmentsByDay: { date: string; count: number }[] // últimos 14 días
}
```

### Servicios

| Método | Ruta | Body / Query | Response |
|---|---|---|---|
| GET | `/api/admin/services` | — | `{ ok, services: ServiceAdmin[] }` (incluye inactivos) |
| POST | `/api/admin/services` | `ServiceInput` | `201 { ok, service }` |
| PUT | `/api/admin/services/[id]` | `Partial<ServiceInput>` | `200 { ok, service }` |
| PATCH | `/api/admin/services/order` | `{ items: { id, sortOrder }[] }` | `200 { ok }` (drag-and-drop) |
| DELETE | `/api/admin/services/[id]` | — | `200 { ok }` (soft: las citas pasadas conservan snapshot) |

```ts
interface ServiceInput {
  name: string; description: string
  duration: number; price: number
  category: string; imageUrl?: string | null
  active: boolean; sortOrder?: number
}
```

### Calendario

| Método | Ruta | Body | Response |
|---|---|---|---|
| GET | `/api/admin/schedule` | — | `{ ok, schedule: ScheduleRow[], dateBlocks: DateBlockRow[] }` |
| PUT | `/api/admin/schedule` | `{ schedule: ScheduleRow[] }` | `200 { ok }` (upsert semanal completo) |
| POST | `/api/admin/date-blocks` | `{ date, reason }` | `201 { ok, block }` |
| DELETE | `/api/admin/date-blocks/[id]` | — | `200 { ok }` |

```ts
interface ScheduleRow { dayOfWeek: 0|1|2|3|4|5|6; startTime: string; endTime: string; isActive: boolean }
```

### Citas

| Método | Ruta | Query / Body | Response |
|---|---|---|---|
| GET | `/api/admin/appointments` | `status?, date?, from?, to?, q?, page?` | `{ ok, appointments, total, page, pageCount }` |
| POST | `/api/admin/appointments` | `AppointmentCreateInput` | `201 { ok, appointment }` |
| PUT | `/api/admin/appointments/[id]` | `AppointmentUpdateInput` | `200 { ok, appointment }` |
| DELETE | `/api/admin/appointments/[id]` | — | `200 { ok }` |

```ts
interface AppointmentCreateInput {
  patientId?: string            // o newPatient si es nuevo
  newPatient?: { firstName: string; lastName: string; email: string; phone: string }
  serviceIds: string[]
  date: string; startTime: string
  notes?: string; adminNotes?: string
  status?: "PENDING" | "CONFIRMED"   // creación manual suele ser CONFIRMED
}
interface AppointmentUpdateInput {
  date?: string; startTime?: string   // re-agendar revalida disponibilidad
  status?: "PENDING"|"CONFIRMED"|"COMPLETED"|"CANCELLED"|"NO_SHOW"
  notes?: string; adminNotes?: string
}
// GET devuelve AppointmentRow con patient y services incluidos (JOIN)
```

Al pasar a `CONFIRMED`: si `WHATSAPP_ENABLED=true` se notifica al paciente (registro en `NotificationLog`); si no, queda `SIMULATED` para auditoría.

### Pacientes e historial clínico

| Método | Ruta | Query / Body | Response |
|---|---|---|---|
| GET | `/api/admin/patients` | `q?, page?` | `{ ok, patients, total, page, pageCount }` |
| GET | `/api/admin/patients/[id]` | — | `{ ok, patient, appointments, clinicalNotes, invoices }` |
| POST | `/api/admin/patients` | `PatientInput` | `201 { ok, patient }` |
| PUT | `/api/admin/patients/[id]` | `Partial<PatientInput>` | `200 { ok, patient }` |
| DELETE | `/api/admin/patients/[id]` | — | `200 { ok }` (cascade con confirmación en UI) |
| POST | `/api/admin/clinical-notes` | `ClinicalNoteInput` | `201 { ok, note }` |
| PUT | `/api/admin/clinical-notes/[id]` | `Partial<ClinicalNoteInput>` | `200 { ok, note }` |
| DELETE | `/api/admin/clinical-notes/[id]` | — | `200 { ok }` |
| GET | `/api/admin/patients/[id]/history/pdf` | — | PDF (application/pdf) |
| POST | `/api/admin/patients/[id]/history/send` | `{ email?: string }` | `{ ok, status: "SENT"\|"SIMULATED"\|"FAILED", message, downloadUrl }` |

```ts
interface ClinicalNoteInput {
  patientId: string; appointmentId?: string
  date: string                 // "YYYY-MM-DD"
  treatment: string
  observations?: string
  privateNotes?: string
}
```

### Facturación

| Método | Ruta | Query / Body | Response |
|---|---|---|---|
| GET | `/api/admin/invoices` | `q?, year?, page?` | `{ ok, invoices, total, page, pageCount }` |
| POST | `/api/admin/invoices` | `{ appointmentId }` (cita COMPLETED) | `201 { ok, invoice }` |
| GET | `/api/admin/invoices/[id]/pdf` | — | PDF |
| GET | `/api/admin/invoices/export` | — | CSV (todas) |

PDF de factura: numeración FAC-NNNN, fecha, datos del paciente, líneas de servicio, subtotal, total, método de pago (EFECTIVO), datos de la clínica (desde `ClinicSetting`).

CSV: `numero,fecha,paciente,servicios,subtotal,total,metodo_pago`.

### Configuración y flags

| Método | Ruta | Body | Response |
|---|---|---|---|
| GET | `/api/admin/settings` | — | `{ ok, settings: ClinicSettingsDTO, flags: FlagRow[] }` |
| PUT | `/api/admin/settings` | `ClinicSettingsDTO` | `200 { ok }` |
| PUT | `/api/admin/flags/[key]` | `{ enabled: boolean }` | `200 { ok, flag }` |

```ts
interface ClinicSettingsDTO {
  clinic: { name: string; tagline: string; address: string; city: string; phone: string; whatsapp: string; email: string }
  doctor: { name: string; title: string; specialty: string; bio: string; photoUrl: string; credentials: string[] }
  hero: { title: string; subtitle: string; imageUrl: string }
  about: { title: string; text: string }
  theme: { colors: { background: string; foreground: string; primary: string; secondary: string; accent: string } }
}
```

### Mensajes de contacto

| Método | Ruta | Body | Response |
|---|---|---|---|
| GET | `/api/admin/contact-messages` | `page?` | `{ ok, messages, total, pageCount }` |
| PATCH | `/api/admin/contact-messages/[id]` | `{ read: boolean }` | `200 { ok }` |

---

## 4. Validaciones Zod (fuente compartida)

Definidas en `src/lib/validators.ts` y usadas en cliente y servidor:
- `patientSchema`: nombres ≥2 chars, email formato, teléfono ≥7 dígitos.
- `bookingSchema`: `serviceIds` ≥1, fecha futura válida, `startTime` HH:MM.
- `contactSchema`, `serviceInputSchema`, `scheduleRowSchema`, `clinicalNoteSchema`, `settingsSchema`.

## 5. Paginación

`page` (1-based) y `pageSize` fijo 20 (admin) — server-side con `skip/take` de Prisma. Umbral de scroll infinito: ver `docs/05-scaling-thresholds.md`.
