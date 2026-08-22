import type { AvailabilityChecker } from "./scheduler";

/**
 * Stub — no real calendar wired up yet. Always offers a slot 3 days out.
 * Swap this for a real Cal.com / Google Calendar call when that's ready;
 * scheduler.ts and the graph don't need to change, since they only depend
 * on this function's shape, not its implementation.
 */
export const checkAvailability: AvailabilityChecker = async () => {
  const slot = new Date();
  slot.setDate(slot.getDate() + 3);
  const label =
    slot.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) + " at 2:00 PM";
  return { slot: label };
};
