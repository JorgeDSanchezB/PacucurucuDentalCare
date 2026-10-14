"use client";

// Dashboard: estadísticas + gráfico de 14 días + agenda de hoy + mensajes.
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CalendarCheck, Users, Receipt, Mail, ArrowRight, MessageCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "@/lib/client-api";
import { formatDateShort, formatMoney } from "@/lib/validators";
import { StatusBadge, AdminLoading, AdminError, SectionHeader } from "./shared";
import type { AdminStats } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DashboardView({ goSection }: { goSection: (key: "citas" | "mensajes" | "facturacion" | "pacientes") => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<{ stats: AdminStats }>("/api/admin/stats");
      setStats(res.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (error) return <AdminError message={error} onRetry={load} />;
  if (!stats) return <AdminLoading label="Cargando el panel…" />;

  const cards = [
    { label: "Citas hoy", value: String(stats.todayCount), icon: CalendarDays, hint: `${stats.weekCount} en los próximos 7 días` },
    { label: "Solicitudes pendientes", value: String(stats.pendingRequests), icon: CalendarCheck, hint: "Requieren tu confirmación", action: () => goSection("citas") },
    { label: "Pacientes nuevos (mes)", value: String(stats.newPatientsThisMonth), icon: Users, hint: "Fichas creadas este mes", action: () => goSection("pacientes") },
    { label: "Ingresos del mes", value: formatMoney(stats.monthRevenue), icon: Receipt, hint: "Facturas emitidas este mes", action: () => goSection("facturacion") },
  ];

  const chartData = stats.appointmentsByDay.map((d) => ({
    ...d,
    label: d.date.slice(8, 10) + "/" + d.date.slice(5, 7),
  }));

  return (
    <div className="space-y-8">
      <SectionHeader title="Buen día, doctor" description="Resumen de la clínica hoy." />

      {/* Tarjetas de estadísticas */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              onClick={card.action}
              className={`border-border/60 bg-card ${card.action ? "cursor-pointer transition-shadow hover:shadow-[0_8px_24px_rgba(26,26,46,0.08)]" : ""}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                  {card.label}
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums text-foreground">{card.value}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">{card.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {/* Gráfico: citas por día (14 días) */}
        <Card className="border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Citas de los últimos 14 días</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      background: "var(--card)", border: "1px solid var(--border)",
                      borderRadius: "12px", fontSize: "12px", color: "var(--foreground)",
                    }}
                    labelFormatter={(label) => `Día ${label}`}
                  />
                  <Bar dataKey="count" name="Citas" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Agenda de hoy */}
        <Card className="border-border/60 bg-card">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Agenda de hoy</CardTitle>
            <Button variant="ghost" size="sm" className="rounded-full text-primary" onClick={() => goSection("citas")}>
              Ver todas
              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Button>
          </CardHeader>
          <CardContent>
            {stats.todayAppointments.length === 0 ? (
              <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                No hay citas para hoy. Buen momento para revisar las solicitudes pendientes.
              </p>
            ) : (
              <ul className="max-h-64 space-y-3 overflow-y-auto subtle-scroll pr-1">
                {stats.todayAppointments.map((appt) => (
                  <li key={appt.id} className="flex items-start gap-3 rounded-xl border border-border/50 p-3">
                    <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold tabular-nums text-primary">
                      {appt.startTime}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
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
          </CardContent>
        </Card>
      </div>

      {/* Mensajes recientes */}
      <Card className="border-border/60 bg-card">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Mensajes sin leer
            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {stats.unreadMessages}
            </span>
          </CardTitle>
          <Button variant="ghost" size="sm" className="rounded-full text-primary" onClick={() => goSection("mensajes")}>
            Bandeja
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Button>
        </CardHeader>
        <CardContent>
          {stats.recentMessages.length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">La bandeja está al día.</p>
          ) : (
            <ul className="space-y-3">
              {stats.recentMessages.map((m) => (
                <li key={m.id} className="flex items-start gap-3 rounded-xl border border-border/50 p-3.5">
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {formatDateShort(m.createdAt.slice(0, 10))}
                      </p>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{m.message}</p>
                  </div>
                  {!m.read && <Mail className="h-4 w-4 shrink-0 text-terracotta" aria-hidden />}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
