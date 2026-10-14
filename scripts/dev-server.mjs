// Lanzador del dev server como demonio real ( detached + unref + stdio a archivo).
// Este patrón es el único que sobrevive a la limpieza de procesos entre comandos
// del sandbox (mismo mecanismo que usa agent-browser para su navegador).
// Uso: node scripts/dev-server.mjs   (idempotente: si :3000 ya responde, no hace nada)
import { spawn } from "node:child_process";
import { openSync, closeSync, readFileSync } from "node:fs";
import http from "node:http";

// Sanitización: el entorno del proceso padre puede traer una DATABASE_URL
// obsoleta (p. ej. exportada por una sesión anterior del shell con la URL de
// SQLite). Este lanzador impone SIEMPRE la URL escrita en .env para el hijo.
function databaseUrlFromEnvFile() {
  try {
    for (const line of readFileSync("/home/z/my-project/.env", "utf8").split("\n")) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* sin .env: se usa el entorno tal cual */
  }
  return null;
}

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

const dbUrl = databaseUrlFromEnvFile();
const childEnv = { ...process.env };
if (dbUrl) childEnv.DATABASE_URL = dbUrl;

const out = openSync("/home/z/my-project/dev.log", "a");
const err = openSync("/home/z/my-project/dev.log", "a");
const child = spawn(
  process.execPath,
  ["/home/z/my-project/node_modules/next/dist/bin/next", "dev", "-p", "3000"],
  { cwd: "/home/z/my-project", env: childEnv, detached: true, stdio: ["ignore", out, err] }
);
child.unref();
closeSync(out);
closeSync(err);
console.log(`Servidor lanzado como demonio (pid ${child.pid}). Espera unos segundos a que compile.`);
