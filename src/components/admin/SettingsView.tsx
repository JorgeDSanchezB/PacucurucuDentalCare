"use client";

// Configuración: datos de la clínica, doctor, textos del sitio, tema y flags.
import { useCallback, useEffect, useState } from "react";
import { Save, Loader2, Flag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiPost } from "@/lib/client-api";
import { ImageField } from "./ImageField";
import type { ClinicSettings, FlagDTO } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { AdminLoading, AdminError, SectionHeader } from "./shared";

export function SettingsView() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [flags, setFlags] = useState<FlagDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<{ settings: ClinicSettings; flags: FlagDTO[] }>("/api/admin/settings");
      setSettings(res.settings);
      setFlags(res.flags);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const body = {
        clinic: settings.clinic,
        social: settings.social,
        doctor: {
          ...settings.doctor,
          credentials: settings.doctor.credentials.filter((c) => c.trim()),
        },
        hero: settings.hero,
        about: settings.about,
        theme: settings.theme,
      };
      await apiPost("/api/admin/settings", body, "PUT");
      toast({ title: "Configuración guardada", description: "Recarga la página pública para ver los cambios." });
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleFlag = async (key: string, enabled: boolean) => {
    setFlags((list) => (list ?? []).map((f) => (f.key === key ? { ...f, enabled } : f)));
    try {
      await apiPost(`/api/admin/flags/${key}`, { enabled }, "PUT");
      toast({
        title: enabled ? "Flag activado" : "Flag desactivado",
        description: key === "WHATSAPP_ENABLED"
          ? enabled
            ? "Los envíos a WhatsApp usan la API real (requiere credenciales)."
            : "Las notificaciones quedan registradas en modo simulado."
          : "El paso de pago online depende de este flag.",
      });
    } catch (e) {
      toast({ title: "No se pudo cambiar el flag", description: e instanceof Error ? e.message : "", variant: "destructive" });
      await load();
    }
  };

  if (error) return <AdminError message={error} onRetry={load} />;
  if (!settings || !flags) return <AdminLoading label="Cargando configuración…" />;

  const setClinic = (key: keyof ClinicSettings["clinic"], value: string) =>
    setSettings((s) => (s ? { ...s, clinic: { ...s.clinic, [key]: value } } : s));
  const setSocial = (key: keyof ClinicSettings["social"], value: string) =>
    setSettings((s) => (s ? { ...s, social: { ...s.social, [key]: value } } : s));
  const setDoctor = (key: keyof ClinicSettings["doctor"], value: string | string[]) =>
    setSettings((s) => (s ? { ...s, doctor: { ...s.doctor, [key]: value } } : s));
  const setHero = (key: keyof ClinicSettings["hero"], value: string) =>
    setSettings((s) => (s ? { ...s, hero: { ...s.hero, [key]: value } } : s));
  const setAbout = (key: keyof ClinicSettings["about"], value: string) =>
    setSettings((s) => (s ? { ...s, about: { ...s.about, [key]: value } } : s));
  const setColor = (key: keyof ClinicSettings["theme"]["colors"], value: string) =>
    setSettings((s) => (s ? { ...s, theme: { colors: { ...s.theme.colors, [key]: value } } } : s));

  const Field = (label: string, value: string, onChange: (v: string) => void, opts?: { textarea?: boolean; rows?: number; type?: string; hint?: string }) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {opts?.textarea ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={opts.rows ?? 3} />
      ) : (
        <Input type={opts?.type ?? "text"} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {opts?.hint && <p className="text-xs leading-relaxed text-muted-foreground">{opts.hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="Configuración" description="Todo el contenido y la apariencia del sitio se editan aquí.">
        <Button onClick={save} disabled={saving} className="rounded-full font-medium">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-1.5 h-4 w-4" aria-hidden />}
          Guardar cambios
        </Button>
      </SectionHeader>

      <Tabs defaultValue="clinica">
        <TabsList className="rounded-xl">
          <TabsTrigger value="clinica" className="rounded-lg">Clínica</TabsTrigger>
          <TabsTrigger value="redes" className="rounded-lg">Redes sociales</TabsTrigger>
          <TabsTrigger value="doctor" className="rounded-lg">Doctor</TabsTrigger>
          <TabsTrigger value="textos" className="rounded-lg">Textos del sitio</TabsTrigger>
          <TabsTrigger value="tema" className="rounded-lg">Tema</TabsTrigger>
          <TabsTrigger value="flags" className="rounded-lg">
            <Flag className="mr-1.5 h-4 w-4" aria-hidden />
            Feature flags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clinica" className="mt-6">
          <div className="grid gap-5 rounded-2xl border border-border/60 bg-card p-6 sm:grid-cols-2">
            {Field("Nombre de la clínica", settings.clinic.name, (v) => setClinic("name", v))}
            {Field("Lema corto", settings.clinic.tagline, (v) => setClinic("tagline", v))}
            {Field("Dirección", settings.clinic.address, (v) => setClinic("address", v))}
            {Field("Ciudad / sector", settings.clinic.city, (v) => setClinic("city", v))}
            {Field("Teléfono", settings.clinic.phone, (v) => setClinic("phone", v), { type: "tel" })}
            {Field("WhatsApp (con código de país)", settings.clinic.whatsapp, (v) => setClinic("whatsapp", v), { type: "tel" })}
            {Field("Email", settings.clinic.email, (v) => setClinic("email", v), { type: "email" })}
          </div>
        </TabsContent>

        <TabsContent value="redes" className="mt-6">
          <div className="grid gap-5 rounded-2xl border border-border/60 bg-card p-6 sm:grid-cols-2">
            {Field("WhatsApp", settings.social.whatsapp, (v) => setSocial("whatsapp", v), { type: "tel", hint: "Número con código de país (ej: +593 98 612 4470) o enlace wa.me completo." })}
            {Field("Instagram", settings.social.instagram, (v) => setSocial("instagram", v), { hint: "Enlace completo o solo tu usuario (ej: @tuclinica)." })}
            {Field("Facebook", settings.social.facebook, (v) => setSocial("facebook", v), { hint: "Enlace a tu página o perfil." })}
            {Field("TikTok", settings.social.tiktok, (v) => setSocial("tiktok", v), { hint: "Enlace completo o solo tu usuario (ej: @tuclinica)." })}
            <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
              Estos enlaces activan los íconos del pie de la página ("Síguenos en las redes"). El campo que quede vacío muestra su ícono atenuado, sin clic. Guarda y recarga la página pública para verlos.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="doctor" className="mt-6">
          <div className="grid gap-5 rounded-2xl border border-border/60 bg-card p-6 sm:grid-cols-2">
            {Field("Nombre", settings.doctor.name, (v) => setDoctor("name", v))}
            {Field("Título", settings.doctor.title, (v) => setDoctor("title", v))}
            {Field("Especialidad", settings.doctor.specialty, (v) => setDoctor("specialty", v))}
            <div className="sm:col-span-2">
              <ImageField label="Foto del doctor" value={settings.doctor.photoUrl} onChange={(v) => setDoctor("photoUrl", v)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              {Field("Biografía", settings.doctor.bio, (v) => setDoctor("bio", v), { textarea: true, rows: 5 })}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Credenciales (una por línea)</Label>
              <Textarea
                value={settings.doctor.credentials.join("\n")}
                onChange={(e) => setDoctor("credentials", e.target.value.split("\n"))}
                rows={4}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="textos" className="mt-6">
          <div className="grid gap-5 rounded-2xl border border-border/60 bg-card p-6 sm:grid-cols-2">
            {Field("Título del hero", settings.hero.title, (v) => setHero("title", v))}
            <div className="sm:col-span-2">
              <ImageField label="Imagen del inicio (hero)" value={settings.hero.imageUrl} onChange={(v) => setHero("imageUrl", v)} hint="Foto principal del inicio · PNG, JPG, WebP o GIF · hasta 5 MB" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              {Field("Subtítulo del hero", settings.hero.subtitle, (v) => setHero("subtitle", v), { textarea: true, rows: 2 })}
            </div>
            {Field("Título sección clínica", settings.about.title, (v) => setAbout("title", v))}
            <div className="sm:col-span-2">
              <ImageField label="Imagen de la clínica" value={settings.about.imageUrl} onChange={(v) => setAbout("imageUrl", v)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              {Field("Texto sobre la clínica", settings.about.text, (v) => setAbout("text", v), { textarea: true, rows: 5 })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tema" className="mt-6">
          <div className="grid gap-5 rounded-2xl border border-border/60 bg-card p-6 sm:grid-cols-2">
            {(Object.keys(settings.theme.colors) as Array<keyof ClinicSettings["theme"]["colors"]>).map((key) => (
              <div key={key} className="flex items-end gap-3">
                <div className="flex-1">{Field(key.charAt(0).toUpperCase() + key.slice(1), settings.theme.colors[key], (v) => setColor(key, v))}</div>
                <div
                  className="h-9 w-12 shrink-0 rounded-xl border border-border"
                  style={{ background: settings.theme.colors[key] }}
                  aria-hidden
                />
              </div>
            ))}
            <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
              Los colores se aplican al sitio público al recargar la página (una vez guardados). Formato hexadecimal, ej: #0A7B83.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="flags" className="mt-6">
          <div className="space-y-4">
            {flags.map((flag) => (
              <div key={flag.key} className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-5">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-foreground">{flag.key}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{flag.description}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Valor por entorno (.env): {flag.envDefault ? "activo" : "inactivo"}
                  </p>
                </div>
                <Switch
                  checked={flag.enabled}
                  onCheckedChange={(v) => toggleFlag(flag.key, v)}
                  aria-label={`Activar ${flag.key}`}
                />
              </div>
            ))}
            <p className="text-xs leading-relaxed text-muted-foreground">
              El interruptor guarda un ajuste en la base de datos que tiene prioridad sobre las variables de entorno.
              Con WHATSAPP_ENABLED apagado, las notificaciones se registran en modo simulado (nada se envía de verdad).
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
