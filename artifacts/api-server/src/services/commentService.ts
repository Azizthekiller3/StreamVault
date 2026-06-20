import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const FILE = join(DATA_DIR, "comments.json");
const MAX_PER_MOVIE = 200;
const MAX_TEXT = 500;
const MAX_USERNAME = 40;

export interface Comment {
  id: string;
  movieId: string;
  username: string;
  text: string;
  createdAt: string;
}

type Store = Record<string, Comment[]>;

function load(): Store {
  try {
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, "utf8")) as Store;
  } catch {
    return {};
  }
}

function persist(store: Store) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(store), "utf8");
  } catch {}
}

export function getComments(movieId: string): Comment[] {
  const store = load();
  return (store[movieId] ?? []).slice().reverse(); // newest first
}

export function addComment(
  movieId: string,
  username: string,
  text: string
): Comment | null {
  const u = username.trim().slice(0, MAX_USERNAME);
  const t = text.trim().slice(0, MAX_TEXT);
  if (!u || !t) return null;

  const comment: Comment = {
    id: randomUUID(),
    movieId,
    username: u,
    text: t,
    createdAt: new Date().toISOString(),
  };

  const store = load();
  if (!store[movieId]) store[movieId] = [];
  store[movieId].push(comment);

  // Keep max entries
  if (store[movieId].length > MAX_PER_MOVIE) {
    store[movieId] = store[movieId].slice(-MAX_PER_MOVIE);
  }

  persist(store);
  return comment;
}

export function getCommentCount(movieId: string): number {
  const store = load();
  return (store[movieId] ?? []).length;
}
