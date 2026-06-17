import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const port = process.env.VITE_DEV_PORT ?? "5173";
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
const args = [viteCli, "--host", "127.0.0.1", "--port", port, "--strictPort"];
const stdout = fs.createWriteStream(path.join(root, ".vite-dev.stdout.log"), { flags: "a" });
const stderr = fs.createWriteStream(path.join(root, ".vite-dev.stderr.log"), { flags: "a" });

let child = null;
let stopping = false;

function write(stream, message) {
  stream.write(`\n[watchdog ${new Date().toISOString()}] ${message}\n`);
}

function startServer() {
  write(stdout, `starting Vite dev server on http://127.0.0.1:${port}/`);
  child = spawn(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout.pipe(stdout, { end: false });
  child.stderr.pipe(stderr, { end: false });

  child.once("error", (error) => {
    write(stderr, `failed to start Vite dev server: ${error.message}`);
  });

  child.once("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    write(stderr, `Vite dev server exited with ${reason}`);

    if (stopping) {
      stdout.end();
      stderr.end();
      return;
    }

    write(stdout, "restarting Vite dev server in 2 seconds");
    setTimeout(startServer, 2000);
  });
}

function stop() {
  stopping = true;
  if (child && !child.killed) {
    child.kill();
  }
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

startServer();
