# design-brief.md — Pacurucu Dental Care

**Skill aplicada**: `design-taste-frontend` (taste-skill de Leonxlnx).
**Nota de instalación**: el comando `npx skills add` falló en el sandbox (timeout del CLI). El contenido íntegro de la skill se recuperó clonando el repositorio oficial y se aplicó manualmente: flujo de 4 pasos (lectura de brief → declaración de juicio → dials → autoevaluación anti-slop). Declaración honesta: no se ejecutó el instalador, pero sí el framework completo.

---

## Paso A — Lectura del brief

- **Qué es**: web oficial de una clínica odontológica de una sola sede en Guayaquil, con reservas online y panel admin para el odontólogo.
- **Audiencia**: pacientes de barrio Urdesa (25 a 55 años, mixto, español), decisor de salud familiar; y el propio doctor como usuario del panel (no tecnólogo).
- **Vibe del brief**: "calma", "premium con personalidad", nada de dashboard-feel en el público. La propia cliente pidió evitar simetría perfecta y scroll narrativo pesado.
- **Señales de referencia**: Grand Street Dental (editorial, formas geométricas), Austin Dental Company (boutique, navy+cream), Dentalia (calma clínica).
- **Restricciones duras del brief**: cero em-dashes visibles, cero emojis decorativos, cero gradientes púrpura-azul, cero hero centrado genérico, cero "3 cards idénticas".

## Paso B — Declaración de juicio estético (antes de escribir código)

### Los 3 dials

| Dial | Valor | Justificación |
|---|---|---|
| **DESIGN_VARIANCE** | `6` | Layout con personalidad: hero asimétrico (texto 55% / imagen 45% con offset vertical), tarjetas de servicios en grid asimétrico (primera tarjeta de cada categoría con `col-span-2`), secciones con encabezado alineado a la izquierda sobre contenido centrado. Sin llegar a experimental: es una clínica, no un estudio de diseño. Nivel técnico: overlaps con margen negativo suave, ratios variados (4:3 junto a 3:2), asimetría 7/5 en grids. |
| **MOTION_INTENSITY** | `4` | Fluid CSS + Framer Motion: fade/slide de entrada en hero, reveal on scroll en secciones, hover con física suave en CTAs y tarjetas, transición entre pasos del flujo de reserva. GSAP descartado (la coreografía que exige este nivel no lo necesita). Todo respeta `prefers-reduced-motion`. |
| **VISUAL_DENSITY** | `3` | Art gallery: secciones `py-24` a `py-32`, máximo dos ideas visuales por pantalla, tipografía que respira. Una clínica dental debe transmitir calma. El panel admin sube a densidad 6 (cockpit funcional, estándar de producto). |

### Paleta (Hex, editable desde el panel admin vía `ClinicSetting.theme`)

| Token | Valor | Uso |
|---|---|---|
| background | `#FAF8F5` | Fondo crema cálido (nunca blanco puro en fondo) |
| foreground | `#1A1A2E` | Navy profundo para texto y encabezados |
| primary | `#0A7B83` | Turquesa médico: CTAs, enlaces, acentos de acción |
| secondary | `#E8B4A0` | Terracota suave: fondos de sección, badges sutiles |
| accent | `#C25E3C` | Terracota intensa: subrayados, estados activos (sustituye al navy para diferenciar acción de texto) |
| surface | `#FFFFFF` | Tarjetas (con sombra tibia, no bordes duros) |

Contraste verificado: foreground sobre background = 13.9:1 (AAA); primary sobre background = 5.0:1 (AA); blanco sobre primary = 4.7:1 (AA).

### Tipografía

- **Títulos**: **Fraunces** (serif con personalidad, eje óptico, aire editorial). Peso 600/500, con itálicas puntuales para palabras cálidas ("sin prisa").
- **Cuerpo**: **DM Sans** (sans legible, moderna; se descarta Inter como default por regla de la skill).
- Escala: display 56/64 → h2 40/48 → h3 24 → body 16/1.7 → small 14 → eyebrow 12 (tracking 0.12em, máx. 3 eyebrows en toda la página).
- Números tabulares en panel admin (`font-variant-numeric: tabular-nums`).

### Referencias visuales concretas

1. **Grand Street Dental** (Brooklyn, NY): foto clínica grande en hero, tipografía serif grande, bloques de color planos, formas geométricas recortadas.
2. **Austin Dental Company**: paleta navy+cream, tipografía con carácter, tarjetas con bordes muy redondeados suaves.
3. **Dentalia** (Kit UI): calma clínica, mucho blanco cálido, jerarquía clara y formularios amables.

### Principios de layout

- **Asimetría suave en hero**: split 55/45 con imagen a derecha desplazada hacia abajo; título sobre la imagen en móvil.
- **Grid de servicios por categorías**: 12-col con tarjetas de ancho variable (2+1+1 y 1+1+2), nunca tres iguales.
- **Secciones alternando familia de layout**: split imagen-texto → banda de color con estadística → grid de tarjetas → cita destacada → FAQ en dos columnas desiguales. Máximo 2 secciones seguidas de la misma familia.
- **Radios**: tarjetas `rounded-2xl` (16px), botones `rounded-full`, inputs `rounded-xl`. Suave, no burbuja.
- **Sombra**: tibia y baja (`shadow-[0_2px_24px_rgba(26,26,46,0.06)]`), sin glows.
- **Espaciado**: escala 4/8/12/16/24/32/48/64/96. Secciones públicas `py-24` a `py-32`.
- **Panel admin**: sidebar navy, contenido sobre crema claro, tarjetas blancas, densidad de producto, tablas con filas respiradas. Un solo sistema de diseño (shadcn/ui) en todo el proyecto.

### Nota sobre modo oscuro

La skill pide dual-mode por defecto, con excepción cuando la marca lo justifica. Aquí la paleta crema+navy ES la expresión de marca (referencias boutique citadas). v1 se entrega en modo claro exclusivamente, documentado como decisión de marca (no omisión). El token `theme` en DB ya permite re-mapear colores desde el panel.

## Paso C — Aprobación humana

El brief se presenta al cliente junto a la entrega de la Fase 5. Por instrucción explícita del workflow ("continúa con supuestos documentados"), la implementación procede con los valores propuestos; cualquier ajuste de paleta, tipografía o dials se aplica editando `ClinicSetting.theme` o el brief, sin reescribir componentes.

## Paso D — Autoevaluación (checklist anti-slop, ejecutada en Fase 6)

Puntos clave que se verificarán antes de entregar:
- Cero em-dashes y cero emojis decorativos en contenido visible.
- Cero gradientes púrpura-azul; cero hero centrado con 2 botones + 3 cards.
- Hero asimétrico, ≤4 elementos de texto, título ≤2 líneas, CTA visible sin scroll.
- Máximo 3 eyebrows; sin split-header; sin numeración de secciones.
- Nombres realistas locales (Loor, Vera, Cedeño: nada de "Jane Doe").
- Imágenes reales (búsqueda web) o placeholders intencionales con inicial.
- `prefers-reduced-motion` respetado; animaciones con propósito.
- `min-h-[100dvh]`; footer sticky; móvil colapsa a columna única.
- Empty/loading/error states en todos los flujos.
