-- db/2026-09-09-omspro-branding.sql — subscriber company logo upload.
-- "jo banda iska subscription lega vo apni company ke sath sath logo bhi
-- laga sakega" (2026-09-09): every subscriber company brands the dashboard
-- with ITS OWN logo. The OMS Pro logo stays on all public/marketing pages
-- and on every exported file ("Powered by OMS Pro" line) — that platform
-- branding is NOT distributed to the subscriber; only their own logo shows
-- in their workspace UI (dashboard header + printed invoices already read
-- companies.logo_url).
--
-- Public bucket, same pattern as employee-photos (db/2026-08-22): reads
-- render directly in the UI; writes go ONLY through the server action
-- (service-role client, gated on the caller being the company's admin).
--
-- Idempotent — safe to run again.
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;
