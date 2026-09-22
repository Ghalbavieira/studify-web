"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useStudyData } from "@/lib/study-store";
import { FREE_CAPABILITIES, mergeCapabilities, type Capability } from "@/lib/entitlements";
export type { Capability } from "@/lib/entitlements";
export type PlanState = { plan: "free" | "pro"; status: "free" | "active" | "trialing"; loading: boolean; error?: string; trialDaysRemaining: number; billingStatus?: string; expiresAt?: string | null; capabilities: Partial<Record<Capability, boolean>> };
const initial: PlanState = { plan: "free", status: "free", loading: true, trialDaysRemaining: 0, capabilities: FREE_CAPABILITIES };
export function usePlan() {
  const { mode, userId } = useStudyData();
  const [state, setState] = useState<PlanState>(initial);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    if (mode !== "cloud" || !userId) { setState({ ...initial, loading: false }); return; }
    try {
      const { data, error } = await getSupabaseClient().rpc("get_entitlement");
      if (error || data?.version !== 1 || !data.capabilities || !["free", "pro"].includes(data.plan)) throw error ?? new Error("Plano indisponível");
      if (version === generation.current) setState({ ...data, capabilities: mergeCapabilities(data.capabilities), loading: false });
    } catch { if (version === generation.current) setState({ ...initial, loading: false, error: "Não foi possível consultar seu plano. Tente atualizar." }); }
  }, [mode, userId]);
  useEffect(() => { const ref = generation;
    const timer = setTimeout(() => void refresh(), 0);
    const focus = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", focus);
    const interval = setInterval(focus, 60_000);
    return () => { ref.current++; clearTimeout(timer); clearInterval(interval); document.removeEventListener("visibilitychange", focus); };
  }, [refresh]);
  return { ...state, refresh, can: (capability: Capability) => mode === "cloud" && !state.loading && !state.error && state.capabilities[capability] === true };
}
