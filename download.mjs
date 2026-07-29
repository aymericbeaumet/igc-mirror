#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const manifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));
const root = new URL("./", import.meta.url);

function invariant(condition, message) {
  if (!condition) throw new Error(`IGC mirror download failed: ${message}`);
}

async function sha256(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (status) =>
      status === 0 ? resolve() : reject(new Error(`${command} exited with status ${status}`)),
    );
  });
}

invariant(manifest.version === 5, "unsupported manifest version");
invariant(manifest.release?.baseUrl, "release asset base URL is missing");
mkdirSync(new URL("./parts/", root), { recursive: true });

let cursor = 0;
const worker = async () => {
  while (true) {
    const part = manifest.parts[cursor++];
    if (!part) return;
    const name = basename(part.file);
    const target = fileURLToPath(new URL(part.file, root));
    if (
      existsSync(target) &&
      statSync(target).size === part.byteLength &&
      (await sha256(target)) === part.sha256
    ) {
      process.stdout.write(`reused ${name}\n`);
      continue;
    }
    const partial = `${target}.partial`;
    mkdirSync(dirname(partial), { recursive: true });
    let valid = false;
    for (let attempt = 0; attempt < 2 && !valid; attempt += 1) {
      if (attempt > 0 || (existsSync(partial) && statSync(partial).size > part.byteLength)) {
        rmSync(partial, { force: true });
      }
      await run("curl", [
        "--fail",
        "--location",
        "--continue-at",
        "-",
        "--retry",
        "8",
        "--retry-all-errors",
        "--output",
        partial,
        `${manifest.release.baseUrl}/${name}`,
      ]);
      valid =
        statSync(partial).size === part.byteLength &&
        (await sha256(partial)) === part.sha256;
    }
    invariant(valid, `${name} size or checksum mismatch after a clean retry`);
    renameSync(partial, target);
    process.stdout.write(`downloaded ${name}\n`);
  }
};

await Promise.all(Array.from({ length: Math.min(4, manifest.parts.length) }, worker));
