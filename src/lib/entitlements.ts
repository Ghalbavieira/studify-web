export type Capability = "canCreateMultipleGoals" | "canUseFullHistory" | "canUseAdvancedAnalytics" | "canUseAdvancedAI" | "canUseAdvancedExamImport" | "canUseAdvancedPlanning" | "canUseFullReports" | "canUseTimer" | "canUseCommunity";

// These capabilities belong to the product's Free foundation. Paid plans may add
// capabilities, but a failed or pending entitlement request must not remove them.
export const FREE_CAPABILITIES: Readonly<Partial<Record<Capability, boolean>>> = {
  canUseTimer: true,
  canUseCommunity: true,
};

export function mergeCapabilities(capabilities?: Partial<Record<Capability, boolean>>) {
  return { ...capabilities, ...FREE_CAPABILITIES };
}
