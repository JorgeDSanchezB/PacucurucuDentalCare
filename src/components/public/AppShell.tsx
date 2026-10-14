"use client";

// AppShell: contenedor SPA (rutas: inicio · reservar · admin/*).
// Aplica el tema dinámico desde DB (personalizable en el panel) y monta
// el SessionProvider de NextAuth para las vistas admin.
import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import { useHashRoute } from "@/lib/hash-router";
import type { InitialPublicData } from "@/types";
import { PublicNavbar } from "./Navbar";
import { Footer } from "./Footer";
import { HomeView } from "./HomeView";
import { BookingView } from "./BookingView";
import { AdminApp } from "@/components/admin/AdminApp";

export default function AppShell({ initialData }: { initialData: InitialPublicData }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} basePath="/api/auth">
      <SiteRoot initialData={initialData} />
    </SessionProvider>
  );
}

function SiteRoot({ initialData }: { initialData: InitialPublicData }) {
  const [segments, navigate] = useHashRoute();
  const route = segments[0] ?? "";
  const [preselectedServiceIds, setPreselectedServiceIds] = useState<string[]>([]);

  const startBooking = (serviceIds: string[]) => {
    setPreselectedServiceIds(serviceIds);
    navigate("reservar");
  };

  // Tema dinámico desde la configuración (editable en el panel admin)
  useEffect(() => {
    const c = initialData.settings.theme.colors;
    const root = document.documentElement;
    root.style.setProperty("--background", c.background);
    root.style.setProperty("--foreground", c.foreground);
    root.style.setProperty("--primary", c.primary);
    root.style.setProperty("--primary-foreground", "#ffffff");
    root.style.setProperty("--ring", c.primary);
    root.style.setProperty("--accent", c.secondary);
    root.style.setProperty("--accent-foreground", c.foreground);
    root.style.setProperty("--secondary", `color-mix(in srgb, ${c.secondary} 22%, #ffffff)`);
    root.style.setProperty("--secondary-foreground", `color-mix(in srgb, ${c.foreground} 72%, ${c.secondary})`);
    root.style.setProperty("--chart-1", c.primary);
    root.style.setProperty("--chart-2", c.secondary);
    root.style.setProperty("--chart-4", c.accent);
    root.style.setProperty("--terracotta", c.accent);
  }, [initialData.settings.theme.colors]);

  // Título por vista
  useEffect(() => {
    const titles: Record<string, string> = {
      "": "Pacurucu Dental Care · Odontología con calma en Guayaquil",
      reservar: "Reservar cita · Pacurucu Dental Care",
      admin: "Panel de administración · Pacurucu Dental Care",
    };
    document.title = titles[route] ?? titles.admin;
  }, [route]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {route !== "admin" && <PublicNavbar settings={initialData.settings} navigate={navigate} route={route} startBooking={startBooking} />}
      <main className="flex-1 flex flex-col">
        {route === "reservar" ? (
          <BookingView
            services={initialData.services}
            settings={initialData.settings}
            schedule={initialData.schedule}
            navigate={navigate}
            initialSelection={preselectedServiceIds}
          />
        ) : route === "admin" ? (
          <AdminApp section={segments[1] ?? "dashboard"} navigate={navigate} />
        ) : (
          <HomeView initialData={initialData} navigate={navigate} onReserveService={(id) => startBooking([id])} />
        )}
      </main>
      {route !== "admin" && <Footer initialData={initialData} navigate={navigate} />}
    </div>
  );
}
