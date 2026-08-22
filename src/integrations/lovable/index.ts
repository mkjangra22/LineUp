import { supabase } from "@/integrations/supabase/client";

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "github" | "apple" | string,
      options?: { redirect_uri?: string }
    ) => {
      try {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: provider as any,
          options: {
            redirectTo: options?.redirect_uri || window.location.origin,
          },
        });
        if (error) {
          return { error, redirected: false };
        }
        return { data, error: null, redirected: true };
      } catch (err) {
        return { error: err, redirected: false };
      }
    },
  },
};
