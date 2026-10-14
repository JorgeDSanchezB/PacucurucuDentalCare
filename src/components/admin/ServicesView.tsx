"use client";

// Servicios: CRUD + orden drag-and-drop (@dnd-kit) + activar/desactivar.
import { useCallback, useEffect, useState } from "react";
import {
  DndContext, closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, GripVertical, Pencil, Trash2, Loader2, Search,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ImageField } from "./ImageField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiPost } from "@/lib/client-api";
import { formatDuration, formatMoney, slugify } from "@/lib/validators";
import type { ServiceAdminDTO } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { AdminEmpty, AdminLoading, AdminError, SectionHeader } from "./shared";

interface ServiceForm {
  name: string;
  description: string;
  duration: string;
  price: string;
  category: string;
  imageUrl: string;
  active: boolean;
}

const EMPTY_FORM: ServiceForm = {
  name: "", description: "", duration: "30", price: "0", category: "", imageUrl: "", active: true,
};

export function ServicesView() {
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceAdminDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceAdminDTO | null>(null);
  const [deleting, setDeleting] = useState<ServiceAdminDTO | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<{ services: ServiceAdminDTO[] }>("/api/admin/services");
      setServices(res.services);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = (services ?? []).filter((s) =>
    !query.trim() ||
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.category.toLowerCase().includes(query.toLowerCase())
  );

  // Drag-and-drop: reordena localmente y persiste el orden completo
  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !services) return;
    const oldIndex = services.findIndex((s) => s.id === active.id);
    const newIndex = services.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(services, oldIndex, newIndex);
    setServices(reordered);
    setSavingOrder(true);
    try {
      await apiPost("/api/admin/services/order", {
        items: reordered.map((s, i) => ({ id: s.id, sortOrder: i + 1 })),
      }, "PATCH");
    } catch (e) {
      toast({ title: "No se pudo guardar el orden", description: e instanceof Error ? e.message : "", variant: "destructive" });
      await load();
    } finally {
      setSavingOrder(false);
    }
  };

  const toggleActive = async (service: ServiceAdminDTO, active: boolean) => {
    setServices((list) => (list ?? []).map((s) => (s.id === service.id ? { ...s, active } : s)));
    try {
      await apiPost(`/api/admin/services/${service.id}`, { active }, "PUT");
    } catch (e) {
      toast({ title: "No se pudo cambiar", description: e instanceof Error ? e.message : "", variant: "destructive" });
      await load();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await apiPost<{ message: string }>(`/api/admin/services/${deleting.id}`, null, "DELETE");
      toast({ title: "Servicio eliminado", description: res.message });
      setDeleting(null);
      await load();
    } catch (e) {
      toast({ title: "No se pudo eliminar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Servicios" description="Catálogo visible en el sitio y en el formulario de reserva.">
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="rounded-full font-medium"
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          Nuevo servicio
        </Button>
      </SectionHeader>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o categoría…"
            className="rounded-xl pl-9"
          />
        </div>
        {savingOrder && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Guardando orden…
          </span>
        )}
      </div>

      {error ? <AdminError message={error} onRetry={load} /> : services === null ? <AdminLoading /> : filtered.length === 0 ? (
        <AdminEmpty title={query ? "Sin coincidencias" : "Aún no hay servicios"} hint="Crea el primero con el botón Nuevo servicio." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={filtered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-10 px-3 py-3" aria-label="Ordenar" />
                    <th className="px-4 py-3 font-medium">Servicio</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">Duración</th>
                    <th className="px-4 py-3 font-medium">Precio</th>
                    <th className="px-4 py-3 font-medium">Visible</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((service) => (
                    <SortableRow
                      key={service.id}
                      service={service}
                      onEdit={() => { setEditing(service); setDialogOpen(true); }}
                      onDelete={() => setDeleting(service)}
                      onToggle={(active) => toggleActive(service, active)}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Arrastra el asa <GripVertical className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden /> para reordenar. El orden se refleja en el sitio público.
      </p>

      {dialogOpen && (
        <ServiceDialog
          service={editing}
          onClose={() => setDialogOpen(false)}
          onSaved={() => { setDialogOpen(false); void load(); }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Si el servicio tiene citas activas, se desactivará del catálogo conservando las citas existentes.
              Las facturas históricas no se ven afectadas (guardan su propia copia de precios).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableRow({
  service, onEdit, onDelete, onToggle,
}: {
  service: ServiceAdminDTO;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (active: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-b border-border/40 last:border-0 ${isDragging ? "bg-muted/60 shadow-lg" : "hover:bg-muted/20"}`}
    >
      <td className="px-3 py-3.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
          aria-label={`Reordenar ${service.name}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </td>
      <td className="max-w-72 px-4 py-3.5">
        <p className="font-medium text-foreground">{service.name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{service.description}</p>
      </td>
      <td className="px-4 py-3.5">
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
          {service.category}
        </span>
      </td>
      <td className="px-4 py-3.5 tabular-nums text-muted-foreground">{formatDuration(service.duration)}</td>
      <td className="px-4 py-3.5 tabular-nums font-semibold text-primary">{formatMoney(service.price)}</td>
      <td className="px-4 py-3.5">
        <Switch checked={service.active} onCheckedChange={onToggle} aria-label={`Mostrar ${service.name} en el sitio`} />
      </td>
      <td className="px-4 py-3.5 text-right">
        <div className="inline-flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onEdit} aria-label={`Editar ${service.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onDelete} aria-label={`Eliminar ${service.name}`}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ServiceDialog({
  service, onClose, onSaved,
}: {
  service: ServiceAdminDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ServiceForm>(
    service
      ? {
          name: service.name,
          description: service.description,
          duration: String(service.duration),
          price: String(service.price),
          category: service.category,
          imageUrl: service.imageUrl ?? "",
          active: service.active,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);

  const set = (key: keyof ServiceForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        duration: Number(form.duration),
        price: Number(form.price),
        category: form.category.trim(),
        imageUrl: form.imageUrl.trim() || null,
        active: form.active,
      };
      if (!body.name || !body.category || !body.description) {
        throw new Error("Completa nombre, categoría y descripción.");
      }
      if (!Number.isFinite(body.duration) || body.duration < 5) throw new Error("Duración inválida (mínimo 5 minutos).");
      if (!Number.isFinite(body.price) || body.price < 0) throw new Error("Precio inválido.");

      if (service) {
        await apiPost(`/api/admin/services/${service.id}`, body, "PUT");
        toast({ title: "Servicio actualizado" });
      } else {
        await apiPost("/api/admin/services", { ...body, slug: slugify(body.name) });
        toast({ title: "Servicio creado", description: "Ya aparece en el sitio público y en la reserva." });
      }
      onSaved();
    } catch (e) {
      toast({ title: "No se pudo guardar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg overflow-y-auto max-h-[90dvh] subtle-scroll">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{service ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Odontopediatría" />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              placeholder="Qué incluye, para quién, beneficios…"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Duración (min)</Label>
              <Input type="number" min={5} max={480} step={5} value={form.duration} onChange={(e) => set("duration", e.target.value)} className="tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label>Precio (USD)</Label>
              <Input type="number" min={0} step="1" value={form.price} onChange={(e) => set("price", e.target.value)} className="tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Ej: Pediatría" />
            </div>
          </div>
          <ImageField
            label="Imagen del servicio (opcional)"
            value={form.imageUrl}
            onChange={(v) => set("imageUrl", v)}
            hint="Sin imagen se muestra la inicial del servicio"
          />
          <div className="flex items-center justify-between rounded-2xl border border-border/60 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Visible en el sitio</p>
              <p className="text-xs text-muted-foreground">Los servicios ocultos no aparecen en el catálogo ni en la reserva.</p>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} aria-label="Servicio visible" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-full">Cancelar</Button>
          <Button onClick={save} disabled={saving} className="rounded-full font-medium">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            {service ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
