"use client";

// Navbar pública: una línea en desktop (≤80px), menú lateral en móvil.
import { useEffect, useState } from "react";
import { Menu, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useScrollToSection } from "@/lib/hash-router";
import type { ClinicSettings } from "@/types";

interface NavbarProps {
  settings: ClinicSettings;
  navigate: (path: string) => void;
  route: string;
  startBooking: (serviceIds: string[]) => void;
}

const LINKS = [
  { id: "servicios", label: "Servicios" },
  { id: "doctor", label: "El doctor" },
  { id: "testimonios", label: "Testimonios" },
  { id: "galeria", label: "Clínica" },
  { id: "faq", label: "Preguntas" },
  { id: "contacto", label: "Contacto" },
];

export function PublicNavbar({ settings, navigate, route, startBooking }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const isHome = route === "";
  const scrollToSection = useScrollToSection(navigate, isHome);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    setOpen(false);
    scrollToSection(id);
  };

  const reserve = () => {
    setOpen(false);
    startBooking([]);
  };

  return (
    <header
      className={`sticky top-0 z-40 bg-background/85 backdrop-blur-md transition-all duration-300 ${
        scrolled ? "border-b border-border/60 shadow-[0_8px_24px_-16px_rgba(26,26,46,0.15)]" : "border-b border-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 transition-[height] duration-300 sm:px-6 ${
          scrolled ? "h-14" : "h-16"
        }`}
      >
        {/* Marca: serif + itálica en color de acento (firma tipográfica) */}
        <button
          onClick={() => (isHome ? window.scrollTo({ top: 0, behavior: "smooth" }) : navigate(""))}
          className="text-left"
          aria-label="Ir al inicio"
        >
          <span className="font-serif text-[1.3rem] font-semibold tracking-tight text-foreground">
            {settings.clinic.name?.split(" ").slice(0, 1)[0] || "Pacurucu"}
            <span className="font-serif italic font-medium text-primary">
              {" "}
              {settings.clinic.name?.split(" ").slice(1).join(" ") || "Dental Care"}
            </span>
          </span>
        </button>

        {/* Navegación desktop con subrayado animado */}
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegación principal">
          {LINKS.map((link) => (
            <button
              key={link.id}
              onClick={() => go(link.id)}
              className="link-underline text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            onClick={reserve}
            size="sm"
            className="rounded-full px-5 font-medium shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5"
          >
            <CalendarCheck className="mr-1.5 h-4 w-4" aria-hidden />
            Reservar
          </Button>

          {/* Menú móvil */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 border-border/60">
              <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
              <nav className="mt-2 flex flex-col gap-0.5" aria-label="Navegación móvil">
                {LINKS.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => go(link.id)}
                    className="rounded-xl px-3 py-2.5 text-left font-serif text-lg font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {link.label}
                  </button>
                ))}
                <Button onClick={reserve} className="mt-5 rounded-full py-6 text-base font-medium shadow-soft">
                  <CalendarCheck className="mr-1.5 h-4 w-4" aria-hidden />
                  Reservar cita
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

