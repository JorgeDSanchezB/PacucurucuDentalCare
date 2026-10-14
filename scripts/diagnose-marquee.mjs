// Diagnóstico del "desbordamiento" reportado: marquee + overflow horizontal + eco de arco
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

const viewports = [
  { name: "1440", w: 1440, h: 900 },
  { name: "1280", w: 1280, h: 800 },
  { name: "768", w: 768, h: 1024 },
  { name: "390", w: 390, h: 844 },
];

for (const vp of viewports) {
  await run(["--viewport", `${vp.w}x${vp.h}`]);
  await run(["open", "http://localhost:3000/"]);
  await new Promise((r) => setTimeout(r, 2500));

  const diag = await run(["eval", `JSON.stringify((() => {
    const de = document.documentElement;
    const track = document.querySelector('.marquee-track');
    const marquee = document.querySelector('.marquee');
    let trackInfo = null;
    if (track) {
      const cs = getComputedStyle(track);
      const r = track.getBoundingClientRect();
      const mr = marquee.getBoundingClientRect();
      trackInfo = {
        animationName: cs.animationName,
        duration: cs.animationDuration,
        playState: cs.animationPlayState,
        fillMode: cs.animationFillMode,
        transform: cs.transform,
        trackWidth: Math.round(r.width),
        containerWidth: Math.round(mr.width),
        trackRight: Math.round(r.right),
        viewportWidth: window.innerWidth,
      };
    }
    // eco de arco: ¿se sale del viewport?
    const eco = document.querySelector('section[aria-label="Presentación"] .arch');
    let ecoInfo = null;
    if (eco) {
      const er = eco.getBoundingClientRect();
      ecoInfo = { right: Math.round(er.right), viewport: window.innerWidth, fuera: Math.round(er.right - window.innerWidth) };
    }
    return {
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      overflowHorizontal: de.scrollWidth > de.clientWidth,
      bodyScrollX: document.body.scrollWidth > document.body.clientWidth,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      track: trackInfo,
      eco: ecoInfo,
    };
  })())`]);

  console.log(`\n=== VIEWPORT ${vp.name} (${vp.w}x${vp.h}) ===`);
  try {
    const json = JSON.parse(diag.replace(/^[^{]*/, "").trim());
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(diag.slice(0, 1500));
  }
  await run(["screenshot", `${SHOTS}/diag-marquee-${vp.name}.png`]);
}

await run(["close"]);
console.log("\nListo.");
