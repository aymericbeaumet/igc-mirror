#!/usr/bin/env node

import { createHash } from "node:crypto";
import { closeSync, createReadStream, openSync, readFileSync, readSync, statSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("./manifest.json", import.meta.url), "utf8"));

function invariant(condition, message) {
  if (!condition) throw new Error(`IGC mirror verification failed: ${message}`);
}

async function sha256(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(new URL(path, import.meta.url))) digest.update(chunk);
  return digest.digest("hex");
}

invariant(manifest.version === 4, "unsupported manifest version");
invariant(manifest.srs === "EPSG:2154", "unexpected coordinate reference system");
invariant(manifest.lod === 12, "unexpected source level of detail");
invariant(Array.isArray(manifest.parts) && manifest.parts.length > 0, "source archives are missing");
invariant(
  manifest.parts.reduce((sum, part) => sum + part.tileCount, 0) === manifest.tileCount,
  "archive tile counts do not match the manifest",
);

invariant(
  (await sha256(manifest.coverage.file)) === manifest.coverage.sha256,
  "coverage checksum mismatch",
);

for (const part of manifest.parts) {
  const path = new URL(part.file, import.meta.url);
  const descriptor = openSync(path, "r");
  const buffer = Buffer.alloc(64);
  const bytesRead = readSync(descriptor, buffer, 0, buffer.length, 0);
  closeSync(descriptor);
  const prefix = buffer.subarray(0, bytesRead).toString("utf8");
  invariant(!prefix.startsWith("version https://git-lfs.github.com/spec"), `${part.file} is only an LFS pointer`);
  invariant(statSync(path).size === part.byteLength, `${part.file} size mismatch`);
  invariant((await sha256(part.file)) === part.sha256, `${part.file} checksum mismatch`);
  process.stdout.write(`verified ${part.file}\n`);
}

process.stdout.write(
  `IGC mirror PASS: ${manifest.tileCount} exact source PNGs in ${manifest.parts.length} lossless archives\n`,
);
