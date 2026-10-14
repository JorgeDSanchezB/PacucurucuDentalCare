// Tipos compartidos cliente/servidor — Pacurucu Dental Care

// ─── Estados ────────────────────────────────────────────────────────────────
export const APPOINTMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

export const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

// ─── DTOs públicos ──────────────────────────────────────────────────────────
export interface ServicePublicDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  duration: number;
  price: number;
  category: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface TestimonialDTO {
  id: string;
  patientName: string;
  rating: number;
  text: string;
}

export interface FaqDTO {
  id: string;
  question: string;
  answer: string;
}

export interface GalleryDTO {
  id: string;
  title: string;
  imageUrl: string;
}

// ─── Configuración (ClinicSetting key → JSON) ───────────────────────────────
export interface ClinicInfo {
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  whatsapp: string;
  email: string;
}

export interface DoctorInfo {
  name: string;
  title: string;
  specialty: string;
  bio: string;
  photoUrl: string;
  credentials: string[];
}

export interface HeroContent {
  title: string;
  subtitle: string;
  imageUrl: string;
}

export interface AboutContent {
  title: string;
  text: string;
  imageUrl: string;
}

export interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
}

// Redes sociales del pie: aceptan URL completa, @usuario o número (WhatsApp).
export interface SocialLinks {
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
}

export interface ClinicSettings {
  clinic: ClinicInfo;
  social: SocialLinks;
  doctor: DoctorInfo;
  hero: HeroContent;
  about: AboutContent;
  theme: { colors: ThemeColors };
}

export interface FlagDTO {
  key: string;
  enabled: boolean;
  description: string;
}

// ─── Datos iniciales que el server component pasa a la SPA ──────────────────
export interface InitialPublicData {
  settings: ClinicSettings;
  services: ServicePublicDTO[];
  testimonials: TestimonialDTO[];
  faqs: FaqDTO[];
  gallery: GalleryDTO[];
  schedule: ScheduleRow[];
}

// ─── DTOs admin ─────────────────────────────────────────────────────────────
export interface ServiceAdminDTO extends ServicePublicDTO {
  active: boolean;
}

export interface AppointmentServiceRow {
  id: string;
  name: string;
  price: number;
  duration: number;
}

export interface AppointmentRow {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  source: string;
  notes: string | null;
  adminNotes: string | null;
  createdAt: string;
  patient: { id: string; firstName: string; lastName: string; phone: string; email: string };
  services: AppointmentServiceRow[];
  hasInvoice?: boolean;
}

export interface PatientRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate: string | null;
  createdAt: string;
  appointmentCount?: number;
}

export interface ClinicalNoteRow {
  id: string;
  date: string;
  treatment: string;
  observations: string | null;
  privateNotes: string | null;
  appointmentId: string | null;
}

export interface InvoiceRow {
  id: string;
  number: number;
  date: string;
  patientId: string;
  patientName: string;
  total: number;
  subtotal: number;
  paymentMethod: string;
  appointmentId: string | null;
}

export interface ScheduleRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface DateBlockRow {
  id: string;
  date: string;
  reason: string;
}

export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AdminStats {
  todayCount: number;
  weekCount: number;
  newPatientsThisMonth: number;
  monthRevenue: number;
  pendingRequests: number;
  unreadMessages: number;
  appointmentsByDay: { date: string; count: number }[];
  todayAppointments: AppointmentRow[];
  recentMessages: ContactMessageRow[];
}

// ─── Respuestas API ─────────────────────────────────────────────────────────
export interface Paginated<T> {
  ok: true;
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}
