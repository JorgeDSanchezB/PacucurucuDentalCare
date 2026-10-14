// Re-verificación del fix del marquee con viewport correcto (set viewport <w> <h>)
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
  const spans = track ? [...track.children] : [];
  const vw = window.innerWidth;
  const vis = spans.filter(s => {
    const r = s.getBoundingClientRect();
    return r.right > 0 && r.left < vw && r.width > 0;
  });
  const clones = spans.filter(s => s.classList.contains('marquee-clone'));
  const clonesOcultos = clones.filter(s => getComputedStyle(s).display === 'none').length;
  return {
    vw,
    overflowHorizontal: de.scrollWidth > de.clientWidth,
    mask: cs ? (cs.maskImage || cs.webkitMaskImage) : null,
    animationName: tcs?.animationName,
    flexWrap: tcs?.flexWrap,
    itemsVisibles: vis.length,
    clonesOultos: clonesOcultos,
    textoVisible: vis.map(s => s.textContent.trim().slice(0, 24)),
  };
})())`;

async function evalJson() {
  const out = await run(["eval", probe]);
  try {
    return JSON.parse(JSON.parse(out.trim()).toString() || "{}");
  } catch {
    try {
      return JSON.parse(out.replace(/^"?"?/, "").replace(/"?\s*$/, "").replace(/\\"/g, '"'));
    } catch {
      return { raw: out.slice(0, 900) };
    }
  }
}

async function checkMode(label, media) {
  console.log(`\n── ${label} ──`);
  for (const [w, h, name] of [[1280, 800, "1280"], [390, 844, "390"]]) {
    await run(["set", "viewport", String(w), String(h)]);
    await run(["open", "http://localhost:3000/"]);
    await new Promise((r) => setTimeout(r, 3000));
    const j = await evalJson();
    console.log(`${name}:`, JSON.stringify(j));
    await run(["screenshot", `${SHOTS}/marquee-fix-${media}-${name}.png`]);
  }
  const errs = await run(["errors"]);
  console.log("Errores de página:", errs.trim() || "ninguno");
}

await run(["set", "media", "light"]);
await checkMode("MODO NORMAL (animado, con máscara)", "normal");
await run(["set", "media", "reduced-motion"]);
await checkMode("MODO MOVIMIENTO REDUCIDO (estático, 1 copia)", "reduced");
await run(["set", "media", "light"]);
await run(["close"]);
console.log("\nRe-verificación completa.");
