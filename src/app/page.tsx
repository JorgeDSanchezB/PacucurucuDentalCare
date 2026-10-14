// Pacurucu Dental Care — página única (SSR inicial + SPA client-side).
// El server component carga todo el contenido público desde la DB;
// si la DB falla, se muestra el estado de mantenimiento (nunca pantalla blanca).
import AppShell from "@/components/public/AppShell";
import { db } from "@/lib/db";
import { getSettings } from "@/modules/settings/settings";
import type { InitialPublicData } from "@/types";

export const dynamic = "force-dynamic";

async function loadInitialData(): Promise<InitialPublicData | null> {
  try {
    const [settings, services, testimonials, faqs, gallery, schedule] = await Promise.all([
      getSettings(),
      db.service.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true, name: true, slug: true, description: true,
          duration: true, price: true, category: true, imageUrl: true, sortOrder: true,
        },
      }),
      db.testimonial.findMany({
        where: { published: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, patientName: true, rating: true, text: true },
      }),
      db.faqItem.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, question: true, answer: true } }),
      db.galleryItem.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true, imageUrl: true } }),
      db.schedule.findMany({ orderBy: { dayOfWeek: "asc" } }),
    ]);

    return {
      settings,
      services,
      testimonials,
      faqs,
      gallery,
      schedule: schedule.map((s) => ({
        dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, isActive: s.isActive,
      })),
    };
  } catch (e) {
    console.error("[page] DB no disponible:", e);
    return null;
  }
}

export default async function Page() {
  const initialData = await loadInitialData();

  if (!initialData) {
    // Tolerancia a fallos: DB caída → mensaje de mantenimiento (503 visual)
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
        <p className="font-serif text-3xl font-semibold text-foreground">Estamos en mantenimiento</p>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
          El sistema está temporalmente fuera de servicio. Vuelve en unos minutos. Para urgencias dentales,
          escríbenos por WhatsApp y te acomodamos en el primer espacio disponible.
        </p>
        <a
          href="/"
          className="mt-8 rounded-full border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Reintentar
        </a>
      </div>
    );
  }

  return <AppShell initialData={initialData} />;
}
