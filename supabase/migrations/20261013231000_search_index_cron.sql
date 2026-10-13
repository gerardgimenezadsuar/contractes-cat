-- Scheduling for the search index sync. Secrets are read from Vault:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<anon key>', 'anon_key');
--   select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'search_sync_token');
-- The Edge Function runs one step per call and decides itself whether a new
-- run is due (at most one full refresh every 20 hours).
select cron.schedule(
  'search-index-sync',
  '*/2 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-search-index',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-sync-token', (select decrypted_secret from vault.decrypted_secrets where name = 'search_sync_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 140000
  ) as request_id;
  $job$
);
