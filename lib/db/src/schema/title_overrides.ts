import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const titleOverridesTable = pgTable("title_overrides", {
  id: serial("id").primaryKey(),
  rawTitle: text("raw_title").notNull().unique(),
  tmdbId: integer("tmdb_id").notNull(),
  mediaType: text("media_type").notNull().default("movie"),
  tmdbTitle: text("tmdb_title").notNull().default(""),
  tmdbPoster: text("tmdb_poster").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TitleOverride = typeof titleOverridesTable.$inferSelect;
