CREATE TABLE "arche"."wbs_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"lot_id" uuid,
	"number" integer NOT NULL,
	"name" text NOT NULL,
	"start_on" date NOT NULL,
	"end_on" date NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"owner_user_id" uuid,
	"milestone" boolean DEFAULT false NOT NULL,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wbs_tasks_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
ALTER TABLE "arche"."wbs_tasks" ADD CONSTRAINT "wbs_tasks_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."wbs_tasks" ADD CONSTRAINT "wbs_tasks_lot_id_capex_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "arche"."capex_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."wbs_tasks" ADD CONSTRAINT "wbs_tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;