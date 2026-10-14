"use client";

// ImageField: campo de imagen con subida desde el PC.
// Combina: miniatura de vista previa + campo URL editable + botón "Subir
// imagen" (PNG, JPG, WebP o GIF hasta 5 MB) + botón "Quitar".
// La subida va a POST /api/admin/media y el campo queda con la URL servida
// por /api/media/<id>, que funciona igual en el sitio público.
import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB (misma validación que la API)
const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif";

interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}

export function ImageField({ label, value, onChange, hint }: ImageFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pickFile = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type || !ACCEPTED.includes(file.type)) {
      toast({ title: "Formato no soportado", description: "Usa PNG, JPG, WebP o GIF.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "Imagen demasiado grande", description: "Máximo 5 MB. Exporta una versión más liviana.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "No se pudo subir la imagen.");
      }
      onChange(json.url as string);
      toast({ title: "Imagen subida", description: "Guarda los cambios para aplicarla al sitio." });
    } catch (e) {
      toast({
        title: "No se pudo subir la imagen",
        description: e instanceof Error ? e.message : "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = ""; // permite resubir el mismo archivo
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        {/* Miniatura de vista previa */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted">
          {value ? (
            <>
              <img src={value} alt="Vista previa" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label="Quitar imagen"
                title="Quitar imagen"
                className="absolute right-0.5 top-0.5 rounded-full bg-foreground/80 p-0.5 text-background hover:bg-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">sin foto</div>
          )}
        </div>

        <div className="flex-1 space-y-1.5">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Pega una URL o sube un archivo" />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={pickFile} disabled={uploading} className="rounded-full">
              {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
              {uploading ? "Subiendo…" : "Subir imagen"}
            </Button>
            <span className="text-xs text-muted-foreground">{hint ?? "PNG, JPG, WebP o GIF · hasta 5 MB"}</span>
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
