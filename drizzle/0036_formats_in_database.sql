ALTER TABLE "arche"."exchange_rates" ADD CONSTRAINT "exchange_rates_currency_shape" CHECK ("arche"."exchange_rates"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "arche"."exchange_rates" ADD CONSTRAINT "exchange_rates_period_shape" CHECK ("arche"."exchange_rates"."period" ~ '^[0-9]{4}(-(0[1-9]|1[0-2]))?$');--> statement-breakpoint
ALTER TABLE "arche"."exchange_rates" ADD CONSTRAINT "exchange_rates_units_positive" CHECK ("arche"."exchange_rates"."units_per_eur" > 0);--> statement-breakpoint
ALTER TABLE "arche"."exchange_rates" ADD CONSTRAINT "exchange_rates_entered_by_filled" CHECK (length(btrim("arche"."exchange_rates"."entered_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."reference_revenues" ADD CONSTRAINT "reference_revenues_year_range" CHECK ("arche"."reference_revenues"."fiscal_year" between 2000 and 2100);--> statement-breakpoint
ALTER TABLE "arche"."reference_revenues" ADD CONSTRAINT "reference_revenues_revenue_positive" CHECK ("arche"."reference_revenues"."revenue_keur" > 0);--> statement-breakpoint
ALTER TABLE "arche"."reference_revenues" ADD CONSTRAINT "reference_revenues_entered_by_filled" CHECK (length(btrim("arche"."reference_revenues"."entered_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."role_assignments" ADD CONSTRAINT "role_assignments_role_domain" CHECK ("arche"."role_assignments"."role" in ('ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director', 'sponsor', 'project_lead', 'controller', 'co_dig', 'epc2i_pmo', 'expert', 'admin'));--> statement-breakpoint
ALTER TABLE "arche"."role_assignments" ADD CONSTRAINT "role_assignments_scope_kind_domain" CHECK ("arche"."role_assignments"."scope_kind" in ('group', 'zone', 'subsidiary', 'capex'));--> statement-breakpoint
ALTER TABLE "arche"."role_assignments" ADD CONSTRAINT "role_assignments_speciality_domain" CHECK ("arche"."role_assignments"."speciality" in ('quality', 'hse', 'finance', 'operations'));--> statement-breakpoint
ALTER TABLE "arche"."role_assignments" ADD CONSTRAINT "role_assignments_scope_ref_iff_scoped" CHECK (("arche"."role_assignments"."scope_kind" = 'group') = ("arche"."role_assignments"."scope_ref" is null));--> statement-breakpoint
ALTER TABLE "arche"."role_assignments" ADD CONSTRAINT "role_assignments_dates_order" CHECK ("arche"."role_assignments"."to_on" is null or "arche"."role_assignments"."from_on" is null or "arche"."role_assignments"."to_on" >= "arche"."role_assignments"."from_on");--> statement-breakpoint
ALTER TABLE "arche"."role_assignments" ADD CONSTRAINT "role_assignments_created_by_filled" CHECK (length(btrim("arche"."role_assignments"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."sites" ADD CONSTRAINT "sites_name_filled" CHECK (length(btrim("arche"."sites"."name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."sites" ADD CONSTRAINT "sites_country_shape" CHECK ("arche"."sites"."country_iso2" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "arche"."sites" ADD CONSTRAINT "sites_latitude_range" CHECK ("arche"."sites"."latitude" between -90 and 90);--> statement-breakpoint
ALTER TABLE "arche"."sites" ADD CONSTRAINT "sites_longitude_range" CHECK ("arche"."sites"."longitude" between -180 and 180);--> statement-breakpoint
ALTER TABLE "arche"."sites" ADD CONSTRAINT "sites_coordinates_together" CHECK (("arche"."sites"."latitude" is null) = ("arche"."sites"."longitude" is null));--> statement-breakpoint
ALTER TABLE "arche"."subsidiaries" ADD CONSTRAINT "subsidiaries_code_shape" CHECK ("arche"."subsidiaries"."code" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "arche"."subsidiaries" ADD CONSTRAINT "subsidiaries_name_filled" CHECK (length(btrim("arche"."subsidiaries"."name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."subsidiaries" ADD CONSTRAINT "subsidiaries_country_shape" CHECK ("arche"."subsidiaries"."country_iso2" ~ '^[A-Z]{2}$');--> statement-breakpoint
ALTER TABLE "arche"."subsidiaries" ADD CONSTRAINT "subsidiaries_currency_shape" CHECK ("arche"."subsidiaries"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "arche"."users" ADD CONSTRAINT "users_email_shape" CHECK ("arche"."users"."email" = lower("arche"."users"."email") and "arche"."users"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+$');--> statement-breakpoint
ALTER TABLE "arche"."users" ADD CONSTRAINT "users_display_name_filled" CHECK (length(btrim("arche"."users"."display_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD CONSTRAINT "zones_code_shape" CHECK ("arche"."zones"."code" ~ '^[A-Z]{2,6}$');--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD CONSTRAINT "zones_name_filled" CHECK (length(btrim("arche"."zones"."name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD CONSTRAINT "zones_bounds_west_range" CHECK ("arche"."zones"."bounds_west" between -180 and 180);--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD CONSTRAINT "zones_bounds_east_range" CHECK ("arche"."zones"."bounds_east" between -180 and 180);--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD CONSTRAINT "zones_bounds_north_range" CHECK ("arche"."zones"."bounds_north" between -90 and 90);--> statement-breakpoint
ALTER TABLE "arche"."zones" ADD CONSTRAINT "zones_bounds_south_range" CHECK ("arche"."zones"."bounds_south" between -90 and 90);--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD CONSTRAINT "budget_lines_amount_non_negative" CHECK ("arche"."budget_lines"."amount_keur" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD CONSTRAINT "budget_lines_local_non_negative" CHECK ("arche"."budget_lines"."amount_local" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD CONSTRAINT "budget_lines_currency_shape" CHECK ("arche"."budget_lines"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD CONSTRAINT "budget_lines_rate_positive" CHECK ("arche"."budget_lines"."rate" > 0);--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD CONSTRAINT "budget_lines_currency_rate_together" CHECK ((("arche"."budget_lines"."currency" is null)::int + ("arche"."budget_lines"."rate" is null)::int) in (0, 2));--> statement-breakpoint
ALTER TABLE "arche"."budget_lines" ADD CONSTRAINT "budget_lines_local_has_currency" CHECK ("arche"."budget_lines"."amount_local" is null or "arche"."budget_lines"."currency" is not null);--> statement-breakpoint
ALTER TABLE "arche"."budget_versions" ADD CONSTRAINT "budget_versions_number_positive" CHECK ("arche"."budget_versions"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."budget_versions" ADD CONSTRAINT "budget_versions_class_domain" CHECK ("arche"."budget_versions"."estimate_class" in ('E50', 'E30', 'E10'));--> statement-breakpoint
ALTER TABLE "arche"."budget_versions" ADD CONSTRAINT "budget_versions_status_domain" CHECK ("arche"."budget_versions"."status" in ('draft', 'submitted', 'validated', 'superseded'));--> statement-breakpoint
ALTER TABLE "arche"."budget_versions" ADD CONSTRAINT "budget_versions_created_by_filled" CHECK (length(btrim("arche"."budget_versions"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_code_shape" CHECK ("arche"."capex"."code" ~ '^CPX-[A-Z]{3}-[0-9]{4}-[0-9]{2,}$');--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_code_of_subsidiary" CHECK (substr("arche"."capex"."code", 5, 4) = "arche"."capex"."subsidiary_code" || '-');--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_title_filled" CHECK (length(btrim("arche"."capex"."title")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_investment_type_domain" CHECK ("arche"."capex"."investment_type" in ('new_plant', 'new_line', 'extension', 'other'));--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_status_domain" CHECK ("arche"."capex"."status" in ('draft', 'active', 'on_hold', 'closed', 'abandoned'));--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_phase_domain" CHECK ("arche"."capex"."phase" in ('cadrage', 'avant_projet', 'execution', 'demarrage'));--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_typology_domain" CHECK ("arche"."capex"."typology" in ('light', 'strategic'));--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_typology_source_domain" CHECK ("arche"."capex"."typology_source" in ('computed', 'forced'));--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_typology_proposed_domain" CHECK ("arche"."capex"."typology_proposed" in ('light', 'strategic'));--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_forced_typology_reason" CHECK ("arche"."capex"."typology_source" is distinct from 'forced' or length(btrim("arche"."capex"."typology_reason")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."capex" ADD CONSTRAINT "capex_taken_over_together" CHECK ((("arche"."capex"."taken_over_at" is null)::int + ("arche"."capex"."taken_over_by_name" is null)::int) in (0, 2));--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD CONSTRAINT "capex_lots_number_positive" CHECK ("arche"."capex_lots"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD CONSTRAINT "capex_lots_kind_domain" CHECK ("arche"."capex_lots"."kind" in ('civil_works', 'buildings', 'utilities', 'vrd', 'land', 'machines', 'recruitment', 'other'));--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD CONSTRAINT "capex_lots_title_filled" CHECK (length(btrim("arche"."capex_lots"."title")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD CONSTRAINT "capex_lots_planned_start_shape" CHECK ("arche"."capex_lots"."planned_start" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD CONSTRAINT "capex_lots_planned_end_shape" CHECK ("arche"."capex_lots"."planned_end" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');--> statement-breakpoint
ALTER TABLE "arche"."capex_lots" ADD CONSTRAINT "capex_lots_planned_order" CHECK ("arche"."capex_lots"."planned_start" is null or "arche"."capex_lots"."planned_end" is null or "arche"."capex_lots"."planned_end" >= "arche"."capex_lots"."planned_start");--> statement-breakpoint
ALTER TABLE "arche"."capex_members" ADD CONSTRAINT "capex_members_role_domain" CHECK ("arche"."capex_members"."capex_role" in ('lead', 'controller', 'co_dig', 'epc2i_pmo', 'internal_client', 'member'));--> statement-breakpoint
ALTER TABLE "arche"."decisions" ADD CONSTRAINT "decisions_number_positive" CHECK ("arche"."decisions"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."decisions" ADD CONSTRAINT "decisions_body_domain" CHECK ("arche"."decisions"."body" in ('copil_projet', 'copil_gpi', 'dir_ig', 'ceo'));--> statement-breakpoint
ALTER TABLE "arche"."decisions" ADD CONSTRAINT "decisions_text_filled" CHECK (length(btrim("arche"."decisions"."text")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."decisions" ADD CONSTRAINT "decisions_recorded_by_filled" CHECK (length(btrim("arche"."decisions"."recorded_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."gate_conditions" ADD CONSTRAINT "gate_conditions_number_positive" CHECK ("arche"."gate_conditions"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."gate_conditions" ADD CONSTRAINT "gate_conditions_text_filled" CHECK (length(btrim("arche"."gate_conditions"."text")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."gate_criteria_results" ADD CONSTRAINT "gate_criteria_results_code_filled" CHECK (length(btrim("arche"."gate_criteria_results"."criterion_code")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."gate_criteria_results" ADD CONSTRAINT "gate_criteria_results_state_domain" CHECK ("arche"."gate_criteria_results"."state" in ('met', 'unmet', 'forced', 'not_evaluated'));--> statement-breakpoint
ALTER TABLE "arche"."gates" ADD CONSTRAINT "gates_code_domain" CHECK ("arche"."gates"."code" in ('G1', 'G2', 'K3', 'G3'));--> statement-breakpoint
ALTER TABLE "arche"."gates" ADD CONSTRAINT "gates_session_positive" CHECK ("arche"."gates"."session" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."gates" ADD CONSTRAINT "gates_status_domain" CHECK ("arche"."gates"."status" in ('open', 'submitted', 'in_review', 'decided', 'returned'));--> statement-breakpoint
ALTER TABLE "arche"."gates" ADD CONSTRAINT "gates_decision_domain" CHECK ("arche"."gates"."decision" in ('go', 'go_with_conditions', 'deferred', 'no_go'));--> statement-breakpoint
ALTER TABLE "arche"."gates" ADD CONSTRAINT "gates_decided_has_decision" CHECK ("arche"."gates"."status" <> 'decided' or "arche"."gates"."decision" is not null);--> statement-breakpoint
ALTER TABLE "arche"."lifecycle_models" ADD CONSTRAINT "lifecycle_models_code_filled" CHECK (length(btrim("arche"."lifecycle_models"."code")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."lifecycle_models" ADD CONSTRAINT "lifecycle_models_version_filled" CHECK (length(btrim("arche"."lifecycle_models"."version")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."lifecycle_models" ADD CONSTRAINT "lifecycle_models_updated_by_filled" CHECK (length(btrim("arche"."lifecycle_models"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."phase_transitions" ADD CONSTRAINT "phase_transitions_from_status_domain" CHECK ("arche"."phase_transitions"."from_status" in ('draft', 'active', 'on_hold', 'closed', 'abandoned'));--> statement-breakpoint
ALTER TABLE "arche"."phase_transitions" ADD CONSTRAINT "phase_transitions_from_phase_domain" CHECK ("arche"."phase_transitions"."from_phase" in ('cadrage', 'avant_projet', 'execution', 'demarrage'));--> statement-breakpoint
ALTER TABLE "arche"."phase_transitions" ADD CONSTRAINT "phase_transitions_to_status_domain" CHECK ("arche"."phase_transitions"."to_status" in ('draft', 'active', 'on_hold', 'closed', 'abandoned'));--> statement-breakpoint
ALTER TABLE "arche"."phase_transitions" ADD CONSTRAINT "phase_transitions_to_phase_domain" CHECK ("arche"."phase_transitions"."to_phase" in ('cadrage', 'avant_projet', 'execution', 'demarrage'));--> statement-breakpoint
ALTER TABLE "arche"."phase_transitions" ADD CONSTRAINT "phase_transitions_gate_domain" CHECK ("arche"."phase_transitions"."gate_code" in ('G1', 'G2', 'K3', 'G3'));--> statement-breakpoint
ALTER TABLE "arche"."phase_transitions" ADD CONSTRAINT "phase_transitions_by_filled" CHECK (length(btrim("arche"."phase_transitions"."by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."risks" ADD CONSTRAINT "risks_number_positive" CHECK ("arche"."risks"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."risks" ADD CONSTRAINT "risks_title_filled" CHECK (length(btrim("arche"."risks"."title")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."risks" ADD CONSTRAINT "risks_category_domain" CHECK ("arche"."risks"."category" in ('technical', 'schedule', 'cost', 'hse', 'regulatory', 'market', 'other'));--> statement-breakpoint
ALTER TABLE "arche"."risks" ADD CONSTRAINT "risks_probability_range" CHECK ("arche"."risks"."probability" between 1 and 4);--> statement-breakpoint
ALTER TABLE "arche"."risks" ADD CONSTRAINT "risks_impact_range" CHECK ("arche"."risks"."impact" between 1 and 4);--> statement-breakpoint
ALTER TABLE "arche"."risks" ADD CONSTRAINT "risks_status_domain" CHECK ("arche"."risks"."status" in ('open', 'mitigated', 'closed'));--> statement-breakpoint
ALTER TABLE "arche"."business_plans" ADD CONSTRAINT "business_plans_horizon_range" CHECK ("arche"."business_plans"."horizon_years" between 1 and 50);--> statement-breakpoint
ALTER TABLE "arche"."business_plans" ADD CONSTRAINT "business_plans_discount_range" CHECK ("arche"."business_plans"."discount_rate_pct" between 0 and 50);--> statement-breakpoint
ALTER TABLE "arche"."business_plans" ADD CONSTRAINT "business_plans_updated_by_filled" CHECK (length(btrim("arche"."business_plans"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_number_positive" CHECK ("arche"."changes"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_title_filled" CHECK (length(btrim("arche"."changes"."title")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_kind_domain" CHECK ("arche"."changes"."kind" in ('cost', 'schedule', 'scope', 'contingency_draw'));--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_delay_range" CHECK ("arche"."changes"."delay_days" between 0 and 3650);--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_status_domain" CHECK ("arche"."changes"."status" in ('submitted', 'approved', 'rejected'));--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_decider_domain" CHECK ("arche"."changes"."required_decider" in ('copil_projet', 'dir_ig', 'ceo'));--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_decided_dated" CHECK ("arche"."changes"."status" = 'submitted' or "arche"."changes"."decided_at" is not null);--> statement-breakpoint
ALTER TABLE "arche"."changes" ADD CONSTRAINT "changes_created_by_filled" CHECK (length(btrim("arche"."changes"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_position_non_negative" CHECK ("arche"."circuit_steps"."position" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_group_positive" CHECK ("arche"."circuit_steps"."group_no" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_kind_domain" CHECK ("arche"."circuit_steps"."kind" in ('opinion', 'review', 'visa', 'decision', 'signature', 'countersign', 'quitus', 'attestation'));--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_actor_domain" CHECK ("arche"."circuit_steps"."actor" in ('ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director', 'sponsor', 'project_lead', 'controller', 'co_dig', 'epc2i_pmo', 'expert', 'admin', 'internal_client'));--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_speciality_domain" CHECK ("arche"."circuit_steps"."speciality" in ('quality', 'hse', 'finance', 'operations'));--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_label_filled" CHECK (length(btrim("arche"."circuit_steps"."label")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_status_domain" CHECK ("arche"."circuit_steps"."status" in ('waiting', 'open', 'done', 'cancelled'));--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_outcome_domain" CHECK ("arche"."circuit_steps"."outcome" in ('favorable', 'reserved', 'unfavorable', 'noted', 'approved', 'refused', 'go', 'go_with_conditions', 'deferred', 'no_go'));--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_done_has_outcome" CHECK ("arche"."circuit_steps"."status" <> 'done' or "arche"."circuit_steps"."outcome" is not null);--> statement-breakpoint
ALTER TABLE "arche"."delegation_matrices" ADD CONSTRAINT "delegation_matrices_updated_by_filled" CHECK (length(btrim("arche"."delegation_matrices"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD CONSTRAINT "dossier_versions_number_positive" CHECK ("arche"."dossier_versions"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD CONSTRAINT "dossier_versions_state_domain" CHECK ("arche"."dossier_versions"."state" in ('draft', 'frozen', 'approved', 'rejected', 'superseded'));--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD CONSTRAINT "dossier_versions_completeness_range" CHECK ("arche"."dossier_versions"."completeness_pct" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD CONSTRAINT "dossier_versions_frozen_hashed" CHECK ("arche"."dossier_versions"."state" in ('draft', 'superseded') or ("arche"."dossier_versions"."content_hash" is not null and "arche"."dossier_versions"."frozen_at" is not null));--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD CONSTRAINT "dossier_versions_hash_shape" CHECK ("arche"."dossier_versions"."content_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD CONSTRAINT "dossier_versions_template_version_positive" CHECK ("arche"."dossier_versions"."template_version" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."dossier_versions" ADD CONSTRAINT "dossier_versions_created_by_filled" CHECK (length(btrim("arche"."dossier_versions"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."dossiers" ADD CONSTRAINT "dossiers_kind_domain" CHECK ("arche"."dossiers"."kind" in ('business_case', 'investment', 'transfer'));--> statement-breakpoint
ALTER TABLE "arche"."signature_requests" ADD CONSTRAINT "signature_requests_provider_domain" CHECK ("arche"."signature_requests"."provider" in ('simulation', 'yousign'));--> statement-breakpoint
ALTER TABLE "arche"."signature_requests" ADD CONSTRAINT "signature_requests_status_domain" CHECK ("arche"."signature_requests"."status" in ('creating', 'pending', 'completed', 'declined', 'expired', 'cancelled', 'failed'));--> statement-breakpoint
ALTER TABLE "arche"."signature_requests" ADD CONSTRAINT "signature_requests_statement_filled" CHECK (length(btrim("arche"."signature_requests"."statement")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."signature_requests" ADD CONSTRAINT "signature_requests_signer_name_filled" CHECK (length(btrim("arche"."signature_requests"."signer_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."signature_requests" ADD CONSTRAINT "signature_requests_completed_dated" CHECK ("arche"."signature_requests"."status" <> 'completed' or "arche"."signature_requests"."completed_at" is not null);--> statement-breakpoint
ALTER TABLE "arche"."signatures" ADD CONSTRAINT "signatures_level_domain" CHECK ("arche"."signatures"."level" in ('simple', 'advanced'));--> statement-breakpoint
ALTER TABLE "arche"."signatures" ADD CONSTRAINT "signatures_user_name_filled" CHECK (length(btrim("arche"."signatures"."user_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."signatures" ADD CONSTRAINT "signatures_statement_filled" CHECK (length(btrim("arche"."signatures"."statement")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."signatures" ADD CONSTRAINT "signatures_hash_shape" CHECK ("arche"."signatures"."content_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "arche"."keystone_sync" ADD CONSTRAINT "keystone_sync_source_domain" CHECK ("arche"."keystone_sync"."source" in ('views', 'simulation', 'off'));--> statement-breakpoint
ALTER TABLE "arche"."keystone_sync" ADD CONSTRAINT "keystone_sync_rows_non_negative" CHECK ("arche"."keystone_sync"."rows" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."machine_needs" ADD CONSTRAINT "machine_needs_number_positive" CHECK ("arche"."machine_needs"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."machine_needs" ADD CONSTRAINT "machine_needs_machine_named" CHECK ("arche"."machine_needs"."catalogue_code" is not null or length(btrim("arche"."machine_needs"."free_label")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."machine_needs" ADD CONSTRAINT "machine_needs_catalogue_version" CHECK (("arche"."machine_needs"."catalogue_code" is null) = ("arche"."machine_needs"."catalogue_version" is null));--> statement-breakpoint
ALTER TABLE "arche"."machine_needs" ADD CONSTRAINT "machine_needs_quantity_range" CHECK ("arche"."machine_needs"."quantity" between 1 and 99);--> statement-breakpoint
ALTER TABLE "arche"."machine_needs" ADD CONSTRAINT "machine_needs_capacity_non_negative" CHECK ("arche"."machine_needs"."target_capacity" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."machine_needs" ADD CONSTRAINT "machine_needs_status_domain" CHECK ("arche"."machine_needs"."status" in ('draft', 'submitted', 'withdrawn', 'ordered'));--> statement-breakpoint
ALTER TABLE "arche"."machine_needs" ADD CONSTRAINT "machine_needs_created_by_filled" CHECK (length(btrim("arche"."machine_needs"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."activity_events" ADD CONSTRAINT "activity_events_actor_filled" CHECK (length(btrim("arche"."activity_events"."actor_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."activity_events" ADD CONSTRAINT "activity_events_kind_filled" CHECK (length(btrim("arche"."activity_events"."kind")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."activity_events" ADD CONSTRAINT "activity_events_text_filled" CHECK (length(btrim("arche"."activity_events"."text")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."app_settings" ADD CONSTRAINT "app_settings_key_filled" CHECK (length(btrim("arche"."app_settings"."key")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."app_settings" ADD CONSTRAINT "app_settings_updated_by_filled" CHECK (length(btrim("arche"."app_settings"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."audit_entries" ADD CONSTRAINT "audit_entries_actor_filled" CHECK (length(btrim("arche"."audit_entries"."actor_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."audit_entries" ADD CONSTRAINT "audit_entries_object_filled" CHECK (length(btrim("arche"."audit_entries"."object_ref")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."audit_entries" ADD CONSTRAINT "audit_entries_change_filled" CHECK (length(btrim("arche"."audit_entries"."change")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."audit_entries" ADD CONSTRAINT "audit_entries_area_filled" CHECK (length(btrim("arche"."audit_entries"."area")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."job_runs" ADD CONSTRAINT "job_runs_last_status_domain" CHECK ("arche"."job_runs"."last_status" in ('ok', 'error'));--> statement-breakpoint
ALTER TABLE "arche"."authorizations" ADD CONSTRAINT "authorizations_number_positive" CHECK ("arche"."authorizations"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."authorizations" ADD CONSTRAINT "authorizations_kind_domain" CHECK ("arche"."authorizations"."kind" in ('icpe', 'building_permit', 'plu', 'atex', 'other'));--> statement-breakpoint
ALTER TABLE "arche"."authorizations" ADD CONSTRAINT "authorizations_title_filled" CHECK (length(btrim("arche"."authorizations"."title")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."authorizations" ADD CONSTRAINT "authorizations_status_domain" CHECK ("arche"."authorizations"."status" in ('to_file', 'filed', 'obtained', 'refused', 'not_required'));--> statement-breakpoint
ALTER TABLE "arche"."authorizations" ADD CONSTRAINT "authorizations_updated_by_filled" CHECK (length(btrim("arche"."authorizations"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."capex_snapshots" ADD CONSTRAINT "capex_snapshots_week_monday" CHECK (extract(isodow from "arche"."capex_snapshots"."week") = 1);--> statement-breakpoint
ALTER TABLE "arche"."capex_snapshots" ADD CONSTRAINT "capex_snapshots_status_domain" CHECK ("arche"."capex_snapshots"."status" in ('draft', 'active', 'on_hold', 'closed', 'abandoned'));--> statement-breakpoint
ALTER TABLE "arche"."capex_snapshots" ADD CONSTRAINT "capex_snapshots_phase_domain" CHECK ("arche"."capex_snapshots"."phase" in ('cadrage', 'avant_projet', 'execution', 'demarrage'));--> statement-breakpoint
ALTER TABLE "arche"."capex_snapshots" ADD CONSTRAINT "capex_snapshots_alerts_non_negative" CHECK ("arche"."capex_snapshots"."alerts" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."hs_statuses" ADD CONSTRAINT "hs_statuses_code_domain" CHECK ("arche"."hs_statuses"."hs_code" in ('HS2', 'HS3', 'HS4', 'PSSR', 'HS6'));--> statement-breakpoint
ALTER TABLE "arche"."hs_statuses" ADD CONSTRAINT "hs_statuses_status_domain" CHECK ("arche"."hs_statuses"."status" in ('not_started', 'in_progress', 'passed', 'waived'));--> statement-breakpoint
ALTER TABLE "arche"."hs_statuses" ADD CONSTRAINT "hs_statuses_source_domain" CHECK ("arche"."hs_statuses"."source" in ('declared', 'vigie'));--> statement-breakpoint
ALTER TABLE "arche"."hs_statuses" ADD CONSTRAINT "hs_statuses_updated_by_filled" CHECK (length(btrim("arche"."hs_statuses"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_month_shape" CHECK ("arche"."lot_actuals"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_committed_non_negative" CHECK ("arche"."lot_actuals"."committed_keur" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_spent_non_negative" CHECK ("arche"."lot_actuals"."spent_keur" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_physical_range" CHECK ("arche"."lot_actuals"."physical_pct" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_source_domain" CHECK ("arche"."lot_actuals"."source" in ('manual', 'import', 'keystone', 'sage'));--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_entered_by_filled" CHECK (length(btrim("arche"."lot_actuals"."entered_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_committed_local_non_negative" CHECK ("arche"."lot_actuals"."committed_local" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_spent_local_non_negative" CHECK ("arche"."lot_actuals"."spent_local" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_currency_shape" CHECK ("arche"."lot_actuals"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_rate_positive" CHECK ("arche"."lot_actuals"."rate" > 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_currency_rate_together" CHECK ((("arche"."lot_actuals"."currency" is null)::int + ("arche"."lot_actuals"."rate" is null)::int) in (0, 2));--> statement-breakpoint
ALTER TABLE "arche"."lot_actuals" ADD CONSTRAINT "lot_actuals_local_has_currency" CHECK (("arche"."lot_actuals"."committed_local" is null and "arche"."lot_actuals"."spent_local" is null) or "arche"."lot_actuals"."currency" is not null);--> statement-breakpoint
ALTER TABLE "arche"."pack_items" ADD CONSTRAINT "pack_items_code_filled" CHECK (length(btrim("arche"."pack_items"."item_code")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."pack_items" ADD CONSTRAINT "pack_items_status_domain" CHECK ("arche"."pack_items"."status" in ('expected', 'in_progress', 'validated', 'not_applicable'));--> statement-breakpoint
ALTER TABLE "arche"."pack_items" ADD CONSTRAINT "pack_items_updated_by_filled" CHECK (length(btrim("arche"."pack_items"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."reviews" ADD CONSTRAINT "reviews_number_positive" CHECK ("arche"."reviews"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."reviews" ADD CONSTRAINT "reviews_kind_domain" CHECK ("arche"."reviews"."kind" in ('copil_projet', 'audit'));--> statement-breakpoint
ALTER TABLE "arche"."reviews" ADD CONSTRAINT "reviews_phase_domain" CHECK ("arche"."reviews"."phase" in ('cadrage', 'avant_projet', 'execution', 'demarrage'));--> statement-breakpoint
ALTER TABLE "arche"."reviews" ADD CONSTRAINT "reviews_attendees_filled" CHECK (length(btrim("arche"."reviews"."attendees")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."reviews" ADD CONSTRAINT "reviews_summary_filled" CHECK (length(btrim("arche"."reviews"."summary")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."reviews" ADD CONSTRAINT "reviews_recorded_by_filled" CHECK (length(btrim("arche"."reviews"."recorded_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."vigie_studies" ADD CONSTRAINT "vigie_studies_ref_filled" CHECK (length(btrim("arche"."vigie_studies"."ref")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."vigie_sync" ADD CONSTRAINT "vigie_sync_source_domain" CHECK ("arche"."vigie_sync"."source" in ('views', 'simulation', 'off'));--> statement-breakpoint
ALTER TABLE "arche"."vigie_sync" ADD CONSTRAINT "vigie_sync_rows_non_negative" CHECK ("arche"."vigie_sync"."rows" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."closure_statements" ADD CONSTRAINT "closure_statements_entered_by_filled" CHECK (length(btrim("arche"."closure_statements"."entered_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."production_lines" ADD CONSTRAINT "production_lines_number_positive" CHECK ("arche"."production_lines"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."production_lines" ADD CONSTRAINT "production_lines_name_filled" CHECK (length(btrim("arche"."production_lines"."name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."production_lines" ADD CONSTRAINT "production_lines_nominal_positive" CHECK ("arche"."production_lines"."nominal_per_day" > 0);--> statement-breakpoint
ALTER TABLE "arche"."production_lines" ADD CONSTRAINT "production_lines_unit_filled" CHECK (length(btrim("arche"."production_lines"."unit")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."production_lines" ADD CONSTRAINT "production_lines_scrap_target_range" CHECK ("arche"."production_lines"."scrap_target_pct" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."production_lines" ADD CONSTRAINT "production_lines_rampup_status_domain" CHECK ("arche"."production_lines"."rampup_status" in ('en_cours', 'atteint', 'hors_delai'));--> statement-breakpoint
ALTER TABLE "arche"."production_lines" ADD CONSTRAINT "production_lines_updated_by_filled" CHECK (length(btrim("arche"."production_lines"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_output_non_negative" CHECK ("arche"."rampup_days"."output" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_availability_range" CHECK ("arche"."rampup_days"."availability_pct" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_performance_range" CHECK ("arche"."rampup_days"."performance_pct" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_quality_range" CHECK ("arche"."rampup_days"."quality_pct" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_oee_range" CHECK ("arche"."rampup_days"."oee_pct" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_scrap_range" CHECK ("arche"."rampup_days"."scrap_pct" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_source_domain" CHECK ("arche"."rampup_days"."source" in ('manual', 'import'));--> statement-breakpoint
ALTER TABLE "arche"."rampup_days" ADD CONSTRAINT "rampup_days_entered_by_filled" CHECK (length(btrim("arche"."rampup_days"."entered_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."rex_entries" ADD CONSTRAINT "rex_entries_number_positive" CHECK ("arche"."rex_entries"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."rex_entries" ADD CONSTRAINT "rex_entries_phase_domain" CHECK ("arche"."rex_entries"."phase" in ('cadrage', 'avant_projet', 'execution', 'demarrage'));--> statement-breakpoint
ALTER TABLE "arche"."rex_entries" ADD CONSTRAINT "rex_entries_category_domain" CHECK ("arche"."rex_entries"."category" in ('technical', 'schedule', 'cost', 'hse', 'organisation', 'supplier', 'regulatory', 'other'));--> statement-breakpoint
ALTER TABLE "arche"."rex_entries" ADD CONSTRAINT "rex_entries_title_filled" CHECK (length(btrim("arche"."rex_entries"."title")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."rex_entries" ADD CONSTRAINT "rex_entries_text_filled" CHECK (length(btrim("arche"."rex_entries"."text")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."rex_entries" ADD CONSTRAINT "rex_entries_author_filled" CHECK (length(btrim("arche"."rex_entries"."author_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."kpi_baselines" ADD CONSTRAINT "kpi_baselines_key_domain" CHECK ("arche"."kpi_baselines"."key" in ('delay:G1', 'delay:G2', 'delay:K3', 'delay:G3', 'documents', 'traced'));--> statement-breakpoint
ALTER TABLE "arche"."kpi_baselines" ADD CONSTRAINT "kpi_baselines_value_non_negative" CHECK ("arche"."kpi_baselines"."value" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."kpi_baselines" ADD CONSTRAINT "kpi_baselines_share_at_most_100" CHECK ("arche"."kpi_baselines"."key" <> 'traced' or "arche"."kpi_baselines"."value" <= 100);--> statement-breakpoint
ALTER TABLE "arche"."kpi_baselines" ADD CONSTRAINT "kpi_baselines_entered_by_filled" CHECK (length(btrim("arche"."kpi_baselines"."entered_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."capex_actions" ADD CONSTRAINT "capex_actions_number_positive" CHECK ("arche"."capex_actions"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."capex_actions" ADD CONSTRAINT "capex_actions_title_filled" CHECK (length(btrim("arche"."capex_actions"."title")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."capex_actions" ADD CONSTRAINT "capex_actions_source_domain" CHECK ("arche"."capex_actions"."source" in ('general', 'gate', 'dossier', 'budget', 'change', 'governance', 'machines', 'pack', 'permits', 'execution', 'risk', 'safety', 'rampup'));--> statement-breakpoint
ALTER TABLE "arche"."capex_actions" ADD CONSTRAINT "capex_actions_status_domain" CHECK ("arche"."capex_actions"."status" in ('open', 'done', 'cancelled'));--> statement-breakpoint
ALTER TABLE "arche"."capex_actions" ADD CONSTRAINT "capex_actions_closed_dated" CHECK (("arche"."capex_actions"."status" = 'open') = ("arche"."capex_actions"."closed_on" is null));--> statement-breakpoint
ALTER TABLE "arche"."capex_actions" ADD CONSTRAINT "capex_actions_cancel_reason" CHECK ("arche"."capex_actions"."status" <> 'cancelled' or length(btrim("arche"."capex_actions"."closing_note")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."capex_actions" ADD CONSTRAINT "capex_actions_created_by_filled" CHECK (length(btrim("arche"."capex_actions"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."wbs_tasks" ADD CONSTRAINT "wbs_tasks_number_positive" CHECK ("arche"."wbs_tasks"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."wbs_tasks" ADD CONSTRAINT "wbs_tasks_name_filled" CHECK (length(btrim("arche"."wbs_tasks"."name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."wbs_tasks" ADD CONSTRAINT "wbs_tasks_dates_order" CHECK ("arche"."wbs_tasks"."end_on" >= "arche"."wbs_tasks"."start_on");--> statement-breakpoint
ALTER TABLE "arche"."wbs_tasks" ADD CONSTRAINT "wbs_tasks_progress_range" CHECK ("arche"."wbs_tasks"."progress_pct" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."wbs_tasks" ADD CONSTRAINT "wbs_tasks_milestone_one_day" CHECK (not "arche"."wbs_tasks"."milestone" or "arche"."wbs_tasks"."end_on" = "arche"."wbs_tasks"."start_on");--> statement-breakpoint
ALTER TABLE "arche"."wbs_tasks" ADD CONSTRAINT "wbs_tasks_updated_by_filled" CHECK (length(btrim("arche"."wbs_tasks"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."api_clients" ADD CONSTRAINT "api_clients_name_filled" CHECK (length(btrim("arche"."api_clients"."name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."api_clients" ADD CONSTRAINT "api_clients_key_hash_shape" CHECK ("arche"."api_clients"."key_hash" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "arche"."api_clients" ADD CONSTRAINT "api_clients_created_by_filled" CHECK (length(btrim("arche"."api_clients"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_domain" CHECK ("arche"."webhook_deliveries"."event" in ('capex.opened', 'gate.decided', 'alert.raised'));--> statement-breakpoint
ALTER TABLE "arche"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_status_domain" CHECK ("arche"."webhook_deliveries"."status" in ('pending', 'sent', 'failed'));--> statement-breakpoint
ALTER TABLE "arche"."webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_attempts_non_negative" CHECK ("arche"."webhook_deliveries"."attempts" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_url_shape" CHECK ("arche"."webhook_subscriptions"."url" ~ '^https?://');--> statement-breakpoint
ALTER TABLE "arche"."webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_events_known" CHECK (cardinality("arche"."webhook_subscriptions"."events") > 0 and "arche"."webhook_subscriptions"."events" <@ array['capex.opened', 'gate.decided', 'alert.raised']::text[]);--> statement-breakpoint
ALTER TABLE "arche"."asset_classes" ADD CONSTRAINT "asset_classes_code_shape" CHECK ("arche"."asset_classes"."code" ~ '^[A-Z0-9_-]{2,12}$');--> statement-breakpoint
ALTER TABLE "arche"."asset_classes" ADD CONSTRAINT "asset_classes_label_filled" CHECK (length(btrim("arche"."asset_classes"."label")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."asset_classes" ADD CONSTRAINT "asset_classes_life_range" CHECK ("arche"."asset_classes"."life_years" between 1 and 60);--> statement-breakpoint
ALTER TABLE "arche"."asset_classes" ADD CONSTRAINT "asset_classes_method_domain" CHECK ("arche"."asset_classes"."method" in ('linear', 'declining'));--> statement-breakpoint
ALTER TABLE "arche"."asset_classes" ADD CONSTRAINT "asset_classes_declining_factor" CHECK ("arche"."asset_classes"."method" <> 'declining' or "arche"."asset_classes"."factor" between 1 and 3);--> statement-breakpoint
ALTER TABLE "arche"."envelope_movements" ADD CONSTRAINT "envelope_movements_kind_domain" CHECK ("arche"."envelope_movements"."kind" in ('carry_over', 'reallocation'));--> statement-breakpoint
ALTER TABLE "arche"."envelope_movements" ADD CONSTRAINT "envelope_movements_amount_positive" CHECK ("arche"."envelope_movements"."amount_keur" > 0);--> statement-breakpoint
ALTER TABLE "arche"."envelope_movements" ADD CONSTRAINT "envelope_movements_distinct" CHECK ("arche"."envelope_movements"."from_envelope_id" is distinct from "arche"."envelope_movements"."to_envelope_id");--> statement-breakpoint
ALTER TABLE "arche"."envelope_movements" ADD CONSTRAINT "envelope_movements_reason_filled" CHECK (length(btrim("arche"."envelope_movements"."reason")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."envelope_movements" ADD CONSTRAINT "envelope_movements_by_filled" CHECK (length(btrim("arche"."envelope_movements"."by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."envelopes" ADD CONSTRAINT "envelopes_year_range" CHECK ("arche"."envelopes"."fiscal_year" between 2020 and 2100);--> statement-breakpoint
ALTER TABLE "arche"."envelopes" ADD CONSTRAINT "envelopes_one_scope" CHECK ("arche"."envelopes"."zone_code" is null or "arche"."envelopes"."subsidiary_code" is null);--> statement-breakpoint
ALTER TABLE "arche"."envelopes" ADD CONSTRAINT "envelopes_category_domain" CHECK ("arche"."envelopes"."category" in ('all', 'light', 'strategic'));--> statement-breakpoint
ALTER TABLE "arche"."envelopes" ADD CONSTRAINT "envelopes_amount_non_negative" CHECK ("arche"."envelopes"."amount_keur" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."envelopes" ADD CONSTRAINT "envelopes_created_by_filled" CHECK (length(btrim("arche"."envelopes"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_life_range" CHECK ("arche"."fixed_asset_transfers"."life_years" between 1 and 60);--> statement-breakpoint
ALTER TABLE "arche"."fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_method_domain" CHECK ("arche"."fixed_asset_transfers"."method" in ('linear', 'declining'));--> statement-breakpoint
ALTER TABLE "arche"."fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_declining_factor" CHECK ("arche"."fixed_asset_transfers"."method" <> 'declining' or "arche"."fixed_asset_transfers"."factor" between 1 and 3);--> statement-breakpoint
ALTER TABLE "arche"."fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_amount_non_negative" CHECK ("arche"."fixed_asset_transfers"."amount_keur" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."fixed_asset_transfers" ADD CONSTRAINT "fixed_asset_transfers_by_filled" CHECK (length(btrim("arche"."fixed_asset_transfers"."transferred_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_forecasts" ADD CONSTRAINT "lot_forecasts_month_shape" CHECK ("arche"."lot_forecasts"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');--> statement-breakpoint
ALTER TABLE "arche"."lot_forecasts" ADD CONSTRAINT "lot_forecasts_amount_non_negative" CHECK ("arche"."lot_forecasts"."amount_keur" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_forecasts" ADD CONSTRAINT "lot_forecasts_local_non_negative" CHECK ("arche"."lot_forecasts"."amount_local" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_forecasts" ADD CONSTRAINT "lot_forecasts_currency_shape" CHECK ("arche"."lot_forecasts"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "arche"."lot_forecasts" ADD CONSTRAINT "lot_forecasts_rate_positive" CHECK ("arche"."lot_forecasts"."rate" > 0);--> statement-breakpoint
ALTER TABLE "arche"."lot_forecasts" ADD CONSTRAINT "lot_forecasts_currency_rate_together" CHECK ((("arche"."lot_forecasts"."currency" is null)::int + ("arche"."lot_forecasts"."rate" is null)::int) in (0, 2));--> statement-breakpoint
ALTER TABLE "arche"."lot_forecasts" ADD CONSTRAINT "lot_forecasts_local_has_currency" CHECK ("arche"."lot_forecasts"."amount_local" is null or "arche"."lot_forecasts"."currency" is not null);--> statement-breakpoint
ALTER TABLE "arche"."lot_forecasts" ADD CONSTRAINT "lot_forecasts_entered_by_filled" CHECK (length(btrim("arche"."lot_forecasts"."entered_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."capex_scores" ADD CONSTRAINT "capex_scores_criterion_domain" CHECK ("arche"."capex_scores"."criterion_code" in ('strategy', 'urgency', 'safety'));--> statement-breakpoint
ALTER TABLE "arche"."capex_scores" ADD CONSTRAINT "capex_scores_score_range" CHECK ("arche"."capex_scores"."score" between 0 and 5);--> statement-breakpoint
ALTER TABLE "arche"."capex_scores" ADD CONSTRAINT "capex_scores_scored_by_filled" CHECK (length(btrim("arche"."capex_scores"."scored_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."portfolio_scenarios" ADD CONSTRAINT "portfolio_scenarios_name_filled" CHECK (length(btrim("arche"."portfolio_scenarios"."name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."portfolio_scenarios" ADD CONSTRAINT "portfolio_scenarios_kind_domain" CHECK ("arche"."portfolio_scenarios"."kind" in ('base', 'constrained', 'growth', 'other'));--> statement-breakpoint
ALTER TABLE "arche"."portfolio_scenarios" ADD CONSTRAINT "portfolio_scenarios_created_by_filled" CHECK (length(btrim("arche"."portfolio_scenarios"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."scoring_weights" ADD CONSTRAINT "scoring_weights_code_domain" CHECK ("arche"."scoring_weights"."code" in ('value', 'return', 'risk', 'strategy', 'urgency', 'safety'));--> statement-breakpoint
ALTER TABLE "arche"."scoring_weights" ADD CONSTRAINT "scoring_weights_weight_range" CHECK ("arche"."scoring_weights"."weight" between 0 and 100);--> statement-breakpoint
ALTER TABLE "arche"."scoring_weights" ADD CONSTRAINT "scoring_weights_updated_by_filled" CHECK (length(btrim("arche"."scoring_weights"."updated_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."absences" ADD CONSTRAINT "absences_dates_order" CHECK ("arche"."absences"."to_on" >= "arche"."absences"."from_on");--> statement-breakpoint
ALTER TABLE "arche"."absences" ADD CONSTRAINT "absences_delegate_other" CHECK ("arche"."absences"."delegate_user_id" <> "arche"."absences"."user_id");--> statement-breakpoint
ALTER TABLE "arche"."absences" ADD CONSTRAINT "absences_created_by_filled" CHECK (length(btrim("arche"."absences"."created_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."email_outbox" ADD CONSTRAINT "email_outbox_key_filled" CHECK (length(btrim("arche"."email_outbox"."key")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."email_outbox" ADD CONSTRAINT "email_outbox_to_shape" CHECK ("arche"."email_outbox"."to_email" ~ '^[^@[:space:]]+@[^@[:space:]]+$');--> statement-breakpoint
ALTER TABLE "arche"."email_outbox" ADD CONSTRAINT "email_outbox_subject_filled" CHECK (length(btrim("arche"."email_outbox"."subject")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."email_outbox" ADD CONSTRAINT "email_outbox_status_domain" CHECK ("arche"."email_outbox"."status" in ('pending', 'sent', 'held', 'failed'));--> statement-breakpoint
ALTER TABLE "arche"."email_outbox" ADD CONSTRAINT "email_outbox_attempts_non_negative" CHECK ("arche"."email_outbox"."attempts" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."email_outbox" ADD CONSTRAINT "email_outbox_sent_dated" CHECK ("arche"."email_outbox"."status" <> 'sent' or "arche"."email_outbox"."sent_at" is not null);--> statement-breakpoint
ALTER TABLE "arche"."designs" ADD CONSTRAINT "designs_kind_domain" CHECK ("arche"."designs"."kind" in ('dossier', 'circuit'));--> statement-breakpoint
ALTER TABLE "arche"."designs" ADD CONSTRAINT "designs_state_domain" CHECK ("arche"."designs"."state" in ('draft', 'published', 'retired'));--> statement-breakpoint
ALTER TABLE "arche"."designs" ADD CONSTRAINT "designs_version_positive" CHECK ("arche"."designs"."version" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."designs" ADD CONSTRAINT "designs_target_of_kind" CHECK (("arche"."designs"."kind" = 'dossier' and "arche"."designs"."target" in ('business_case', 'investment', 'transfer')) or ("arche"."designs"."kind" = 'circuit' and "arche"."designs"."target" in ('G1', 'G2', 'K3', 'G3')));--> statement-breakpoint
ALTER TABLE "arche"."designs" ADD CONSTRAINT "designs_published_dated" CHECK ("arche"."designs"."state" = 'draft' or "arche"."designs"."published_at" is not null);--> statement-breakpoint
ALTER TABLE "arche"."benefit_actuals" ADD CONSTRAINT "benefit_actuals_year_positive" CHECK ("arche"."benefit_actuals"."year" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."benefit_actuals" ADD CONSTRAINT "benefit_actuals_revenue_non_negative" CHECK ("arche"."benefit_actuals"."revenue_keur" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."benefit_actuals" ADD CONSTRAINT "benefit_actuals_opex_non_negative" CHECK ("arche"."benefit_actuals"."opex_keur" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."benefit_actuals" ADD CONSTRAINT "benefit_actuals_entered_by_filled" CHECK (length(btrim("arche"."benefit_actuals"."entered_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_number_positive" CHECK ("arche"."ideas"."number" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_title_filled" CHECK (length(btrim("arche"."ideas"."title")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_stake_filled" CHECK (length(btrim("arche"."ideas"."stake")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_size_non_negative" CHECK ("arche"."ideas"."size_keur" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_investment_type_domain" CHECK ("arche"."ideas"."investment_type" in ('new_plant', 'new_line', 'extension', 'other'));--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_status_domain" CHECK ("arche"."ideas"."status" in ('new', 'qualified', 'retained', 'rejected', 'converted'));--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_converted_has_capex" CHECK ("arche"."ideas"."status" <> 'converted' or "arche"."ideas"."capex_id" is not null);--> statement-breakpoint
ALTER TABLE "arche"."ideas" ADD CONSTRAINT "ideas_proposed_by_filled" CHECK (length(btrim("arche"."ideas"."proposed_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."post_audits" ADD CONSTRAINT "post_audits_milestone_domain" CHECK ("arche"."post_audits"."milestone" in (6, 12, 24));--> statement-breakpoint
ALTER TABLE "arche"."post_audits" ADD CONSTRAINT "post_audits_conclusion_domain" CHECK ("arche"."post_audits"."conclusion" in ('above', 'on_track', 'below'));--> statement-breakpoint
ALTER TABLE "arche"."post_audits" ADD CONSTRAINT "post_audits_summary_filled" CHECK (length(btrim("arche"."post_audits"."summary")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."post_audits" ADD CONSTRAINT "post_audits_recorded_by_filled" CHECK (length(btrim("arche"."post_audits"."recorded_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."sage_imports" ADD CONSTRAINT "sage_imports_source_domain" CHECK ("arche"."sage_imports"."source" in ('upload', 'folder', 'demo'));--> statement-breakpoint
ALTER TABLE "arche"."sage_imports" ADD CONSTRAINT "sage_imports_counts" CHECK ("arche"."sage_imports"."accepted" >= 0 and "arche"."sage_imports"."duplicates" >= 0 and "arche"."sage_imports"."rejected" >= 0 and "arche"."sage_imports"."lines" >= 0);--> statement-breakpoint
ALTER TABLE "arche"."sage_imports" ADD CONSTRAINT "sage_imports_by_filled" CHECK (length(btrim("arche"."sage_imports"."imported_by_name")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."sage_lines" ADD CONSTRAINT "sage_lines_key_filled" CHECK (length(btrim("arche"."sage_lines"."key")) > 0);--> statement-breakpoint
ALTER TABLE "arche"."sage_lines" ADD CONSTRAINT "sage_lines_kind_domain" CHECK ("arche"."sage_lines"."kind" in ('order', 'invoice', 'credit'));--> statement-breakpoint
ALTER TABLE "arche"."sage_lines" ADD CONSTRAINT "sage_lines_currency_shape" CHECK ("arche"."sage_lines"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "arche"."sage_rejects" ADD CONSTRAINT "sage_rejects_line_positive" CHECK ("arche"."sage_rejects"."line_no" >= 1);--> statement-breakpoint
ALTER TABLE "arche"."sage_rejects" ADD CONSTRAINT "sage_rejects_reason_filled" CHECK (length(btrim("arche"."sage_rejects"."reason")) > 0);