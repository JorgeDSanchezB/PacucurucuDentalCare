/**
 * Pacurucu Dental Care — Seed
 * Ejecutar: bun prisma/seed.ts
 *
 * Estrategia idempotente:
 *  - upsert: admin, settings, flags, schedule, servicios (por slug)
 *  - deleteMany+create: testimonios, FAQ, galería (contenido de demo editable)
 *  - datos demo (pacientes, citas, factura, notas): solo si no existen pacientes
 *
 * NOTA: incluye datos de demostración para que el panel sea explorable.
 * Se pueden eliminar desde el propio panel (no se toca código).
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// ─── Utilidades de fecha (dinámicas para que la demo siempre sea relevante) ───
// Hoy según la zona horaria de la clínica (America/Guayaquil, UTC-5).
function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date());
}
function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function nextWeekdayISO(dayOfWeek: number): string {
  // dayOfWeek: 0=domingo … 6=sábado. Próxima fecha que caiga en ese día.
  const d = new Date();
  const diff = (dayOfWeek - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ─── Imágenes seleccionadas (búsqueda real, fuentes no-stock, OSS estable) ───
const IMG = {
  hero: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/14a2c6c18a13.jpg",
  about: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/7ca0645b6ad6.jpg",
  doctor: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/d954db954e6c.jpg",
  gallery: [
    { title: "Sala de espera", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/30967a4b3854.jpg" },
    { title: "Recepción", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/daed8754c34a.jpg" },
    { title: "Consultorio principal", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/aede3deb8589.jpeg" },
    { title: "Área de esterilización", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/390c93dce7b8.jpg" },
    { title: "Detalle de iluminación", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/1e36617b1bc2.jpg" },
    { title: "Vista del consultorio", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/7ca0645b6ad6.jpg" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
async function seedAdmin() {
  // Credenciales SIEMPRE desde el entorno (.env, nunca versionado) — el repositorio es público.
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Dr. Miguel Pacurucu";
  if (!email || !password) {
    throw new Error(
      "Faltan ADMIN_EMAIL y/o ADMIN_PASSWORD en el .env — revisa .env.example. " +
        "El seed no crea el admin con contraseñas por defecto."
    );
  }
  const passwordHash = await bcrypt.hash(password, 10);

  await db.user.upsert({
    where: { email },
    update: {}, // no sobrescribir password si ya existe (el admin pudo cambiarla)
    create: { email, name, passwordHash, role: "ADMIN" },
  });
  console.log(`✓ Admin: ${email}`);
}

// ─────────────────────────────────────────────────────────────────────────────
const SERVICES: Array<{
  slug: string; name: string; description: string;
  duration: number; price: number; category: string; sortOrder: number;
}> = [
  {
    slug: "consulta-y-diagnostico",
    name: "Consulta y diagnóstico",
    description:
      "Evaluación completa de tu salud bucal con revisión clínica, historia dental y plan de tratamiento personalizado. Incluye explicación clara de opciones y costos antes de cualquier procedimiento.",
    duration: 30, price: 25, category: "General", sortOrder: 1,
  },
  {
    slug: "limpieza-dental",
    name: "Limpieza dental",
    description:
      "Profilaxis profesional que elimina placa y sarro acumulado, pulido de superficies y revisión de encías. Es el mantenimiento recomendado cada seis meses para prevenir caries y enfermedad periodontal.",
    duration: 45, price: 35, category: "Prevención", sortOrder: 2,
  },
  {
    slug: "resina-estetica",
    name: "Resina estética",
    description:
      "Restauración de caries o fracturas menores con resina compuesta del color exacto de tu diente. En una sola sesión recuperas función y estética sin nota visual del arreglo.",
    duration: 45, price: 45, category: "Restauración", sortOrder: 3,
  },
  {
    slug: "blanqueamiento-dental",
    name: "Blanqueamiento dental",
    description:
      "Aclaramiento profesional supervisado en consultorio, con protectores de encía y gel de concentración controlada. Resultado visible en la misma sesión y guía de mantenimiento posterior.",
    duration: 60, price: 120, category: "Estética", sortOrder: 4,
  },
  {
    slug: "endodoncia",
    name: "Endodoncia",
    description:
      "Tratamiento de conducto para salvar un diente con pulpa afectada. Se limpia, desinfecta y sella el interior del diente, eliminando el dolor y evitando la extracción cuando es posible.",
    duration: 90, price: 150, category: "Especialidades", sortOrder: 5,
  },
  {
    slug: "extraccion-dental",
    name: "Extracción dental",
    description:
      "Extracción simple o quirúrgica con anestesia local y protocolo de cuidados posteriores. Incluye indicaciones precisas para una recuperación rápida y sin complicaciones.",
    duration: 45, price: 50, category: "Cirugía", sortOrder: 6,
  },
  {
    slug: "corona-porcelana",
    name: "Corona de porcelana",
    description:
      "Funda de porcelana que restaura un diente dañado o tratado con endodoncia. Se toma color y forma personalizados para integrarse de forma natural con tu sonrisa.",
    duration: 90, price: 280, category: "Restauración", sortOrder: 7,
  },
  {
    slug: "implante-dental",
    name: "Implante dental",
    description:
      "Reemplazo de un diente perdido mediante implante de titanio y corona. Evaluación previa con radiografía, planificación de tiempos y seguimiento completo hasta la carga definitiva.",
    duration: 120, price: 850, category: "Cirugía", sortOrder: 8,
  },
  {
    slug: "valoracion-ortodoncia",
    name: "Valoración de ortodoncia",
    description:
      "Estudio de alineación dental, mordida y perfil para diseñar tu plan de ortodoncia. Se explican alternativas de brackets o alineadores, tiempos y costos por etapa.",
    duration: 40, price: 40, category: "Ortodoncia", sortOrder: 9,
  },
  {
    slug: "odontopediatria",
    name: "Odontopediatría",
    description:
      "Atención dental para niños con enfoque en confianza y juego. Incluye revisión de crecimiento dental, aplicación de flúor y enseñanza de cepillado adaptada a cada edad.",
    duration: 45, price: 38, category: "Pediatría", sortOrder: 10,
  },
];

async function seedServices() {
  for (const s of SERVICES) {
    await db.service.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name, description: s.description, duration: s.duration,
        price: s.price, category: s.category, sortOrder: s.sortOrder,
      },
      create: { ...s, active: true, imageUrl: null },
    });
  }
  console.log(`✓ Servicios: ${SERVICES.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function seedSchedule() {
  const rows: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }> = [
    { dayOfWeek: 0, startTime: "09:00", endTime: "13:00", isActive: false }, // domingo
    { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isActive: true },
    { dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isActive: true },
    { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isActive: true },
    { dayOfWeek: 4, startTime: "09:00", endTime: "17:00", isActive: true },
    { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isActive: true },
    { dayOfWeek: 6, startTime: "09:00", endTime: "13:00", isActive: true }, // sábado
  ];
  for (const r of rows) {
    await db.schedule.upsert({
      where: { dayOfWeek: r.dayOfWeek },
      update: { startTime: r.startTime, endTime: r.endTime, isActive: r.isActive },
      create: r,
    });
  }
  console.log("✓ Horarios semanales (Lun-Vie 9-17, Sáb 9-13)");
}

// ─────────────────────────────────────────────────────────────────────────────
async function seedSettings() {
  const settings: Record<string, unknown> = {
    clinic: {
      name: "Pacurucu Dental Care",
      tagline: "Odontología con calma",
      address: "Av. Chauly Clemencia N36-152 y Cuarta",
      city: "Urdesa Central, Guayaquil",
      phone: "+593 4 288 6412",
      whatsapp: "+593 98 612 4470",
      email: "citas@pacurucu.dental",
    },
    social: {
      // WhatsApp arranca con el número del consultorio; las demás redes
      // las completa el doctor desde Ajustes → Redes sociales.
      whatsapp: "+593 98 612 4470",
      instagram: "",
      facebook: "",
      tiktok: "",
    },
    doctor: {
      name: "Dr. Miguel Pacurucu",
      title: "Odontólogo",
      specialty: "Odontología general y estética dental",
      bio: "Graduado con honores en Odontología por la Universidad de Cuenca, con más de doce años de práctica clínica. Su enfoque combina prevención, honestidad clínica y estética natural: cada plan de tratamiento se explica en palabras simples antes de tocar un solo diente. Cree que una cita al dentista puede sentirse tranquila, y diseña la consulta para que así sea. Lleva la odontopediatría como vocación y el detalle como método de trabajo.",
      photoUrl: IMG.doctor,
      credentials: [
        "Odontólogo, Universidad de Cuenca (2009)",
        "Diplomado en Estética Dental Adhesiva",
        "Curso avanzado en Odontopediatría",
        "Miembro activo de la Asociación Dental del Ecuador",
      ],
    },
    hero: {
      title: "Tu sonrisa, sin prisa",
      subtitle:
        "Odontología general y estética en Urdesa. Citas puntuales, explicaciones claras y tratamientos que respetan tu tiempo y tu bolsillo.",
      imageUrl: IMG.hero,
    },
    about: {
      title: "Una clínica pensada para que respires tranquilo",
      text:
        "Pacurucu Dental Care nació con una idea simple: que ir al dentista deje de ser una cita que se pospone. Trabajamos con agenda honesta (menos pacientes por día, más tiempo por paciente), esterilización visible y presupuestos que se explican antes de empezar. La consulta incluye siempre una revisión completa y un plan por etapas, para que decidas qué tratar, cuándo y con cuánta inversión.",
      imageUrl: IMG.about,
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

  for (const [key, value] of Object.entries(settings)) {
    await db.clinicSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }
  console.log("✓ Configuración de la clínica");

  const flags = [
    { key: "WHATSAPP_ENABLED", enabled: false, description: "Envío real de mensajes vía WhatsApp Business Cloud API (al recibir solicitudes y confirmar citas)." },
    { key: "STRIPE_ENABLED", enabled: false, description: "Pago online con Stripe en el flujo de reserva." },
  ];
  for (const f of flags) {
    await db.featureFlag.upsert({
      where: { key: f.key },
      update: { description: f.description },
      create: f,
    });
  }
  console.log("✓ Feature flags (WHATSAPP/STRIPE OFF)");
}

// ─────────────────────────────────────────────────────────────────────────────
async function seedContent() {
  await db.testimonial.deleteMany();
  await db.testimonial.createMany({
    data: [
      {
        patientName: "María Fernanda Loor",
        rating: 5,
        text: "Llevaba años con miedo al dentista. El doctor me explicó todo antes de empezar y la limpieza fue de lo más tranquilo que he vivido en un consultorio. Volveré cada seis meses, como me indicó.",
        sortOrder: 1,
      },
      {
        patientName: "Carlos Andrés Vera",
        rating: 5,
        text: "Me hizo una resina que ni yo encuentro en el espejo. Puntualidad total: entré a las 9 y salí a las 9:40, tal cual lo acordado.",
        sortOrder: 2,
      },
      {
        patientName: "Andrea Cedeño",
        rating: 4,
        text: "Llevé a mi hijo de seis años y salió pidiendo volver. Eso dice todo de la odontopediatría acá. La única espera fue porque llegamos tarde.",
        sortOrder: 3,
      },
      {
        patientName: "Luis Miguel Zambrano",
        rating: 5,
        text: "Me salvaron un muelle con endodoncia cuando otro consultorio ya lo daba por perdido. Presupuesto claro desde el inicio y sin sorpresas al final.",
        sortOrder: 4,
      },
      {
        patientName: "Johanna Macías",
        rating: 5,
        text: "El blanqueamiento quedó natural, no ese blanco fluorescente. Me dieron guía de mantenimiento y hasta hoy el color se mantiene.",
        sortOrder: 5,
      },
    ],
  });

  await db.faqItem.deleteMany();
  await db.faqItem.createMany({
    data: [
      { question: "¿Cómo agendo una cita?", answer: "Desde el formulario de reserva de esta web: eliges los servicios, completas tus datos y prefieres fecha y hora. Recibimos tu solicitud y te confirmamos por WhatsApp en horario de atención. También puedes escribirnos directo al número de la clínica.", sortOrder: 1 },
      { question: "¿Cuánto dura una primera consulta?", answer: "La consulta y diagnóstico inicial toma 30 minutos. Si eliges además una limpieza u otro tratamiento, el sistema suma los tiempos y te muestra la duración total antes de confirmar.", sortOrder: 2 },
      { question: "¿Atienden urgencias o dolor agudo?", answer: "Sí. Guardamos franjas diarias para urgencias. Si tienes dolor, marca el número de la clínica por WhatsApp y te acomodamos en el primer espacio disponible del día.", sortOrder: 3 },
      { question: "¿Qué formas de pago aceptan?", answer: "Efectivo y transferencia bancaria. El pago con tarjeta y el pago online llegarán en una próxima etapa; el sistema ya está preparado para activarlos.", sortOrder: 4 },
      { question: "¿Los tratamientos duelen?", answer: "Trabajamos con anestesia local en todos los procedimientos que la requieren y con técnica mínimamente invasiva. La mayoría de pacientes describe las limpiezas y resinas como indoloras.", sortOrder: 5 },
      { question: "¿Cada cuánto debo hacerme una limpieza?", answer: "Cada seis meses para la mayoría de personas. Si tienes encías sensibles o antecedentes de sarro rápido, el doctor te indicará un intervalo más corto.", sortOrder: 6 },
      { question: "¿Dónde están y hay parqueadero?", answer: "Estamos en Urdesa Central, Guayaquil. Hay parqueadero público en la cuadra y parada de bus a media cuadra. Al confirmar tu cita te envíamos la ubicación exacta por WhatsApp.", sortOrder: 7 },
    ],
  });

  await db.galleryItem.deleteMany();
  await db.galleryItem.createMany({
    data: IMG.gallery.map((g, i) => ({
      title: g.title, imageUrl: g.url, sortOrder: i + 1,
    })),
  });
  console.log("✓ Testimonios, FAQ y galería");
}

// ─────────────────────────────────────────────────────────────────────────────
// DATOS DEMO: solo si la base no tiene pacientes (idempotente)
// ─────────────────────────────────────────────────────────────────────────────
async function seedDemoData() {
  const existing = await db.patient.count();
  if (existing > 0) {
    console.log(`– Datos demo omitidos (ya existen ${existing} pacientes)`);
    return;
  }

  // Pacientes
  const p1 = await db.patient.create({
    data: { firstName: "María Fernanda", lastName: "Loor Villamar", email: "maria.loor@example.com", phone: "+593 99 842 1736", birthDate: "1987-04-12" },
  });
  const p2 = await db.patient.create({
    data: { firstName: "Carlos Andrés", lastName: "Vera Muñoz", email: "cavera82@example.com", phone: "+593 98 304 5518", birthDate: "1982-11-03" },
  });
  const p3 = await db.patient.create({
    data: { firstName: "Andrea", lastName: "Cedeño Pita", email: "andreacedenop@example.com", phone: "+593 96 217 8904", birthDate: "1994-06-25" },
  });

  // Servicios para snapshots
  const limpieza = await db.service.findUniqueOrThrow({ where: { slug: "limpieza-dental" } });
  const consulta = await db.service.findUniqueOrThrow({ where: { slug: "consulta-y-diagnostico" } });
  const resina = await db.service.findUniqueOrThrow({ where: { slug: "resina-estetica" } });
  const blanqueamiento = await db.service.findUniqueOrThrow({ where: { slug: "blanqueamiento-dental" } });

  async function createAppointment(opts: {
    patientId: string; date: string; startTime: string; endTime: string;
    status: string; services: Array<{ id: string; name: string; price: number; duration: number }>;
    notes?: string; adminNotes?: string;
  }) {
    const appt = await db.appointment.create({
      data: {
        patientId: opts.patientId, date: opts.date,
        startTime: opts.startTime, endTime: opts.endTime,
        status: opts.status, source: opts.status === "PENDING" ? "PUBLIC_FORM" : "ADMIN",
        notes: opts.notes, adminNotes: opts.adminNotes,
        services: {
          create: opts.services.map((s) => ({
            serviceId: s.id, name: s.name, price: s.price, duration: s.duration,
          })),
        },
      },
    });
    if (opts.status === "PENDING") {
      await db.bookingRequest.create({
        data: { appointmentId: appt.id, doctorNotified: "PENDING" },
      });
    }
    return appt;
  }

  const addMinutes = (t: string, m: number) => {
    const [h, min] = t.split(":").map(Number);
    const total = h * 60 + min + m;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  // Cita completada en el pasado (para historial + factura)
  const pastAppt = await createAppointment({
    patientId: p2.id, date: addDaysISO(-9), startTime: "10:00", endTime: "11:15",
    status: "COMPLETED",
    services: [
      { id: consulta.id, name: consulta.name, price: consulta.price, duration: consulta.duration },
      { id: limpieza.id, name: limpieza.name, price: limpieza.price, duration: limpieza.duration },
    ],
    adminNotes: "Puntual. Higiene aceptable, sarro moderado en sector posterior inferior.",
  });

  // Nota clínica asociada
  await db.clinicalNote.create({
    data: {
      patientId: p2.id, appointmentId: pastAppt.id, date: addDaysISO(-9),
      treatment: "Consulta y diagnóstico + profilaxis completa",
      observations: "Sarro moderado en cara lingual de inferiores. Encías sanas tras profilaxis. Se refuerza técnica de cepillado en sector posterior.",
      privateNotes: "Paciente refiere sensibilidad al frío en 4.6. Vigilar en próxima visita. Sin caries visibles en radiografía de control.",
    },
  });

  // Factura de la cita completada
  await db.invoice.create({
    data: {
      number: 1, appointmentId: pastAppt.id, patientId: p2.id, date: addDaysISO(-9),
      itemsJson: JSON.stringify([
        { name: "Consulta y diagnóstico", price: 25, quantity: 1 },
        { name: "Limpieza dental", price: 35, quantity: 1 },
      ]),
      subtotal: 60, total: 60, paymentMethod: "EFECTIVO", status: "ISSUED",
    },
  });

  // Cita confirmada HOY (dashboard + calendario)
  await createAppointment({
    patientId: p1.id, date: todayISO(), startTime: "15:00", endTime: "16:00",
    status: "CONFIRMED",
    services: [{ id: blanqueamiento.id, name: blanqueamiento.name, price: blanqueamiento.price, duration: blanqueamiento.duration }],
    notes: "Primera vez con blanqueamiento. Confirmó por WhatsApp.",
  });

  // Cita confirmada próximo jueves
  await createAppointment({
    patientId: p3.id, date: nextWeekdayISO(4), startTime: "09:30", endTime: "10:15",
    status: "CONFIRMED",
    services: [{ id: resina.id, name: resina.name, price: resina.price, duration: resina.duration }],
    notes: "Resina en pieza 1.2 por fractura pequeña.",
  });

  // Solicitud pendiente (flujo v1: llegó del formulario público)
  await createAppointment({
    patientId: p1.id, date: addDaysISO(5), startTime: "10:00", endTime: "10:45",
    status: "PENDING",
    services: [{ id: limpieza.id, name: limpieza.name, price: limpieza.price, duration: limpieza.duration }],
    notes: "Solicité desde la web. Prefiero mañana por la tarde si no hay espacio.",
  });

  // Cita cancelada en el pasado
  await createAppointment({
    patientId: p3.id, date: addDaysISO(-4), startTime: "14:00", endTime: "14:30",
    status: "CANCELLED",
    services: [{ id: consulta.id, name: consulta.name, price: consulta.price, duration: consulta.duration }],
    adminNotes: "Canceló por viaje de trabajo. Reagendar en dos semanas.",
  });

  // Mensaje de contacto sin leer
  await db.contactMessage.create({
    data: {
      name: "Patricia Anchundia", email: "patricia.anchundia@example.com",
      phone: "+593 97 553 2201",
      message: "Buenas tardes. Tengo un puente de hace ocho años que se movió. ¿La valoración para reponerlo tiene costo y en cuánto tiempo me darían cita? Gracias.",
    },
  });

  console.log("✓ Datos demo: 3 pacientes, 5 citas, 1 nota clínica, 1 factura, 1 mensaje");
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Seeding Pacurucu Dental Care…");
  await seedAdmin();
  await seedServices();
  await seedSchedule();
  await seedSettings();
  await seedContent();
  await seedDemoData();
  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
