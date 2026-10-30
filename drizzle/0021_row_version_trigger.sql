-- Custom SQL migration file, put your code below! ---- Optimistic lock (AR-049): every UPDATE of a CAPEX, a budget version, a dossier version or a circuit step raises its
-- row_version by one, whoever writes it (Server Function, job or seed); a form sends the value it was shown and the Server
-- Function refuses the write when the row has changed since (src/domain/concurrency.ts).
CREATE OR REPLACE FUNCTION "arche"."bump_row_version"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "capex_row_version" BEFORE UPDATE ON "arche"."capex" FOR EACH ROW EXECUTE FUNCTION "arche"."bump_row_version"();
--> statement-breakpoint
CREATE TRIGGER "budget_versions_row_version" BEFORE UPDATE ON "arche"."budget_versions" FOR EACH ROW EXECUTE FUNCTION "arche"."bump_row_version"();
--> statement-breakpoint
CREATE TRIGGER "dossier_versions_row_version" BEFORE UPDATE ON "arche"."dossier_versions" FOR EACH ROW EXECUTE FUNCTION "arche"."bump_row_version"();
--> statement-breakpoint
CREATE TRIGGER "circuit_steps_row_version" BEFORE UPDATE ON "arche"."circuit_steps" FOR EACH ROW EXECUTE FUNCTION "arche"."bump_row_version"();
