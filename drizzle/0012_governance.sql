CREATE TABLE "arche"."capex_snapshots" (
	"capex_id" uuid NOT NULL,
	"week" date NOT NULL,
	"status" text NOT NULL,
	"phase" text NOT NULL,
	"pack_pct" numeric,
	"subsidiary_pack_pct" numeric,
	"epc2i_pack_pct" numeric,
	"bac_keur" numeric,
	"pv_keur" numeric,
	"ev_keur" numeric,
	"ac_keur" numeric,
	"eac_keur" numeric,
	"spi" numeric,
	"cpi" numeric,
	"alerts" integer DEFAULT 0 NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capex_snapshots_uq" UNIQUE("capex_id","week")
);
--> statement-breakpoint
CREATE TABLE "arche"."reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"held_on" date NOT NULL,
	"phase" text NOT NULL,
	"attendees" text NOT NULL,
	"summary" text NOT NULL,
	"recorded_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
ALTER TABLE "arche"."decisions" ADD COLUMN "review_id" uuid;--> statement-breakpoint
ALTER TABLE "arche"."capex_snapshots" ADD CONSTRAINT "capex_snapshots_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."reviews" ADD CONSTRAINT "reviews_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;