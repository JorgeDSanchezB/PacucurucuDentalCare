"use client";

// Bandeja de mensajes del formulario de contacto público.
import { useCallback, useEffect, useState } from "react";
import { Mail, MailOpen, Phone, Clock3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiGet, apiPost } from "@/lib/client-api";
import { formatDateShort } from "@/lib/validators";
import type { ContactMessageRow } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { AdminEmpty, AdminLoading, AdminError, AdminPagination, SectionHeader } from "./shared";

export function MessagesView() {
  const { toast } = useToast();
  const [items, setItems] = useState<ContactMessageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pageCount: 1 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ContactMessageRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<{ items: ContactMessageRow[]; total: number; pageCount: number }>(
        `/api/admin/contact-messages?page=${page}`
      );
      setItems(res.items);
      setMeta({ total: res.total, pageCount: res.pageCount });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openMessage = async (msg: ContactMessageRow) => {
    setExpandedId(expandedId === msg.id ? null : msg.id);
    if (!msg.read) {
      setItems((list) => (list ?? []).map((m) => (m.id === msg.id ? { ...m, read: true } : m)));
      try {
        await apiPost(`/api/admin/contact-messages/${msg.id}`, { read: true }, "PATCH");
      } catch {
        // el cambio de estado local es suficiente; se reintenta al recargar
      }
    }
  };

  const removeMessage = async () => {
    if (!deleting) return;
    try {
      await apiPost(`/api/admin/contact-messages/${deleting.id}`, null, "DELETE");
      setItems((list) => (list ?? []).filter((m) => m.id !== deleting.id));
      setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
      if (expandedId === deleting.id) setExpandedId(null);
      toast({ title: "Mensaje eliminado" });
    } catch (e) {
      toast({ title: "No se pudo eliminar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Mensajes" description="Consultas enviadas desde el formulario de contacto del sitio." />

      {error ? <AdminError message={error} onRetry={load} /> : items === null ? <AdminLoading /> : items.length === 0 ? (
        <AdminEmpty title="La bandeja está vacía" hint="Los mensajes del formulario público llegan aquí." />
      ) : (
        <div className="space-y-3">
          {items.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-2xl border transition-colors ${
                msg.read ? "border-border/50 bg-card" : "border-primary/30 bg-primary/5"
              }`}
            >
              {/* Área clicable: cabecera y texto. Las acciones quedan FUERA de
                  este botón (HTML válido: sin button dentro de button). */}
              <button
                onClick={() => openMessage(msg)}
                aria-expanded={expandedId === msg.id}
                className="w-full p-5 text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{msg.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{msg.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden />
                      {formatDateShort(msg.createdAt.slice(0, 10))}
                    </span>
                    {msg.read ? (
                      <MailOpen className="h-4 w-4 text-muted-foreground/50" aria-label="Leído" />
                    ) : (
                      <Mail className="h-4 w-4 text-primary" aria-label="Sin leer" />
                    )}
                  </div>
                </div>
                <p className={`mt-2 text-sm leading-relaxed ${expandedId === msg.id ? "text-foreground" : "text-muted-foreground line-clamp-1"}`}>
                  {msg.message}
                </p>
              </button>
              {expandedId === msg.id && (
                <div className="mx-5 mb-5 flex flex-wrap gap-2 border-t border-border/50 pt-4">
                  <a href={`mailto:${msg.email}`}>
                    <Button size="sm" variant="outline" className="rounded-full">
                      <Mail className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Responder por email
                    </Button>
                  </a>
                  {msg.phone && (
                    <a href={`tel:${msg.phone.replace(/\s/g, "")}`}>
                      <Button size="sm" variant="outline" className="rounded-full">
                        <Phone className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        {msg.phone}
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleting(msg)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Eliminar
                  </Button>
                </div>
              )}
            </div>
          ))}
          <AdminPagination page={page} pageCount={meta.pageCount} total={meta.total} onPage={setPage} />
        </div>
      )}

      {/* Confirmar borrado */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este mensaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará el mensaje de {deleting?.name}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar</AlertDialogCancel>
            <AlertDialogAction onClick={removeMessage} className="bg-destructive text-white hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
