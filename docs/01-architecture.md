# 01 — Arquitectura

**Proyecto**: Pacurucu Dental Care
**Versión del documento**: v1 (Fase 1)
**Estado**: Planificación

---

## 1. Descripción general

Sistema web para una clínica odontológica de una sola sede, compuesto por tres planos:

1. **Sitio público**: presentación de la clínica, servicios, perfil del odontólogo, testimonios, FAQ, galería y formulario de contacto.
2. **Sistema de reservas**: formulario público multi-paso (servicios → datos del paciente → fecha/hora) que registra solicitudes de cita y las canaliza al odontólogo por WhatsApp (v1: modo registrado en DB, envío real desactivado por feature flag).
3. **Panel de administración** (acceso exclusivo del odontólogo): gestión de servicios, calendario de disponibilidad, citas, pacientes con historial clínico, facturación interna y configuración completa del sitio.

---

## 2. Diagrama de arquitectura

```
┌────────────────────────────────────────────────────────────────────────┐
│                            NAVEGADOR DEL USUARIO                       │
│                                                                         │
│   Paciente (sitio público + flujo de reserva)      Odontólogo (admin)  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS (rutas relativas)
┌───────────────────────────────▼─────────────────────────────────────────┐
│                     NEXT.JS (App Router, puerto 3000)                    │
│                                                                          │
│  ┌──────────────────────┐    ┌───────────────────────────────────────┐  │
│  │  CAPA DE PRESENTACIÓN│    │        CAPA DE API (Route Handlers)   │  │
│  │  src/app/page.tsx    │    │        src/app/api/**                 │  │
│  │  (SSR inicial + SPA  │───▶│                                       │  │
│  │  hash-routing)       │    │  /api/auth/[...nextauth]  (NextAuth)  │  │
│  │                      │    │  /api/public/*   (sin sesión)         │  │
│  │  components/public/* │    │  /api/admin/*    (getServerSession)   │  │
│  │  components/admin/*  │    │                                       │  │
│  └──────────────────────┘    └───────────────┬───────────────────────┘  │
│                                              │                           │
│  ┌───────────────────────────────────────────▼───────────────────────┐  │
│  │            CAPA DE DOMINIO (src/modules/**)                       │  │
│  │  appointments/  (disponibilidad, creación, transiciones)          │  │
│  │  services/  clinical-history/  invoicing/  settings/              │  │
│  │  + lib/whatsapp.ts  lib/email.ts  lib/pdf.ts  lib/flags.ts        │  │
│  └───────────────────────────────────────────┬───────────────────────┘  │
│                                              │ Prisma Client            │
│  ┌───────────────────────────────────────────▼───────────────────────┐  │
│  │            BASE DE DATOS (SQLite en sandbox / PostgreSQL en prod) │  │
│  │  User, Patient, Service, Schedule, DateBlock, Appointment,        │  │
│  │  ClinicalNote, Invoice, ClinicSetting, FeatureFlag,               │  │
│  │  Testimonial, FaqItem, GalleryItem, ContactMessage,               │  │
│  │  NotificationLog, BookingRequest                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  SERVICIOS EXTERNOS (detrás de feature flags, OFF en v1):               │
│   • WhatsApp Business Cloud API (WHATSAPP_ENABLED)                      │
│   • Stripe (STRIPE_ENABLED)                                              │
│   • Email SMTP/Resend (historial clínico, best-effort con fallback)     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Flujo de reserva v1 (modo sin WhatsApp real)

```
Paciente: selecciona servicios → completa datos → elige fecha/hora
   │
   ▼
POST /api/public/bookings
   │  (validación Zod + verificación de disponibilidad server-side)
   ▼
Se crea Appointment (estado PENDING) + BookingRequest (registro de la solicitud)
   │
   ├── WHATSAPP_ENABLED=false (v1):
   │     el sistema registra la solicitud y responde:
   │     "Tu solicitud ha sido recibida. El odontólogo te contactará
   │      por WhatsApp para confirmar."
   │
   └── WHATSAPP_ENABLED=true (futuro):
         envío real al odontólogo vía Cloud API + reintento ante fallo,
         y confirmación al paciente al validar disponibilidad.

Odontólogo (panel admin): ve la solicitud PENDING → la confirma
   │
   ▼
Appointment pasa a CONFIRMED → NotificationLog registra el aviso al paciente
   │  (envío real solo si el flag está activo; si no, queda registrado
   │   como SIMULATED para auditoría)
