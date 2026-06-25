import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

const rootDir = process.cwd();
const publicDir = resolve(rootDir, "public");
const contentDir = resolve(publicDir, "content");
const reportPath = resolve(rootDir, "qa-screenshots", "image-reference-repair-report.json");
const imageExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".mp4", ".avif", ".otf", ".ttf", ".woff", ".woff2"]);
const repairableImageExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else files.push(file);
  }
  return files;
}

function toPublicPath(file) {
  return `/${relative(publicDir, file).replace(/\\/g, "/")}`;
}

function fromPublicPath(publicPath) {
  return resolve(publicDir, decodeURIComponent(publicPath).replace(/^\/+/, ""));
}

function pathExistsExact(publicPath) {
  const target = fromPublicPath(publicPath);
  if (!existsSync(target)) return false;
  let current = publicDir;
  for (const part of decodeURIComponent(publicPath).replace(/^\/+/, "").split("/")) {
    const entries = readdirSync(current);
    if (!entries.includes(part)) return false;
    current = join(current, part);
  }
  return true;
}

function collectSourceFiles() {
  const files = [];
  for (const file of readdirSync(contentDir)) {
    if (file.endsWith(".json")) files.push(join(contentDir, file));
  }
  for (const dir of ["src", "scripts"]) {
    const abs = resolve(rootDir, dir);
    if (existsSync(abs)) {
      files.push(...walk(abs).filter((file) => /\.(jsx?|tsx?|css|mjs)$/.test(file)));
    }
  }
  files.push(resolve(rootDir, "index.html"));
  return files.filter(existsSync);
}

function collectReferences(text) {
  const refs = new Set();
  const quoted = /["'`]((?:\/(?:assets|uploads|projects|fonts|content)\/)[^"'`]*?\.(?:png|jpe?g|webp|gif|svg|mp4|avif|otf|ttf|woff2?))["'`]/gi;
  const cssUrl = /url\(\s*["']?((?:\/(?:assets|uploads|projects|fonts|content)\/)[^"')]*?\.(?:png|jpe?g|webp|gif|svg|mp4|avif))["']?\s*\)/gi;
  for (const regex of [quoted, cssUrl]) {
    for (const match of text.matchAll(regex)) refs.add(match[1]);
  }
  return [...refs];
}

const publicAssets = walk(publicDir).filter((file) => imageExts.has(extname(file).toLowerCase()));
const byPublicPathLower = new Map(publicAssets.map((file) => [toPublicPath(file).toLowerCase(), toPublicPath(file)]));
const byDirStem = new Map();
const byStem = new Map();

for (const file of publicAssets) {
  const publicPath = toPublicPath(file);
  const parsed = {
    dir: dirname(publicPath).toLowerCase().replace(/\\/g, "/"),
    stem: basename(publicPath, extname(publicPath)).toLowerCase(),
    ext: extname(publicPath).toLowerCase(),
  };
  const dirKey = `${parsed.dir}/${parsed.stem}`;
  byDirStem.set(dirKey, [...(byDirStem.get(dirKey) || []), publicPath]);
  byStem.set(parsed.stem, [...(byStem.get(parsed.stem) || []), publicPath]);
}

function scoreCandidate(original, candidate) {
  const wantedExt = extname(original).toLowerCase();
  const candidateExt = extname(candidate).toLowerCase();
  let score = 0;
  if (candidateExt === ".webp" && repairableImageExts.has(wantedExt)) score += 8;
  if (candidateExt === wantedExt) score += 6;
  if (dirname(candidate).toLowerCase() === dirname(original).toLowerCase()) score += 5;
  if (basename(candidate, candidateExt).toLowerCase() === basename(original, wantedExt).toLowerCase()) score += 10;
  return score;
}

function findRepair(publicPath) {
  const lower = publicPath.toLowerCase();
  if (byPublicPathLower.has(lower)) {
    const exactCase = byPublicPathLower.get(lower);
    if (exactCase !== publicPath) return { path: exactCase, strategy: "case-corrected" };
  }

  const dirStemKey = `${dirname(publicPath).toLowerCase()}/${basename(publicPath, extname(publicPath)).toLowerCase()}`;
  const sameDirStem = byDirStem.get(dirStemKey) || [];
  const stemMatches = byStem.get(basename(publicPath, extname(publicPath)).toLowerCase()) || [];
  const candidates = [...new Set([...sameDirStem, ...stemMatches])]
    .filter((candidate) => candidate !== publicPath)
    .sort((a, b) => scoreCandidate(publicPath, b) - scoreCandidate(publicPath, a));

  if (!candidates.length) return null;
  const path = candidates[0];
  const strategy = extname(path).toLowerCase() === ".webp" ? "webp" : "original-or-nearby";
  return { path, strategy };
}

const sourceFiles = collectSourceFiles();
const records = [];
const replacementsByFile = new Map();

for (const file of sourceFiles) {
  const text = readFileSync(file, "utf8");
  for (const ref of collectReferences(text)) {
    const exists = pathExistsExact(ref);
    const record = {
      file: relative(rootDir, file).replace(/\\/g, "/"),
      reference: ref,
      exists,
      repairedTo: null,
      strategy: null,
    };
    if (!exists) {
      const repair = findRepair(ref);
      if (repair) {
        record.repairedTo = repair.path;
        record.strategy = repair.strategy;
        if (!replacementsByFile.has(file)) replacementsByFile.set(file, new Map());
        replacementsByFile.get(file).set(ref, repair.path);
      }
    }
    records.push(record);
  }
}

for (const [file, replacements] of replacementsByFile.entries()) {
  let text = readFileSync(file, "utf8");
  for (const [from, to] of replacements.entries()) {
    text = text.split(from).join(to);
  }
  writeFileSync(file, text, "utf8");
}

const missingBefore = records.filter((record) => !record.exists);
const repaired = records.filter((record) => record.repairedTo);
const remainingMissing = records
  .filter((record) => !record.exists && !record.repairedTo)
  .map((record) => ({ file: record.file, reference: record.reference }));

const report = {
  totalReferencesScanned: records.length,
  uniqueReferencesScanned: new Set(records.map((record) => record.reference)).size,
  missingBeforeRepair: missingBefore.length,
  repairedCount: repaired.length,
  remainingMissingCount: remainingMissing.length,
  repaired: repaired.map(({ file, reference, repairedTo, strategy }) => ({ file, from: reference, to: repairedTo, strategy })),
  remainingMissing,
  scannedFiles: sourceFiles.map((file) => relative(rootDir, file).replace(/\\/g, "/")),
  generatedAt: new Date().toISOString(),
};

writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
