-- Custom SQL migration file, put your code below! ---- Signatures are append-only, like the audit trail (0001): a row trigger refuses UPDATE and DELETE, a statement trigger
-- refuses TRUNCATE. Tamper evidence, not tamper proof (see 0001).
CREATE OR REPLACE FUNCTION "arche"."signatures_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'signatures is append-only: % refused', TG_OP
    USING ERRCODE = 'restrict_violation', HINT = 'A signature can only be added.';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "signatures_no_update_delete" BEFORE UPDATE OR DELETE ON "arche"."signatures"
FOR EACH ROW EXECUTE FUNCTION "arche"."signatures_append_only"();
--> statement-breakpoint
CREATE TRIGGER "signatures_no_truncate" BEFORE TRUNCATE ON "arche"."signatures"
FOR EACH STATEMENT EXECUTE FUNCTION "arche"."signatures_append_only"();
