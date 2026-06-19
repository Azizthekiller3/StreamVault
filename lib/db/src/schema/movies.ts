import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const moviesTable = pgTable("telegram_movies", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").unique().notNull(),
  title: text("title").notNull(),
  poster: text("poster").notNull().default(""),
  posterFileId: text("poster_file_id").notNull().default(""),
  audio: text("audio").notNull().default(""),
  qualities: jsonb("qualities").notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Movie = typeof moviesTable.$inferSelect;
export type InsertMovie = typeof moviesTable.$inferInsert;
