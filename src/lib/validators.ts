// Validaciones Zod compartidas (cliente + servidor) — única fuente de verdad.
import { z } from "zod";

// "Hoy" en la zona horaria de la clínica (America/Guayaquil, UTC-5 fija).
// SUPUESTO: clínica en Ecuador. Confirmar con el cliente si cambia la sede.
export function clinicToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
  }).format(new Date());
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const dateSchema = z
  .string()
  .regex(dateRegex, "Fecha inválida")
  .refine((d) => d >= clinicToday(), { message: "Selecciona una fecha futura" });

export const timeSchema = z.string().regex(timeRegex, "Hora inválida");

export const patientInfoSchema = z.object({
  firstName: z.string().trim().min(2, "Ingresa tu nombre (mínimo 2 letras)"),
  lastName: z.string().trim().min(2, "Ingresa tu apellido"),
  email: z.string().trim().email("Revisa tu email"),
  phone: z
    .string()
    .trim()
    .min(7, "Ingresa un teléfono válido (mínimo 7 dígitos)")
    .max(20, "Teléfono demasiado largo"),
});

// ─── Público ────────────────────────────────────────────────────────────────
export const bookingSchema = z.object({
  serviceIds: z.array(z.string()).min(1, "Selecciona al menos un servicio"),
  patient: patientInfoSchema,
  date: dateSchema,
  startTime: timeSchema,
  notes: z.string().max(500, "Las notas no pueden exceder 500 caracteres").optional(),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre"),
  email: z.string().trim().email("Revisa tu email"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Cuéntanos un poco más (mínimo 10 caracteres)").max(1000),
});

// ─── Admin: servicios ───────────────────────────────────────────────────────
export const serviceInputSchema = z.object({
  name: z.string().trim().min(2, "Nombre del servicio requerido"),
  description: z.string().trim().min(10, "Descripción de al menos 10 caracteres"),
  duration: z.coerce.number().int().min(5).max(480, "Duración entre 5 y 480 minutos"),
  price: z.coerce.number().min(0).max(10000, "Precio entre 0 y 10000"),
  category: z.string().trim().min(2, "Categoría requerida"),
  imageUrl: z.string().trim().url("URL de imagen inválida").optional().or(z.literal("")).nullable(),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

// ─── Admin: calendario ──────────────────────────────────────────────────────
export const scheduleRowSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
  isActive: z.boolean(),
});

export const scheduleUpdateSchema = z.object({
  schedule: z.array(scheduleRowSchema).length(7, "Se requieren los 7 días"),
});

export const dateBlockSchema = z.object({
  date: z.string().regex(dateRegex, "Fecha inválida"),
  reason: z.string().trim().min(2, "Indica el motivo del bloqueo").max(100),
});

// ─── Admin: citas ───────────────────────────────────────────────────────────
export const appointmentCreateSchema = z
  .object({
    patientId: z.string().optional(),
    newPatient: patientInfoSchema.optional(),
    serviceIds: z.array(z.string()).min(1, "Selecciona al menos un servicio"),
    date: dateSchema,
    startTime: timeSchema,
    notes: z.string().max(500).optional(),
    adminNotes: z.string().max(500).optional(),
    status: z.enum(["PENDING", "CONFIRMED"]).optional(),
  })
  .refine((d) => !!d.patientId || !!d.newPatient, {
    message: "Selecciona un paciente o crea uno nuevo",
    path: ["patientId"],
  });

export const appointmentUpdateSchema = z.object({
  date: dateSchema.optional(),
  startTime: timeSchema.optional(),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  notes: z.string().max(500).nullable().optional(),
  adminNotes: z.string().max(500).nullable().optional(),
});

// ─── Admin: pacientes e historial ───────────────────────────────────────────
export const patientInputSchema = patientInfoSchema.extend({
  birthDate: z
    .string()
    .regex(dateRegex, "Fecha inválida")
    .optional()
    .or(z.literal("")),
});

export const clinicalNoteSchema = z.object({
  patientId: z.string(),
  appointmentId: z.string().optional().nullable(),
  date: z.string().regex(dateRegex, "Fecha inválida"),
  treatment: z.string().trim().min(3, "Describe el tratamiento"),
  observations: z.string().max(2000).optional().or(z.literal("")),
  privateNotes: z.string().max(2000).optional().or(z.literal("")),
});

// ─── Admin: configuración ───────────────────────────────────────────────────
export const settingsSchema = z.object({
  clinic: z.object({
    name: z.string().min(2),
    tagline: z.string().max(80),
    address: z.string().min(2),
    city: z.string().min(2),
    phone: z.string().min(6),
    whatsapp: z.string().min(8),
    email: z.string().email(),
  }),
  doctor: z.object({
    name: z.string().min(2),
    title: z.string().min(2),
    specialty: z.string().min(2),
    bio: z.string().min(20),
    photoUrl: z.string().optional().or(z.literal("")),
    credentials: z.array(z.string()).max(10),
  }),
  hero: z.object({
    title: z.string().min(2).max(60),
    subtitle: z.string().min(10).max(160),
    imageUrl: z.string().optional().or(z.literal("")),
  }),
  about: z.object({
    title: z.string().min(2).max(80),
    text: z.string().min(20).max(2000),
    imageUrl: z.string().optional().or(z.literal("")),
  }),
  social: z.object({
    // Vacío permitido: la red sin enlace simplemente no queda clicable en el pie.
    whatsapp: z.string().max(120),
    instagram: z.string().max(200),
    facebook: z.string().max(200),
    tiktok: z.string().max(200),
  }),
  theme: z.object({
    colors: z.object({
      background: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      foreground: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    }),
  }),
});

// ─── Utilidades de tiempo ───────────────────────────────────────────────────
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(t: string, mins: number): string {
  return fromMinutes(toMinutes(t) + mins);
}

// Formatea "YYYY-MM-DD" a "lun 13 oct 2026" sin dependencias pesadas
export function formatDateLong(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat("es-EC", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
