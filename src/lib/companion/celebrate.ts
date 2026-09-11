// 2026-09-12 — birthday/anniversary dance. "koi naya employe ki id genrate
// hogi vo dance karegi or bolegi ab to party to banti hai" + "birthday ho,
// aniversery ho dance karegi": the layout already computes today's
// celebrations (src/lib/celebration/today.ts) for the banner — this helper
// hands those rows to the queue_companion_celebrations() SQL function
// (db/2026-09-12-virtual-assistant.sql), which fans each one out to every
// active colleague of the star's company in ONE round-trip and de-dupes per
// (employee, type, day) via its ON CONFLICT — so reloading the dashboard
// never stacks duplicate dances. Never blocks the render (same rule as
// notifyCompanion()).
import type { createServiceRoleClient } from "@/lib/supabase/server";
import type { Celebration } from "@/lib/celebration/today";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

// The companion's event vocabulary has "birthday" and "work_anniversary";
// a marriage anniversary rides the same dance mood via "work_anniversary"
// (both map to the dance pose in EVENT_TYPE_TO_MOOD) — the message text is
// what actually differs on screen.
function eventTypeFor(kind: Celebration["kind"]): "birthday" | "work_anniversary" {
  return kind === "birthday" ? "birthday" : "work_anniversary";
}

function messageFor(c: Celebration): string {
  if (c.kind === "birthday") return `Happy Birthday ${c.name}! 🎂 Ab to party to banti hai! 🥳`;
  if (c.kind === "anniversary") return `Happy Wedding Anniversary ${c.name}! 💐 Ab to party to banti hai! 🥳`;
  return `Happy Work Anniversary ${c.name} — ${c.years ?? 1} year${(c.years ?? 1) === 1 ? "" : "s"} at the company! 🎉 Ab to party to banti hai! 🥳`;
}

export async function queueCelebrationDances(supabase: ServiceClient, celebrations: Celebration[]): Promise<void> {
  if (celebrations.length === 0) return;
  try {
    await supabase.rpc("queue_companion_celebrations", {
      p_events: celebrations.map((c) => ({
        employee_id: c.employeeId,
        event_type: eventTypeFor(c.kind),
        message: messageFor(c),
      })),
    });
  } catch {
    // Function not yet migrated (or any hiccup) — never block the render.
  }
}
