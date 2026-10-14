"use client";

// Imagen de servicio con fallback intencional: glifo de molar (firma gráfica).
// Tolerancia a fallos: servicio sin imagen o URL rota → molar lineal en arco.
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ToothGlyph } from "./tooth-glyph";

interface ServiceImageProps {
  name: string;
  category?: string;
  imageUrl?: string | null;
  className?: string;
  size?: "sm" | "md";
}

export function ServiceImage({ name, category, imageUrl, className, size = "md" }: ServiceImageProps) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    const dims = size === "sm" ? "h-12 w-12" : "h-14 w-14";
    const glyph = size === "sm" ? "h-6 w-6" : "h-7 w-7";
    return (
      <div
        aria-label={`Ícono de ${name}`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-t-full rounded-b-xl bg-secondary/60 ring-1 ring-border/50",
          "select-none text-terracotta",
          dims,
          className
        )}
      >
        <ToothGlyph className={glyph} />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className={cn(
        "h-14 w-14 shrink-0 rounded-t-full rounded-b-xl object-cover ring-1 ring-border/50",
        className
      )}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
