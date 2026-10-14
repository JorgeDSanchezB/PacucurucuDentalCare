// Auditoría visual con VLM: verifica screenshots contra la checklist anti-slop.
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

const CHECKS = `Eres un director de arte auditando el sitio de una clínica dental premium.
Evalúa esta captura y responde en español, formato estricto:
1. ELEMENTOS: lista lo que ves (secciones/componentes principales) en 1-3 líneas.
2. IMAGENES: ¿se ven imágenes correctamente cargadas (no rotas/placeholder gris)? ¿SÍ/NO + detalle?
3. PROBLEMAS: defectos visuales concretos (elementos montados, texto cortado, desbordes, contraste ilegible, colores inesperados). Si no hay: "ninguno".
4. VEREDICTO: APROBADO o CORREGIR (una palabra) + una frase de justificación.`;

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
              { type: "text", text: CHECKS },
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
