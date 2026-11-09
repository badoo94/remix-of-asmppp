import { useEffect, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Client-only session hook (the session lives in browser storage). */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return { session, user: session?.user ?? null, ready };
}

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  is_premium: boolean;
  created_at: string;
};

export const accessQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["access", userId ?? "anon"],
    enabled: true,
    queryFn: async () => {
      if (!userId) return { profile: null as Profile | null, isAdmin: false, isPremium: false };
      const [{ data: profile }, { data: isAdmin }] = await Promise.all([
        supabase.from("profiles").select("id,email,display_name,is_premium,created_at").eq("id", userId).maybeSingle(),
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      ]);
      const admin = Boolean(isAdmin);
      return {
        profile: (profile ?? null) as Profile | null,
        isAdmin: admin,
        isPremium: Boolean(profile?.is_premium) || admin,
      };
    },
  });

/** Verifies on every visit whether the visitor is premium (FREE when signed out). */
export function useAccess() {
  const { user, ready } = useSession();
  const q = useQuery({ ...accessQuery(user?.id), enabled: ready });
  return {
    user,
    ready: ready && !q.isLoading,
    profile: q.data?.profile ?? null,
    isAdmin: q.data?.isAdmin ?? false,
    isPremium: q.data?.isPremium ?? false,
    refetch: q.refetch,
  };
}
