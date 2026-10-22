CREATE TABLE "arche"."business_plans" (
	"capex_id" uuid PRIMARY KEY NOT NULL,
	"horizon_years" integer NOT NULL,
	"discount_rate_pct" numeric NOT NULL,
	"flows" jsonb NOT NULL,
	"updated_by_name" text NOT NULL,
	"validated_by_name" text,
	"validated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"amount_keur" numeric DEFAULT 0 NOT NULL,
	"delay_days" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"required_decider" text NOT NULL,
	"matrix_valid_from" date,
	"decision_reason" text,
	"decided_by_name" text,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changes_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
CREATE TABLE "arche"."circuit_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gate_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"group_no" integer NOT NULL,
	"kind" text NOT NULL,
	"actor" text NOT NULL,
	"speciality" text,
	"label" text NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	"decides" boolean DEFAULT false NOT NULL,
	"assignee_user_id" uuid,
	"status" text DEFAULT 'waiting' NOT NULL,
	"opened_on" date,
	"due_on" date,
	"outcome" text,
	"comment" text,
	"acted_by_name" text,
	"acted_by_user_id" uuid,
	"acted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."delegation_matrices" (
	"valid_from" date PRIMARY KEY NOT NULL,
	"definition" jsonb NOT NULL,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."dossier_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dossier_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"content" jsonb NOT NULL,
	"computed" jsonb,
	"completeness_pct" integer DEFAULT 0 NOT NULL,
	"content_hash" text,
	"frozen_at" timestamp with time zone,
	"frozen_by_name" text,
	"frozen_by_user_id" uuid,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossier_versions_number_uq" UNIQUE("dossier_id","number")
);
--> statement-breakpoint
CREATE TABLE "arche"."dossiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossiers_capex_kind_uq" UNIQUE("capex_id","kind")
);
--> statement-breakpoint
CREATE TABLE "arche"."signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circuit_step_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_name" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" text DEFAULT 'simple' NOT NULL,
	"content_hash" text,
	"statement" text NOT NULL,
	"auth_time" timestamp with time zone,
	"ip_hash" text,
	"provider_ref" text
);
--> statement-breakpoint
ALTER TABLE "arche"."gates" ADD COLUMN "dossier_version_id" uuid;--> statement-breakpoint
ALTER TABLE "arche"."business_plans" ADD CONSTRAINT "business_plans_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "arche"."gates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_acted_by_user_id_users_id_fk" FOREIGN KEY ("acted_by_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD CONSTRAINT "dossier_versions_dossier_id_dossiers_id_fk" FOREIGN KEY ("dossier_id") REFERENCES "arche"."dossiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD CONSTRAINT "dossier_versions_frozen_by_user_id_users_id_fk" FOREIGN KEY ("frozen_by_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."dossiers" ADD CONSTRAINT "dossiers_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."signatures" ADD CONSTRAINT "signatures_circuit_step_id_circuit_steps_id_fk" FOREIGN KEY ("circuit_step_id") REFERENCES "arche"."circuit_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."signatures" ADD CONSTRAINT "signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "circuit_steps_gate_idx" ON "arche"."circuit_steps" USING btree ("gate_id");