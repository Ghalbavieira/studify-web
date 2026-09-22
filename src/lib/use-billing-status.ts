"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useStudyData } from "@/lib/study-store";
import type { PlanState } from "@/lib/use-plan";

export type BillingStatus = {
  entitlement: PlanState;
  billing: {
    checkout_id: string | null;
    subscription_id: string | null;
    subscription_status: string;
    checkout_status: string | null;
    cancel_requested_at: string | null;
    operation_started_at: string | null;
    payment_method: string | null;
    trial_ends_at: string | null;
    trial_days_remaining: number;
    paid_until: string | null;
  } | null;
};

export async function billingApi(path: string, body?: unknown) {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) throw new Error("Entre na sua conta para gerenciar a assinatura.");
  const response = await fetch(`/api/billing/${path}`, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível consultar a assinatura.");
  return result;
}

export function useBillingStatus() {
  const { mode } = useStudyData();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (mode !== "cloud") return;
    try { setStatus(await billingApi("status")); setError(""); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao consultar status."); }
  }, [mode]);
  useEffect(() => {
    if (mode !== "cloud") return;
    const timer = setTimeout(() => void refresh(), 0);
    const focus = () => void refresh();
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visible); };
  }, [mode, refresh]);
  return { status, error, refresh };
}
