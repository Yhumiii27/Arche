CREATE TABLE "arche"."capex_scores" (
	"capex_id" uuid NOT NULL,
	"criterion_code" text NOT NULL,
	"score" integer NOT NULL,
	"note" text,
	"scored_by_name" text NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capex_scores_pk" PRIMARY KEY("capex_id","criterion_code")
);
--> statement-breakpoint
CREATE TABLE "arche"."portfolio_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"description" text,
	"envelopes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"retained" boolean DEFAULT false NOT NULL,
	"retained_by_name" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."scenario_items" (
	"scenario_id" uuid NOT NULL,
	"capex_id" uuid NOT NULL,
	"included" boolean DEFAULT true NOT NULL,
	"shift_months" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "scenario_items_pk" PRIMARY KEY("scenario_id","capex_id")
);
--> statement-breakpoint
CREATE TABLE "arche"."scoring_weights" (
	"code" text PRIMARY KEY NOT NULL,
	"weight" integer NOT NULL,
	"updated_by_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arche"."capex_scores" ADD CONSTRAINT "capex_scores_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."scenario_items" ADD CONSTRAINT "scenario_items_scenario_id_portfolio_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "arche"."portfolio_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."scenario_items" ADD CONSTRAINT "scenario_items_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;