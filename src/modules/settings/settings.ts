// Módulo de configuración: lectura tipada de ClinicSetting (key → JSON).
// Los defaults estructurales existen SOLO como tolerancia a fallos
// (claves ausentes). El contenido real vive en la DB (regla Cero Hardcoding).
import { db } from "@/lib/db";
import type { ClinicSettings } from "@/types";

const STRUCTURAL_DEFAULTS: ClinicSettings = {
  clinic: {
    name: "Pacurucu Dental Care",
    tagline: "",
    address: "",
    city: "",
    phone: "",
    whatsapp: "",
    email: "",
  },
  doctor: {
    name: "",
    title: "",
    specialty: "",
    bio: "",
    photoUrl: "",
    credentials: [],
  },
  hero: { title: "", subtitle: "", imageUrl: "" },
  about: { title: "", text: "", imageUrl: "" },
  social: {
    whatsapp: "",
    instagram: "",
    facebook: "",
    tiktok: "",
  },
  theme: {
    colors: {
      background: "#FAF8F5",
      foreground: "#1A1A2E",
      primary: "#0A7B83",
      secondary: "#E8B4A0",
      accent: "#C25E3C",
    },
  },
};

export async function getSettings(): Promise<ClinicSettings> {
  try {
    const rows = await db.clinicSetting.findMany();
    const parsed: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        parsed[row.key] = JSON.parse(row.value);
      } catch {
        // valor corrupto → se ignora y cae al default estructural
      }
    }
    return {
      clinic: { ...STRUCTURAL_DEFAULTS.clinic, ...(parsed.clinic as object) },
      social: { ...STRUCTURAL_DEFAULTS.social, ...(parsed.social as object) },
      doctor: { ...STRUCTURAL_DEFAULTS.doctor, ...(parsed.doctor as object) },
      hero: { ...STRUCTURAL_DEFAULTS.hero, ...(parsed.hero as object) },
      about: { ...STRUCTURAL_DEFAULTS.about, ...(parsed.about as object) },
      theme: { ...STRUCTURAL_DEFAULTS.theme, ...(parsed.theme as object) },
    };
  } catch {
    // DB caída: defaults estructurales para no romper el render
    return STRUCTURAL_DEFAULTS;
  }
}
