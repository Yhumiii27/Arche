CREATE TABLE "arche"."absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"delegate_user_id" uuid NOT NULL,
	"from_on" date NOT NULL,
	"to_on" date NOT NULL,
	"note" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "arche"."email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"user_id" uuid NOT NULL,
	"to_email" text NOT NULL,
	"capex_id" uuid,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_outbox_key_user" UNIQUE("key","user_id")
);
--> statement-breakpoint
CREATE TABLE "arche"."designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"target" text NOT NULL,
	"version" integer NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"definition" jsonb NOT NULL,
	"note" text,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by_name" text,
	"published_at" timestamp with time zone,
	CONSTRAINT "designs_version_uq" UNIQUE("kind","target","version")
);
--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD COLUMN "on_behalf_of_name" text;--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD COLUMN "template_version" integer;--> statement-breakpoint
ALTER TABLE "arche"."absences" ADD CONSTRAINT "absences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "arche"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."absences" ADD CONSTRAINT "absences_delegate_user_id_users_id_fk" FOREIGN KEY ("delegate_user_id") REFERENCES "arche"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."email_outbox" ADD CONSTRAINT "email_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "arche"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."email_outbox" ADD CONSTRAINT "email_outbox_capex_id_capex_id_fk" FOREIGN KEY ("capex_id") REFERENCES "arche"."capex"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absences_user_idx" ON "arche"."absences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "absences_delegate_idx" ON "arche"."absences" USING btree ("delegate_user_id");--> statement-breakpoint
CREATE INDEX "email_outbox_status_idx" ON "arche"."email_outbox" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_outbox_user_idx" ON "arche"."email_outbox" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "designs_target_idx" ON "arche"."designs" USING btree ("kind","target");