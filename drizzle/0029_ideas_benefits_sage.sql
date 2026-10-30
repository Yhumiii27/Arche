CREATE TABLE "arche"."benefit_actuals" (
	"capex_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"revenue_keur" numeric NOT NULL,
	"opex_keur" numeric NOT NULL,
	"note" text,
	"entered_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "benefit_actuals_pk" PRIMARY KEY("capex_id","year")
);
--> statement-breakpoint
CREATE TABLE "arche"."ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subsidiary_code" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"stake" text NOT NULL,
	"size_keur" numeric,
	"investment_type" text,
	"status" text DEFAULT 'new' NOT NULL,
	"proposed_by_name" text NOT NULL,
	"proposed_by_user_id" uuid,
	"decision_note" text,
	"decided_by_name" text,
	"decided_at" timestamp with time zone,
	"capex_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ideas_number_uq" UNIQUE("subsidiary_code","number")
);
--> statement-breakpoint
CREATE TABLE "arche"."post_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"milestone" integer NOT NULL,
	"held_on" date NOT NULL,
	"conclusion" text NOT NULL,
	"summary" text NOT NULL,
	"codex_ref" text,
	"real_npv_keur" numeric,
	"real_irr_pct" numeric,
	"recorded_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_audits_milestone_uq" UNIQUE("capex_id","milestone")
);
--> statement-breakpoint
CREATE TABLE "arche"."sage_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subsidiary_code" text NOT NULL,
	"source" text NOT NULL,
	"file_name" text,
	"lines" integer NOT NULL,
	"accepted" integer NOT NULL,
	"duplicates" integer NOT NULL,
	"rejected" integer NOT NULL,
	"imported_by_name" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."sage_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"subsidiary_code" text NOT NULL,
	"key" text NOT NULL,
	"lot_id" uuid NOT NULL,
	"doc_date" date NOT NULL,
	"kind" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text NOT NULL,
	"supplier" text,
	"label" text,
	CONSTRAINT "sage_lines_key_uq" UNIQUE("subsidiary_code","key")
);
--> statement-breakpoint
CREATE TABLE "arche"."sage_rejects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"raw" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD COLUMN "sage_code" text;--> statement-breakpoint
ALTER TABLE "arche"."benefit_actuals" ADD CONSTRAINT "benefit_actuals_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_subsidiary_code_subsidiaries_code_fk" FOREIGN KEY ("subsidiary_code") REFERENCES "arche"."subsidiaries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_proposed_by_user_id_users_id_fk" FOREIGN KEY ("proposed_by_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."post_audits" ADD CONSTRAINT "post_audits_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."sage_imports" ADD CONSTRAINT "sage_imports_subsidiary_code_subsidiaries_code_fk" FOREIGN KEY ("subsidiary_code") REFERENCES "arche"."subsidiaries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."sage_lines" ADD CONSTRAINT "sage_lines_import_id_sage_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "arche"."sage_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."sage_lines" ADD CONSTRAINT "sage_lines_lot_id_capex_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "arche"."capex_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."sage_rejects" ADD CONSTRAINT "sage_rejects_import_id_sage_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "arche"."sage_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ideas_subsidiary_idx" ON "arche"."ideas" USING btree ("subsidiary_code");--> statement-breakpoint
CREATE INDEX "sage_imports_sub_idx" ON "arche"."sage_imports" USING btree ("subsidiary_code");--> statement-breakpoint
CREATE INDEX "sage_lines_lot_idx" ON "arche"."sage_lines" USING btree ("lot_id");