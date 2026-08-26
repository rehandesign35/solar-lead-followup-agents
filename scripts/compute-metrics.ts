import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function main() {
  const { data: rows, error } = await supabase.from("lead_state").select("*");

  if (error) {
    console.error("Failed to fetch lead_state:", error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log("No leads in lead_state yet — send a few messages through the widget first.");
    return;
  }

  const total = rows.length;
  const resolved = rows.filter((r) => r.resolution !== "in_progress");
  const booked = rows.filter((r) => r.resolution === "booked");
  const escalated = rows.filter((r) => r.needs_human_review);

  const resolutionRate = (resolved.length / total) * 100;
  const bookedRate = (booked.length / total) * 100;

  const avgHandoffs = rows.reduce((sum, r) => sum + (r.routing_trace?.length ?? 0), 0) / total;

  const resolvedTurns = resolved.map((r) => r.turns_count ?? 0);
  const avgTurnsToResolution = resolvedTurns.length
    ? resolvedTurns.reduce((a: number, b: number) => a + b, 0) / resolvedTurns.length
    : null;

  console.log("\n=== Lead Follow-Up Agents — Metrics ===\n");
  console.log(`Total leads:              ${total}`);
  console.log(`Resolution rate:          ${resolutionRate.toFixed(1)}% (${resolved.length}/${total})`);
  console.log(`Booked rate:              ${bookedRate.toFixed(1)}% (${booked.length}/${total})`);
  console.log(`Escalated to human:       ${escalated.length}/${total}`);
  console.log(`Avg handoffs per lead:    ${avgHandoffs.toFixed(2)}`);
  console.log(
    `Avg turns to resolution:  ${avgTurnsToResolution !== null ? avgTurnsToResolution.toFixed(1) : "n/a (no resolved leads yet)"}`
  );

  console.log("\n--- Routing decisions (spot-check a sample for accuracy) ---\n");
  rows
    .flatMap((r) => (r.routing_trace ?? []).map((t: any) => ({ lead: r.lead_id, ...t })))
    .slice(0, 15)
    .forEach((t: any) => {
      console.log(`[${t.lead}] ${t.fromAgent} → ${t.toAgent}: "${t.reason}"`);
    });

  console.log("\nCopy the numbers above into docs/eval-results.md.\n");
}

main();
