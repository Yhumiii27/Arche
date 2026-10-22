CREATE TABLE "arche"."authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"authority" text,
	"status" text DEFAULT 'to_file' NOT NULL,
	"filed_on" date,
	"due_on" date,
	"obtained_on" date,
	"codex_ref" text,
	"note" text,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authorizations_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
CREATE TABLE "arche"."hs_statuses" (
	"capex_id" uuid NOT NULL,
	"hs_code" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"evidence_ref" text,
	"source" text DEFAULT 'declared' NOT NULL,
	"passed_on" date,
	"note" text,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hs_statuses_uq" UNIQUE("capex_id","hs_code")
);
--> statement-breakpoint
CREATE TABLE "arche"."lot_actuals" (
	"lot_id" uuid NOT NULL,
	"month" text NOT NULL,
	"committed_keur" numeric,
	"spent_keur" numeric,
	"physical_pct" numeric,
	"source" text DEFAULT 'manual' NOT NULL,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lot_actuals_uq" UNIQUE("lot_id","month")
);
--> statement-breakpoint
CREATE TABLE "arche"."pack_items" (
	"capex_id" uuid NOT NULL,
	"item_code" text NOT NULL,
	"status" text DEFAULT 'expected' NOT NULL,
	"codex_ref" text,
	"validated_on" date,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_items_uq" UNIQUE("capex_id","item_code")
);
--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD COLUMN "planned_start" text;--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD COLUMN "planned_end" text;--> statement-breakpoint
ALTER TABLE "arche"."authorizations" ADD CONSTRAINT "authorizations_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."hs_statuses" ADD CONSTRAINT "hs_statuses_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_lot_id_capex_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "arche"."capex_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."pack_items" ADD CONSTRAINT "pack_items_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;