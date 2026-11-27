ALTER TABLE "arche"."capex_lots" RENAME COLUMN "epc2i" TO "from_keystone";--> statement-breakpoint
ALTER TABLE "arche"."capex_snapshots" RENAME COLUMN "epc2i_pack_pct" TO "keystone_pack_pct";--> statement-breakpoint
ALTER TABLE "arche"."role_assignments" DROP CONSTRAINT "role_assignments_role_domain";--> statement-breakpoint
ALTER TABLE "arche"."users" DROP CONSTRAINT "users_granted_roles_known";--> statement-breakpoint
ALTER TABLE "arche"."capex_members" DROP CONSTRAINT "capex_members_role_domain";--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" DROP CONSTRAINT "circuit_steps_actor_domain";--> statement-breakpoint
-- Atrium rename of the stored identifiers (hand-added data, between the drop and the re-creation of the domain checks):
-- role key epc2i_pmo -> engineering_pmo, gate criterion g2_epc2i_offers -> g2_keystone_offers. The append-only journals
-- (audit_entries, signatures), the frozen dossier versions (hashed content) and the webhook outbox keep what they recorded.
UPDATE "arche"."role_assignments" SET "role" = 'engineering_pmo' WHERE "role" = 'epc2i_pmo';--> statement-breakpoint
UPDATE "arche"."users" SET "granted_roles" = array_replace("granted_roles", 'epc2i_pmo', 'engineering_pmo') WHERE 'epc2i_pmo' = ANY("granted_roles");--> statement-breakpoint
UPDATE "arche"."capex_members" SET "capex_role" = 'engineering_pmo' WHERE "capex_role" = 'epc2i_pmo';--> statement-breakpoint
UPDATE "arche"."circuit_steps" SET "actor" = 'engineering_pmo' WHERE "actor" = 'epc2i_pmo';--> statement-breakpoint
UPDATE "arche"."designs" SET "definition" = replace("definition"::text, '"epc2i_pmo"', '"engineering_pmo"')::jsonb WHERE "definition"::text LIKE '%"epc2i\_pmo"%';--> statement-breakpoint
UPDATE "arche"."delegation_matrices" SET "definition" = replace("definition"::text, '"epc2i_pmo"', '"engineering_pmo"')::jsonb WHERE "definition"::text LIKE '%"epc2i\_pmo"%';--> statement-breakpoint
UPDATE "arche"."lifecycle_models" SET "definition" = replace("definition"::text, '"g2_epc2i_offers"', '"g2_keystone_offers"')::jsonb WHERE "definition"::text LIKE '%"g2\_epc2i\_offers"%';--> statement-breakpoint
UPDATE "arche"."gate_criteria_results" SET "criterion_code" = 'g2_keystone_offers' WHERE "criterion_code" = 'g2_epc2i_offers';--> statement-breakpoint
UPDATE "arche"."signature_requests" SET "input" = replace("input"::text, '"g2_epc2i_offers"', '"g2_keystone_offers"')::jsonb WHERE "input"::text LIKE '%"g2\_epc2i\_offers"%';--> statement-breakpoint
ALTER TABLE "arche"."role_assignments" ADD CONSTRAINT "role_assignments_role_domain" CHECK ("arche"."role_assignments"."role" in ('ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director', 'sponsor', 'project_lead', 'controller', 'co_dig', 'engineering_pmo', 'expert', 'admin'));--> statement-breakpoint
ALTER TABLE "arche"."users" ADD CONSTRAINT "users_granted_roles_known" CHECK ("arche"."users"."granted_roles" is null or "arche"."users"."granted_roles" <@ array['ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director', 'sponsor', 'project_lead', 'controller', 'co_dig', 'engineering_pmo', 'expert', 'admin']::text[]);--> statement-breakpoint
ALTER TABLE "arche"."capex_members" ADD CONSTRAINT "capex_members_role_domain" CHECK ("arche"."capex_members"."capex_role" in ('lead', 'controller', 'co_dig', 'engineering_pmo', 'internal_client', 'member'));--> statement-breakpoint
ALTER TABLE "arche"."circuit_steps" ADD CONSTRAINT "circuit_steps_actor_domain" CHECK ("arche"."circuit_steps"."actor" in ('ceo', 'dir_ig', 'group_cfo', 'group_hse', 'copil_member', 'zone_director', 'sponsor', 'project_lead', 'controller', 'co_dig', 'engineering_pmo', 'expert', 'admin', 'internal_client'));