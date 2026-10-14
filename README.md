# Pacurucu Dental Care

Web oficial de la clínica: sitio público, sistema de reservas online y panel de administración para el odontólogo.

> Repositorio de **código y documentación**. Los datos (pacientes, citas, facturas) viven en la base de datos del servidor y **no se versionan aquí**.

## Accesos

| Zona | Dónde | Credenciales |
|---|---|---|
| Sitio público | `/` | Sin credenciales |
| Reserva de cita | `#/reservar` | Sin credenciales |
| Panel admin | `#/admin` | Las que definas en `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) |

> El usuario admin se crea con el seed (`bun prisma/seed.ts`) leyendo `ADMIN_EMAIL` y `ADMIN_PASSWORD` del `.env`. El seed no sobrescribe un password ya cambiado manualmente. **Nunca subas el `.env` ni la base de datos a un repositorio**: contienen secretos y datos de pacientes.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma (SQLite en sandbox, PostgreSQL en producción) · NextAuth v4 (JWT) · pdf-lib · Framer Motion · Zod.

## Comandos

```bash
bun run dev          # servidor de desarrollo (puerto 3000)
bun run lint         # ESLint
bun run db:push      # aplicar schema a la DB
bun prisma/seed.ts   # datos iniciales (idempotente)
```

## Estructura

```
docs/               # arquitectura, modelo de datos, contratos API, flags, umbrales, deploy
prisma/             # schema + seed
src/app/page.tsx    # SSR inicial + SPA (hash-routing)
src/app/api/        # API routes (públicas y admin con sesión)
src/components/     # public/ (sitio) · admin/ (panel) · ui/ (shadcn)
src/modules/        # lógica de dominio: citas, servicios, historial, facturación, settings
src/lib/            # db, auth, whatsapp, email, pdf, flags, validación Zod
```

## Reglas del proyecto

1. **Cero hardcoding**: servicios, horarios, textos, tema y flags viven en la base de datos; se editan desde el panel admin.
2. **Extensibilidad**: un servicio nuevo se crea desde el panel y aparece solo en la web y en la reserva.
3. **Escalabilidad**: listados con paginación server-side; umbrales de virtualización documentados en `docs/05`.
4. **Tolerancia a fallos**: degradación con mensajes claros (WhatsApp caído, email fallido, día sin disponibilidad, DB caída).

## Estado honesto de las integraciones

- **WhatsApp Business API**: implementado (`src/lib/whatsapp.ts`), flag `WHATSAPP_ENABLED=false`. **No probado contra la API real.** Guía completa: `docs/07-whatsapp-integration.md`.
- **Stripe**: módulo reservado con flag `STRIPE_ENABLED=false` (endpoint responde 501).
- **Email (Resend)**: wrapper listo; sin API key funciona en modo simulado con descarga del PDF como fallback.
- **Tests**: no existen suites automatizadas en v1. La verificación se realizó con ESLint + auditoría en navegador real (flujos completos de reserva, login admin y gestión de citas).
