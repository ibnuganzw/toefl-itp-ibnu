import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const watchdogScript = path.join(root, "scripts", "devServerWatchdog.mjs");
const pidPath = path.join(root, ".vite-dev.watchdog.pid");

const child = spawn(process.execPath, [watchdogScript], {
  cwd: root,
  detached: true,
  env: process.env,
  stdio: "ignore",
  windowsHide: true,
});

child.unref();
fs.writeFileSync(pidPath, `${child.pid}\n`, "utf8");

console.log(`Started detached Vite watchdog PID ${child.pid}`);
console.log("Local URL: http://127.0.0.1:5173/");
