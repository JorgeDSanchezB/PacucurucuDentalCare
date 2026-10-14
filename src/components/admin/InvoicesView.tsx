"use client";

// Facturación: listado, generación desde citas completadas, PDF y export CSV.
import { useCallback, useEffect, useState } from "react";
import { FileDown, FileSpreadsheet, Search, Receipt, Loader2, CalendarCheck, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/client-api";
import { formatDateShort, formatMoney } from "@/lib/validators";
import type { AppointmentRow, InvoiceRow } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { AdminEmpty, AdminLoading, AdminError, AdminPagination, SectionHeader } from "./shared";

const CURRENT_YEAR = String(new Date().getFullYear());

export function InvoicesView({ goSection }: { goSection: (key: "citas") => void }) {
  const { toast } = useToast();
  const [items, setItems] = useState<InvoiceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("ALL");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pageCount: 1 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query.trim()) params.set("q", query.trim());
      if (year !== "ALL") params.set("year", year);
      const res = await apiGet<{ items: InvoiceRow[]; total: number; pageCount: number }>(
        `/api/admin/invoices?${params.toString()}`
      );
      setItems(res.items);
      setMeta({ total: res.total, pageCount: res.pageCount });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, [page, query, year]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const years = Array.from({ length: 5 }, (_, i) => String(Number(CURRENT_YEAR) - i));

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      const res = await apiPost<{ number: number }>(`/api/admin/invoices/${deleting.id}`, null, "DELETE");
      toast({ title: `Factura FAC-${String(res.number).padStart(4, "0")} eliminada` });
      setDeleting(null);
      // Si era la última de la página, retrocede una página
      if (items && items.length === 1 && page > 1) setPage((p) => p - 1);
      else await load();
    } catch (e) {
      toast({ title: "No se pudo eliminar", description: e instanceof Error ? e.message : "", variant: "destructive" });
      setDeleting(null);
    }
  };

  const totalSum = (items ?? []).reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-6">
      <SectionHeader title="Facturación" description="Facturas internas de citas completadas, numeración secuencial.">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPickerOpen(true)} className="rounded-full">
            <Receipt className="mr-1.5 h-4 w-4" aria-hidden />
            Nueva factura
          </Button>
          <a href="/api/admin/invoices/export" download>
            <Button variant="outline" className="rounded-full">
              <FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden />
              Exportar CSV
            </Button>
          </a>
        </div>
      </SectionHeader>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Buscar por paciente…"
            className="rounded-xl pl-9"
          />
        </div>
        <Select value={year} onValueChange={(v) => { setYear(v); setPage(1); }}>
          <SelectTrigger className="w-36 rounded-xl" aria-label="Filtrar por año">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los años</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? <AdminError message={error} onRetry={load} /> : items === null ? <AdminLoading /> : items.length === 0 ? (
        <AdminEmpty
          title="Sin facturas todavía"
          hint="Marca citas como completadas y genera su factura desde el menú de acciones."
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Total en esta página: <span className="font-semibold tabular-nums text-foreground">{formatMoney(totalSum)}</span>
          </p>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="overflow-x-auto subtle-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">N.º</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Paciente</th>
                    <th className="px-4 py-3 font-medium">Método</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3.5 font-semibold tabular-nums text-primary">
                        FAC-{String(inv.number).padStart(4, "0")}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-muted-foreground">{formatDateShort(inv.date)}</td>
                      <td className="px-4 py-3.5 text-foreground">{inv.patientName}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{inv.paymentMethod}</td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">{formatMoney(inv.total)}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-1">
                          <a href={`/api/admin/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label={`Descargar factura ${inv.number}`}>
                              <FileDown className="h-4 w-4 text-primary" />
                            </Button>
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleting(inv)}
                            aria-label={`Eliminar factura ${inv.number}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <AdminPagination page={page} pageCount={meta.pageCount} total={meta.total} onPage={setPage} />
            </div>
          </div>
        </>
      )}

      {/* Confirmar borrado de factura */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la factura FAC-{deleting ? String(deleting.number).padStart(4, "0") : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará de la lista y del registro contable interno. Esta acción no se puede deshacer.
              Si la cita asociada sigue completada, podrás generar una nueva factura desde ella.
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

      {pickerOpen && (
        <InvoicePickerDialog
          onClose={() => setPickerOpen(false)}
          onGenerate={async (appointmentId) => {
            setGeneratingId(appointmentId);
            try {
              const res = await apiPost<{ invoice: { number: number } }>("/api/admin/invoices", { appointmentId });
              toast({ title: `Factura FAC-${String(res.invoice.number).padStart(4, "0")} generada` });
              setPickerOpen(false);
              setPage(1);
              await load();
            } catch (e) {
              toast({ title: "No se pudo facturar", description: e instanceof Error ? e.message : "", variant: "destructive" });
            } finally {
              setGeneratingId(null);
            }
          }}
          generatingId={generatingId}
          goSection={goSection}
        />
      )}
    </div>
  );
}

function InvoicePickerDialog({
  onClose, onGenerate, generatingId, goSection,
}: {
  onClose: () => void;
  onGenerate: (appointmentId: string) => void;
  generatingId: string | null;
  goSection: (key: "citas") => void;
}) {
  const [items, setItems] = useState<AppointmentRow[] | null>(null);

  useEffect(() => {
    apiGet<{ items: AppointmentRow[] }>("/api/admin/appointments?status=COMPLETED&page=1&pageSize=100")
      .then((res) => setItems(res.items.filter((a) => !a.hasInvoice)))
      .catch(() => setItems([]));
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Nueva factura</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Selecciona una cita <span className="font-medium text-foreground">completada</span> sin factura:
        </p>
        {items === null ? <AdminLoading /> : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <CalendarCheck className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
            <p className="mt-2 font-medium text-foreground">No hay citas pendientes de facturar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Marca citas como completadas en la sección Citas y vuelve aquí.
            </p>
            <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => { onClose(); goSection("citas"); }}>
              Ir a Citas
            </Button>
          </div>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto subtle-scroll pr-1">
            {items.map((appt) => (
              <li key={appt.id}>
                <Button
                  variant="outline"
                  disabled={generatingId !== null}
                  onClick={() => onGenerate(appt.id)}
                  className="h-auto w-full justify-between rounded-xl p-4 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {appt.patient.firstName} {appt.patient.lastName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDateShort(appt.date)} {appt.startTime} · {appt.services.map((s) => s.name).join(" / ")}
                    </span>
                  </span>
                  <span className="ml-3 shrink-0 font-semibold tabular-nums text-primary">
                    {formatMoney(appt.services.reduce((sum, s) => sum + s.price, 0))}
                  </span>
                  {generatingId === appt.id && <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
