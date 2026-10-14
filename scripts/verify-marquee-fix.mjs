// Verificación del fix del marquee: máscara de degradado + modo movimiento reducido
import { spawn } from "node:child_process";

const BROWSER = "/usr/local/bin/agent-browser";
const SHOTS = "/home/z/my-project/download";

function run(args, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const p = spawn(BROWSER, args, { cwd: "/home/z/my-project" });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.on("close", () => { clearTimeout(t); resolve(out); });
  });
}

const probe = `JSON.stringify((() => {
  const de = document.documentElement;
  const marquee = document.querySelector('.marquee');
  const track = document.querySelector('.marquee-track');
  const cs = marquee ? getComputedStyle(marquee) : null;
  const tcs = track ? getComputedStyle(track) : null;
  // ¿Cuántos ítems caben visibles y dónde terminan?
  const spans = track ? [...track.children] : [];
  const vw = window.innerWidth;
  const lastVisible = spans.filter(s => {
    const r = s.getBoundingClientRect();
    return r.right > 0 && r.left < vw;
  });
  // Opacidad real del primer y último span visible (efecto de la máscara)
  const first = lastVisible[0]?.getBoundingClientRect();
  const last = lastVisible[lastVisible.length - 1]?.getBoundingClientRect();
  return {
    overflowHorizontal: de.scrollWidth > de.clientWidth,
    mask: cs ? (cs.maskImage || cs.webkitMaskImage) : null,
    animationName: tcs?.animationName,
    playState: tcs?.animationPlayState,
    flexWrap: tcs?.flexWrap,
    width: tcs?.width,
    itemsVisibles: lastVisible.length,
    primero_left: first ? Math.round(first.left) : null,
    ultimo_right: last ? Math.round(last.right) : null,
    viewport: vw,
  };
})())`;

async function evalJson() {
  const out = await run(["eval", probe]);
  try {
    return JSON.parse(out.replace(/^[^{]*/, "").trim());
  } catch {
    return { raw: out.slice(0, 800) };
  }
}

// ── MODO 1: normal (animado, con máscara) ─────────────────────────────
console.log("── MODO NORMAL (animado) ──");
await run(["set", "viewport", "1280x800"]);
await run(["open", "http://localhost:3000/"]);
await new Promise((r) => setTimeout(r, 3000));
console.log(JSON.stringify(await evalJson(), null, 2));
await run(["screenshot", `${SHOTS}/marquee-fix-normal-1280.png`]);
await run(["set", "viewport", "390x844"]);
await new Promise((r) => setTimeout(r, 1500));
console.log("390px:", JSON.stringify(await evalJson()));
await run(["screenshot", `${SHOTS}/marquee-fix-normal-390.png`]);

const errs1 = await run(["errors"]);
console.log("Errores de página (normal):", errs1.trim() || "ninguno");

// ── MODO 2: movimiento reducido (estático, envuelto, sin máscara) ────
console.log("\n── MODO MOVIMIENTO REDUCIDO ──");
await run(["set", "media", "reduced-motion"]);
await run(["set", "viewport", "1280x800"]);
await run(["open", "http://localhost:3000/"]);
await new Promise((r) => setTimeout(r, 3000));
console.log(JSON.stringify(await evalJson(), null, 2));
await run(["screenshot", `${SHOTS}/marquee-fix-reduced-1280.png`]);
await run(["set", "viewport", "390x844"]);
await new Promise((r) => setTimeout(r, 1500));
console.log("390px:", JSON.stringify(await evalJson()));
await run(["screenshot", `${SHOTS}/marquee-fix-reduced-390.png`]);

const errs2 = await run(["errors"]);
console.log("Errores de página (reducido):", errs2.trim() || "ninguno");

// Restaurar
await run(["set", "media", "light"]);
await run(["close"]);
console.log("\nVerificación completa.");
