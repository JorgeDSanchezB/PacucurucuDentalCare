"use client";

// Calendario: vista mensual + semanal de citas, horarios semanales editables
// y bloqueo de fechas (vacaciones, feriados).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CalendarRange, Save, Plus, Trash2, Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiPost } from "@/lib/client-api";
import { DAY_LABELS, STATUS_LABELS, type AppointmentRow, type DateBlockRow, type ScheduleRow } from "@/types";
import { clinicToday, formatDateLong } from "@/lib/validators";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge, AdminEmpty, AdminLoading, AdminError, SectionHeader } from "./shared";

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-[#e3b341]",
  CONFIRMED: "bg-primary",
  COMPLETED: "bg-[#4caf6d]",
  CANCELLED: "bg-muted-foreground/40",
  NO_SHOW: "bg-terracotta",
};

export function CalendarView() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Calendario" description="Vista de citas por mes y semana, horarios de atención y bloqueos." />
      <Tabs defaultValue="mes">
        <TabsList className="rounded-xl">
          <TabsTrigger value="mes" className="rounded-lg">
            <CalendarDays className="mr-1.5 h-4 w-4" aria-hidden /> Mes
          </TabsTrigger>
          <TabsTrigger value="semana" className="rounded-lg">
            <CalendarRange className="mr-1.5 h-4 w-4" aria-hidden /> Semana
          </TabsTrigger>
          <TabsTrigger value="horarios" className="rounded-lg">Horarios y bloqueos</TabsTrigger>
        </TabsList>
        <TabsContent value="mes" className="mt-6">
          <MonthView />
        </TabsContent>
        <TabsContent value="semana" className="mt-6">
          <WeekView />
        </TabsContent>
        <TabsContent value="horarios" className="mt-6">
          <ScheduleEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Vista mensual ───────────────────────────────────────────────────────────

