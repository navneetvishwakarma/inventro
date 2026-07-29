-- S-05: private Storage bucket for uploaded receipt files.
-- storage.objects has RLS enabled by default with zero policies here, so
-- anon/authenticated get no access at all — only the service-role key
-- (server-side only, ADR-0004) can read/write. No public URL, ever
-- (ADR-0005, 06-security.md); the app generates 60s-TTL signed URLs on
-- demand instead.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false);
