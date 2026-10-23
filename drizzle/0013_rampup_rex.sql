CREATE TABLE "arche"."closure_statements" (
	"capex_id" uuid PRIMARY KEY NOT NULL,
	"afe_balance_keur" numeric NOT NULL,
	"note" text,
	"entered_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."lot_final_costs" (
	"lot_id" uuid PRIMARY KEY NOT NULL,
	"final_keur" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."production_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"nominal_per_day" numeric NOT NULL,
	"unit" text NOT NULL,
	"scrap_target_pct" numeric NOT NULL,
	"machine_numbers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reached_on" date,
	"avg_capacity_pct" numeric,
	"avg_oee_pct" numeric,
	"avg_scrap_pct" numeric,
	"rampup_status" text DEFAULT 'en_cours' NOT NULL,
	"computed_at" timestamp with time zone,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_lines_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
CREATE TABLE "arche"."rampup_days" (
	"line_id" uuid NOT NULL,
	"day" date NOT NULL,
	"output" numeric,
	"availability_pct" numeric,
	"performance_pct" numeric,
	"quality_pct" numeric,
	"oee_pct" numeric,
	"scrap_pct" numeric,
	"planned_stop" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rampup_days_uq" UNIQUE("line_id","day")
);
--> statement-breakpoint
CREATE TABLE "arche"."rex_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"phase" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"author_name" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rex_entries_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
ALTER TABLE "arche"."closure_statements" ADD CONSTRAINT "closure_statements_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."lot_final_costs" ADD CONSTRAINT "lot_final_costs_lot_id_capex_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "arche"."capex_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."production_lines" ADD CONSTRAINT "production_lines_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "arche"."production_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."rex_entries" ADD CONSTRAINT "rex_entries_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;