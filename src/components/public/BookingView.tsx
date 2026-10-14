"use client";

// Flujo de reserva multi-paso: servicios → datos → fecha/hora → confirmación.
// v1 (WHATSAPP_ENABLED=false): la solicitud se registra y el paciente ve el
// mensaje "Tu solicitud ha sido recibida…". El admin confirma desde el panel.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, CalendarCheck, Check, CheckCircle2, Clock, Loader2,
  MessageCircle, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ServiceImage } from "./ServiceImage";
import { apiGet, apiPost } from "@/lib/client-api";
import { bookingSchema, clinicToday, formatDateLong, formatDuration, formatMoney } from "@/lib/validators";
import { type ClinicSettings, type ScheduleRow, type ServicePublicDTO } from "@/types";
import { useToast } from "@/hooks/use-toast";

interface BookingViewProps {
  services: ServicePublicDTO[];
  settings: ClinicSettings;
  schedule: ScheduleRow[];
  navigate: (path: string) => void;
  initialSelection: string[];
}

const STEPS = ["Servicios", "Tus datos", "Fecha y hora"];

export function BookingView({ services, settings, schedule, navigate, initialSelection }: BookingViewProps) {
  const [step, setStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection);
  const [patient, setPatient] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [date, setDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsMessage, setSlotsMessage] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ appointmentId: string; message: string } | null>(null);
  const { toast } = useToast();

  const selectedServices = useMemo(
    () => services.filter((s) => selectedIds.includes(s.id)),
    [services, selectedIds]
  );
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  // ─── Fechas cerradas por horario semanal (client-side) ───────────────────
  const scheduleMap = useMemo(() => {
    const map = new Map<number, ScheduleRow>();
    for (const row of schedule) map.set(row.dayOfWeek, row);
    return map;
  }, [schedule]);

  const isDayClosed = useCallback(
    (dateStr: string) => {
      const row = scheduleMap.get(new Date(`${dateStr}T12:00:00`).getDay());
      return !row?.isActive;
    },
    [scheduleMap]
  );

  const fetchSlots = useCallback(
    async (dateStr: string) => {
      setLoadingSlots(true);
      setSlots(null);
      setStartTime("");
      setSlotsMessage("");
      try {
        const res = await apiGet<{ closed: boolean; slots: string[]; reason?: string }>(
          `/api/public/availability?date=${dateStr}&duration=${totalDuration || 30}`
        );
        if (res.closed) {
          setSlots([]);
          setSlotsMessage(res.reason ?? "La clínica no atiende esta fecha.");
        } else {
          setSlots(res.slots);
          if (res.slots.length === 0) {
            setSlotsMessage("No hay horarios disponibles para esta fecha. Prueba otra fecha.");
          }
        }
      } catch (err) {
        setSlots([]);
        setSlotsMessage(err instanceof Error ? err.message : "No se pudo consultar la disponibilidad.");
      } finally {
        setLoadingSlots(false);
      }
    },
    [totalDuration]
  );

  useEffect(() => {
    if (date && step === 2) void fetchSlots(date);
  }, [date, step, fetchSlots]);

  // ─── Navegación de pasos con validación ──────────────────────────────────
  const goNext = () => {
    if (step === 0) {
      if (selectedIds.length === 0) {
        toast({ title: "Selecciona al menos un servicio", description: "Marca los tratamientos que necesitas." });
        return;
      }
    }
    if (step === 1) {
      const parsed = bookingSchema.safeParse({
        serviceIds: selectedIds,
        patient: {
          firstName: patient.firstName, lastName: patient.lastName,
          email: patient.email, phone: patient.phone,
        },
        date: date || "2099-12-31", // la fecha se valida en el paso 3
        startTime: "09:00",
      });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[1] ?? issue.path[0] ?? "form");
          if (!errs[key]) errs[key] = issue.message;
        }
        setFieldErrors(errs);
        return;
      }
      setFieldErrors({});
    }
    setStep((s) => Math.min(s + 1, 2));
  };

  const submit = async () => {
    if (!date || !startTime) {
      toast({ title: "Elige fecha y hora", description: "Selecciona un día y una franja disponible." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ appointmentId: string; message: string }>("/api/public/bookings", {
        serviceIds: selectedIds,
        patient: {
          firstName: patient.firstName, lastName: patient.lastName,
          email: patient.email, phone: patient.phone,
        },
        date,
        startTime,
        notes: patient.notes || undefined,
      });
      setResult(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Intenta de nuevo.";
      // 409: la franja se ocupó → volver al paso 3 y recargar disponibilidad
      if (message.includes("ocup") || message.includes("disponib")) {
        setStep(2);
        if (date) void fetchSlots(date);
      }
      toast({ title: "No se pudo registrar la solicitud", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Confirmación (v1) ────────────────────────────────────────────────────
  if (result) {
    return (
      <BookingSuccess
        message={result.message}
        settings={settings}
        navigate={navigate}
        patientEmail={patient.email}
      />
    );
  }

  // Entrada del panel por paso: animación CSS nativa (ver globals.css). Si por
  // cualquier motivo la animación no se ejecuta, el contenido queda visible —
  // a diferencia de initial/animate de framer, que dejaba el panel en opacity 0.
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 md:py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Reserva de cita</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Tres pasos y listo
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("")} className="rounded-full text-muted-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          Volver
        </Button>
      </div>

      {/* Indicador de progreso */}
      <ol className="mt-8 flex items-center gap-2" aria-label="Progreso de la reserva">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={`hidden text-sm font-medium sm:inline ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* ─── Panel principal por paso ─────────────────────────────── */}
        <div key={step} className="anim-panel-in">
          {step === 0 && (
            <StepServices
              services={services}
              selectedIds={selectedIds}
              toggle={(id) =>
                setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
              }
            />
          )}
          {step === 1 && (
            <StepPatient patient={patient} setPatient={setPatient} errors={fieldErrors} />
          )}
          {step === 2 && (
            <StepDateTime
              date={date}
              setDate={(d) => {
                setDate(d);
                setStartTime("");
              }}
              startTime={startTime}
              setStartTime={setStartTime}
              slots={slots}
              slotsMessage={slotsMessage}
              loadingSlots={loadingSlots}
              isDayClosed={isDayClosed}
            />
          )}
        </div>

        {/* ─── Resumen lateral ───────────────────────────────────────── */}
        <aside className="h-fit rounded-3xl border border-border/60 bg-card p-6 lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tu reserva</p>
          {selectedServices.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Aún no has seleccionado servicios. Elige los tratamientos que necesitas en el paso 1.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {selectedServices.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="leading-snug text-foreground">{s.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatMoney(s.price)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Duración total</span>
              <span className="tabular-nums font-medium text-foreground">{formatDuration(totalDuration)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Total estimado</span>
              <span className="tabular-nums font-semibold text-primary">{formatMoney(totalPrice)}</span>
            </div>
            {step === 2 && date && startTime && (
              <div className="flex justify-between text-muted-foreground">
                <span>Fecha</span>
                <span className="text-right font-medium text-foreground">
                  {formatDateLong(date)} · {startTime}
                </span>
              </div>
            )}
            <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
              El pago se realiza en la clínica (efectivo o transferencia). La cita se confirma por WhatsApp.
            </p>
          </div>
        </aside>
      </div>

      {/* ─── Barra de acciones ─────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-full"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Anterior
        </Button>
        {step < 2 ? (
          <Button onClick={goNext} className="rounded-full px-6 font-medium">
            Continuar
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button onClick={submit} disabled={submitting || !date || !startTime} className="rounded-full px-6 font-medium">
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                Enviando solicitud…
              </>
            ) : (
              <>
                <CalendarCheck className="mr-1.5 h-4 w-4" aria-hidden />
                Solicitar cita
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── PASO 1: servicios ───────────────────────────────────────────────────────

function StepServices({
  services,
  selectedIds,
  toggle,
}: {
  services: ServicePublicDTO[];
  selectedIds: string[];
  toggle: (id: string) => void;
}) {
  const categories: { name: string; items: ServicePublicDTO[] }[] = [];
  for (const service of services) {
    const existing = categories.find((c) => c.name === service.category);
    if (existing) existing.items.push(service);
    else categories.push({ name: service.category, items: [service] });
  }

  return (
    <div className="space-y-8">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Selecciona uno o más tratamientos. La duración y el costo se suman automáticamente.
      </p>
      {categories.map((cat) => (
        <div key={cat.name}>
          <h2 className="mb-4 font-serif text-xl font-semibold text-foreground">{cat.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {cat.items.map((service) => {
              const selected = selectedIds.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggle(service.id)}
                  aria-pressed={selected}
                  className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 ${
                    selected
                      ? "border-primary bg-primary/[0.06] shadow-[0_4px_20px_rgba(10,123,131,0.10)]"
                      : "border-border/60 bg-card hover:border-primary/50"
                  }`}
                >
                  <ServiceImage name={service.name} imageUrl={service.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-serif text-base font-semibold leading-snug text-foreground">{service.name}</p>
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                        }`}
                        aria-hidden
                      >
                        {selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 text-muted-foreground" />}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {service.description}
                    </p>
                    <p className="mt-2.5 flex items-center gap-3 text-xs font-medium text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {formatDuration(service.duration)}
                      </span>
                      <span className="tabular-nums text-primary">{formatMoney(service.price)}</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PASO 2: datos del paciente ──────────────────────────────────────────────

function StepPatient({
  patient,
  setPatient,
  errors,
}: {
  patient: { firstName: string; lastName: string; email: string; phone: string; notes: string };
  setPatient: React.Dispatch<React.SetStateAction<{ firstName: string; lastName: string; email: string; phone: string; notes: string }>>;
  errors: Record<string, string>;
}) {
  const set = (key: keyof typeof patient) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setPatient((p) => ({ ...p, [key]: e.target.value }));

  const Field = (key: keyof typeof patient, label: string, extra?: Record<string, unknown>) => (
    <div className="space-y-1.5">
      <Label htmlFor={`p-${key}`}>{label}</Label>
      <Input id={`p-${key}`} value={patient[key]} onChange={set(key)} aria-invalid={!!errors[key]} {...extra} />
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Con estos datos creamos tu ficha de paciente y te contactamos para confirmar.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {Field("firstName", "Nombre", { placeholder: "María", autoComplete: "given-name" })}
        {Field("lastName", "Apellido", { placeholder: "Loor", autoComplete: "family-name" })}
      </div>
      {Field("email", "Email", { placeholder: "tu@email.com", type: "email", autoComplete: "email" })}
      {Field("phone", "Teléfono (WhatsApp)", { placeholder: "+593 99 000 0000", type: "tel", autoComplete: "tel" })}
      <div className="space-y-1.5">
        <Label htmlFor="p-notes">Comentarios (opcional)</Label>
        <Textarea
          id="p-notes"
          value={patient.notes}
          onChange={set("notes")}
          placeholder="Ej: prefiero la tarde, tengo sensibilidad al frío…"
          rows={4}
        />
      </div>
    </div>
  );
}

// ─── PASO 3: fecha y hora ────────────────────────────────────────────────────

function StepDateTime({
  date,
  setDate,
  startTime,
  setStartTime,
  slots,
  slotsMessage,
  loadingSlots,
  isDayClosed,
}: {
  date: string;
  setDate: (d: string) => void;
  startTime: string;
  setStartTime: (t: string) => void;
  slots: string[] | null;
  slotsMessage: string;
  loadingSlots: boolean;
  isDayClosed: (dateStr: string) => boolean;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = clinicToday();

  // Mes visible
  const base = new Date(`${today}T12:00:00`);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // semana inicia lunes

  const dayDisabled = (dayNum: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return dateStr < today || isDayClosed(dateStr);
  };

  const dayDate = (dayNum: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Calendario */}
      <div>
        <div className="flex items-center justify-between">
          <p className="font-serif text-lg font-semibold text-foreground">
            {new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(base)}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => Math.max(0, m - 1))} disabled={monthOffset === 0} aria-label="Mes anterior">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => Math.min(3, m + 1))} disabled={monthOffset === 3} aria-label="Mes siguiente">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Calendario de disponibilidad">
          {["l", "m", "m", "j", "v", "s", "d"].map((d, i) => (
            <span key={i} className="py-1 text-[11px] font-semibold uppercase text-muted-foreground" aria-hidden>
              {d}
            </span>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const disabled = dayDisabled(dayNum);
            const dateStr = dayDate(dayNum);
            const selected = date === dateStr;
            return (
              <button
                key={dayNum}
                type="button"
                disabled={disabled}
                onClick={() => setDate(dateStr)}
                aria-pressed={selected}
                aria-label={disabled ? undefined : `Seleccionar ${formatDateLong(dateStr)}`}
                className={`h-10 rounded-xl text-sm transition-colors ${
                  disabled
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : selected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                }`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Los días atenuados no tienen atención. Si un día aparece disponible pero sin franjas, ya está reservado o bloqueado: prueba otra fecha.
        </p>
      </div>

      {/* Franjas horarias */}
      <div>
        <p className="font-serif text-lg font-semibold text-foreground">Franjas disponibles</p>
        {!date && <p className="mt-4 text-sm text-muted-foreground">Selecciona un día del calendario.</p>}
        {date && loadingSlots && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Consultando disponibilidad…
          </div>
        )}
        {date && !loadingSlots && slots && slots.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-label="Horarios disponibles">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setStartTime(slot)}
                aria-pressed={startTime === slot}
                className={`rounded-xl border px-2 py-2.5 text-sm tabular-nums transition-colors ${
                  startTime === slot
                    ? "border-primary bg-primary font-semibold text-primary-foreground"
                    : "border-border/60 bg-card text-foreground hover:border-primary/50"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        )}
        {date && !loadingSlots && slotsMessage && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
            {slotsMessage}
          </div>
        )}
        {startTime && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Clock className="h-4 w-4" aria-hidden />
            {formatDateLong(date)} a las {startTime}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── CONFIRMACIÓN v1 ─────────────────────────────────────────────────────────

function BookingSuccess({
  message,
  settings,
  navigate,
  patientEmail,
}: {
  message: string;
  settings: ClinicSettings;
  navigate: (path: string) => void;
  patientEmail: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-16 sm:px-6">
      <div
        className="anim-rise-in w-full rounded-3xl border border-border/60 bg-card p-10 text-center shadow-[0_12px_40px_rgba(26,26,46,0.07)]"
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden />
        </span>
        <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-foreground">
          Solicitud registrada
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{message}</p>
        {patientEmail && (
          <p className="mt-2 text-sm text-muted-foreground">
            Enviamos la referencia a <span className="font-medium text-foreground">{patientEmail}</span> en tu ficha de paciente.
          </p>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {settings.clinic.whatsapp && (
            <a
              href={`https://wa.me/${settings.clinic.whatsapp.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="outline" className="rounded-full">
                <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden />
                Escribir por WhatsApp
              </Button>
            </a>
          )}
          <Button onClick={() => navigate("")} className="rounded-full font-medium">
            Volver al inicio
          </Button>
        </div>
      </div>
    </div>
  );
}
