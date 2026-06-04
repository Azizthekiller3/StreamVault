import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const historyTable = pgTable("watch_history", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  poster: text("poster").notNull(),
  link: text("link").notNull(),
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  imdbId: text("imdb_id"),
  progress: real("progress"),
  duration: real("duration"),
  episodeTitle: text("episode_title"),
  watchedAt: timestamp("watched_at").defaultNow().notNull(),
});

export const insertHistorySchema = createInsertSchema(historyTable).omit({ id: true, watchedAt: true });
export type InsertHistory = z.infer<typeof insertHistorySchema>;
export type History = typeof historyTable.$inferSelect;
