CREATE TABLE "arche"."reference_revenues" (
	"subsidiary_code" text NOT NULL,
	"fiscal_year" integer NOT NULL,
	"revenue_keur" numeric NOT NULL,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_note" text,
	CONSTRAINT "reference_revenues_uq" UNIQUE("subsidiary_code","fiscal_year")
);
--> statement-breakpoint
CREATE TABLE "arche"."role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_ref" text,
	"speciality" text,
	"from_on" date,
	"to_on" date,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subsidiary_code" text NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"country_iso2" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_subsidiary_name_uq" UNIQUE("subsidiary_code","name")
);
--> statement-breakpoint
CREATE TABLE "arche"."subsidiaries" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country_iso2" text NOT NULL,
	"zone_code" text NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entra_object_id" text,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"job_title" text,
	"subsidiary_code" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_entra_object_id_unique" UNIQUE("entra_object_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "arche"."zones" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."capex" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"subsidiary_code" text NOT NULL,
	"site_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"investment_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"phase" text DEFAULT 'cadrage' NOT NULL,
	"typology" text,
	"sponsor_user_id" uuid,
	"lead_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capex_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "arche"."capex_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"capex_role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capex_members_uq" UNIQUE("capex_id","user_id","capex_role")
);
--> statement-breakpoint
CREATE TABLE "arche"."activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_user_id" uuid,
	"actor_name" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"capex_id" uuid
);
--> statement-breakpoint
CREATE TABLE "arche"."app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."audit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_user_id" uuid,
	"actor_name" text NOT NULL,
	"actor_role" text,
	"object_ref" text NOT NULL,
	"change" text NOT NULL,
	"area" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"capex_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"reason" text
);
--> statement-breakpoint
ALTER TABLE "arche"."reference_revenues" ADD CONSTRAINT "reference_revenues_subsidiary_code_subsidiaries_code_fk" FOREIGN KEY ("subsidiary_code") REFERENCES "arche"."subsidiaries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "arche"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."sites" ADD CONSTRAINT "sites_subsidiary_code_subsidiaries_code_fk" FOREIGN KEY ("subsidiary_code") REFERENCES "arche"."subsidiaries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."subsidiaries" ADD CONSTRAINT "subsidiaries_zone_code_zones_code_fk" FOREIGN KEY ("zone_code") REFERENCES "arche"."zones"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."users" ADD CONSTRAINT "users_subsidiary_code_subsidiaries_code_fk" FOREIGN KEY ("subsidiary_code") REFERENCES "arche"."subsidiaries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_subsidiary_code_subsidiaries_code_fk" FOREIGN KEY ("subsidiary_code") REFERENCES "arche"."subsidiaries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "arche"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_sponsor_user_id_users_id_fk" FOREIGN KEY ("sponsor_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_lead_user_id_users_id_fk" FOREIGN KEY ("lead_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."capex_members" ADD CONSTRAINT "capex_members_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."capex_members" ADD CONSTRAINT "capex_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."activity_events" ADD CONSTRAINT "activity_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."activity_events" ADD CONSTRAINT "activity_events_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."audit_entries" ADD CONSTRAINT "audit_entries_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."audit_entries" ADD CONSTRAINT "audit_entries_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_assignments_user_idx" ON "arche"."role_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_events_occurred_at_idx" ON "arche"."activity_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_entries_occurred_at_idx" ON "arche"."audit_entries" USING btree ("occurred_at");