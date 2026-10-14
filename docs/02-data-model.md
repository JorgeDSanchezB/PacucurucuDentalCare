# 02 — Modelo de datos

**Proyecto**: Pacurucu Dental Care
**Fuente de verdad**: `prisma/schema.prisma`
**DB en sandbox**: SQLite (`db/custom.db`) — portable a PostgreSQL sin cambios de modelo.

---

## 1. Diagrama entidad-relación

```
┌──────────┐        ┌──────────────────┐        ┌──────────┐
│  User    │        │    Service       │        │ Schedule │
│ (admin)  │        │ (catálogo)       │        │ (semana) │
└──────────┘        └────────┬─────────┘        └──────────┘
                             │ 1..*
                    ┌────────▼─────────┐        ┌───────────┐
                    │ AppointmentService│       │ DateBlock │
                    │ (snapshot precio) │       │ (fechas)  │
                    └────────┬─────────┘        └───────────┘
                             │ N..1
┌──────────┐  1..*  ┌───────▼──────────┐  1..1  ┌──────────┐
│ Patient  │───────▶│   Appointment    │◀───────│ Invoice  │
│          │        │ (PENDING→CONFIRMED│        │ (FAC-NNN)│
│          │        │  →COMPLETED…)    │        └──────────┘
│          │        └───────┬──────────┘
│          │  1..*          │ 1..*
│          │───────▶ ┌──────▼───────────┐
│          │         │  ClinicalNote    │
└──────────┘         │ (historial)      │
                     └──────────────────┘
  BookingRequest ──▶ Appointment   (auditoría de solicitudes públicas)
  NotificationLog                (auditoría de WhatsApp/email)

  ClinicSetting (key→JSON)   Testimonial   FaqItem   GalleryItem
  FeatureFlag (key→bool)     ContactMessage
```

---

## 2. Decisiones de modelado

```
// DECISIÓN: Snapshots de precio/duración en AppointmentService
// QUÉ: Cada cita guarda nombre, precio y duración del servicio en el momento
//   de la reserva, además del id.
// COSTE: Redundancia controlada (2 columnas).
// ALTERNATIVA: JOIN dinámico con Service (descartada: si el odontólogo cambia
//   el precio de una limpieza, las facturas antiguas mutarían).
// UMBRAL: Ninguno; el snapshot es correcto para facturación en cualquier escala.
```

```
// DECISIÓN: Fechas como String "YYYY-MM-DD" y horas "HH:MM"
// QUÉ: Sin DateTime en campos de calendario (solo en createdAt/updatedAt).
// COSTE: Validación de formato manual (Zod).
// ALTERNATIVA: DateTime + conversiones (descartada: introduce errores de zona
//   horaria entre el servidor UTC y el calendario del odontólogo).
// UMBRAL: Ninguno.
```

```
// DECISIÓN: Estados como String + validación Zod (sin enums de Prisma)
// QUÉ: SQLite no soporta enums nativos de Prisma. Los valores permitidos se
//   definen una sola vez en src/lib/validators.ts (fuente compartida
//   cliente/servidor) y TypeScript garantiza el tipado.
// COSTE: Validación explícita en cada escritura (1 línea).
// ALTERNATIVA: Migrar a enums al pasar a PostgreSQL (opcional, no necesaria).
// UMBRAL: Ninguno.
```

```
// DECISIÓN: find-or-create de Patient por email
// QUÉ: El flujo público busca el paciente por email; si no existe, lo crea.
//   Email es UNIQUE.
// COSTE: Un paciente con email distinto genera ficha nueva (comportamiento
//   esperado y auditable en el panel).
// ALTERNATIVA: Dedup por teléfono (descartada: menos fiable).
// UMBRAL: >5,000 pacientes → fusionar fichas manualmente desde el panel.
```

```
// DECISIÓN: Numeración de factura = max(number) + 1 con unique
// QUÉ: La constraint UNIQUE evita duplicados aunque dos facturas se generen
//   en el mismo instante (la segunda falla y reintenta).
// COSTE: Reintento raro y barato.
// ALTERNATIVA: Secuencia dedicada con lock transaccional (innecesaria <1,000
//   facturas/año).
// UMBRAL: >100 facturas/día → tabla contador con transacción serializada.
```

---

## 3. Catálogo de modelos

### User (admin)
| Campo | Tipo | Nota |
|---|---|---|
| id | cuid | |
| email | String unique | `ADMIN_EMAIL` en seed |
| passwordHash | String | bcryptjs, coste 10 |
| role | String | v1: "ADMIN" (único rol) |

### Service
| Campo | Tipo | Nota |
|---|---|---|
| name, slug | String | slug único, generado |
| description | String | |
| duration | Int | minutos |
| price | Float | USD |
| category | String | agrupación del sitio público y del selector de reserva |
| imageUrl | String? | sin valor → placeholder con inicial |
| active, sortOrder | Bool, Int | visible / orden drag-and-drop |

### Schedule / DateBlock
- `Schedule`: un turno por día (`dayOfWeek` 0–6, único), `startTime`, `endTime`, `isActive`.
- `DateBlock`: fechas puntuales bloqueadas (vacaciones/feriados), `reason`.

### Patient
`firstName`, `lastName`, `email` (unique), `phone`, `birthDate?`.

### Appointment
- `status`: PENDING → CONFIRMED → COMPLETED, o CANCELLED / NO_SHOW.
- `source`: PUBLIC_FORM | ADMIN.
- `services`: relación a `AppointmentService` (snapshot).
- `notes` (paciente) y `adminNotes` (odontólogo), separados.

### ClinicalNote
Notas del historial: `date`, `treatment`, `observations?`, `privateNotes?`, opcionalmente ligada a una `appointment`.

### Invoice
`number` secuencial (FAC-0001…), `itemsJson` (snapshot de líneas), `subtotal`, `total`, `paymentMethod` (default EFECTIVO), relación 1:1 opcional con Appointment.

### ClinicSetting / FeatureFlag
- `ClinicSetting`: clave → JSON (clinic, doctor, hero, about, theme, contact).
- `FeatureFlag`: WHATSAPP_ENABLED / STRIPE_ENABLED con override desde panel.

### Contenido del sitio
`Testimonial` (nombre, rating 1–5, texto, published), `FaqItem`, `GalleryItem`, `ContactMessage` (bandeja del panel).

### NotificationLog
Auditoría de cada intento de notificación (tipo, destinatario, estado SENT/SIMULATED/FAILED, error). Soporta la estrategia de tolerancia a fallos.

---

## 4. Reglas de integridad implementadas

1. `onDelete: Cascade` en Patient→Appointment/Invoice/ClinicalNote: borrar un paciente borra su historial (acción explícita del admin, con confirmación en UI).
2. `onDelete: SetNull` en AppointmentService→Service y ClinicalNote→Appointment: borrar un servicio no destruye el historial de citas facturadas.
3. Unique en `Invoice.number`, `Invoice.appointmentId`, `DateBlock.date`, `Schedule.dayOfWeek`, `Patient.email`, `Service.slug`, `ClinicSetting.key`, `FeatureFlag.key`.
4. Índices en las rutas de consulta frecuentes: `(date,status)` y `(status,date)` de Appointment, `(active,sortOrder)` de Service, bandeja de mensajes `(read,createdAt)`.
