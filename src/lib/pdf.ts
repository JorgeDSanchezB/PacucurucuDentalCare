// Generación de PDFs (facturas + historial clínico) con pdf-lib.
// Fuentes estándar Helvetica (WinAnsi cubre acentos del español).
// Diseño sobrio alineado a la marca: navy, turquesa y crema.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ClinicSettings, ClinicalNoteRow, InvoiceRow, PatientRow, AppointmentRow } from "@/types";
import { formatDateLong, formatMoney } from "@/lib/validators";

const NAVY = rgb(0.102, 0.102, 0.18); // #1A1A2E
const TURQUOISE = rgb(0.039, 0.482, 0.514); // #0A7B83
const TERRACOTTA = rgb(0.761, 0.369, 0.235); // #C25E3C
const MUTED = rgb(0.42, 0.4, 0.44);
const CREAM = rgb(0.98, 0.973, 0.961); // #FAF8F5
const WHITE = rgb(1, 1, 1);
const LINE = rgb(0.9, 0.878, 0.847);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return TURQUOISE;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Divide texto en líneas que caben en maxWidth. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // palabra más ancha que la columna: se corta
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawHeader(page: PDFPage, settings: ClinicSettings, bold: PDFFont, font: PDFFont) {
  const { clinic, doctor } = settings;
  // banda superior turquesa
  page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 96, color: TURQUOISE });
  page.drawText(clinic.name || "Pacurucu Dental Care", {
    x: MARGIN, y: PAGE_H - 44, size: 22, font: bold, color: WHITE,
  });
  const sub = `${doctor.name}${clinic.city ? " · " + clinic.city : ""}`;
  page.drawText(sub, { x: MARGIN, y: PAGE_H - 64, size: 10, font, color: rgb(0.9, 0.97, 0.97) });
  const contact = [clinic.phone, clinic.email].filter(Boolean).join("  ·  ");
  if (contact) {
    page.drawText(contact, { x: MARGIN, y: PAGE_H - 80, size: 9, font, color: rgb(0.85, 0.94, 0.94) });
  }
}

function drawFooter(page: PDFPage, settings: ClinicSettings, font: PDFFont) {
  const y = 30;
  page.drawLine({
    start: { x: MARGIN, y: y + 16 }, end: { x: PAGE_W - MARGIN, y: y + 16 },
    thickness: 0.5, color: LINE,
  });
  const generated = new Date().toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" });
  const left = settings.clinic.address
    ? `${settings.clinic.address}, ${settings.clinic.city}`
    : settings.clinic.city || "";
  page.drawText(left, { x: MARGIN, y, size: 8, font, color: MUTED });
  const right = `Generado el ${generated}`;
  const w = font.widthOfTextAtSize(right, 8);
  page.drawText(right, { x: PAGE_W - MARGIN - w, y, size: 8, font, color: MUTED });
}

