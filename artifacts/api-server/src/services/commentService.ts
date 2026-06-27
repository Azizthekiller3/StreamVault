import { db } from "@workspace/db";
import { commentsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export interface Comment {
  id: string;
  movieId: string;
  username: string;
  text: string;
  createdAt: string;
}

const MAX_TEXT = 500;
const MAX_USERNAME = 40;

export async function getComments(movieId: string): Promise<Comment[]> {
  const rows = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.movieId, movieId))
    .orderBy(desc(commentsTable.createdAt))
    .limit(200);
  return rows.map((r) => ({
    id: String(r.id),
    movieId: r.movieId,
    username: r.username,
    text: r.text,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function addComment(
  movieId: string,
  username: string,
  text: string
): Promise<Comment | null> {
  const u = username.trim().slice(0, MAX_USERNAME);
  const t = text.trim().slice(0, MAX_TEXT);
  if (!u || !t) return null;
  const [inserted] = await db
    .insert(commentsTable)
    .values({ movieId, username: u, text: t })
    .returning();
  if (!inserted) return null;
  return {
    id: String(inserted.id),
    movieId: inserted.movieId,
    username: inserted.username,
    text: inserted.text,
    createdAt: inserted.createdAt.toISOString(),
  };
}

export async function getCommentCount(movieId: string): Promise<number> {
  const rows = await db
    .select({ id: commentsTable.id })
    .from(commentsTable)
    .where(eq(commentsTable.movieId, movieId));
  return rows.length;
}
