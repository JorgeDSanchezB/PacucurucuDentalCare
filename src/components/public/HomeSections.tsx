"use client";

// Secciones del home: doctor · la clínica · testimonios · galería · FAQ · contacto · CTA.
// Alternancia de familias de layout (split → banda → grid → dos columnas).
import { useState } from "react";
import { CalendarCheck, Check, Star, Quote, Send, MapPin, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Reveal } from "./Reveal";
import { SectionHeading } from "./HomeView";
import { dayRangeLabel } from "./Footer";
import { apiPost } from "@/lib/client-api";
import { contactSchema } from "@/lib/validators";
import { useToast } from "@/hooks/use-toast";
import type { InitialPublicData } from "@/types";

export function HomeSections({
  initialData,
  navigate,
}: {
  initialData: InitialPublicData;
  navigate: (path: string) => void;
}) {
  const { settings, testimonials, faqs, gallery, schedule } = initialData;

  return (
    <>
      {/* ── EL DOCTOR: split foto izquierda (4:5) + texto ─────────────── */}
      <section id="doctor" className="scroll-mt-20 bg-muted/40 py-16 md:py-24" aria-label="Perfil del odontólogo">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[2fr_3fr]">
          <Reveal>
            <div className="relative mx-auto max-w-sm lg:max-w-none">
              <div aria-hidden className="arch absolute -left-4 -bottom-4 h-full w-full border-[1.5px] border-terracotta/60" />
              <div className="arch relative aspect-[4/5] overflow-hidden shadow-lift">
                {settings.doctor.photoUrl ? (
                   
                  <img
                    src={settings.doctor.photoUrl}
                    alt={`Retrato de ${settings.doctor.name}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-secondary/70 font-serif text-3xl italic text-secondary-foreground">
                    {settings.doctor.name}
                  </div>
                )}
              </div>
              <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-border/60 bg-card/90 px-5 py-4 text-foreground shadow-lift backdrop-blur-sm md:block">
                <p className="font-display font-serif text-2xl font-semibold leading-none tabular-nums">12</p>
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">años de<br />práctica clínica</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              <span aria-hidden className="h-px w-7 bg-terracotta/80" />
              {settings.doctor.title}
            </p>
            <h2 className="font-display mt-4 font-serif text-[2rem] font-semibold leading-[1.06] tracking-tight text-foreground md:text-[2.6rem]">
              {settings.doctor.name}
            </h2>
            <p className="mt-2 font-serif text-lg italic text-terracotta">{settings.doctor.specialty}</p>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">{settings.doctor.bio}</p>
            {settings.doctor.credentials.length > 0 && (
              <ul className="mt-6 space-y-2.5">
                {settings.doctor.credentials.map((cred) => (
                  <li key={cred} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {cred}
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={() => navigate("reservar")} size="lg" className="mt-8 rounded-full font-medium">
              <CalendarCheck className="mr-1.5 h-4 w-4" aria-hidden />
              Agendar con el doctor
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ── LA CLÍNICA: banda crema con texto + imagen (zigzag opuesto) ── */}
      <section id="clinica" className="scroll-mt-20 py-16 md:py-24" aria-label="Sobre la clínica">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[3fr_2fr]">
          <Reveal>
            <SectionHeading
              eyebrow="La clínica"
              title={settings.about.title}
              text={settings.about.text}
            />
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                ["Agenda honesta", "Menos pacientes por día, más tiempo por persona."],
                ["Presupuesto antes de empezar", "Sin sorpresas al final del tratamiento."],
                ["Esterilización visible", "Protocolo completo, a la vista."],
              ].map(([title, text], i) => (
                <li key={title} className="rounded-2xl border border-border/70 bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-terracotta/40 hover:shadow-soft">
                  <p className="font-display font-serif text-sm font-medium italic text-terracotta">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-2 font-serif text-base font-semibold text-foreground">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.12}>
            {settings.about.imageUrl && (
              <div className="relative lg:-mt-10">
                <div aria-hidden className="arch absolute -left-3 -top-3 h-full w-full border-[1.5px] border-terracotta/50" />
                <div className="arch relative aspect-[3/4] overflow-hidden shadow-lift">
                  <img
                    src={settings.about.imageUrl}
                    alt="Consultorio de la clínica"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── TESTIMONIOS: 1 destacado + 2 apilados ───────────────────────── */}
      {testimonials.length > 0 && (
        <section id="testimonios" className="relative scroll-mt-20 overflow-hidden bg-foreground py-16 text-background md:py-24" aria-label="Testimonios">
          {/* Comilla gigante decorativa (profundidad editorial) */}
          <span aria-hidden className="pointer-events-none absolute -top-10 right-6 select-none font-serif text-[220px] leading-none text-[#e8b4a0] opacity-[0.14] md:text-[300px]">
            ”
          </span>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#b8d8cd]">
                <span aria-hidden className="h-px w-7 bg-[#b8d8cd]/70" />
                Testimonios
              </p>
              <h2 className="font-display mt-4 max-w-xl font-serif text-[2rem] font-semibold leading-[1.08] tracking-tight md:text-[2.6rem]">
                Lo que dicen quienes ya se sentaron en el sillón
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-6 md:grid-cols-12">
              {testimonials.slice(0, 3).map((t, i) => (
                <Reveal key={t.id} delay={0.08 * i} className={i === 0 ? "md:col-span-7" : "md:col-span-5"}>
                  <figure
                    className={`flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.045] p-7 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 ${
                      i === 0 ? "md:p-9" : ""
                    }`}
                  >
                    <Quote className="h-5 w-5 text-[#b8d8cd]" aria-hidden />
                    <blockquote
                      className={`mt-4 flex-1 leading-relaxed ${
                        i === 0 ? "font-display font-serif text-xl italic md:text-2xl" : "text-base"
                      }`}
                    >
                      {t.text}
                    </blockquote>
                    <figcaption className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">{t.patientName}</span>
                      <span className="flex items-center gap-0.5" aria-label={`${t.rating} de 5 estrellas`}>
                        {Array.from({ length: 5 }).map((_, s) => (
                          <Star
                            key={s}
                            className={`h-4 w-4 ${s < t.rating ? "fill-[#b8d8cd] text-[#b8d8cd]" : "text-white/20"}`}
                            aria-hidden
                          />
                        ))}
                      </span>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── GALERÍA: grid con ratios variados + lightbox ────────────────── */}
      {gallery.length > 0 && (
        <section id="galeria" className="scroll-mt-20 py-16 md:py-24" aria-label="Galería de la clínica">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal>
              <SectionHeading
                eyebrow="Nuestra clínica"
                title="Diseñada para que respires tranquilo"
              />
            </Reveal>
            <GalleryGrid items={gallery} />
          </div>
        </section>
      )}

      {/* ── FAQ: título sticky + acordeón ───────────────────────────────── */}
      {faqs.length > 0 && (
        <section id="faq" className="scroll-mt-20 bg-muted/40 py-16 md:py-24" aria-label="Preguntas frecuentes">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[2fr_3fr]">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <SectionHeading
                  eyebrow="Preguntas frecuentes"
                  title="Dudas comunes, respuestas cortas"
                  text="Si tu pregunta no está aquí, escríbenos por WhatsApp o usa el formulario de contacto."
                />
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <Accordion type="single" collapsible className="-mt-2 w-full">
                {faqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id} className="border-border/60">
                    <AccordionTrigger className="py-5 text-left font-serif text-lg font-medium text-foreground transition-colors hover:text-primary hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── CTA banda turquesa ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary py-16 text-primary-foreground md:py-20" aria-label="Llamado a la acción">
        <div aria-hidden className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-foreground/15 blur-3xl" />
        <div aria-hidden className="absolute right-10 top-0 hidden h-40 w-40 translate-x-8 -translate-y-14 rounded-full border-[1.5px] border-white/20 md:block" />
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-4 sm:px-6">
          <div className="max-w-xl">
            <p className="font-display font-serif text-2xl font-semibold leading-snug md:text-[2.1rem]">
              La cita que sigues posponiendo dura{" "}
              <span className="font-serif italic font-medium text-white/85">treinta minutos.</span>
            </p>
            <p className="mt-3 text-sm opacity-80">Reserva hoy y crúzala de la lista.</p>
          </div>
          <Button
            onClick={() => navigate("reservar")}
            size="lg"
            variant="secondary"
            className="rounded-full bg-background px-8 py-6 text-base font-semibold text-foreground shadow-lift transition-all duration-300 hover:-translate-y-0.5 hover:bg-card"
          >
            <CalendarCheck className="mr-1.5 h-4 w-4" aria-hidden />
            Reservar cita
          </Button>
        </div>
      </section>

      {/* ── CONTACTO: info + formulario ─────────────────────────────────── */}
      <section id="contacto" className="scroll-mt-20 py-16 md:py-24" aria-label="Contacto">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[2fr_3fr]">
          <Reveal>
            <SectionHeading eyebrow="Contacto" title="Escríbenos lo que necesites" />
            <ul className="mt-8 space-y-5 text-sm">
              {settings.clinic.address && (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="leading-relaxed">
                    {settings.clinic.address}
                    {settings.clinic.city ? `, ${settings.clinic.city}` : ""}
                  </span>
                </li>
              )}
              <li className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="leading-relaxed">{dayRangeLabel(schedule)}</span>
              </li>
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}

// ─── Galería con lightbox ────────────────────────────────────────────────────

function GalleryGrid({ items }: { items: InitialPublicData["gallery"] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const spans = [
    "sm:col-span-2 aspect-[16/10]",
    "aspect-[4/3]",
    "aspect-[4/3] sm:row-span-2 sm:aspect-auto",
    "aspect-[4/3]",
    "sm:col-span-2 aspect-[16/10]",
  ];

  return (
    <>
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.slice(0, 5).map((item, i) => (
          <Reveal key={item.id} delay={0.05 * i} className={spans[i % spans.length]}>
            <button
              onClick={() => setSelected(i)}
              className="group relative h-full w-full overflow-hidden rounded-2xl shadow-soft transition-shadow duration-300 hover:shadow-lift"
              aria-label={`Ampliar foto: ${item.title}`}
            >
              <div className={`h-full w-full ${spans[i % spans.length].includes("row-span") ? "min-h-64" : ""}`}>
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  loading="lazy"
                />
              </div>
              {/* Etiqueta emergente al pasar el cursor */}
              <span className="pointer-events-none absolute inset-x-3 bottom-3 translate-y-2 rounded-full bg-foreground/70 py-1.5 px-3.5 text-center text-xs font-medium text-background opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                {item.title}
              </span>
            </button>
          </Reveal>
        ))}
      </div>
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none [&>button]:bg-background [&>button]:rounded-full [&>button]:p-1.5">
          {selected !== null && items[selected] && (
            <>
              <DialogTitle className="sr-only">{items[selected].title}</DialogTitle>
              { }
              <img
                src={items[selected].imageUrl}
                alt={items[selected].title}
                className="max-h-[80vh] w-full rounded-2xl object-contain"
              />
              <p className="mt-3 text-center text-sm text-background mix-blend-difference">{items[selected].title}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Formulario de contacto (Zod + react-hook-form) ──────────────────────────

function ContactForm() {
  const { toast } = useToast();
  const [values, setValues] = useState({ name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSending(true);
    try {
      const res = await apiPost<{ message: string }>("/api/public/contact", parsed.data);
      setSent(true);
      setValues({ name: "", email: "", phone: "", message: "" });
      toast({ title: "Mensaje enviado", description: res.message });
    } catch (err) {
      toast({
        title: "No se pudo enviar",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-3xl border border-border/60 bg-card p-10 text-center shadow-soft">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
          <Send className="h-6 w-6 text-primary" aria-hidden />
        </span>
        <p className="font-display mt-5 font-serif text-2xl font-semibold text-foreground">Mensaje en camino</p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Gracias por escribirnos. Te responderemos en horario de atención, normalmente el mismo día.
        </p>
        <Button variant="outline" className="mt-6 rounded-full px-6" onClick={() => setSent(false)}>
          Enviar otro mensaje
        </Button>
      </div>
    );
  }

  const field = (
    key: keyof typeof values,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> | React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    as: "input" | "textarea" = "input"
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`contact-${key}`}>{label}</Label>
      {as === "input" ? (
        <Input
          id={`contact-${key}`}
          value={values[key]}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          aria-invalid={!!errors[key]}
          {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        />
      ) : (
        <Textarea
          id={`contact-${key}`}
          value={values[key]}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          aria-invalid={!!errors[key]}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      )}
      {errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-border/70 bg-card p-7 shadow-soft md:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", "Nombre", { placeholder: "Tu nombre", autoComplete: "name" })}
        {field("email", "Email", { placeholder: "tu@email.com", type: "email", autoComplete: "email" })}
      </div>
      {field("phone", "Teléfono (opcional)", { placeholder: "+593 …", type: "tel", autoComplete: "tel" })}
      {field(
        "message",
        "Mensaje",
        { placeholder: "Cuéntanos en qué podemos ayudarte…", rows: 5 },
        "textarea"
      )}
      <Button
        type="submit"
        disabled={sending}
        className="rounded-full px-7 py-6 text-base font-medium shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift sm:w-auto"
      >
        {sending ? "Enviando…" : "Enviar mensaje"}
        <Send className="ml-2 h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}
