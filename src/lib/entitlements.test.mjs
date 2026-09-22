import test from "node:test";
import assert from "node:assert/strict";
import { mergeCapabilities } from "./entitlements.ts";

for (const status of ["free", "trialing", "active"]) {
  test(`community and timer remain available for ${status}`, () => {
    const capabilities = mergeCapabilities({ canUseCommunity: false, canUseTimer: false, canUseAdvancedAI: status !== "free" });
    assert.equal(capabilities.canUseCommunity, true);
    assert.equal(capabilities.canUseTimer, true);
  });
}
