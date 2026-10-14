# 08 — Guía de deploy (Vercel + Neon)

**Proyecto**: Pacurucu Dental Care

## 1. Resumen del pase a producción

La app corre en un único proyecto Next.js (App Router). El sandbox usa **SQLite**; producción recomienda **PostgreSQL en Neon** (tier gratuito). El schema Prisma no usa características exclusivas de SQLite, por lo que el cambio es de configuración, no de código.

## 2. Paso a paso

### 2.1 Base de datos (Neon)

1. Crear proyecto en [neon.tech](https://neon.tech) → copiar la *connection string* (`postgresql://user:pass@host/db?sslmode=require`).

### 2.2 Código

1. Subir el repositorio a GitHub.
2. `prisma/schema.prisma` → cambiar el datasource:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Ejecutar en local con la URL de Neon:
   ```bash
   bunx prisma migrate dev --name init
   bun prisma/seed.ts        # admin, servicios, settings, contenido demo
   ```
   (El seed es idempotente: puede re-ejecutarse sin duplicar).

### 2.3 Vercel

1. Importar el repo en [vercel.com](https://vercel.com) (framework Next.js detectado).
2. Variables de entorno (Project → Settings → Environment Variables):

   | Variable | Valor | Nota |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://…` | de Neon |
   | `NEXTAUTH_URL` | `https://tudominio.com` | |
   | `NEXTAUTH_SECRET` | aleatorio (openssl rand -base64 32) | **obligatorio en producción** |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | credenciales del odontólogo | usadas por el seed |
   | `WHATSAPP_ENABLED` | `false` (default) | activar tras docs/07 |
   | `STRIPE_ENABLED` | `false` (default) | roadmap |
   | `RESEND_API_KEY` | opcional | habilita el envío real de historiales |

3. Deploy. Primera carga: el `page.tsx` fuerza render dinámico (datos frescos de la DB).

### 2.4 Dominio propio

Vercel → Settings → Domains → añadir `pacurucu.dental` (o el que elija la clínica) y apuntar los DNS según las instrucciones del panel.

## 3. Checklist post-deploy

- [ ] Crear la cita de prueba desde la web y confirmarla en el panel.
- [ ] Verificar el login admin y el cierre de sesión.
- [ ] Descargar PDF de factura e historial.
- [ ] Cambiar la contraseña del admin (el seed no sobrescribe cambios).
- [ ] Revisar `NotificationLog` en el panel (debe mostrar SIMULATED hasta activar WhatsApp).

## 4. Migración de la SPA a páginas SSR (opcional, SEO completo)

La v1 renderiza el contenido público por SSR en `/` y navega por hash (`#/reservar`, `#/admin`). Si se quieren URLs reales para SEO:

1. Mover cada vista de `src/components/public/` a su propia ruta (`src/app/reservar/page.tsx`, etc.) reutilizando los mismos componentes y queries.
2. La capa de API y los módulos de dominio **no cambian** (esa fue la decisión de arquitectura).
3. Redirigir los hash antiguos con un pequeño script en `layout.tsx`.

## 5. Alternativas documentadas

- **Supabase** (DB + auth gestionados): cambiar Prisma por el cliente de Supabase y NextAuth por Supabase Auth. Decisión no tomada en v1 para mantener portabilidad SQL pura.
- **Railway**: alternativa a Neon con Postgres gestionado (plan inicial gratuito).
- **Cal.com**: sistema de reservas pre-construido; se descartó porque el flujo de WhatsApp + panel clínico + facturación interna es específico del dominio.

## 6. Backups

- Neon: PITR (point-in-time recovery) disponible; export semanal con `pg_dump` recomendado.
- Documentos (facturas/historiales) se regeneran desde la DB en cualquier momento (no hay archivos que respaldar).
