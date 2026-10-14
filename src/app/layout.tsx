import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pacurucu Dental Care · Odontología con calma en Guayaquil",
  description:
    "Odontología general y estética en Urdesa, Guayaquil. Citas puntuales, explicaciones claras y tratamientos que respetan tu tiempo. Reserva online.",
  keywords: ["dentista Guayaquil", "odontología Urdesa", "limpieza dental", "blanqueamiento", "Pacurucu Dental Care"],
  openGraph: {
    title: "Pacurucu Dental Care",
    description: "Odontología con calma en Urdesa, Guayaquil. Reserva tu cita online.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        // Algunas extensiones del navegador (p. ej. gestores de portapapeles)
        // inyectan atributos como "cz-shortcut-listen" en <body> antes de que
        // React hidrate. Eso dispara un falso aviso de hidratación que no es
        // un fallo de la web. suppressHydrationWarning aquí SOLO silencia
        // diferencias de atributos en este elemento; no afecta a los hijos.
        suppressHydrationWarning
        className={`${fraunces.variable} ${dmSans.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
