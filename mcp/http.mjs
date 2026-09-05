#!/usr/bin/env node
/**
 * Noella over HTTP, for the models that cannot launch a process.
 *
 * Claude Code and Claude Desktop run server.mjs as a child process and talk to
 * it on a pipe. ChatGPT cannot do that, and neither can claude.ai in a browser
 * or on a phone — they reach *out* to a URL. Same tools, different doorway.
 *
 *   NOELLA_TOKEN=<secret> node http.mjs /path/to/folder
 *
 * Binds to 127.0.0.1 unless told otherwise, because the thing on the other end
 * of this is every note you have ever written. To let a hosted model reach it,
 * put a tunnel in front (`cloudflared tunnel --url http://localhost:8787`)
 * rather than opening a port — the tunnel dials out, so nothing on your machine
 * is listening to the internet.
 *
 * Stateless: every request builds its own server and transport and throws them
 * away. Sessions would mean holding per-client state for a server whose whole
 * job is to re-read one file, and a connector that drops its session id would
 * silently stop working.
 */

import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { folderFrom, registerTools } from "./tools.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const positional = args.find((a) => !a.startsWith("--") && !isFlagValue(a));

function isFlagValue(a) {
  const i = args.indexOf(a);
  return i > 0 && args[i - 1].startsWith("--");
}

const FOLDER = folderFrom(positional);
const PORT = Number(flag("port", process.env.NOELLA_PORT ?? 8787));
const HOST = flag("host", process.env.NOELLA_HOST ?? "127.0.0.1");
const TOKEN = process.env.NOELLA_TOKEN;

if (!TOKEN) {
  console.error(
    "Refusing to start without NOELLA_TOKEN.\n\n" +
      "This serves your notes over HTTP, so it needs a secret. Use this one:\n\n" +
      `  NOELLA_TOKEN=${randomBytes(24).toString("base64url")} node http.mjs${positional ? ` ${positional}` : ""}\n\n` +
      "Keep it somewhere; the connector needs the same value.",
  );
  process.exit(1);
}

/** Compared in constant time, so the answer never leaks the token's shape. */
function tokenMatches(given) {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Two ways in, because connectors differ in what they will let you set.
 *
 *   Authorization: Bearer <token>     preferred; secrets do not belong in URLs
 *   POST /mcp/<token>                 for clients that only take a URL
 *
 * The path form is a real trade-off — URLs turn up in proxy logs and browser
 * history — but a connector you cannot authenticate is a connector you cannot
 * use, and this beats running it open.
 */
function authorise(req, url) {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ") && tokenMatches(header.slice(7))) {
    return true;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === "mcp" && tokenMatches(parts[1]);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function send(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(body));
}

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // A liveness check that says nothing about the wall and needs no secret.
  if (url.pathname === "/health") {
    send(res, 200, { ok: true, folder: FOLDER });
    return;
  }

  if (!url.pathname.startsWith("/mcp")) {
    send(res, 404, { error: "Not here. The endpoint is /mcp." });
    return;
  }

  if (!authorise(req, url)) {
    res.writeHead(401, {
      "Content-Type": "application/json",
      "WWW-Authenticate": 'Bearer realm="noella"',
      ...CORS,
    });
    res.end(
      JSON.stringify({
        error:
          "Send Authorization: Bearer <NOELLA_TOKEN>, or POST to /mcp/<NOELLA_TOKEN>.",
      }),
    );
    return;
  }

  // A server per request. Nothing is shared, so nothing can leak between
  // callers and a restart costs no client anything.
  const server = new McpServer({ name: "noella", version: "1.0.0" });
  registerTools(server, FOLDER);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    if (!res.headersSent) {
      send(res, 500, { error: String(error) });
    }
  }
});

http.listen(PORT, HOST, () => {
  const shown = HOST === "0.0.0.0" ? "0.0.0.0 (every interface)" : HOST;
  console.error(`Noella MCP on http://${shown}:${PORT}/mcp — folder ${FOLDER}`);
  if (HOST !== "127.0.0.1" && HOST !== "localhost") {
    console.error(
      "Listening beyond this machine. A tunnel is usually the better door.",
    );
  }
});
