CREATE TABLE "arche"."keystone_mirror" (
	"view" text NOT NULL,
	"key" text NOT NULL,
	"capex_code" text,
	"project_code" text,
	"need_ref" text,
	"data" jsonb NOT NULL,
	"maj_le" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "keystone_mirror_pk" PRIMARY KEY("view","key")
);
--> statement-breakpoint
CREATE TABLE "arche"."keystone_sync" (
	"view" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"rows" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "arche"."machine_needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capex_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"catalogue_code" text,
	"catalogue_version" integer,
	"free_label" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_capacity" numeric,
	"capacity_unit" text,
	"need_date" date,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"ordered_on" date,
	"lot_id" uuid,
	"comment" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_needs_number_uq" UNIQUE("capex_id","number")
);
--> statement-breakpoint
ALTER TABLE "arche"."machine_needs" ADD CONSTRAINT "machine_needs_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."machine_needs" ADD CONSTRAINT "machine_needs_lot_id_capex_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "arche"."capex_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "keystone_mirror_capex_idx" ON "arche"."keystone_mirror" USING btree ("capex_code");--> statement-breakpoint
CREATE INDEX "keystone_mirror_project_idx" ON "arche"."keystone_mirror" USING btree ("project_code");