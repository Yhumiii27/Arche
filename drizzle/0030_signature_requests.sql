CREATE TABLE "arche"."signature_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"circuit_step_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'creating' NOT NULL,
	"provider_status" text,
	"provider_ref" text,
	"signer_ref" text,
	"document_ref" text,
	"signing_url" text,
	"input" jsonb NOT NULL,
	"statement" text NOT NULL,
	"content_hash" text,
	"signer_user_id" uuid NOT NULL,
	"signer_name" text NOT NULL,
	"on_behalf_of_name" text,
	"error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arche"."signature_requests" ADD CONSTRAINT "signature_requests_circuit_step_id_circuit_steps_id_fk" FOREIGN KEY ("circuit_step_id") REFERENCES "arche"."circuit_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arche"."signature_requests" ADD CONSTRAINT "signature_requests_signer_user_id_users_id_fk" FOREIGN KEY ("signer_user_id") REFERENCES "arche"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signature_requests_step_idx" ON "arche"."signature_requests" USING btree ("circuit_step_id");