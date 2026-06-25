import { createServer } from "node:http";
import { copyFileSync, createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = join(rootDir, "dist");
const publicDir = join(rootDir, "public");
const contentDir = join(publicDir, "content");
const uploadsDir = join(publicDir, "uploads");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const allowedContentFiles = new Set(["site", "home", "works", "fonts", "services", "about", "contact", "seo", "assets"]);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};
const uploadTypes = {
  image: { dir: "images", extensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"] },
  background: { dir: "backgrounds", extensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"] },
  font: { dir: "fonts", extensions: [".woff2", ".woff", ".ttf", ".otf"] },
  document: { dir: "documents", extensions: [".pdf", ".doc", ".docx", ".txt"] },
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function readRequest(req) {
  return new Promise((resolveRequest, rejectRequest) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolveRequest(Buffer.concat(chunks)));
    req.on("error", rejectRequest);
  });
}

function slugifyFileName(name) {
  const ext = extname(name).toLowerCase();
  const base = basename(name, ext).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "upload";
  return `${base}-${Date.now()}${ext}`;
}

function parseMultipart(buffer, contentType) {
  const boundary = contentType.match(/boundary=(.+)$/)?.[1];
  if (!boundary) return null;
  const parts = buffer.toString("binary").split(`--${boundary}`);
  for (const part of parts) {
    if (!part.includes('name="file"')) continue;
    const filename = part.match(/filename="([^"]+)"/)?.[1];
    const declaredType = part.match(/Content-Type: ([^\r\n]+)/)?.[1] || "application/octet-stream";
    const start = part.indexOf("\r\n\r\n");
    if (start < 0 || !filename) return null;
    let binary = part.slice(start + 4);
    if (binary.endsWith("\r\n")) binary = binary.slice(0, -2);
    return { filename, declaredType, buffer: Buffer.from(binary, "binary") };
  }
  return null;
}

async function handleSave(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method not allowed." });
  try {
    const body = JSON.parse((await readRequest(req)).toString("utf8"));
    const files = body.files || {};
    const keys = Object.keys(files).filter((key) => allowedContentFiles.has(key));
    if (!keys.length) return sendJson(res, 400, { ok: false, message: "No valid content files were provided." });
    mkdirSync(contentDir, { recursive: true });
    mkdirSync(join(contentDir, "backups"), { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    for (const key of keys) {
      const target = join(contentDir, `${key}.json`);
      if (existsSync(target)) copyFileSync(target, join(contentDir, "backups", `${key}.${timestamp}.backup.json`));
      writeFileSync(target, JSON.stringify(files[key], null, 2) + "\n", "utf8");
    }
    return sendJson(res, 200, { ok: true, saved: keys, savedAt: new Date().toISOString() });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      message: "Direct save is unavailable in this environment. Please export JSON and replace the content file manually.",
      detail: String(error?.message || error),
    });
  }
}

async function handleUpload(req, res, url) {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method not allowed." });
  try {
    const kind = url.searchParams.get("type") || "image";
    const config = uploadTypes[kind] || uploadTypes.image;
    const file = parseMultipart(await readRequest(req), req.headers["content-type"] || "");
    if (!file) return sendJson(res, 400, { ok: false, message: "No upload file was received." });
    const extension = extname(file.filename).toLowerCase();
    if (!config.extensions.includes(extension)) {
      return sendJson(res, 400, { ok: false, message: `Unsupported file type. Allowed: ${config.extensions.join(", ")}` });
    }
    const uploadDir = join(uploadsDir, config.dir);
    mkdirSync(uploadDir, { recursive: true });
    const safeName = slugifyFileName(file.filename);
    writeFileSync(join(uploadDir, safeName), file.buffer);
    return sendJson(res, 200, { ok: true, path: `/uploads/${config.dir}/${safeName}`, name: file.filename, type: kind, declaredType: file.declaredType });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      message: "Upload is unavailable in this environment. Use a manual public path and export JSON instead.",
      detail: String(error?.message || error),
    });
  }
}

function serveFile(req, res, url) {
  const decoded = decodeURIComponent(url.pathname);
  const publicPath = join(publicDir, decoded.replace(/^\//, ""));
  const distPath = join(distDir, decoded === "/" ? "index.html" : decoded.replace(/^\//, ""));
  const hasPublicFile = existsSync(publicPath) && statSync(publicPath).isFile();
  const hasDistFile = existsSync(distPath) && statSync(distPath).isFile();
  const filePath = hasPublicFile ? publicPath : hasDistFile ? distPath : join(distDir, "index.html");
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

export const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  if (url.pathname === "/api/admin/save-content") return handleSave(req, res);
  if (url.pathname === "/api/admin/upload-asset") return handleUpload(req, res, url);
  return serveFile(req, res, url);
});

server.listen(port, host, () => {
  console.log(`ATHAYA admin server running at http://${host}:${port}`);
});
