---
name: Orval Zod schema conflict fix
description: How to prevent duplicate export name conflicts when using Orval's zod client mode with schemas option
---

When Orval generates a `zod` client with both `target: "generated"` and `schemas: { path: "generated/types", type: "typescript" }`, the auto-generated `index.ts` re-exports from both `./generated/api` (Zod schemas) and `./generated/types` (TypeScript interfaces), causing TS2308 "already exported a member" errors for any schema that appears in both.

**Fix:** Remove the `schemas` option from the `zod` output config in `orval.config.ts`. The Zod schemas in `generated/api.ts` are sufficient for runtime validation; the separate TS interface types directory is redundant.

**Why:** `api.ts` already imports the TypeScript types internally. Re-exporting both in `index.ts` causes namespace collision. The server only needs Zod schemas; TypeScript infers types from `z.infer<>`.

**How to apply:** In `lib/api-spec/orval.config.ts`, the `zod` output block should NOT have a `schemas` key. After removing it, codegen will no longer generate `generated/types/` and will not add `export * from './generated/types'` to the index.
