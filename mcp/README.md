# Noella, as tools Claude can use

Lets Claude read your wall and add to it: "what's still open?", "put *scout the
underpass* on the film project", "what have I got filed under Money?"

It runs on your machine and talks to nothing but a folder. No account, no API
key, no data leaving the computer.

## The one thing to understand first

**Noella lives in a browser tab.** Its notes are in that browser's storage. An
MCP server is a separate process and cannot reach into a tab — so the two share
a folder you pick once:

```
<your folder>/
  noella.json     the whole wall.   Noella writes it, the server reads it.
  inbox/*.json    one change each.  The server writes them, Noella applies them.
```

One writer per path, which is why there is no merge algorithm and nothing to
get subtly wrong.

The consequence, stated plainly: **a change Claude makes lands the next time a
Noella tab is open.** Reading is always current as of the last time the tab was
open. Every write tool says this in its reply rather than pretending otherwise.

## Setup

### 1. Connect the folder in Noella

Open Noella, scroll to the bottom, press **Connect a folder**, and pick one —
`~/Noella` is a fine choice. Make it a new empty folder; the app writes into it.

This needs **Chrome, Edge, Arc or Brave**. Firefox and Safari have no way for a
page to hold onto a folder, so there is nothing to connect there.

After a browser restart the button says **Reconnect** — the folder is
remembered but the permission is not, and only a click can restore it. That is
a browser rule, not something the app can avoid.

### 2. Install

```sh
cd mcp
npm install
```

### 3. Point Claude at it

**Claude Code**

```sh
claude mcp add noella -- node /absolute/path/to/noella/mcp/server.mjs /absolute/path/to/your/folder
```

**Claude Desktop** — edit `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`)

```json
{
  "mcpServers": {
    "noella": {
      "command": "node",
      "args": [
        "/absolute/path/to/noella/mcp/server.mjs",
        "/absolute/path/to/your/folder"
      ]
    }
  }
}
```

Restart Claude Desktop. Both paths must be absolute.

If you leave the folder argument off, it looks at `$NOELLA_FOLDER`, then
`~/Noella`.

## What Claude can do

Reading — always available, current as of the last time a tab was open:

| Tool | For |
| --- | --- |
| `whats_open` | Everything unticked, in the order Noella would work through it |
| `search_notes` | By text, `#tag`, folder, or kind; `open_only` for just the live ones |
| `get_note` | One thing in full, with its steps or items |
| `list_projects` | Every project with status, progress and next step; every list |
| `list_folders` | The colour folders, their names, and how much is in each |

Writing — queued, lands when a tab is next open:

| Tool | For |
| --- | --- |
| `add_note` | A note, to-do, project or list, optionally filed in a folder |
| `add_step` | A step on a project or an item on a list |
| `complete` | Tick something off, or `undo: true` to un-tick it |
| `set_project_status` | idea / active / paused / done |
| `pending_changes` | What is queued and not yet applied |

Things are found by id, by their `NOTE 0041` reference, or by enough of their
text to be unambiguous. When the text matches several, the server says which
rather than guessing.

## What it cannot do

- **Photos and video.** The bytes stay in the browser. A note says how many
  attachments it has and that they are not readable from here.
- **Delete anything.** Nothing here can destroy a note. Archive from the app.
- **Work from your phone.** A local server only serves the machine it runs on.
  Syncing everywhere needs a real backend — `supabase/migrations/0001_init.sql`
  is the schema for it, waiting.

## If it says there is no wall

```
No wall found at <path>/noella.json.
```

Either the folder in your Claude config is not the one you picked in Noella, or
you have not pressed **Connect a folder** yet. Both paths must match exactly.
