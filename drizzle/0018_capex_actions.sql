CREATE TABLE "arche"."capex_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source" text NOT NULL,
	"source_ref" text,
	"owner_user_id" uuid,
	"due_on" date,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_on" date,
	"closing_note" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capex_actions_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
ALTER TABLE "arche"."capex_actions" ADD CONSTRAINT "capex_actions_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."capex_actions" ADD CONSTRAINT "capex_actions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capex_actions_owner_idx" ON "arche"."capex_actions" USING btree ("owner_user_id");