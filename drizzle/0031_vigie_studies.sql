CREATE TABLE "arche"."vigie_studies" (
	"ref" text PRIMARY KEY NOT NULL,
	"capex_code" text,
	"data" jsonb NOT NULL,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."vigie_sync" (
	"view" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "vigie_studies_capex_idx" ON "arche"."vigie_studies" USING btree ("capex_code");