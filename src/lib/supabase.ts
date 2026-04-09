import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cvcduziadxjwpaenwlsn.supabase.co";
const SUPABASE_ANON_KEY =
  "sb_publishable_5VxHHfgsmB5TuE1gSKSn8w_maemiQl7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
