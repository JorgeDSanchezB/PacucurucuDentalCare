// Lanzador del dev server como demonio real ( detached + unref + stdio a archivo).
// Este patrón es el único que sobrevive a la limpieza de procesos entre comandos
// del sandbox (mismo mecanismo que usa agent-browser para su navegador).
// Uso: node scripts/dev-server.mjs   (idempotente: si :3000 ya responde, no hace nada)
import { spawn } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import http from "node:http";

function isUp() {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:3000/", { timeout: 2000 }, (res) => {
      resolve(res.statusCode > 0);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

const up = await isUp();
if (up) {
  console.log("El servidor ya está corriendo en :3000. Nada que hacer.");
  process.exit(0);
}

const out = openSync("/home/z/my-project/dev.log", "a");
const err = openSync("/home/z/my-project/dev.log", "a");
const child = spawn(
  process.execPath,
  ["/home/z/my-project/node_modules/next/dist/bin/next", "dev", "-p", "3000"],
  { cwd: "/home/z/my-project", detached: true, stdio: ["ignore", out, err] }
);
child.unref();
closeSync(out);
closeSync(err);
console.log(`Servidor lanzado como demonio (pid ${child.pid}). Espera unos segundos a que compile.`);
