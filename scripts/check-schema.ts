/**
 * Check Supabase schema
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fyktnfziqyjbrrzszzuz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5a3RuZnppcXlqYnJyenN6enV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzIwNzQyNiwiZXhwIjoyMDc4NzgzNDI2fQ.cf5FqnEcmx6YTLswdiQ3cB_lWoxv3j9M9q4IZwH_oCU';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // List tables - try to select from information_schema
  const { data: tables, error: tablesError } = await supabase
    .rpc('get_tables');

  if (tablesError) {
    console.log('Could not list tables via RPC, trying direct query...');

    // Try to query projects table structure
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .limit(1);

    if (projectError) {
      console.log('Projects table error:', projectError);
    } else {
      console.log('Projects table exists. Sample:', projectData);
    }
  } else {
    console.log('Tables:', tables);
  }
}

main().catch(console.error);
