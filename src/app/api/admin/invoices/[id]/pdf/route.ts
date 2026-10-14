// GET /api/admin/invoices/[id]/pdf — factura en PDF.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateInvoicePdf } from "@/lib/pdf";
import { getSettings } from "@/modules/settings/settings";
import { requireAdminSession, handleError } from "@/lib/api";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { patient: true },
    });
    if (!invoice) return NextResponse.json({ ok: false, error: "Factura no encontrada." }, { status: 404 });

    const settings = await getSettings();

    const bytes = await generateInvoicePdf(
      {
        id: invoice.id, number: invoice.number, date: invoice.date,
        patientId: invoice.patientId,
        patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
        total: invoice.total, subtotal: invoice.subtotal,
        paymentMethod: invoice.paymentMethod, appointmentId: invoice.appointmentId,
        // itemsJson viaja para el módulo PDF:
        itemsJson: invoice.itemsJson,
      } as never,
      {
        id: invoice.patient.id, firstName: invoice.patient.firstName,
        lastName: invoice.patient.lastName, email: invoice.patient.email,
        phone: invoice.patient.phone, birthDate: invoice.patient.birthDate,
        createdAt: invoice.patient.createdAt.toISOString(),
      },
      settings
    );

    const filename = `fac-${String(invoice.number).padStart(4, "0")}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
