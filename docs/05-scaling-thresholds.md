# 05 — Umbrales de escalabilidad

**Proyecto**: Pacurucu Dental Care
**Regla de la "Lista Infinita"**: todo listado funciona igual con 10 o 10,000 items; la arquitectura solo cambia en umbrales explícitos y documentados.

## 1. Estrategia actual (v1) y umbrales de activación

| Listado | Volumen v1 esperado | Estrategia v1 | Umbral → acción |
|---|---|---|---|
| Servicios (público) | 10–20 | Render completo, orden por `sortOrder` | >200 items → virtualización con `@tanstack/react-virtual` (cambio de presentación, modelo intacto) |
| Servicios (admin) | 10–20 | Tabla completa + drag-and-drop | >200 → paginación + drag por página |
| Citas (admin) | 100–500/mes | **Paginación server-side** (20/página) + filtros | >1,000/mes → scroll infinito; >5,000 → índice compuesto `(date,status)` ya creado + cursor pagination |
| Pacientes | 100–500/año | Paginación + búsqueda `q` (LIKE) | >5,000 → índice full-text (PostgreSQL) o `contains` con debounce (ya implementado) |
| Facturas | 100–500/año | Paginación + filtros + CSV | >5,000 → agregaciones pre-calculadas (tabla resumen mensual) |
| Historial clínico (por paciente) | 5–50 notas | Lista cronológica con scroll (`max-h` + overflow) | >200 por paciente → agrupación por año + paginación |

## 2. Disponibilidad de horarios

- v1: cálculo por request (2–3 queries indexadas). Coste: <5ms con <10,000 citas.
- **Umbral**: >50,000 citas acumuladas o >50 solicitudes concurrentes en la misma franja → serializar confirmaciones con cola (transacción con `SELECT ... FOR UPDATE` en PostgreSQL) o caché de disponibilidad con invalidación por escritura.

## 3. Lecturas de settings/contenido

- v1: lectura directa a DB en cada request del server component.
- **Umbral**: >50,000 lecturas/min → caché en memoria con TTL 30s (patrón ya aislado en `src/modules/settings/`, sin cambios en llamadores).

## 4. Numeración de facturas

- v1: `max(number)+1` con constraint UNIQUE.
- **Umbral**: >100 facturas/día → tabla contador con transacción serializada.

## 5. Imágenes

- v1: dos fuentes convivientes: URLs externas (OSS) y fotos subidas desde el PC del odontólogo (modelo `MediaAsset`, base64 en DB, servidas por `GET /api/media/<id>` con cache inmutable). Límite: 5 MB por archivo, PNG/JPG/WebP/GIF.
- **Umbral**: >200 fotos subidas o >2 GB en DB → migrar `MediaAsset` a almacenamiento de objetos (S3/R2) manteniendo el contrato `url` intacto (los campos de imagen no cambian). Si el ancho de banda de imágenes supera 5 GB/mes → CDN dedicado.

## 6. Qué NO escala y por qué está bien

- SQLite en sandbox: monousuario/escritura. Producción usa PostgreSQL (cambio de provider sin tocar el modelo).
- Sesiones JWT sin revocación individual: para un único admin es aceptable. Multi-admin → tabla de sesiones.
