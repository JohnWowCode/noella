/**
 * Bringing your Claude chats in.
 *
 * There is no endpoint for this. The Messages API sends messages; it cannot
 * list what you have talked about on claude.ai, and there is no public route
 * to your Projects either. The only supported way out is the account data
 * export, which is a zip of JSON — so that is what this reads.
 *
 * What arrives is not a new kind of thing. A Project becomes a room, a chat
 * becomes a note inside it with a checkbox, and the three states you asked for
 * are the three the app already has:
 *
 *   ongoing   nothing done to it, which is where every chat starts
 *   finished  ticked
 *   dead      archived
 *
 * That is deliberate. A status field for chats would be the fourth thing this
 * app has deleted for saying what a tick and an archive already say.
 *
 * Re-importing is expected — you will export again next month — so a chat is
 * matched by the claude.ai link in its body. Anything already here is left
 * alone rather than duplicated, and its activity line is refreshed.
 */

import type { NewNote, Note } from "../types";

/** Where imported chats live, so the whole lot is one thing you can open. */
export const HOME = "Claude";

const CHAT_URL = "https://claude.ai/chat/";

interface RawMessage {
  created_at?: string;
  updated_at?: string;
  sender?: string;
}

interface RawConversation {
  uuid?: string;
  name?: string;
  summary?: string;
  created_at?: string;
  updated_at?: string;
  chat_messages?: RawMessage[];
  project_uuid?: string;
  project?: { uuid?: string; name?: string } | null;
}

interface RawProject {
  uuid?: string;
  name?: string;
}

export interface Chat {
  uuid: string;
  name: string;
  project: string | null;
  lastAt: string;
  messages: number;
}

export interface Plan {
  chats: Chat[];
  /** Project name -> chats in it, most recently active first. */
  rooms: Map<string, Chat[]>;
  loose: Chat[];
}

/** Tolerant: the file is a bare array in some exports and wrapped in others. */
function arrayOf(text: string): unknown[] {
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

export function readExport(files: Map<string, string>): Plan {
  const projects = new Map<string, string>();
  const projectsFile = files.get("projects.json");
  if (projectsFile) {
    for (const raw of arrayOf(projectsFile) as RawProject[]) {
      if (raw?.uuid && raw?.name) projects.set(raw.uuid, raw.name);
    }
  }

  const chats: Chat[] = [];
  const conversationsFile =
    files.get("conversations.json") ?? files.get("chat_conversations.json");
  if (conversationsFile) {
    for (const raw of arrayOf(conversationsFile) as RawConversation[]) {
      if (!raw?.uuid) continue;
      const messages = Array.isArray(raw.chat_messages) ? raw.chat_messages : [];
      /*
       * The last message is what "active" means. A conversation's own
       * updated_at moves when you rename it or when it is touched by
       * housekeeping, so it flatters chats nobody has spoken in.
       */
      const stamps = messages
        .map((m) => m?.created_at ?? m?.updated_at ?? "")
        .filter(Boolean);
      const lastAt =
        stamps.sort().at(-1) ?? raw.updated_at ?? raw.created_at ?? "";
      const projectName =
        raw.project?.name ??
        (raw.project?.uuid ? projects.get(raw.project.uuid) : undefined) ??
        (raw.project_uuid ? projects.get(raw.project_uuid) : undefined) ??
        null;

      chats.push({
        uuid: raw.uuid,
        name: (raw.name ?? "").trim() || "Untitled chat",
        project: projectName ?? null,
        lastAt,
        messages: messages.length,
      });
    }
  }

  chats.sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  const rooms = new Map<string, Chat[]>();
  const loose: Chat[] = [];
  for (const chat of chats) {
    if (!chat.project) {
      loose.push(chat);
      continue;
    }
    const room = rooms.get(chat.project);
    if (room) room.push(chat);
    else rooms.set(chat.project, [chat]);
  }
  return { chats, rooms, loose };
}

export function linkFor(uuid: string): string {
  return `${CHAT_URL}${uuid}`;
}

/** The uuid a note was imported from, if it was. */
export function uuidOf(note: Note): string | null {
  const at = note.body.indexOf(CHAT_URL);
  if (at === -1) return null;
  return note.body.slice(at + CHAT_URL.length).split(/\s/, 1)[0] || null;
}

function activity(chat: Chat): string {
  const when = chat.lastAt
    ? new Date(chat.lastAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "never";
  const count =
    chat.messages === 1 ? "1 message" : `${chat.messages} messages`;
  return `Last spoken ${when} · ${count}`;
}

/** What a chat looks like as a note. Three lines: name, activity, link. */
export function bodyFor(chat: Chat): string {
  return `${chat.name}\n${activity(chat)}\n${linkFor(chat.uuid)}`;
}

export function noteFor(
  chat: Chat,
  parentId: string | null,
  order: number,
  colorId: string | null,
): NewNote {
  return {
    body: bodyFor(chat),
    colorId,
    parentId,
    order,
    // A checkbox, so ticking it means finished and archiving it means dead.
    // Those are the two states you asked for; the third is leaving it alone.
    isTask: true,
  };
}
