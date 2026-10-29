CREATE TABLE "arche"."asset_classes" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"life_years" integer NOT NULL,
	"method" text DEFAULT 'linear' NOT NULL,
	"factor" numeric,
	"lot_kinds" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."fixed_asset_transfers" (
	"lot_id" uuid PRIMARY KEY NOT NULL,
	"capex_id" uuid NOT NULL,
	"asset_class_code" text NOT NULL,
	"life_years" integer NOT NULL,
	"method" text NOT NULL,
	"factor" numeric,
	"amount_keur" numeric NOT NULL,
	"in_service_on" date NOT NULL,
	"transferred_by_name" text NOT NULL,
	"transferred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD COLUMN "asset_class_code" text;--> statement-breakpoint
ALTER TABLE "arche"."fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_lot_id_capex_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "arche"."capex_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixed_asset_transfers_capex_idx" ON "arche"."fixed_asset_transfers" USING btree ("capex_id");