function drawKeyValue(
  page: PDFPage, x: number, y: number, label: string, value: string,
  font: PDFFont, bold: PDFFont, maxW: number
) {
  page.drawText(label.toUpperCase(), { x, y: y + 12, size: 7.5, font: bold, color: TURQUOISE });
  const lines = wrapText(value || " ", font, 11, maxW);
  lines.slice(0, 2).forEach((line, i) => {
    page.drawText(line, { x, y: y - i * 14, size: 11, font, color: NAVY });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTURA
// ─────────────────────────────────────────────────────────────────────────────
export async function generateInvoicePdf(
  invoice: InvoiceRow,
  patient: PatientRow,
  settings: ClinicSettings
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  drawHeader(page, settings, bold, font);

  // Título
  page.drawText("FACTURA", { x: PAGE_W - MARGIN - 90, y: PAGE_H - 130, size: 16, font: bold, color: NAVY });
  const numText = `N.º FAC-${String(invoice.number).padStart(4, "0")}`;
  page.drawText(numText, { x: PAGE_W - MARGIN - 110, y: PAGE_H - 150, size: 11, font, color: TERRACOTTA });

  // Datos paciente y fecha
  let y = PAGE_H - 190;
  drawKeyValue(page, MARGIN, y, "Paciente", `${patient.firstName} ${patient.lastName}`, font, bold, 240);
  drawKeyValue(page, MARGIN + 260, y, "Fecha de emisión", formatDateLong(invoice.date), font, bold, 240);
  y -= 46;
  drawKeyValue(page, MARGIN, y, "Teléfono", patient.phone, font, bold, 240);
  drawKeyValue(page, MARGIN + 260, y, "Método de pago", invoice.paymentMethod, font, bold, 240);

  // Tabla de conceptos
  y -= 50;
  page.drawRectangle({ x: MARGIN, y: y - 6, width: PAGE_W - MARGIN * 2, height: 26, color: CREAM });
  page.drawText("CONCEPTO", { x: MARGIN + 10, y: y + 2, size: 9, font: bold, color: NAVY });
  page.drawText("CANT.", { x: PAGE_W - MARGIN - 190, y: y + 2, size: 9, font: bold, color: NAVY });
  page.drawText("PRECIO", { x: PAGE_W - MARGIN - 120, y: y + 2, size: 9, font: bold, color: NAVY });
  page.drawText("TOTAL", { x: PAGE_W - MARGIN - 70, y: y + 2, size: 9, font: bold, color: NAVY });
  y -= 30;

  const items: { name: string; price: number; quantity: number }[] = (() => {
    try {
      return JSON.parse(String((invoice as unknown as { itemsJson?: string }).itemsJson ?? "[]"));
    } catch {
      return [];
    }
  })();

  for (const item of items) {
    const lineTotal = item.price * (item.quantity || 1);
    const nameLines = wrapText(item.name, font, 10.5, PAGE_W - MARGIN * 2 - 220);
    for (const line of nameLines) {
      page.drawText(line, { x: MARGIN + 10, y, size: 10.5, font, color: NAVY });
      y -= 15;
    }
    page.drawText(String(item.quantity || 1), { x: PAGE_W - MARGIN - 180, y: y + 15, size: 10.5, font, color: NAVY });
    page.drawText(formatMoney(item.price), { x: PAGE_W - MARGIN - 120, y: y + 15, size: 10.5, font, color: NAVY });
    page.drawText(formatMoney(lineTotal), { x: PAGE_W - MARGIN - 70, y: y + 15, size: 10.5, font: bold, color: NAVY });
    y -= 12;
    page.drawLine({
      start: { x: MARGIN, y: y + 18 }, end: { x: PAGE_W - MARGIN, y: y + 18 },
      thickness: 0.4, color: LINE,
    });
  }

  // Totales
  y -= 24;
  page.drawRectangle({ x: PAGE_W - MARGIN - 200, y, width: 200, height: 64, color: TURQUOISE });
  page.drawText("SUBTOTAL", { x: PAGE_W - MARGIN - 186, y: y + 40, size: 9, font, color: rgb(0.9, 0.97, 0.97) });
  page.drawText(formatMoney(invoice.subtotal), { x: PAGE_W - MARGIN - 60, y: y + 40, size: 9, font, color: WHITE });
  page.drawText("TOTAL", { x: PAGE_W - MARGIN - 186, y: y + 18, size: 12, font: bold, color: WHITE });
  const totalW = bold.widthOfTextAtSize(formatMoney(invoice.total), 12);
  page.drawText(formatMoney(invoice.total), { x: PAGE_W - MARGIN - 16 - totalW, y: y + 18, size: 12, font: bold, color: WHITE });

  // Nota de método de pago
  page.drawText(
    "Documento interno de la clínica. No constituye comprobante tributario electrónico.",
    { x: MARGIN, y: y + 30, size: 8, font, color: MUTED }
  );

  drawFooter(page, settings, font);
  return pdf.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL CLÍNICO
// ─────────────────────────────────────────────────────────────────────────────
export async function generateClinicalHistoryPdf(
  patient: PatientRow,
  notes: ClinicalNoteRow[],
  appointments: AppointmentRow[],
  settings: ClinicSettings
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  drawHeader(page, settings, bold, font);

  page.drawText("HISTORIAL CLÍNICO", { x: MARGIN, y: PAGE_H - 130, size: 16, font: bold, color: NAVY });

  // Datos del paciente
  let y = PAGE_H - 165;
  const fullName = `${patient.firstName} ${patient.lastName}`;
  drawKeyValue(page, MARGIN, y, "Paciente", fullName, font, bold, 240);
  drawKeyValue(page, MARGIN + 260, y, "Teléfono", patient.phone, font, bold, 240);
  y -= 44;
  drawKeyValue(page, MARGIN, y, "Email", patient.email, font, bold, 240);
  const birth = patient.birthDate ? formatDateLong(patient.birthDate) : "No registrada";
  drawKeyValue(page, MARGIN + 260, y, "Fecha de nacimiento", birth, font, bold, 240);
  y -= 44;
  const firstVisit = appointments.length
    ? formatDateLong([...appointments].sort((a, b) => a.date.localeCompare(b.date))[0].date)
    : "Sin citas registradas";
  drawKeyValue(page, MARGIN, y, "Primera visita", firstVisit, font, bold, 240);
  drawKeyValue(page, MARGIN + 260, y, "Notas registradas", String(notes.length), font, bold, 240);

  // Contenido
  y -= 60;
  const contentW = PAGE_W - MARGIN * 2;
  page.drawText("NOTAS CLÍNICAS (ORDEN CRONOLÓGICO)", { x: MARGIN, y, size: 10, font: bold, color: TURQUOISE });
  y -= 24;

  const sortedNotes = [...notes].sort((a, b) => b.date.localeCompare(a.date));

  if (sortedNotes.length === 0) {
    page.drawText("Sin notas clínicas registradas.", { x: MARGIN, y, size: 10.5, font, color: MUTED });
    y -= 18;
  }

  for (const note of sortedNotes) {
    const needed = estimateNoteHeight(note, font, bold, contentW);
    if (y - needed < 60) {
      drawFooter(page, settings, font);
      page = pdf.addPage([PAGE_W, PAGE_H]);
      drawHeader(page, settings, bold, font);
      y = PAGE_H - 130;
    }

    // tarjeta de nota
    const cardH = needed + 8;
    page.drawRectangle({
      x: MARGIN, y: y - cardH + 14, width: contentW, height: cardH,
      color: CREAM, borderColor: LINE, borderWidth: 0.6,
    });
    page.drawText(formatDateLong(note.date), { x: MARGIN + 12, y: y - 4, size: 9.5, font: bold, color: TERRACOTTA });
    y -= 20;

    const section = (label: string, text: string | null, labelColor = NAVY) => {
      if (!text) return;
      page.drawText(label, { x: MARGIN + 12, y, size: 8, font: bold, color: labelColor });
      y -= 13;
      for (const line of wrapText(text, font, 10, contentW - 30)) {
        page.drawText(line, { x: MARGIN + 12, y, size: 10, font, color: NAVY });
        y -= 13;
      }
      y -= 4;
    };

    section("TRATAMIENTO", note.treatment, NAVY);
    section("OBSERVACIONES", note.observations, NAVY);
    section("NOTAS PRIVADAS", note.privateNotes, TERRACOTTA);

    y -= 10;
  }

  drawFooter(page, settings, font);
  return pdf.save();
}

function estimateNoteHeight(note: ClinicalNoteRow, font: PDFFont, bold: PDFFont, contentW: number): number {
  // estimación conservadora para paginación
  const wrapCount = (text: string | null, size: number, indentW: number) =>
    text ? wrapText(text, font, size, contentW - indentW).length : 0;
  const lines =
    1 +
    1 + wrapCount(note.treatment, 10, 30) +
    (note.observations ? 1 + wrapCount(note.observations, 10, 30) : 0) +
    (note.privateNotes ? 1 + wrapCount(note.privateNotes, 10, 30) : 0);
  return lines * 13 + 34 + Math.max(0, wrapCount(note.treatment, 10, 30)) * 0 + (bold ? 0 : 0);
}
