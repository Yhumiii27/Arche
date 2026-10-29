CREATE TABLE "arche"."exchange_rates" (
	"currency" text NOT NULL,
	"period" text NOT NULL,
	"units_per_eur" numeric NOT NULL,
	"note" text,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_uq" UNIQUE("currency","period")
);
--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD COLUMN "amount_local" numeric;--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD COLUMN "rate" numeric;--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD COLUMN "committed_local" numeric;--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD COLUMN "spent_local" numeric;--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD COLUMN "rate" numeric;