```

---

## 3. Stack tecnológico (efectivo en este entorno)

| Capa | Solicitado | Implementado en sandbox | Nota |
|---|---|---|---|
| Framework | Next.js 15 (App Router) | **Next.js 16.1.1 (App Router)** | El entorno provisiona Next 16. Misma API de App Router; la migración del código es 1:1. |
| Lenguaje | TypeScript | TypeScript 5 (strict) | Sin cambios. |
| UI | React 19 | React 19 | Sin cambios. |
| Estilos | Tailwind CSS 4 + shadcn/ui | Tailwind CSS 4 + shadcn/ui (New York) | Sin cambios. Set completo disponible. |
| Animaciones | Framer Motion + GSAP | **Framer Motion 12 (sin GSAP)** | MOTION_INTENSITY=4 no requiere coreografía GSAP. Ver docs/design-brief.md. |
| DB | PostgreSQL (Neon/Supabase/Railway) | **SQLite (archivo local)** | El schema Prisma es portable: cambiar `provider` a `postgresql` y correr migraciones. Ver docs/08-deployment.md. |
| ORM | Prisma | Prisma 6 | Sin cambios. |
| Auth | NextAuth.js (Credentials) | next-auth 4.24.11 + bcryptjs | Sin cambios funcionales. |
| Email | Resend o Nodemailer (SMTP) | Wrapper `lib/email.ts` (modo simulado) | Sin credenciales SMTP en el sandbox. El wrapper centraliza el envío para activarlo con variables de entorno. |
| PDF | @react-pdf/renderer o pdf-lib | **pdf-lib** | Generación server-side en API routes. Render confiable sin DOM. |
| WhatsApp | WhatsApp Business Cloud API | Wrapper `lib/whatsapp.ts` con flag OFF | Implementado, no probado contra la API real. |
| Pagos | Stripe (flag OFF) | Módulo reservado con flag OFF | Fuera de alcance v1, documentado en roadmap. |
| Deploy | Vercel + Neon | Preview sandbox | Guía de deploy en docs/08-deployment.md. |

### Desviaciones impuestas por el entorno (documentadas con honestidad)

1. **Ruta única visible**: el panel de vista previa del sandbox solo expone la ruta `/`. La aplicación se implementa como **SPA con hash-routing (`#/reservar`, `#/admin/...`)** dentro de `src/app/page.tsx`, con **SSR del contenido inicial** (el server component consulta la DB antes del primer render, conservando SEO en la primera carga). Toda la lógica de negocio vive en la capa de API (`src/app/api/**`), por lo que la migración a páginas SSR multi-ruta en producción es un cambio de presentación, no de arquitectura.
2. **SQLite en lugar de PostgreSQL**: limitación del sandbox. El schema no usa tipos exclusivos de SQLite ni arrays (requisito Prisma), por lo que el cambio de provider es transparente.
3. **No se ejecuta `next build`** en el sandbox (restricción del entorno). La verificación se realiza con `eslint` + servidor dev + auditoría en navegador real (Agent Browser). Esto se declara explícitamente: **no se ha ejecutado un build de producción**.
4. **Next.js 16 en lugar de 15**: versión provisionada por el entorno. App Router mantiene compatibilidad.

---

## 4. Decisiones de arquitectura

```
// DECISIÓN: Monolito modular en un único despliegue
// QUÉ: Toda la app (público + admin + API) vive en un proyecto Next.js.
// COSTE: Ninguno adicional; es el modelo por defecto de Next.js.
// ALTERNATIVA: Separar admin y público en dos proyectos (descartada: duplicaría
//   la capa de dominio y el deploy para <100 pacientes/mes).
// UMBRAL: Solo reconsiderar si el panel admin crece a un equipo de desarrollo
//   separado del sitio público.
```

```
// DECISIÓN: Contenido dinámico 100% en DB (regla Cero Hardcoding)
// QUÉ: Servicios, horarios, textos, testimonios, FAQ, galería, tema y flags
//   viven en tablas; el render los lee en cada request.
// COSTE: Una query adicional por vista (índices cubren <10k filas).
// ALTERNATIVA: Archivos estáticos/JSON (descartada: rompe la personalización
//   desde el panel admin, requisito central del proyecto).
// UMBRAL: >50k lecturas/min → caché en memoria con TTL (ver docs/05).
```

