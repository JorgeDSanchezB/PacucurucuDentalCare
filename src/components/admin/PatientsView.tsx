"use client";

// Pacientes: búsqueda, ficha completa (citas, historial clínico, facturas),
// notas clínicas CRUD, exportar PDF y enviar historial por email.
import { useCallback, useEffect, useState } from "react";
import {
  Search, Loader2, FileDown, Mail, Plus, Trash2, Pencil, X, Stethoscope,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, apiPost } from "@/lib/client-api";
import {
  STATUS_LABELS, type AppointmentRow, type ClinicalNoteRow, type InvoiceRow, type PatientRow,
} from "@/types";
import { clinicToday, formatDateLong, formatDateShort, formatMoney } from "@/lib/validators";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge, AdminEmpty, AdminLoading, AdminError, AdminPagination, SectionHeader } from "./shared";

export function PatientsView() {
  const { toast } = useToast();
  const [items, setItems] = useState<PatientRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pageCount: 1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PatientRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (query.trim()) params.set("q", query.trim());
      const res = await apiGet<{ items: PatientRow[]; total: number; pageCount: number }>(
        `/api/admin/patients?${params.toString()}`
      );
      setItems(res.items);
      setMeta({ total: res.total, pageCount: res.pageCount });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, [page, query]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const removeRowPatient = async () => {
    if (!deleteTarget) return;
    try {
      await apiPost(`/api/admin/patients/${deleteTarget.id}`, null, "DELETE");
      toast({ title: "Paciente eliminado", description: `${deleteTarget.firstName} ${deleteTarget.lastName} y sus datos asociados.` });
      setDeleteTarget(null);
      if (items && items.length === 1 && page > 1) setPage((p) => p - 1);
      else await load();
    } catch (e) {
      toast({ title: "No se pudo eliminar", description: e instanceof Error ? e.message : "", variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Pacientes" description="Fichas, historial clínico y documentación." />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Buscar por nombre, email o teléfono…"
          className="rounded-xl pl-9"
        />
      </div>

      {error ? <AdminError message={error} onRetry={load} /> : items === null ? <AdminLoading /> : items.length === 0 ? (
        <AdminEmpty title={query ? "Sin coincidencias" : "Aún no hay pacientes"} hint="Se crean automáticamente con la primera reserva." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="overflow-x-auto subtle-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Citas</th>
                  <th className="px-4 py-3 font-medium">Ficha desde</th>
                  <th className="px-4 py-3 text-right font-medium">Historial</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/20" onClick={() => setSelectedId(p.id)}>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-foreground">{p.firstName} {p.lastName}</p>
                      {p.birthDate && <p className="text-xs text-muted-foreground">{formatDateShort(p.birthDate)}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-foreground">{p.phone}</p>
                      <p className="text-xs text-muted-foreground">{p.email}</p>
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-muted-foreground">{p.appointmentCount ?? 0}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{formatDateShort(p.createdAt.slice(0, 10))}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" className="rounded-full" onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}>
                          Ver ficha
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                          aria-label={`Eliminar a ${p.firstName} ${p.lastName}`}
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
      )}

      {selectedId && <PatientDetailDialog patientId={selectedId} onClose={() => { setSelectedId(null); void load(); }} />}

      {/* Confirmar borrado desde la tabla */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {deleteTarget?.firstName} {deleteTarget?.lastName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán también sus citas ({deleteTarget?.appointmentCount ?? 0}), notas clínicas y facturas asociadas.
              Esta acción no se puede deshacer. Si solo quieres liberar el horario, cancela o borra la cita en la sección Citas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar</AlertDialogCancel>
            <AlertDialogAction onClick={removeRowPatient} className="bg-destructive text-white hover:bg-destructive/90">
              Eliminar paciente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Ficha del paciente ──────────────────────────────────────────────────────

interface PatientDetail {
  patient: PatientRow;
  appointments: AppointmentRow[];
  clinicalNotes: ClinicalNoteRow[];
  invoices: InvoiceRow[];
}

function PatientDetailDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [data, setData] = useState<PatientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ClinicalNoteRow | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<PatientDetail>(`/api/admin/patients/${patientId}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendHistory = async () => {
    setSendingEmail(true);
    try {
      const res = await apiPost<{
        emailStatus: "SENT" | "SIMULATED" | "FAILED";
        message: string;
        downloadUrl: string;
      }>(`/api/admin/patients/${patientId}/history/send`, {});
      toast({
        title: res.emailStatus === "SENT" ? "Email enviado" : res.emailStatus === "SIMULATED" ? "Envío simulado" : "Falló el envío",
        description: res.message,
      });
    } catch (e) {
      toast({ title: "No se pudo enviar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const removePatient = async () => {
    try {
      const res = await apiPost<{ deleted: { appointments: number; clinicalNotes: number; invoices: number } }>(
        `/api/admin/patients/${patientId}`, null, "DELETE"
      );
      toast({
        title: `${patient.firstName} ${patient.lastName} eliminado`,
        description: `Se borraron ${res.deleted.appointments} citas, ${res.deleted.clinicalNotes} notas clínicas y ${res.deleted.invoices} facturas.`,
      });
      onClose();
    } catch (e) {
      toast({ title: "No se pudo eliminar", description: e instanceof Error ? e.message : "", variant: "destructive" });
      setConfirmDelete(false);
    }
  };

  if (error) return <Dialog open onOpenChange={() => onClose()}><DialogContent><AdminError message={error} onRetry={load} /></DialogContent></Dialog>;
  if (!data) return <Dialog open onOpenChange={() => onClose()}><DialogContent><AdminLoading label="Cargando ficha…" /></DialogContent></Dialog>;

  const { patient, appointments, clinicalNotes, invoices } = data;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[92dvh] subtle-scroll">
        <DialogHeader className="items-start">
          <DialogTitle className="font-serif text-2xl">{patient.firstName} {patient.lastName}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {patient.phone} · {patient.email}
            {patient.birthDate ? ` · ${formatDateLong(patient.birthDate)}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`/api/admin/patients/${patient.id}/history/pdf`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="rounded-full">
                <FileDown className="mr-1.5 h-4 w-4" aria-hidden />
                Historial en PDF
              </Button>
            </a>
            <Button variant="outline" size="sm" className="rounded-full" onClick={sendHistory} disabled={sendingEmail}>
              {sendingEmail ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <Mail className="mr-1.5 h-4 w-4" aria-hidden />}
              Enviar por email
            </Button>
            <Button size="sm" className="rounded-full" onClick={() => { setEditingNote(null); setNoteFormOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              Nueva nota clínica
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
              Eliminar paciente
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="historial" className="mt-2">
          <TabsList className="rounded-xl">
            <TabsTrigger value="historial" className="rounded-lg">Historial ({clinicalNotes.length})</TabsTrigger>
            <TabsTrigger value="citas" className="rounded-lg">Citas ({appointments.length})</TabsTrigger>
            <TabsTrigger value="facturas" className="rounded-lg">Facturas ({invoices.length})</TabsTrigger>
          </TabsList>

          {/* Historial clínico */}
          <TabsContent value="historial" className="mt-4 space-y-4">
            {clinicalNotes.length === 0 ? (
              <AdminEmpty title="Sin notas clínicas" hint="Registra la primera con Nueva nota clínica." />
            ) : (
              clinicalNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={() => { setEditingNote(note); setNoteFormOpen(true); }}
                  onDeleted={load}
                />
              ))
            )}
          </TabsContent>

          {/* Citas */}
          <TabsContent value="citas" className="mt-4">
            {appointments.length === 0 ? (
              <AdminEmpty title="Sin citas registradas" />
            ) : (
              <ul className="space-y-3">
                {appointments.map((appt) => (
                  <li key={appt.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 p-4">
                    <div className="min-w-40">
                      <p className="text-sm font-medium tabular-nums text-foreground">{formatDateLong(appt.date)}</p>
                      <p className="text-xs tabular-nums text-muted-foreground">{appt.startTime} a {appt.endTime}</p>
                    </div>
                    <p className="min-w-40 flex-1 text-sm text-foreground">{appt.services.map((s) => s.name).join(" · ")}</p>
                    <StatusBadge status={appt.status} />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* Facturas */}
          <TabsContent value="facturas" className="mt-4">
            {invoices.length === 0 ? (
              <AdminEmpty title="Sin facturas" hint="Se generan desde Citas al marcar una cita como completada." />
            ) : (
              <ul className="space-y-3">
                {invoices.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 p-4">
                    <p className="text-sm font-semibold tabular-nums text-primary">
                      FAC-{String(inv.number).padStart(4, "0")}
                    </p>
                    <p className="text-sm tabular-nums text-muted-foreground">{formatDateShort(inv.date)}</p>
                    <p className="flex-1 text-sm tabular-nums text-foreground">{formatMoney(inv.total)}</p>
                    <a href={`/api/admin/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="rounded-full">
                        <FileDown className="mr-1.5 h-4 w-4" aria-hidden />
                        PDF
                      </Button>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        {noteFormOpen && (
          <ClinicalNoteDialog
            patientId={patient.id}
            note={editingNote}
            appointments={appointments}
            onClose={() => setNoteFormOpen(false)}
            onSaved={() => { setNoteFormOpen(false); void load(); }}
          />
        )}

        {/* Confirmar borrado del paciente completo */}
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar a {patient.firstName} {patient.lastName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borrarán permanentemente: <span className="font-medium text-foreground">{appointments.length} citas</span>,
                <span className="font-medium text-foreground"> {clinicalNotes.length} notas clínicas</span> y
                <span className="font-medium text-foreground"> {invoices.length} facturas</span>.
                Esta acción no se puede deshacer; descarga antes el historial en PDF si lo necesitas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Conservar</AlertDialogCancel>
              <AlertDialogAction onClick={removePatient} className="bg-destructive text-white hover:bg-destructive/90">
                Eliminar paciente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function NoteCard({
  note, onEdit, onDeleted,
}: {
  note: ClinicalNoteRow;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remove = async () => {
    try {
      await apiPost(`/api/admin/clinical-notes/${note.id}`, null, "DELETE");
      toast({ title: "Nota eliminada" });
      onDeleted();
    } catch (e) {
      toast({ title: "No se pudo eliminar", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tabular-nums text-terracotta">{formatDateLong(note.date)}</p>
          <p className="mt-1 font-serif text-base font-semibold text-foreground">{note.treatment}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onEdit} aria-label="Editar nota">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setConfirmOpen(true)} aria-label="Eliminar nota">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
      {note.observations && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Observaciones</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{note.observations}</p>
        </div>
      )}
      {note.privateNotes && (
        <div className="mt-3 rounded-xl bg-secondary/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground">Notas privadas</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{note.privateNotes}</p>
        </div>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta nota clínica?</AlertDialogTitle>
            <AlertDialogDescription>La nota del {formatDateLong(note.date)} se borrará del historial. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-white hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

function ClinicalNoteDialog({
  patientId, note, appointments, onClose, onSaved,
}: {
  patientId: string;
  note: ClinicalNoteRow | null;
  appointments: AppointmentRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    date: note?.date ?? clinicToday(),
    treatment: note?.treatment ?? "",
    observations: note?.observations ?? "",
    privateNotes: note?.privateNotes ?? "",
    appointmentId: note?.appointmentId ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (form.treatment.trim().length < 3) throw new Error("Describe el tratamiento.");
      const body = {
        patientId,
        date: form.date,
        treatment: form.treatment.trim(),
        observations: form.observations.trim() || undefined,
        privateNotes: form.privateNotes.trim() || undefined,
        appointmentId: form.appointmentId || undefined,
      };
      if (note) {
        await apiPost(`/api/admin/clinical-notes/${note.id}`, body, "PUT");
        toast({ title: "Nota actualizada" });
      } else {
        await apiPost("/api/admin/clinical-notes", body);
        toast({ title: "Nota registrada" });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" aria-hidden />
            {note ? "Editar nota clínica" : "Nueva nota clínica"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={form.date} max={clinicToday()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cita asociada (opcional)</Label>
              <select
                value={form.appointmentId}
                onChange={(e) => setForm((f) => ({ ...f, appointmentId: e.target.value }))}
                className="h-9 w-full rounded-xl border border-input bg-transparent px-3 text-sm text-foreground"
                aria-label="Cita asociada"
              >
                <option value="">Sin cita</option>
                {appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.date} {a.startTime} · {a.services.map((s) => s.name).join(" / ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tratamiento</Label>
            <Input value={form.treatment} onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))} placeholder="Ej: Resina en pieza 1.2" />
          </div>
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea value={form.observations} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} rows={3} placeholder="Hallazgos clínicos, indicaciones…" />
          </div>
          <div className="space-y-1.5">
            <Label>Notas privadas</Label>
            <Textarea value={form.privateNotes} onChange={(e) => setForm((f) => ({ ...f, privateNotes: e.target.value }))} rows={3} placeholder="Solo visibles en el panel. Se incluyen en el PDF del historial." />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-full">Cancelar</Button>
          <Button onClick={save} disabled={saving} className="rounded-full font-medium">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            {note ? "Guardar cambios" : "Registrar nota"}
          </Button>
        </div>
        <button onClick={onClose} className="sr-only" aria-hidden><X aria-hidden /></button>
      </DialogContent>
    </Dialog>
  );
}
