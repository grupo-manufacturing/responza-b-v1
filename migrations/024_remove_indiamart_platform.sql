DELETE FROM integrations WHERE platform = 'indiamart';

ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_platform_check;
ALTER TABLE integrations
  ADD CONSTRAINT integrations_platform_check
  CHECK (platform IN ('whatsapp', 'instagram'));

ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_platform_check;
ALTER TABLE channels
  ADD CONSTRAINT channels_platform_check
  CHECK (platform IN ('whatsapp', 'instagram'));