```
// DECISIÓN: Feature flags con env + override en DB
// QUÉ: WHATSAPP_ENABLED / STRIPE_ENABLED leen .env como valor por defecto y
//   la tabla FeatureFlag permite override desde el panel admin.
// COSTE: Una lectura de DB por evaluación de flag.
// ALTERNATIVA: Solo env vars (descartada: exige redeploy para activar).
// UMBRAL: Sin umbral; el coste es despreciable en este volumen.
```

```
// DECISIÓN: Reserva de horarios con bloqueo optimista por validación
// QUÉ: La disponibilidad se calcula desde Schedule/DateBlock/Appointments en
//   el momento de la solicitud y se revalida al confirmar.
// COSTE: Dos queries por solicitud.
// ALTERNATIVA: Locks pesimistas transaccionales (descartados: el volumen
//   <100 pacientes/mes no justifica la complejidad).
// UMBRAL: >50 solicitudes concurrentes en la misma franja → cola de confirmación
//   serializada (ver docs/05-scaling-thresholds.md).
```

```
// DECISIÓN: Sin virtualización, sin Redis, sin WebSockets, sin GraphQL
// QUÉ: Listados con paginación server-side; el panel admin refresca datos
//   al enfocar la ventana (polling suave), sin sockets.
// COSTE: Ninguno.
// ALTERNATIVA: Stack "a prueba de 10k usuarios" (descartada: anti-sobreingeniería).
// UMBRAL: Documentado por listado en docs/05-scaling-thresholds.md.
```

---

## 5. Estructura del código

```
pacurucu-dental-care/           (/home/z/my-project)
├── docs/                        # Documentación completa (esta carpeta)
├── prisma/
│   ├── schema.prisma            # Modelos de datos
│   └── seed.ts                  # Datos iniciales: admin, servicios, settings
├── db/                          # Archivo SQLite (sandbox)
├── src/
│   ├── app/
│   │   ├── page.tsx             # Server component: SSR inicial + montaje SPA
│   │   ├── layout.tsx           # Fuentes, metadata, providers
│   │   └── api/                 # Route handlers (ver docs/03-api-contracts.md)
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── public/          # services, availability, bookings, contact
│   │       └── admin/           # stats, services, schedule, appointments,
│   │                            # patients, notes, invoices, settings, flags
│   ├── components/
│   │   ├── ui/                  # shadcn/ui (existente)
│   │   ├── public/              # Vistas y secciones del sitio público
│   │   └── admin/               # Vistas y controles del panel
│   ├── modules/                 # Lógica de dominio (pura, testeable)
│   │   ├── appointments/        # Disponibilidad, creación, transiciones
│   │   ├── services/            # Queries de servicios
│   │   ├── clinical-history/    # Notas clínicas
│   │   ├── invoicing/           # Numeración y generación de facturas
│   │   └── settings/            # Settings + feature flags
│   ├── lib/                     # Infraestructura: db, auth, whatsapp,
│   │                            # email, pdf, flags, validación Zod
│   └── types/                   # Tipos compartidos
├── .env / .env.example
├── README.md
└── worklog.md                   # Bitácora multiagente
```

---

## 6. Tolerancia a fallos (resumen de implementación)

| Fallo | Estrategia técnica |
|---|---|
| WhatsApp API caída | `try/catch` en el wrapper; la solicitud ya está persistida en DB; `NotificationLog` registra `FAILED` con reintento programado. |
| Email falla | `lib/email.ts` devuelve estado; el panel ofrece descarga directa del PDF como fallback y mensaje claro. |
| Servicio sin imagen | Componente `ServiceImage`: placeholder con inicial + categoría (SVG generado, intencional). |
| Sin disponibilidad | La API devuelve `{ slots: [] }` y la UI muestra "No hay horarios disponibles para esta fecha". |
| DB caída | Error boundary + página 503 con mensaje de mantenimiento (evita pantalla blanca). |
| Email inválido | Validación Zod en cliente y servidor con mensajes accionables. |
| Fecha pasada | Deshabilitada en el calendario (cliente) y rechazada en el server (fuente de verdad). |

---

## 7. Roadmap (fuera de alcance v1, documentado)

- **Stripe**: módulo de pago con flag OFF; activación = `STRIPE_ENABLED=true` + secret key.
- **WhatsApp Business API en producción**: ver docs/07-whatsapp-integration.md.
- **Multi-idioma / multi-sede**: la arquitectura de settings por clave lo permite sin cambiar el modelo.
- **Portal del paciente**: el modelo `Patient` está preparado para añadir credenciales (fase futura).
