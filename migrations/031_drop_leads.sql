-- Drop the leads CRM feature (no longer used).
DROP POLICY IF EXISTS leads_select_own ON leads;
DROP POLICY IF EXISTS leads_insert_own ON leads;
DROP POLICY IF EXISTS leads_update_own ON leads;
DROP POLICY IF EXISTS leads_delete_own ON leads;
DROP TABLE IF EXISTS leads;
