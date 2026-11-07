ALTER TABLE "arche"."exchange_rates" DROP CONSTRAINT "exchange_rates_uq";--> statement-breakpoint
ALTER TABLE "arche"."reference_revenues" DROP CONSTRAINT "reference_revenues_uq";--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" DROP CONSTRAINT "lot_actuals_uq";--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" DROP CONSTRAINT "rampup_days_uq";--> statement-breakpoint
ALTER TABLE "arche"."exchange_rates" ADD CONSTRAINT "exchange_rates_pk" PRIMARY KEY("currency","period");--> statement-breakpoint
ALTER TABLE "arche"."reference_revenues" ADD CONSTRAINT "reference_revenues_pk" PRIMARY KEY("subsidiary_code","fiscal_year");--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_pk" PRIMARY KEY("lot_id","month");--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_pk" PRIMARY KEY("line_id","day");