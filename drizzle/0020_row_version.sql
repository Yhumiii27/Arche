ALTER TABLE "arche"."budget_versions" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD COLUMN "row_version" integer DEFAULT 1 NOT NULL;