import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const rootDir = process.cwd();
const contentDir = resolve(rootDir, "public/content");
const uploadsDir = resolve(rootDir, "public/uploads");
const allowedContentFiles = new Set(["site", "home", "works", "fonts", "services", "about", "contact", "seo", "assets"]);

const uploadTypes = {
  image: { dir: "images", extensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"] },
  background: { dir: "backgrounds", extensions: [".jpg", ".jpeg", ".png", ".webp", ".avif"] },
  font: { dir: "fonts", extensions: [".woff2", ".woff", ".ttf", ".otf"] },
  document: { dir: "documents", extensions: [".pdf", ".doc", ".docx", ".txt"] },
};

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
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
  const base = basename(name, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "upload";
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

function installAdminApi(server) {
  server.middlewares.use("/api/admin/save-content", async (req, res) => {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method not allowed." });

    try {
      const body = JSON.parse((await readRequest(req)).toString("utf8"));
      const files = body.files || {};
      const keys = Object.keys(files).filter((key) => allowedContentFiles.has(key));
      if (!keys.length) return sendJson(res, 400, { ok: false, message: "No valid content files were provided." });

      mkdirSync(contentDir, { recursive: true });
      mkdirSync(join(contentDir, "backups"), { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const saved = [];

      for (const key of keys) {
        const target = join(contentDir, `${key}.json`);
        if (existsSync(target)) {
          copyFileSync(target, join(contentDir, "backups", `${key}.${timestamp}.backup.json`));
        }
        writeFileSync(target, JSON.stringify(files[key], null, 2) + "\n", "utf8");
        saved.push(key);
      }

      return sendJson(res, 200, { ok: true, saved, savedAt: new Date().toISOString() });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        message: "Direct save is unavailable in this environment. Please export JSON and replace the content file manually.",
        detail: String(error?.message || error),
      });
    }
  });

  server.middlewares.use("/api/admin/upload-asset", async (req, res) => {
    if (req.method !== "POST") return sendJson(res, 405, { ok: false, message: "Method not allowed." });

    try {
      const url = new URL(req.url || "", "http://local.admin");
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
      return sendJson(res, 200, {
        ok: true,
        path: `/uploads/${config.dir}/${safeName}`,
        name: file.filename,
        type: kind,
        declaredType: file.declaredType,
      });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        message: "Upload is unavailable in this environment. Use a manual public path and export JSON instead.",
        detail: String(error?.message || error),
      });
    }
  });
}

function adminContentPlugin() {
  return {
    name: "athaya-admin-content-api",
    configureServer(server) {
      installAdminApi(server);
    },
    configurePreviewServer(server) {
      installAdminApi(server);
    },
  };
}

export default {
  plugins: [adminContentPlugin()],
};
