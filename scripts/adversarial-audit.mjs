// Árbitro adversarial: auditoría visual implacable estilo jurado Awwwards.
// Pasa capturas por un VLM con prompt hostil que busca defectos concretos.
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

const PROMPT = `Actúa como un JURADO ADVERSARIAL de Awwwards con 15 años de criterio implacable.
Estás auditando la web de una clínica dental boutique (crema/navy/turquesa/terracota, serif elegante).

Tu trabajo NO es ser amable: es destrozar el trabajo con críticas concretas y accionables.
Evalúa la captura y responde en español con este formato EXACTO:

1. ELEMENTOS: qué se ve (1-2 líneas).
2. DEFECTOS DE DISEÑO (mínimo 3, sé implacable): cada uno con ubicación concreta y qué lo hace mediocre:
   - jerarquía tipográfica débil / tamaños tímidos?
   - espaciado genérico o monótono (todo igual, sin ritmo)?
   - falta de identidad gráfica (parece plantilla de shadcn por defecto)?
   - contraste o legibilidad problemática?
   - profundidad/dimensión plana (todo en un mismo plano)?
   - micro-detalles ausentes (subrayados animados, texturas, ornamentación tipográfica)?
   - elementos montados, cortados, desbordados, rotos?
3. SI FUERA JURADO DE AWWWARDS: puntuación 0-10 en Diseño / Tipografía / Originalidad / Detalle, con media final.
4. TOP 3 MEJORAS con mayor impacto visual, ordenadas por retorno.

Sin halagos. Sin frases de relleno. Solo criterio técnico brutal y específico.`;

async function main() {
  const zai = await ZAI.create();
  const shots = process.argv.slice(2);
  for (const path of shots) {
    const data = fs.readFileSync(path).toString("base64");
    try {
      const res = await zai.chat.completions.createVision({
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/png;base64,${data}` } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
        model: "glm-4.5v",
      });
      const text = res.choices?.[0]?.message?.content ?? "(sin respuesta)";
      console.log(`\n════════ ${path} ════════\n${text}`);
    } catch (e) {
      console.log(`\n════════ ${path} ════════\nERROR VLM: ${e.message}`);
    }
  }
}

main();
