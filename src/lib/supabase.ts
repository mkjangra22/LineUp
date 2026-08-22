import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://wdadebqxntvoealbqyiv.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_dummy_key_placeholder";

if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    "[Supabase] VITE_SUPABASE_PUBLISHABLE_KEY is not configured in .env. Please add your key to connect to live backend."
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