function MonthView() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [appointments, setAppointments] = useState<AppointmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const base = new Date(`${clinicToday()}T12:00:00`);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear();
  const month = base.getMonth();

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<{ items: AppointmentRow[] }>(
        `/api/admin/appointments?date=${monthStart}&date2=${monthEnd}&page=1&pageSize=200`
      );
      setAppointments(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, [monthStart, monthEnd]);

  // OJO: la API de listado filtra por una sola fecha; para la vista mensual
  // pedimos todas y filtramos en cliente (volumen <500/mes, ver docs/05).
  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<{ items: AppointmentRow[] }>("/api/admin/appointments?page=1");
      // Traer más páginas si existen
      let items = res.items;
      for (let p = 2; p <= Math.min(res.pageCount, 10); p++) {
        const more = await apiGet<{ items: AppointmentRow[] }>(`/api/admin/appointments?page=${p}`);
        items = [...items, ...more.items];
      }
      setAppointments(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);
  void load;

  const byDate = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const appt of appointments ?? []) {
      const list = map.get(appt.date) ?? [];
      list.push(appt);
      map.set(appt.date, list);
    }
    return map;
  }, [appointments]);

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // lunes primero
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dayAppts = selectedDay ? (byDate.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-6">
      {error ? <AdminError message={error} onRetry={loadAll} /> : appointments === null ? <AdminLoading /> : (
        <>
          <div className="flex items-center justify-between">
            <p className="font-serif text-lg font-semibold text-foreground">
              {new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(base)}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m + 1)} aria-label="Mes siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <p key={d} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {d}
              </p>
            ))}
            {Array.from({ length: firstWeekday }).map((_, i) => <span key={`b-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const appts = byDate.get(dateStr) ?? [];
              const active = appts.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED" || a.status === "COMPLETED");
              const isSelected = selectedDay === dateStr;
              const isToday = dateStr === clinicToday();
              return (
                <button
                  key={dayNum}
                  onClick={() => setSelectedDay(dateStr)}
                  aria-label={`${dayNum}: ${appts.length} citas`}
                  className={`flex min-h-20 flex-col rounded-xl border p-2 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : appts.length > 0
                        ? "border-border/60 bg-card hover:border-primary/40"
                        : "border-border/40 bg-card/50 hover:bg-muted/40"
                  }`}
                >
                  <span className={`text-xs font-semibold tabular-nums ${isToday ? "rounded-full bg-foreground px-1.5 py-0.5 text-background" : "text-foreground"}`}>
                    {dayNum}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {appts.slice(0, 4).map((a) => (
                      <span key={a.id} className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[a.status] ?? "bg-muted-foreground"}`} aria-hidden />
                    ))}
                    {appts.length > 4 && <span className="text-[10px] text-muted-foreground tabular-nums">+{appts.length - 4}</span>}
                  </span>
                  {active.length > 0 && (
                    <span className="mt-auto pt-1 text-[10px] tabular-nums text-muted-foreground">{active.length} act.</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[key]}`} aria-hidden />
                {label}
              </span>
            ))}
          </div>

          {/* Detalle del día */}
          {selectedDay && (
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <p className="font-serif text-lg font-semibold text-foreground">{formatDateLong(selectedDay)}</p>
              {dayAppts.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Sin citas este día.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {dayAppts.map((appt) => (
                    <li key={appt.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 p-3.5">
                      <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary">
                        {appt.startTime}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {appt.patient.firstName} {appt.patient.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {appt.services.map((s) => s.name).join(" · ")}
                        </p>
                      </div>
                      <StatusBadge status={appt.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Vista semanal ───────────────────────────────────────────────────────────

function WeekView() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [appointments, setAppointments] = useState<AppointmentRow[] | null>(null);

  useEffect(() => {
    apiGet<{ items: AppointmentRow[] }>("/api/admin/appointments?page=1")
      .then(async (res) => {
        let items = res.items;
        for (let p = 2; p <= Math.min(res.pageCount, 10); p++) {
          const more = await apiGet<{ items: AppointmentRow[] }>(`/api/admin/appointments?page=${p}`);
          items = [...items, ...more.items];
        }
        setAppointments(items);
      })
      .catch(() => setAppointments([]));
  }, []);

  // Semana actual (inicia lunes)
  const monday = useMemo(() => {
    const d = new Date(`${clinicToday()}T12:00:00`);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, [monday]);

  const byDate = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const appt of appointments ?? []) {
      const list = map.get(appt.date) ?? [];
      list.push(appt);
      map.set(appt.date, list);
    }
    return map;
  }, [appointments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="font-serif text-lg font-semibold text-foreground">
          Semana del {formatDateLong(weekDays[0])}
        </p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Semana siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {appointments === null ? <AdminLoading /> : (
        <div className="grid gap-3 md:grid-cols-7">
          {weekDays.map((date, i) => {
            const appts = (byDate.get(date) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
            const isToday = date === clinicToday();
            return (
              <div
                key={date}
                className={`min-h-44 rounded-2xl border p-3 ${
                  isToday ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card"
                }`}
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {DAY_LABELS[(i + 1) % 7].slice(0, 3)}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{date.slice(8, 10)}</p>
                <ul className="mt-2 space-y-2">
                  {appts.length === 0 ? (
                    <li className="text-[11px] text-muted-foreground/70">Libre</li>
                  ) : (
                    appts.map((appt) => (
                      <li key={appt.id} className="rounded-lg bg-muted/50 p-2">
                        <p className="text-[11px] font-semibold tabular-nums text-primary">{appt.startTime}</p>
                        <p className="truncate text-[11px] text-foreground">
                          {appt.patient.firstName} {appt.patient.lastName}
                        </p>
                        <span className={`mt-1 block h-1 w-6 rounded-full ${STATUS_DOT[appt.status]}`} aria-hidden />
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Editor de horarios + bloqueos ───────────────────────────────────────────

function ScheduleEditor() {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleRow[] | null>(null);
  const [dateBlocks, setDateBlocks] = useState<DateBlockRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [newBlock, setNewBlock] = useState({ date: "", reason: "" });

  useEffect(() => {
    apiGet<{ schedule: ScheduleRow[]; dateBlocks: DateBlockRow[] }>("/api/admin/schedule")
      .then((res) => {
        setSchedule(res.schedule);
        setDateBlocks(res.dateBlocks);
      })
      .catch(() => {
        setSchedule([]);
        setDateBlocks([]);
      });
  }, []);

  const updateDay = (dayOfWeek: number, patch: Partial<ScheduleRow>) => {
    setSchedule((rows) =>
      (rows ?? []).map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r))
    );
  };

  const saveSchedule = async () => {
    if (!schedule) return;
    // Validación local antes de enviar
    for (const row of schedule) {
      if (row.isActive && row.startTime >= row.endTime) {
        toast({
          title: "Horario inválido",
          description: `${DAY_LABELS[row.dayOfWeek]}: la hora de inicio debe ser menor a la de cierre.`,
          variant: "destructive",
        });
        return;
      }
    }
    setSaving(true);
    try {
      await apiPost("/api/admin/schedule", { schedule }, "PUT");
      toast({ title: "Horarios actualizados", description: "La disponibilidad de reservas ya refleja los cambios." });
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async () => {
    if (!newBlock.date || !newBlock.reason.trim()) {
      toast({ title: "Completa fecha y motivo", variant: "destructive" });
      return;
    }
    try {
      const res = await apiPost<{ block: DateBlockRow }>("/api/admin/date-blocks", newBlock);
      setDateBlocks((blocks) => [...(blocks ?? []), res.block].sort((a, b) => a.date.localeCompare(b.date)));
      setNewBlock({ date: "", reason: "" });
      toast({ title: "Fecha bloqueada", description: "Ese día no aceptará reservas." });
    } catch (e) {
      toast({ title: "No se pudo bloquear", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const removeBlock = async (id: string) => {
    try {
      await apiPost(`/api/admin/date-blocks/${id}`, null, "DELETE");
      setDateBlocks((blocks) => (blocks ?? []).filter((b) => b.id !== id));
    } catch (e) {
      toast({ title: "No se pudo desbloquear", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  if (schedule === null) return <AdminLoading />;

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
      {/* Horario semanal */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <p className="font-serif text-lg font-semibold text-foreground">Horario semanal</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Define por día si hay atención y en qué franja. Los cambios afectan la disponibilidad del sitio.
        </p>
        <div className="mt-5 space-y-3">
          {schedule.map((row) => (
            <div key={row.dayOfWeek} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 p-3">
              <span className="w-24 text-sm font-medium text-foreground">{DAY_LABELS[row.dayOfWeek]}</span>
              <Switch
                checked={row.isActive}
                onCheckedChange={(checked) => updateDay(row.dayOfWeek, { isActive: checked })}
                aria-label={`Atención ${DAY_LABELS[row.dayOfWeek]}`}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={row.startTime}
                  disabled={!row.isActive}
                  onChange={(e) => updateDay(row.dayOfWeek, { startTime: e.target.value })}
                  className="w-28 rounded-xl tabular-nums disabled:opacity-50"
                  aria-label={`Apertura ${DAY_LABELS[row.dayOfWeek]}`}
                />
                <span className="text-muted-foreground">a</span>
                <Input
                  type="time"
                  value={row.endTime}
                  disabled={!row.isActive}
                  onChange={(e) => updateDay(row.dayOfWeek, { endTime: e.target.value })}
                  className="w-28 rounded-xl tabular-nums disabled:opacity-50"
                  aria-label={`Cierre ${DAY_LABELS[row.dayOfWeek]}`}
                />
              </div>
            </div>
          ))}
        </div>
        <Button onClick={saveSchedule} disabled={saving} className="mt-5 rounded-full font-medium">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-1.5 h-4 w-4" aria-hidden />}
          Guardar horarios
        </Button>
      </div>

      {/* Bloqueos */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <p className="font-serif text-lg font-semibold text-foreground">Bloqueo de fechas</p>
        <p className="mt-1 text-sm text-muted-foreground">Vacaciones, feriados o días de capacitación.</p>

        <div className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="block-date">Fecha</Label>
            <Input
              id="block-date"
              type="date"
              min={clinicToday()}
              value={newBlock.date}
              onChange={(e) => setNewBlock((b) => ({ ...b, date: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block-reason">Motivo</Label>
            <Input
              id="block-reason"
              value={newBlock.reason}
              onChange={(e) => setNewBlock((b) => ({ ...b, reason: e.target.value }))}
              placeholder="Ej: Congreso de odontología"
              className="rounded-xl"
            />
          </div>
          <Button onClick={addBlock} variant="outline" className="w-full rounded-full">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Bloquear fecha
          </Button>
        </div>

        <div className="mt-6">
          {dateBlocks === null ? (
            <AdminLoading label="Cargando bloqueos…" />
          ) : dateBlocks.length === 0 ? (
            <AdminEmpty title="Sin fechas bloqueadas" />
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto subtle-scroll pr-1">
              {dateBlocks.map((block) => (
                <li key={block.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3">
                  <div>
                    <p className="text-sm font-medium tabular-nums text-foreground">{formatDateLong(block.date)}</p>
                    <p className="text-xs text-muted-foreground">{block.reason}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => removeBlock(block.id)} aria-label="Quitar bloqueo">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
