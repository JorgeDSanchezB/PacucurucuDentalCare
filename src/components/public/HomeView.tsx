"use client";

// Vista principal del sitio público: hero asimétrico + secciones.
// Dials: DESIGN_VARIANCE 6 · MOTION_INTENSITY 4 · VISUAL_DENSITY 3.
// Firma visual (Task 21): arco dental como marco, Fraunces a opsz 144,
// grano global, sombras en capas y marquee de valores.
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Clock, Diamond, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "./Reveal";
import { ServiceImage } from "./ServiceImage";
import { WhatsAppIcon } from "./social-icons";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { formatDuration, formatMoney } from "@/lib/validators";
import type { InitialPublicData, ServicePublicDTO } from "@/types";
import { HomeSections } from "./HomeSections";

interface HomeViewProps {
  initialData: InitialPublicData;
  navigate: (path: string) => void;
  onReserveService: (serviceId: string) => void;
}

const PRACTICE_VALUES = [
  "Citas puntuales",
  "Presupuesto antes de empezar",
  "Esterilización visible",
  "Agenda honesta",
  "Odontopediatría con calma",
  "Estética natural",
];

export function HomeView({ initialData, navigate, onReserveService }: HomeViewProps) {
  const { settings, services } = initialData;

  // Agrupar por categoría preservando el orden del catálogo
  const categories: { name: string; items: ServicePublicDTO[] }[] = [];
  for (const service of services) {
    const existing = categories.find((c) => c.name === service.category);
    if (existing) existing.items.push(service);
    else categories.push({ name: service.category, items: [service] });
  }

  return (
    <>
      {/* ── HERO: split 55/45, foto en ARCO con eco terracota ───────────── */}
      <section className="relative overflow-hidden" aria-label="Presentación">
        {/* Mancha cálida de fondo (profundidad, no plano) */}
        <div
          aria-hidden
          className="absolute -left-40 top-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(closest-side,var(--color-secondary)_55%,transparent)] opacity-40 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 md:pb-28 md:pt-20 lg:grid-cols-[55fr_45fr] lg:gap-16">
          <HeroCopy settings={settings} navigate={navigate} />
          <HeroImage imageUrl={settings.hero.imageUrl} clinicName={settings.clinic.name} />
        </div>
      </section>

      {/* ── MARQUEE de valores del consultorio (franja de confianza) ────── */}
      <section aria-label="Valores del consultorio" className="border-y border-border/60 bg-secondary/25">
        <div className="marquee overflow-hidden py-3.5">
          <p className="sr-only">{PRACTICE_VALUES.join(" · ")}</p>
          <div className="marquee-track flex items-center" aria-hidden="true">
            {[...PRACTICE_VALUES, ...PRACTICE_VALUES].map((value, i) => (
              <span key={i} className={i >= PRACTICE_VALUES.length ? "marquee-clone flex items-center gap-9 pr-9" : "flex items-center gap-9 pr-9"}>
                <span className="whitespace-nowrap font-serif text-[15px] italic text-muted-foreground">{value}</span>
                <Diamond className="h-2.5 w-2.5 shrink-0 fill-terracotta/70 text-terracotta/70" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICIOS por categoría (numeración editorial) ──────────────── */}
      <section id="servicios" className="scroll-mt-20 py-16 md:py-24" aria-label="Servicios">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Servicios"
              title="Tratamientos claros, presupuesto claro"
              text="Cada servicio indica duración y costo exactos. Selecciona uno y resérvalo en menos de dos minutos."
            />
          </Reveal>

          {categories.length === 0 ? (
            <EmptyServices />
          ) : (
            <div className="mt-14 space-y-16 md:space-y-20">
              {categories.map((cat, catIdx) => (
                <div key={cat.name}>
                  <Reveal delay={0.05}>
                    <div className="mb-1 flex items-baseline gap-4 sm:gap-5">
                      <span className="font-serif text-base font-medium italic text-terracotta/80">
                        {String(catIdx + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-display font-serif text-2xl font-semibold tracking-tight text-foreground md:text-[1.7rem]">
                        {cat.name}
                      </h3>
                      <span className="h-px flex-1 self-center bg-border/70" aria-hidden />
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {cat.items.length} {cat.items.length === 1 ? "tratamiento" : "tratamientos"}
                      </span>
                    </div>
                  </Reveal>
                  <div className="divide-y divide-border/50">
                    {cat.items.map((service, i) => (
                      <Reveal key={service.id} delay={0.05 * i}>
                        <ServiceRow service={service} onReserve={() => onReserveService(service.id)} />
                      </Reveal>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Resto de secciones (doctor, clínica, testimonios, galería, FAQ, contacto) ── */}
      <HomeSections initialData={initialData} navigate={navigate} />
    </>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function HeroCopy({
  settings,
  navigate,
}: {
  settings: InitialPublicData["settings"];
  navigate: (path: string) => void;
}) {
  // Entradas escalonadas con animación CSS nativa (keyframes en globals.css):
  // si la animación no llega a ejecutarse, el contenido queda visible —
  // no depende de framer-motion para existir.
  const stagger = (i: number) => ({ animationDelay: `${(0.1 + i * 0.12).toFixed(2)}s` });

  return (
    <div className="max-w-xl">
      <p
        style={stagger(0)}
        className="anim-rise-in flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary"
      >
        <span aria-hidden className="h-px w-8 bg-terracotta" />
        Odontología general y estética · Urdesa
      </p>
      <h1
        style={stagger(1)}
        className="anim-rise-in font-display mt-6 font-serif text-[clamp(2.9rem,6.5vw,4.9rem)] font-medium leading-[1.02] tracking-[-0.02em] text-foreground"
      >
        {settings.hero.title?.split(",").length ? (
          <>
            {settings.hero.title.split(",")[0]}
            {settings.hero.title.includes(",") && (
              <span className="font-serif italic text-primary">
                ,{settings.hero.title.split(",").slice(1).join(",")}
              </span>
            )}
          </>
        ) : (
          settings.hero.title
        )}
      </h1>
      <p style={stagger(2)} className="anim-rise-in mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
        {settings.hero.subtitle}
      </p>
      <div style={stagger(3)} className="anim-rise-in mt-9 flex flex-wrap items-center gap-4">
        <Button
          onClick={() => navigate("reservar")}
          size="lg"
          className="rounded-full px-8 py-6 text-base font-medium shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
        >
          Reservar cita
          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
        </Button>
        <a
          href={`https://wa.me/${settings.clinic.whatsapp.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-2.5 pl-3 pr-4 text-sm font-medium text-foreground shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-terracotta/50 hover:shadow-lift"
        >
          <WhatsAppIcon className="h-4 w-4 text-terracotta" aria-hidden />
          Escribir por WhatsApp
        </a>
      </div>
      <ul style={stagger(4)} className="anim-rise-in mt-8 flex flex-wrap gap-x-6 gap-y-2">
        {["Primera consulta con revisión completa", "Presupuesto por escrito"].map((item) => (
          <li key={item} className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
            <Diamond aria-hidden className="h-2 w-2 fill-terracotta text-terracotta" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeroImage({ imageUrl, clinicName }: { imageUrl: string; clinicName: string }) {
  // Parallax de deriva sutil (±1.5rem) — desactivado con movimiento reducido.
  const reduce = usePrefersReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 26]);

  if (!imageUrl) {
    return (
      <div className="relative hidden aspect-[4/5] lg:block" aria-label={`${clinicName}`}>
        <div className="arch absolute inset-0 bg-secondary/60" />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-serif text-3xl italic text-secondary-foreground">{clinicName}</p>
        </div>
      </div>
    );
  }
  return (
    <div
      ref={sectionRef}
      className="anim-rise-in relative mt-2 lg:mt-0"
      style={{ animationDelay: "0.25s" }}
    >
      {/* Eco de arco: contorno terracota desplazado (firma compositiva) */}
      <div aria-hidden className="arch absolute -right-4 -top-4 h-full w-full border-[1.5px] border-terracotta/60" />
      {/* Mancha cálida detrás de la bóveda */}
      <div aria-hidden className="absolute -left-14 -top-14 h-44 w-44 rounded-full bg-accent/25 blur-3xl" />

      {/* Foto principal en arco (también en móvil: la firma no se esconde) */}
      <div className="arch relative aspect-[4/3] overflow-hidden shadow-lift ring-1 ring-foreground/5 sm:aspect-[16/11] lg:aspect-[4/5]">
        <motion.img
          src={imageUrl}
          alt={`Interior de la clínica ${clinicName}`}
          className="h-full w-full object-cover object-[center_62%] lg:object-center"
          style={reduce ? undefined : { y, scale: 1.08 }}
        />
        {/* Fundido cálido en la base para asentar la foto */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-foreground/15 via-transparent to-transparent" />
      </div>

      {/* Tarjeta flotante: dato orgánico del turno (solo desktop) */}
      <div className="absolute -bottom-7 -left-9 hidden rounded-2xl border border-border/60 bg-card/90 px-5 py-4 shadow-lift backdrop-blur-sm lg:block">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 ring-1 ring-primary/20">
            <Clock className="h-5 w-5 text-primary" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Turnos de 30 y 60 minutos</p>
            <p className="text-xs text-muted-foreground">Empiezas puntual, siempre</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SERVICIOS: fila de menú editorial (carta de restaurante boutique) ───────

function ServiceRow({ service, onReserve }: { service: ServicePublicDTO; onReserve: () => void }) {
  return (
    <article className="group flex flex-wrap items-start gap-x-6 gap-y-3 py-6 transition-colors duration-300 hover:bg-secondary/25 sm:flex-nowrap sm:items-center">
      <ServiceImage name={service.name} category={service.category} imageUrl={service.imageUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <h4 className="font-display font-serif text-lg font-semibold leading-snug text-foreground">{service.name}</h4>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground line-clamp-4 sm:line-clamp-2">
          {service.description}
        </p>
      </div>
      <div className="flex items-center gap-5 sm:gap-7">
        <div className="text-right">
          <p className="font-display font-serif text-xl font-semibold leading-tight tabular-nums text-terracotta">
            {formatMoney(service.price)}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {formatDuration(service.duration)}
          </p>
        </div>
        <button
          onClick={onReserve}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Reservar
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
        </button>
      </div>
    </article>
  );
}

function EmptyServices() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
      <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium text-foreground">El catálogo de servicios se está preparando</p>
      <p className="mt-1 text-sm text-muted-foreground">Vuelve en un momento o contáctanos por WhatsApp.</p>
    </div>
  );
}

export function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        <span aria-hidden className="h-px w-7 bg-terracotta/80" />
        {eyebrow}
      </p>
      <h2 className="font-display mt-4 font-serif text-[2rem] font-semibold leading-[1.08] tracking-tight text-foreground md:text-[2.6rem]">
        {title}
      </h2>
      {text && <p className="mt-4 text-base leading-relaxed text-muted-foreground">{text}</p>}
    </div>
  );
}
