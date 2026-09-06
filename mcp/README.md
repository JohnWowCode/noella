# Noella, as tools a model can use

Lets Claude or ChatGPT read your wall and add to it: "what's still open?",
"put *scout the underpass* on the film project", "what's filed under Money?"

It runs on your machine and talks to nothing but a folder. No API key, nothing
metered — an MCP server provides tools to a chat client, so it rides on the
subscription you already have.

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

### 3a. Point Claude Code or Claude Desktop at it (local, no secret)

These launch the server as a child process and talk to it on a pipe. Nothing
listens on the network and there is nothing to authenticate.

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

### 3b. Point ChatGPT — or claude.ai on the web or your phone — at it

None of those can launch a process. They reach *out* to a URL, so they need the
HTTP server and a way in from outside your machine.

```sh
NOELLA_TOKEN=$(openssl rand -base64 24 | tr '+/' '-_') node http.mjs /absolute/path/to/your/folder
```

It refuses to start without `NOELLA_TOKEN` and prints a usable one if you have
not set it — this serves every note you have ever written, so it does not run
open.

Then put a tunnel in front rather than opening a port. A tunnel dials *out*, so
nothing on your machine is listening to the internet:

```sh
cloudflared tunnel --url http://localhost:8787
```

That prints an `https://something.trycloudflare.com` URL. The connector's
endpoint is that URL plus `/mcp`.

**In ChatGPT:** Settings → Connectors → Advanced → Developer mode, then add a
connector pointing at `https://…/mcp`. Requires a paid plan.

**In claude.ai:** Settings → Connectors → Add custom connector, same URL. This
is also the only way to reach your wall from a phone.

Two ways to authenticate, because connectors differ in what they let you set:

| | |
| --- | --- |
| `Authorization: Bearer <token>` | Preferred. Secrets do not belong in URLs. |
| `https://…/mcp/<token>` | For connectors that only accept a URL. |

The path form is a real trade-off — URLs end up in proxy logs and history — but
a connector you cannot authenticate is one you cannot use, and it beats running
it open. Rotate the token by restarting with a new one.

`--port 8787` and `--host` change where it listens; it binds to `127.0.0.1`
unless you say otherwise, which is what makes the tunnel the safe default.

A free Cloudflare quick tunnel gets a new URL every restart, so the connector
needs updating each time. A named tunnel keeps its hostname.

### Two extra tools, for ChatGPT's sake

The HTTP server exposes `search` and `fetch` alongside everything else. They
are thin aliases over the same data in the fixed shape OpenAI's connectors look
for — `search` gives `{id, title, url}` and `fetch` gives the text behind an id
— because a connector that cannot find them may refuse to load at all. The urls
are real deep links: every card carries `id="note-<id>"`, so following one
scrolls to the note. Set `NOELLA_APP_URL` if you host the app somewhere other
than the default.

## The tools

Reading — always available, current as of the last time a tab was open:

| Tool | For |
| --- | --- |
| `whats_on_today` | The short list: chosen today, carried over, already done. Ask this first |
| `whats_open` | Everything unticked, in the order Noella would work through it |
| `search_notes` | By text, `#tag`, folder, kind, `mark` or `priority`; `open_only` for the live ones |
| `get_note` | One thing in full: what it holds, and the path to where it lives |
| `list_projects` | Every project with status, progress and next step; every list |
| `list_folders` | The colour folders, their names, and how much is in each |

Writing — queued, lands when a tab is next open:

| Tool | For |
| --- | --- |
| `add_note` | A note, to-do, project or list; `inside` nests it, plus `priority` and `marks` |
| `add_step` | The same thing, worded for checklists |
| `complete` | Tick something off, or `undo: true` to un-tick it |
| `set_project_status` | idea / active / paused / done |
| `set_priority` | now / next / later, or none to unrank |
| `set_marks` | What something is about; replaces the set, empty strips it |
| `pending_changes` | What is queued and not yet applied |

### Marks

A note wears up to four of these, and they are what the wall filters and
groups by — so marking something is filing it, and `search_notes` with a
`mark` is the reliable way to answer "everything about X" no matter how it
was worded:

```
idea   write  art     sound   build   game
bug    fix    test    ship    blocked danger
money  buy    admin   home    health  travel
read   watch  people  place   love    ask
```

Things are found by id, by their `NOTE 0041` reference, or by enough of their
text to be unambiguous. When the text matches several, the server says which
rather than guessing — except when picking a destination, where something that
already holds things beats something that does not.

Anything can hold anything, to any depth. `WowCool.World › Cave Sniper › Bugs ›
a screenshot` is four levels and every tool speaks it: results carry the path
they came from, and `get_note` lists what a thing contains and what each of
those holds in turn.

## What it cannot do

- **Photos and video.** The bytes stay in the browser. A note says how many
  attachments it has and that they are not readable from here.
- **Delete anything.** Nothing here can destroy a note. Archive from the app.
- **Run without your computer.** Even over a tunnel, the server is a process on
  your machine and the wall is a file it writes. Close the laptop and the
  connector goes dark. Genuine always-on sync needs a real backend —
  `supabase/migrations/0001_init.sql` is the schema for it, waiting.

## If it says there is no wall

```
No wall found at <path>/noella.json.
```

Either the folder in the connector's config is not the one you picked in Noella, or
you have not pressed **Connect a folder** yet. Both paths must match exactly.
