CREATE TABLE "arche"."envelope_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"from_envelope_id" uuid,
	"to_envelope_id" uuid,
	"amount_keur" numeric NOT NULL,
	"reason" text NOT NULL,
	"by_name" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year" integer NOT NULL,
	"zone_code" text,
	"subsidiary_code" text,
	"category" text DEFAULT 'all' NOT NULL,
	"amount_keur" numeric NOT NULL,
	"note" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "envelopes_uq" UNIQUE NULLS NOT DISTINCT("fiscal_year","zone_code","subsidiary_code","category")
);
--> statement-breakpoint
CREATE TABLE "arche"."lot_forecasts" (
	"lot_id" uuid NOT NULL,
	"month" text NOT NULL,
	"amount_keur" numeric NOT NULL,
	"amount_local" numeric,
	"currency" text,
	"rate" numeric,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lot_forecasts_uq" UNIQUE("lot_id","month")
);
--> statement-breakpoint
ALTER TABLE "arche"."envelope_movements" ADD CONSTRAINT "envelope_movements_from_envelope_id_envelopes_id_fk" FOREIGN KEY ("from_envelope_id") REFERENCES "arche"."envelopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."envelope_movements" ADD CONSTRAINT "envelope_movements_to_envelope_id_envelopes_id_fk" FOREIGN KEY ("to_envelope_id") REFERENCES "arche"."envelopes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."lot_forecasts" ADD CONSTRAINT "lot_forecasts_lot_id_capex_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "arche"."capex_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "envelope_movements_from_idx" ON "arche"."envelope_movements" USING btree ("from_envelope_id");--> statement-breakpoint
CREATE INDEX "envelope_movements_to_idx" ON "arche"."envelope_movements" USING btree ("to_envelope_id");