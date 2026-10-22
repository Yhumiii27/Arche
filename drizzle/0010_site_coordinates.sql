ALTER TABLE "arche"."sites" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "arche"."sites" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD COLUMN "bounds_west" double precision;--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD COLUMN "bounds_north" double precision;--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD COLUMN "bounds_east" double precision;--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD COLUMN "bounds_south" double precision;