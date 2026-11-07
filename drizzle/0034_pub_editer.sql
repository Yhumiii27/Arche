-- Custom SQL migration file, put your code below! --
-- M-19 (Matrix's request of 5 Nov 2026; owner's choices of 7 Nov 2026, docs/PROPOSITION-M19.md): the IT administrator corrects
-- Arche's data from Matrix's viewer, through Arche's rules and journal — Matrix never writes in Arche's tables itself (M-18).
-- Matrix calls arche.pub_editer(table, action, key, values, by, reason) as matrix_app (execution link decided in Matrix).
--   * Only the tables and columns listed below; the proofs of the DIG-PRODI cycle (decisions, circuits, signatures, frozen
--     versions, journal), rights, secrets, the mirrors of other tools and computed tables stay closed.
--   * Reference lists: add, correct, withdraw (archived, never deleted) where the list allows it; a CAPEX's data: correct only.
--   * `p_par` must name an active Arche account holding the role admin at group scope (by display name or e-mail).
--   * One audit_entries row per call (actor "… (via Matrix)", area Matrix, the changed columns before / after, the reason);
--     a correction of a CAPEX's data is also in its activity feed and e-mailed to its project lead (email_outbox, AR-041).
--   * A rampup day changed marks its line for recomputation (production_lines.computed_at null; job alerts-raised).
-- Refusals are RAISE EXCEPTION with a French message, shown as is by Matrix.
CREATE OR REPLACE FUNCTION "arche"."pub_editer"(
  p_table text, p_action text, p_cle jsonb, p_valeurs jsonb, p_par text, p_motif text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = arche, pg_temp AS $$
DECLARE
  v_keys text[];
  v_cols text[];
  v_actions text[];
  v_retire text;          -- the column set to false (or the date set) to withdraw a row; null: withdrawal refused
  v_kind text;            -- 'list' | 'capex'
  v_user uuid;
  v_name text;
  v_n int;
  v_where text;
  v_vals jsonb;
  v_before jsonb;
  v_after jsonb;
  v_new jsonb;
  v_changed text[];
  v_tcols text[];
  v_set text;
  v_capex uuid;
  v_capex_code text;
  v_capex_status text;
  v_lead uuid;
  v_lead_email text;
  v_ref text;
  v_audit uuid;
  v_label text;
  k text;
BEGIN
  -- The table: its key, its open columns, its actions.
  CASE p_table
    WHEN 'asset_classes' THEN v_kind := 'list'; v_keys := ARRAY['code']; v_cols := ARRAY['label', 'life_years', 'method', 'factor', 'lot_kinds'];
      v_actions := ARRAY['ajouter', 'corriger', 'retirer']; v_retire := 'active';
    WHEN 'exchange_rates' THEN v_kind := 'list'; v_keys := ARRAY['currency', 'period']; v_cols := ARRAY['units_per_eur', 'note'];
      v_actions := ARRAY['ajouter', 'corriger'];
    WHEN 'scoring_weights' THEN v_kind := 'list'; v_keys := ARRAY['code']; v_cols := ARRAY['weight']; v_actions := ARRAY['corriger'];
    WHEN 'kpi_baselines' THEN v_kind := 'list'; v_keys := ARRAY['key']; v_cols := ARRAY['value', 'source', 'measured_on']; v_actions := ARRAY['corriger'];
    WHEN 'reference_revenues' THEN v_kind := 'list'; v_keys := ARRAY['subsidiary_code', 'fiscal_year']; v_cols := ARRAY['revenue_keur', 'source_note'];
      v_actions := ARRAY['ajouter', 'corriger'];
    WHEN 'capex' THEN v_kind := 'capex'; v_keys := ARRAY['id']; v_cols := ARRAY['title', 'description', 'need_date'];
    WHEN 'risks' THEN v_kind := 'capex'; v_keys := ARRAY['id']; v_cols := ARRAY['title', 'category', 'probability', 'impact', 'response', 'due_on'];
    WHEN 'capex_actions' THEN v_kind := 'capex'; v_keys := ARRAY['id']; v_cols := ARRAY['title', 'description', 'due_on'];
    WHEN 'wbs_tasks' THEN v_kind := 'capex'; v_keys := ARRAY['id']; v_cols := ARRAY['name', 'start_on', 'end_on', 'progress_pct'];
    WHEN 'authorizations' THEN v_kind := 'capex'; v_keys := ARRAY['id'];
      v_cols := ARRAY['title', 'authority', 'filed_on', 'due_on', 'obtained_on', 'codex_ref', 'note'];
    WHEN 'reviews' THEN v_kind := 'capex'; v_keys := ARRAY['id']; v_cols := ARRAY['held_on', 'attendees', 'summary'];
    WHEN 'lot_actuals' THEN v_kind := 'capex'; v_keys := ARRAY['lot_id', 'month']; v_cols := ARRAY['committed_keur', 'spent_keur', 'physical_pct'];
    WHEN 'rampup_days' THEN v_kind := 'capex'; v_keys := ARRAY['line_id', 'day'];
      v_cols := ARRAY['output', 'availability_pct', 'performance_pct', 'quality_pct', 'oee_pct', 'scrap_pct'];
    WHEN 'benefit_actuals' THEN v_kind := 'capex'; v_keys := ARRAY['capex_id', 'year']; v_cols := ARRAY['revenue_keur', 'opex_keur', 'note'];
    WHEN 'ideas' THEN v_kind := 'capex'; v_keys := ARRAY['id']; v_cols := ARRAY['title', 'stake', 'size_keur'];
    WHEN 'rex_entries' THEN v_kind := 'capex'; v_keys := ARRAY['id']; v_cols := ARRAY['title', 'text', 'recommendation'];
    WHEN 'absences' THEN v_kind := 'capex'; v_keys := ARRAY['id']; v_cols := ARRAY['from_on', 'to_on', 'note'];
    ELSE RAISE EXCEPTION 'La table « % » n''est pas modifiable depuis Matrix : corrigez-la dans Arche.', coalesce(p_table, '');
  END CASE;
  IF v_kind = 'capex' THEN v_actions := ARRAY['corriger']; END IF;
  IF p_action IS NULL OR NOT (p_action = ANY (v_actions)) THEN
    RAISE EXCEPTION 'Action « % » refusée sur % (admises : %).', coalesce(p_action, ''), p_table, array_to_string(v_actions, ', ');
  END IF;

  -- Who: an active Arche account, administrator at group scope.
  IF p_motif IS NULL OR length(btrim(p_motif)) < 5 THEN RAISE EXCEPTION 'Le motif est obligatoire (5 caractères au moins).'; END IF;
  IF length(p_motif) > 1000 THEN RAISE EXCEPTION 'Le motif dépasse 1000 caractères.'; END IF;
  SELECT count(*), min(u.id::text)::uuid, min(u.display_name) INTO v_n, v_user, v_name
  FROM users u
  WHERE u.active AND (lower(u.display_name) = lower(btrim(coalesce(p_par, ''))) OR lower(u.email) = lower(btrim(coalesce(p_par, ''))))
    AND EXISTS (SELECT 1 FROM role_assignments r WHERE r.user_id = u.id AND r.role = 'admin' AND r.scope_kind = 'group'
                AND (r.from_on IS NULL OR r.from_on <= current_date) AND (r.to_on IS NULL OR r.to_on >= current_date));
  IF v_n = 0 THEN
    RAISE EXCEPTION '« % » n''est pas un administrateur groupe actif d''Arche : correction refusée.', coalesce(p_par, '');
  ELSIF v_n > 1 THEN
    RAISE EXCEPTION 'Plusieurs comptes d''Arche s''appellent « % » : utilisez l''adresse e-mail.', p_par;
  END IF;

  -- The values: open columns only.
  v_vals := coalesce(p_valeurs, '{}'::jsonb);
  IF jsonb_typeof(v_vals) <> 'object' THEN RAISE EXCEPTION 'Les valeurs doivent être un objet JSON.'; END IF;
  FOR k IN SELECT jsonb_object_keys(v_vals) LOOP
    IF NOT (k = ANY (v_cols)) AND NOT (p_action = 'ajouter' AND k = ANY (v_keys)) THEN
      RAISE EXCEPTION 'La colonne « % » de % n''est pas modifiable depuis Matrix.', k, p_table;
    END IF;
  END LOOP;
  IF p_action IN ('ajouter', 'corriger') AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(v_vals) x WHERE x = ANY (v_cols)) THEN
    RAISE EXCEPTION 'Aucune valeur à écrire.';
  END IF;
  SELECT array_agg(column_name::text) INTO v_tcols FROM information_schema.columns WHERE table_schema = 'arche' AND table_name = p_table;

  -- The row.
  IF p_action = 'ajouter' THEN
    FOREACH k IN ARRAY v_keys LOOP
      IF NOT (v_vals ? k) OR v_vals->>k IS NULL OR btrim(v_vals->>k) = '' THEN RAISE EXCEPTION 'La clé « % » est obligatoire pour ajouter une ligne.', k; END IF;
    END LOOP;
    p_cle := (SELECT jsonb_object_agg(x, v_vals->x) FROM unnest(v_keys) x);
  ELSE
    IF p_cle IS NULL OR jsonb_typeof(p_cle) <> 'object' THEN RAISE EXCEPTION 'La clé de la ligne est obligatoire.'; END IF;
    FOREACH k IN ARRAY v_keys LOOP
      IF NOT (p_cle ? k) OR p_cle->>k IS NULL THEN RAISE EXCEPTION 'La clé « % » est obligatoire.', k; END IF;
    END LOOP;
  END IF;
  SELECT string_agg(format('x.%1$I = (jsonb_populate_record(null::arche.%2$I, $1)).%1$I', c, p_table), ' AND ') INTO v_where FROM unnest(v_keys) c;
  BEGIN
    EXECUTE format('SELECT to_jsonb(x.*) FROM arche.%I x WHERE %s FOR UPDATE', p_table, v_where) INTO v_before USING p_cle;
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'Clé invalide pour % : %', p_table, SQLERRM;
  END;
  IF p_action = 'ajouter' AND v_before IS NOT NULL THEN RAISE EXCEPTION 'Cette ligne existe déjà dans % : corrigez-la.', p_table; END IF;
  IF p_action <> 'ajouter' AND v_before IS NULL THEN RAISE EXCEPTION 'Ligne introuvable dans % : %', p_table, p_cle::text; END IF;

  -- The CAPEX of the row and its state.
  IF v_kind = 'capex' THEN
    v_capex := CASE p_table
      WHEN 'capex' THEN (v_before->>'id')::uuid
      WHEN 'lot_actuals' THEN (SELECT l.capex_id FROM capex_lots l WHERE l.id = (v_before->>'lot_id')::uuid)
      WHEN 'rampup_days' THEN (SELECT p.capex_id FROM production_lines p WHERE p.id = (v_before->>'line_id')::uuid)
      WHEN 'absences' THEN NULL
      ELSE (v_before->>'capex_id')::uuid END;
    IF v_capex IS NOT NULL THEN
      SELECT c.code, c.status, c.lead_user_id INTO v_capex_code, v_capex_status, v_lead FROM capex c WHERE c.id = v_capex;
      IF v_capex_status IN ('closed', 'abandoned') AND p_table <> 'benefit_actuals' THEN
        RAISE EXCEPTION 'Le CAPEX % est clos ou abandonné : ses données ne se corrigent plus.', v_capex_code;
      END IF;
    END IF;
    IF p_table = 'lot_actuals' THEN
      IF EXISTS (SELECT 1 FROM closure_statements s WHERE s.capex_id = v_capex) THEN
        RAISE EXCEPTION 'La clôture comptable du CAPEX % est faite : le réalisé ne se corrige plus.', v_capex_code;
      END IF;
      IF coalesce(v_before->>'currency', 'EUR') <> 'EUR' THEN
        RAISE EXCEPTION 'Ce réalisé est saisi en % : corrigez-le dans Arche (montant en devise et taux).', v_before->>'currency';
      END IF;
    ELSIF p_table = 'ideas' AND v_before->>'status' NOT IN ('new', 'qualified') THEN
      RAISE EXCEPTION 'Cette idée est déjà décidée : elle ne se corrige plus.';
    ELSIF p_table = 'rex_entries' AND v_before->>'published_at' IS NOT NULL THEN
      RAISE EXCEPTION 'Ce retour d''expérience est publié : il ne se corrige plus.';
    ELSIF p_table = 'absences' AND v_before->>'cancelled_at' IS NOT NULL THEN
      RAISE EXCEPTION 'Cette absence est annulée.';
    ELSIF p_table = 'rampup_days' AND (v_before->>'planned_stop')::boolean THEN
      RAISE EXCEPTION 'Ce jour est un arrêt planifié : corrigez-le dans Arche.';
    END IF;
  END IF;

  -- The row after the change, checked by the rules of the table.
  v_new := coalesce(v_before, '{}'::jsonb) || v_vals;
  BEGIN
    EXECUTE format('SELECT to_jsonb(jsonb_populate_record(null::arche.%I, $1))', p_table) INTO v_new USING v_new;
  EXCEPTION WHEN data_exception THEN
    RAISE EXCEPTION 'Valeur invalide pour % : %', p_table, SQLERRM;
  END;
  FOR k IN SELECT jsonb_object_keys(v_vals) LOOP
    IF jsonb_typeof(v_new->k) = 'string' AND length(v_new->>k) > 4000 THEN RAISE EXCEPTION 'La valeur de « % » dépasse 4000 caractères.', k; END IF;
    IF k IN ('title', 'name', 'label', 'stake', 'attendees', 'category', 'text') AND (v_new->>k IS NULL OR btrim(v_new->>k) = '') THEN
      RAISE EXCEPTION 'La colonne « % » ne peut pas être vide.', k;
    END IF;
    IF k LIKE '%\_pct' AND v_new->>k IS NOT NULL AND ((v_new->>k)::numeric < 0 OR (v_new->>k)::numeric > 100) THEN
      RAISE EXCEPTION '« % » va de 0 à 100.', k;
    END IF;
    IF (k LIKE '%\_keur' OR k IN ('output', 'value')) AND p_table <> 'benefit_actuals' AND v_new->>k IS NOT NULL AND (v_new->>k)::numeric < 0 THEN
      RAISE EXCEPTION '« % » ne peut pas être négatif.', k;
    END IF;
  END LOOP;
  CASE p_table
    WHEN 'asset_classes' THEN
      IF (v_new->>'life_years')::int NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'La durée d''utilité va de 1 à 60 ans.'; END IF;
      IF v_new->>'method' NOT IN ('linear', 'declining') THEN RAISE EXCEPTION 'Méthode : linear ou declining.'; END IF;
      IF v_new->>'factor' IS NOT NULL AND (v_new->>'factor')::numeric <= 0 THEN RAISE EXCEPTION 'Le coefficient doit être positif.'; END IF;
    WHEN 'exchange_rates' THEN
      IF v_new->>'currency' !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Devise : trois lettres majuscules (ISO 4217).'; END IF;
      IF v_new->>'period' !~ '^[0-9]{4}(-(0[1-9]|1[0-2]))?$' THEN RAISE EXCEPTION 'Période : AAAA ou AAAA-MM.'; END IF;
      IF v_new->>'units_per_eur' IS NULL OR (v_new->>'units_per_eur')::numeric <= 0 THEN RAISE EXCEPTION 'Le taux doit être positif.'; END IF;
    WHEN 'scoring_weights' THEN
      IF (v_new->>'weight')::numeric <> trunc((v_new->>'weight')::numeric) OR (v_new->>'weight')::int NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'Le poids est un entier de 0 à 100.';
      END IF;
    WHEN 'risks' THEN
      IF (v_new->>'probability')::int NOT BETWEEN 1 AND 4 OR (v_new->>'impact')::int NOT BETWEEN 1 AND 4 THEN
        RAISE EXCEPTION 'Probabilité et impact vont de 1 à 4.';
      END IF;
    WHEN 'wbs_tasks' THEN
      IF v_new->>'start_on' IS NOT NULL AND v_new->>'end_on' IS NOT NULL AND (v_new->>'start_on')::date > (v_new->>'end_on')::date THEN
        RAISE EXCEPTION 'La fin ne peut pas précéder le début.';
      END IF;
    WHEN 'absences' THEN
      IF (v_new->>'from_on')::date > (v_new->>'to_on')::date THEN RAISE EXCEPTION 'La fin ne peut pas précéder le début.'; END IF;
    ELSE NULL;
  END CASE;

  -- The write: who wrote it, then the open columns.
  FOREACH k IN ARRAY ARRAY['updated_by_name', 'entered_by_name'] LOOP
    IF k = ANY (v_tcols) THEN v_vals := v_vals || jsonb_build_object(k, v_name || ' (via Matrix)'); END IF;
  END LOOP;
  IF 'entered_at' = ANY (v_tcols) THEN v_vals := v_vals || jsonb_build_object('entered_at', now()); END IF;
  BEGIN
  IF p_action = 'ajouter' THEN
    FOREACH k IN ARRAY ARRAY['created_by_name'] LOOP
      IF k = ANY (v_tcols) THEN v_vals := v_vals || jsonb_build_object(k, v_name || ' (via Matrix)'); END IF;
    END LOOP;
    SELECT string_agg(format('%I', x), ', ') INTO v_set FROM jsonb_object_keys(v_vals) x;
    EXECUTE format('INSERT INTO arche.%1$I AS x (%2$s) SELECT %2$s FROM jsonb_populate_record(null::arche.%1$I, $1) RETURNING to_jsonb(x.*)', p_table, v_set)
      INTO v_after USING v_vals;
  ELSE
    IF p_action = 'retirer' THEN
      IF v_retire IS NULL THEN RAISE EXCEPTION 'Une ligne de % ne se retire pas : corrigez-la.', p_table; END IF;
      IF NOT (v_before->>v_retire)::boolean THEN RAISE EXCEPTION 'Cette ligne est déjà retirée.'; END IF;
      v_vals := (v_vals - v_cols) || jsonb_build_object(v_retire, false);
    END IF;
    SELECT string_agg(format('%1$I = r.%1$I', x), ', ') INTO v_set FROM jsonb_object_keys(v_vals) x;
    IF 'updated_at' = ANY (v_tcols) THEN v_set := v_set || ', updated_at = now()'; END IF;
    EXECUTE format('UPDATE arche.%1$I AS x SET %2$s FROM jsonb_populate_record(null::arche.%1$I, $2) r WHERE %3$s RETURNING to_jsonb(x.*)',
      p_table, v_set, v_where) INTO v_after USING p_cle, v_vals;
  END IF;
  EXCEPTION WHEN not_null_violation OR foreign_key_violation OR check_violation OR unique_violation OR data_exception THEN
    RAISE EXCEPTION 'Écriture refusée par Arche : %', SQLERRM;
  END;

  -- The journal: the columns that changed.
  SELECT array_agg(x ORDER BY x) INTO v_changed FROM jsonb_object_keys(v_after) x
  WHERE x NOT IN ('updated_at', 'created_at', 'row_version', 'updated_by_name', 'entered_by_name', 'created_by_name', 'entered_at')
    AND (v_before IS NULL OR v_before->x IS DISTINCT FROM v_after->x);
  IF v_changed IS NULL THEN RETURN v_after; END IF;
  v_ref := coalesce(v_capex_code, p_table || ' ' || (SELECT string_agg(p_cle->>x, ' / ') FROM unnest(v_keys) x));
  v_label := CASE p_action WHEN 'ajouter' THEN 'added' WHEN 'retirer' THEN 'withdrawn' ELSE 'corrected' END;
  INSERT INTO audit_entries (occurred_at, actor_user_id, actor_name, actor_role, object_ref, change, area, entity_type, entity_id, capex_id, before, after, reason)
  VALUES (now(), v_user, v_name || ' (via Matrix)', 'admin', v_ref,
          format('%s via Matrix: %s (%s)', p_table, v_label, array_to_string(v_changed, ', ')), 'Matrix', p_table,
          CASE WHEN 'id' = ANY (v_keys) THEN (v_after->>'id')::uuid END, v_capex,
          CASE WHEN v_before IS NULL THEN NULL ELSE (SELECT jsonb_object_agg(x, v_before->x) FROM unnest(v_changed) x) END,
          (SELECT jsonb_object_agg(x, v_after->x) FROM unnest(v_changed) x), btrim(p_motif))
  RETURNING id INTO v_audit;

  -- A CAPEX's data: in its activity feed, and e-mailed to its project lead.
  IF v_capex IS NOT NULL THEN
    INSERT INTO activity_events (occurred_at, actor_user_id, actor_name, kind, text, capex_id)
    VALUES (now(), v_user, v_name || ' (via Matrix)', 'matrix_edit',
            format('Corrected from Matrix: %s (%s). Reason: %s', p_table, array_to_string(v_changed, ', '), btrim(p_motif)), v_capex);
    SELECT u.email INTO v_lead_email FROM users u WHERE u.id = v_lead AND u.active;
    IF v_lead_email IS NOT NULL THEN
      INSERT INTO email_outbox (key, kind, user_id, to_email, capex_id, subject, body)
      VALUES ('matrix-edit:' || v_audit, 'matrix_edit', v_lead, v_lead_email, v_capex,
              format('[Arche] %s — correction depuis Matrix', v_capex_code),
              format(E'Bonjour,\n\n%s a corrigé depuis Matrix une donnée du CAPEX %s.\n\nTable : %s\nColonnes : %s\nMotif : %s\n\nLe détail (avant / après) est au journal du CAPEX dans Arche.',
                     v_name, v_capex_code, p_table, array_to_string(v_changed, ', '), btrim(p_motif)))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  IF p_table = 'rampup_days' THEN
    UPDATE production_lines SET computed_at = NULL WHERE id = (v_after->>'line_id')::uuid;
  END IF;
  RETURN v_after;
END;
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION "arche"."pub_editer"(text, text, jsonb, jsonb, text, text) FROM PUBLIC;
--> statement-breakpoint
COMMENT ON FUNCTION "arche"."pub_editer"(text, text, jsonb, jsonb, text, text) IS 'M-19 : correction des données d''Arche depuis la visionneuse de Matrix (administrateur groupe d''Arche, motif obligatoire, journal d''audit). Lien d''exécution : matrix_app, décidé dans Matrix. Périmètre : docs/PROPOSITION-M19.md.';
