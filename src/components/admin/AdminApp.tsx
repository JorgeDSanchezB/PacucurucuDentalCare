"use client";

// Panel de administración: login + shell con navegación por secciones.
// Ruta: #/admin/<seccion>. Sesión NextAuth (JWT en cookie httpOnly).
import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  LayoutDashboard, CalendarDays, CalendarRange, Stethoscope, Users,
  Receipt, Mail, Settings, LogOut, Loader2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DashboardView } from "./DashboardView";
import { AppointmentsView } from "./AppointmentsView";
import { CalendarView } from "./CalendarView";
import { ServicesView } from "./ServicesView";
import { PatientsView } from "./PatientsView";
import { InvoicesView } from "./InvoicesView";
import { MessagesView } from "./MessagesView";
import { SettingsView } from "./SettingsView";

const SECTIONS = [
  { key: "dashboard", label: "Panel", icon: LayoutDashboard },
  { key: "citas", label: "Citas", icon: CalendarDays },
  { key: "calendario", label: "Calendario", icon: CalendarRange },
  { key: "servicios", label: "Servicios", icon: Stethoscope },
  { key: "pacientes", label: "Pacientes", icon: Users },
  { key: "facturacion", label: "Facturación", icon: Receipt },
  { key: "mensajes", label: "Mensajes", icon: Mail },
  { key: "configuracion", label: "Configuración", icon: Settings },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

export function AdminApp({ section, navigate }: { section: string; navigate: (path: string) => void }) {
  const { data: session, status } = useSession({ required: false });
  void session;

  // Redirige secciones desconocidas al dashboard
  const activeSection = (SECTIONS.find((s) => s.key === section)?.key ?? "dashboard") as SectionKey;

  const goSection = (key: SectionKey) => navigate(`admin/${key}`);

  if (status === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Verificando sesión…
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return <LoginView />;
  }

  return (
    <div className="min-h-[100dvh] bg-background lg:grid lg:grid-cols-[260px_1fr]">
      {/* Sidebar desktop */}
      <aside className="hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="border-b border-sidebar-border px-6 py-6">
          <p className="font-serif text-lg font-semibold">Pacurucu Dental</p>
          <p className="mt-0.5 text-xs text-sidebar-foreground/60">Panel del odontólogo</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Secciones del panel">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => goSection(s.key)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4.5 w-4.5" width={18} height={18} aria-hidden />
                {s.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 px-2">
            <p className="text-sm font-medium">{session.user?.name ?? session.user?.email}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{session.user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-h-[100dvh] flex-col">
        {/* Topbar móvil */}
        <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="font-serif text-lg font-semibold">Pacurucu Dental</p>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Salir
            </button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 subtle-scroll" aria-label="Secciones del panel (móvil)">
            {SECTIONS.map((s) => {
              const active = activeSection === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => goSection(s.key)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {activeSection === "dashboard" && <DashboardView goSection={goSection} />}
          {activeSection === "citas" && <AppointmentsView />}
          {activeSection === "calendario" && <CalendarView />}
          {activeSection === "servicios" && <ServicesView />}
          {activeSection === "pacientes" && <PatientsView />}
          {activeSection === "facturacion" && <InvoicesView goSection={goSection} />}
          {activeSection === "mensajes" && <MessagesView />}
          {activeSection === "configuracion" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────

function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Si hay sesión viva al llegar, refresca el estado
    void fetch("/api/auth/session", { cache: "no-store" });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Email o contraseña incorrectos. Vuelve a intentarlo.");
        return;
      }
      toast({ title: "Bienvenida de vuelta" });
      // useSession refetch automático por SessionProvider
      window.location.reload();
    } catch {
      setError("No se pudo iniciar sesión. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-[0_12px_40px_rgba(26,26,46,0.07)] sm:p-10">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" aria-hidden />
            </span>
            <div>
              <p className="font-serif text-xl font-semibold text-foreground">Pacurucu Dental Care</p>
              <p className="text-sm text-muted-foreground">Panel del odontólogo</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@pacurucu.dental"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-password">Contraseña</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-[#fef2f2] p-3.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full rounded-full font-medium">
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  Ingresando…
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>
        </div>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Acceso exclusivo para el personal de la clínica. Los pacientes reservan desde la web pública.
        </p>
      </div>
    </div>
  );
}
