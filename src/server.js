import http from "node:http";
import { pathToFileURL } from "node:url";
import * as fuzzball from "fuzzball";

const DEFAULT_PORT = 3000;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_CHOICES = 10_000;

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function acceptsJson(req) {
  const contentType = req.headers["content-type"];
  return typeof contentType === "string" && /^(?:application\/json|[^;]+\+json)(?:\s*;|$)/i.test(contentType);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const contentLength = Number(req.headers["content-length"]);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      req.resume();
      reject(new HttpError(413, "Request body too large"));
      return;
    }

    let rawBody = "";
    let settled = false;

    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      if (settled)
        return;
      rawBody += chunk;

      if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
        settled = true;
        rawBody = "";
        reject(new HttpError(413, "Request body too large"));
      }
    });
    req.on("end", () => {
      if (settled)
        return;
      settled = true;

      if (!rawBody) {
        reject(new HttpError(400, "Request body is required"));
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      }
      catch {
        reject(new HttpError(400, "Request body must be valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, { ok: true });
      }

      if (req.method === "GET" && url.pathname === "/") {
        const a = url.searchParams.get("a");
        const b = url.searchParams.get("b");
        if (a === null || b === null) {
          throw new HttpError(400, "Query params \"a\" and \"b\" are required");
        }
        return sendJson(res, 200, { ratio: fuzzball.ratio(a, b) });
      }

      if (req.method === "POST" && url.pathname === "/extract") {
        if (!acceptsJson(req)) {
          throw new HttpError(415, "Content-Type must be application/json");
        }

        const body = await readJsonBody(req);
        if (!isObject(body)) {
          throw new HttpError(400, "Request body must be a JSON object");
        }

        const { query, choices, cutoff } = body;
        if (typeof query !== "string" || query.length === 0) {
          throw new HttpError(400, "Body field \"query\" must be a non-empty string");
        }
        if (!isStringArray(choices) || choices.length === 0) {
          throw new HttpError(400, "Body field \"choices\" must be a non-empty array of strings");
        }
        if (choices.length > MAX_CHOICES) {
          throw new HttpError(400, `Body field "choices" cannot contain more than ${MAX_CHOICES} items`);
        }
        if (cutoff !== undefined && (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > 100)) {
          throw new HttpError(400, "Body field \"cutoff\" must be a finite number from 0 to 100 when provided");
        }

        const matches = fuzzball.extract(query, choices, cutoff === undefined ? undefined : { cutoff });
        const bestMatch = matches[0];
        return sendJson(res, 200, bestMatch
          ? { choice: bestMatch[0], score: bestMatch[1] }
          : { choice: null, score: null });
      }

      if (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/extract") {
        const allow = url.pathname === "/extract" ? "POST" : "GET";
        return sendJson(res, 405, { error: "Method not allowed" }, { allow });
      }

      return sendJson(res, 404, { error: "Not found" });
    }
    catch (error) {
      if (error instanceof HttpError) {
        return sendJson(res, error.statusCode, { error: error.message });
      }

      console.error(error);
      return sendJson(res, 500, { error: "Internal server error" });
    }
  });

  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  return server;
}

export function parsePort(value = process.env.PORT) {
  const port = value === undefined ? DEFAULT_PORT : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }
  return port;
}

export function startServer(port = parsePort()) {
  const server = createServer();
  server.listen(port, () => console.log(`fuzzball-api listening on :${port}`));

  const shutdown = () => server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
