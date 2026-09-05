#!/usr/bin/env node
/**
 * Noella over stdio, for Claude Code and Claude Desktop.
 *
 * Both launch this as a child process and talk to it on its own stdin and
 * stdout, so nothing is exposed to the network and there is nothing to
 * authenticate. For ChatGPT, or claude.ai on the web or a phone, use http.mjs
 * instead — those can only reach a remote MCP server.
 *
 *   node server.mjs /path/to/folder
 *   NOELLA_FOLDER=/path/to/folder node server.mjs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { folderFrom, registerTools } from "./tools.mjs";

const server = new McpServer({ name: "noella", version: "1.0.0" });
registerTools(server, folderFrom(process.argv[2]));

await server.connect(new StdioServerTransport());
