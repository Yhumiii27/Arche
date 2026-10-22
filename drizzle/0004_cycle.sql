CREATE TABLE "arche"."budget_lines" (
	"budget_version_id" uuid NOT NULL,
	"lot_id" uuid NOT NULL,
	"amount_keur" numeric NOT NULL,
	CONSTRAINT "budget_lines_uq" UNIQUE("budget_version_id","lot_id")
);
--> statement-breakpoint
CREATE TABLE "arche"."budget_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"estimate_class" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"basis" text,
	"submitted_at" timestamp with time zone,
	"validated_by_name" text,
	"validated_by_user_id" uuid,
	"validated_at" timestamp with time zone,
	"is_g2_baseline" boolean DEFAULT false NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_versions_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
CREATE TABLE "arche"."capex_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"epc2i" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capex_lots_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
CREATE TABLE "arche"."decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"taken_on" date NOT NULL,
	"body" text NOT NULL,
	"text" text NOT NULL,
	"gate_id" uuid,
	"recorded_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
CREATE TABLE "arche"."gate_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gate_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"text" text NOT NULL,
	"owner_user_id" uuid,
	"due_on" date,
	"closed_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."gate_criteria_results" (
	"gate_id" uuid NOT NULL,
	"criterion_code" text NOT NULL,
	"state" text NOT NULL,
	"value" text,
	"forced_reason" text,
	CONSTRAINT "gate_criteria_results_uq" UNIQUE("gate_id","criterion_code")
);
--> statement-breakpoint
CREATE TABLE "arche"."gates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"code" text NOT NULL,
	"session" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"decision" text,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"decided_by_name" text,
	"decided_by_user_id" uuid,
	"due_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gates_session_uq" UNIQUE("capex_id","code","session")
);
--> statement-breakpoint
CREATE TABLE "arche"."lifecycle_models" (
	"code" text NOT NULL,
	"version" text NOT NULL,
	"definition" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lifecycle_models_uq" UNIQUE("code","version")
);
--> statement-breakpoint
CREATE TABLE "arche"."phase_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"from_status" text NOT NULL,
	"from_phase" text NOT NULL,
	"to_status" text NOT NULL,
	"to_phase" text NOT NULL,
	"gate_code" text,
	"effective_on" date NOT NULL,
	"forced" boolean DEFAULT false NOT NULL,
	"reason" text,
	"by_name" text NOT NULL,
	"by_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."risks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"probability" integer NOT NULL,
	"impact" integer NOT NULL,
	"owner_user_id" uuid,
	"response" text,
	"status" text DEFAULT 'open' NOT NULL,
	"due_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "risks_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "typology_source" text;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "typology_reason" text;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "typology_proposed" text;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "lifecycle_model_version" text;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "need_date" date;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "mes_started_on" date;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD CONSTRAINT "budget_lines_budget_version_id_budget_versions_id_fk" FOREIGN KEY ("budget_version_id") REFERENCES "arche"."budget_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD CONSTRAINT "budget_lines_lot_id_capex_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "arche"."capex_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."budget_versions" ADD CONSTRAINT "budget_versions_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."budget_versions" ADD CONSTRAINT "budget_versions_validated_by_user_id_users_id_fk" FOREIGN KEY ("validated_by_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD CONSTRAINT "capex_lots_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."decisions" ADD CONSTRAINT "decisions_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."gate_conditions" ADD CONSTRAINT "gate_conditions_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "arche"."gates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."gate_conditions" ADD CONSTRAINT "gate_conditions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."gate_criteria_results" ADD CONSTRAINT "gate_criteria_results_gate_id_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "arche"."gates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."gates" ADD CONSTRAINT "gates_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."gates" ADD CONSTRAINT "gates_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."phase_transitions" ADD CONSTRAINT "phase_transitions_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."phase_transitions" ADD CONSTRAINT "phase_transitions_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."risks" ADD CONSTRAINT "risks_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."risks" ADD CONSTRAINT "risks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phase_transitions_capex_idx" ON "arche"."phase_transitions" USING btree ("capex_id");