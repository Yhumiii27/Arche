CREATE TABLE "arche"."kpi_baselines" (
	"key" text PRIMARY KEY NOT NULL,
	"value" numeric NOT NULL,
	"source" text,
	"measured_on" date,
	"entered_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "taken_over_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "taken_over_by_name" text;--> statement-breakpoint
ALTER TABLE "arche"."gates" ADD COLUMN "taken_over" boolean DEFAULT false NOT NULL;