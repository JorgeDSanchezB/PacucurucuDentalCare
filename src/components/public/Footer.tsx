"use client";

// Footer: marca (cuadro) + "Síguenos en las redes" con los enlaces de
// WhatsApp, Instagram, Facebook y TikTok (editables en Ajustes → Redes).
// Dirección, teléfono, horarios y navegación vivían aquí duplicados: la
// sección de Contacto del inicio ya los muestra, así que el pie queda limpio.
import type { ComponentType, SVGProps } from "react";
import { Lock } from "lucide-react";
import { WhatsAppIcon, InstagramIcon, FacebookIcon, TikTokIcon } from "./social-icons";
import { DAY_LABELS, type InitialPublicData, type ScheduleRow, type SocialLinks } from "@/types";

export function dayRangeLabel(rows: ScheduleRow[]): string {
  const active = rows.filter((r) => r.isActive).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  if (active.length === 0) return "Horarios por definir";
  // Agrupa días consecutivos con el mismo horario
  const groups: { days: number[]; start: string; end: string }[] = [];
  for (const row of active) {
    const last = groups[groups.length - 1];
    if (last && last.start === row.startTime && last.end === row.endTime && row.dayOfWeek === last.days[last.days.length - 1] + 1) {
      last.days.push(row.dayOfWeek);
    } else {
      groups.push({ days: [row.dayOfWeek], start: row.startTime, end: row.endTime });
    }
  }
  return groups
    .map((g) => {
      const from = DAY_LABELS[g.days[0]].slice(0, 3);
      const to = g.days.length > 1 ? ` a ${DAY_LABELS[g.days[g.days.length - 1]].slice(0, 3)}` : "";
      return `${from}${to} ${g.start} a ${g.end}`;
    })
    .join(" · ");
}

type SocialNetwork = keyof SocialLinks;

const SOCIAL_DOMAINS: Record<Exclude<SocialNetwork, "whatsapp">, string> = {
  instagram: "instagram.com",
  facebook: "facebook.com",
  tiktok: "tiktok.com",
};

// Tolerante a como pegue el enlace el doctor: URL completa, @usuario o,
// en WhatsApp, el número tal cual (wa.me hace el resto).
export function socialHref(network: SocialNetwork, raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (network === "whatsapp") {
    const digits = value.replace(/[^0-9]/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  }
  const handle = value.replace(/^@+/, "");
  return handle ? `https://${SOCIAL_DOMAINS[network]}/${handle}` : "";
}

const SOCIAL_BUTTONS: { network: SocialNetwork; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { network: "whatsapp", label: "WhatsApp", Icon: WhatsAppIcon },
  { network: "instagram", label: "Instagram", Icon: InstagramIcon },
  { network: "facebook", label: "Facebook", Icon: FacebookIcon },
  { network: "tiktok", label: "TikTok", Icon: TikTokIcon },
];

export function Footer({
  initialData,
  navigate,
}: {
  initialData: InitialPublicData;
  navigate: (path: string) => void;
}) {
  const { settings } = initialData;
  // WhatsApp del consultorio como respaldo si aún no se configuró la red.
  const rawSocial: SocialLinks = {
    ...settings.social,
    whatsapp: settings.social.whatsapp || settings.clinic.whatsapp,
  };

  return (
    <footer className="relative mt-auto overflow-hidden bg-foreground text-background">
      {/* Marca fantasma: firma tipográfica a gran escala (solo desktop) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -bottom-[4vw] hidden select-none text-center font-serif text-[13vw] font-semibold leading-none tracking-tight text-white/[0.045] md:block"
      >
        Pacurucu
      </span>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
        {/* Marca (lo que estaba en el cuadro) */}
        <div>
          <p className="font-display font-serif text-[1.7rem] font-semibold tracking-tight">
            {settings.clinic.name?.split(" ").slice(0, 1)[0] || "Pacurucu"}
            <span className="font-serif font-medium italic text-white/75">
              {" "}
              {settings.clinic.name?.split(" ").slice(1).join(" ") || "Dental Care"}
            </span>
          </p>
          <p className="mt-1.5 font-serif text-sm italic text-white/60">{settings.clinic.tagline}</p>
        </div>

        {/* Síguenos en las redes (donde estaba la flecha) */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Síguenos en las redes</p>
          <div className="mt-4 flex gap-3">
            {SOCIAL_BUTTONS.map(({ network, label, Icon }) => {
              const href = socialHref(network, rawSocial[network] ?? "");
              if (href) {
                return (
                  <a
                    key={network}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} de ${settings.clinic.name}`}
                    title={label}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 transition-all duration-300 hover:-translate-y-1 hover:border-terracotta/60 hover:bg-white/15"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              }
              // Red sin enlace todavía: visible pero atenuada y sin clic.
              return (
                <span
                  key={network}
                  aria-disabled="true"
                  title={`${label} (enlace no configurado)`}
                  className="flex h-11 w-11 cursor-default items-center justify-center rounded-full border border-white/10 text-white/35"
                >
                  <Icon className="h-5 w-5" />
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-white/55 sm:px-6">
          {/* suppressHydrationWarning: el año puede diferir un instante entre
              servidor y navegador justo en el cambio de año (zonas horarias). */}
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} {settings.clinic.name}. Guayaquil, Ecuador.
          </p>
          <button
            onClick={() => navigate("admin")}
            className="flex items-center gap-1.5 transition-colors hover:text-white"
            aria-label="Acceso del odontólogo al panel"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Acceso odontólogo
          </button>
        </div>
      </div>
    </footer>
  );
}
