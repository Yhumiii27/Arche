CREATE TABLE "arche"."api_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"can_write" boolean DEFAULT false NOT NULL,
	"subsidiaries" text[] DEFAULT '{}' NOT NULL,
	"created_by_name" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_clients_name_unique" UNIQUE("name"),
	CONSTRAINT "api_clients_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "arche"."api_signatures" (
	"client_id" uuid NOT NULL,
	"signature" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_signatures_pk" PRIMARY KEY("client_id","signature")
);
--> statement-breakpoint
CREATE TABLE "arche"."raised_alerts" (
	"capex_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"raised_on" date NOT NULL,
	CONSTRAINT "raised_alerts_pk" PRIMARY KEY("capex_id","rule")
);
--> statement-breakpoint
CREATE TABLE "arche"."webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_status" integer,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arche"."webhook_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"url" text NOT NULL,
	"events" text[] NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arche"."api_signatures" ADD CONSTRAINT "api_signatures_client_id_api_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "arche"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."raised_alerts" ADD CONSTRAINT "raised_alerts_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "arche"."webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_client_id_api_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "arche"."api_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_due_idx" ON "arche"."webhook_deliveries" USING btree ("status","next_attempt_at");