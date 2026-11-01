ALTER TABLE "arche"."dossier_versions" ADD COLUMN "codex_document_id" text;--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD COLUMN "codex_deposited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD COLUMN "codex_deposited_by_name" text;