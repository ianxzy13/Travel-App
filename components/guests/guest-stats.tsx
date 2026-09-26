import type { GuestStats } from "@/lib/guests/stats";
import type { PartnerNames } from "@/lib/guests/model";
import { SideDot } from "./badges";
import type { EventOption } from "./types";

/** Headline counters above the guest list. */
export function GuestStatsBar({
  stats,
  events,
  names,
}: {
  stats: GuestStats;
  events: EventOption[];
  names: PartnerNames;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Guests" value={stats.total}>
        {stats.households} household{stats.households === 1 ? "" : "s"}
        {stats.plusOnes > 0 &&
          ` · ${stats.plusOnes} plus-one${stats.plusOnes === 1 ? "" : "s"}${
            stats.unnamedPlusOnes ? ` (${stats.unnamedPlusOnes} unnamed)` : ""
          }`}
      </Stat>
      <Stat label="Adults" value={stats.adults}>
        {stats.children} child{stats.children === 1 ? "" : "ren"} · {stats.infants} infant
        {stats.infants === 1 ? "" : "s"}
      </Stat>
      <Stat label="By side">
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <SideDot side="partner_a" /> {names.a}: {stats.bySide.partner_a}
          </span>
          <span className="flex items-center gap-1.5">
            <SideDot side="partner_b" /> {names.b}: {stats.bySide.partner_b}
          </span>
          <span className="flex items-center gap-1.5">
            <SideDot side="both" /> Both: {stats.bySide.both}
          </span>
        </span>
      </Stat>
      <Stat label="By event">
        {events.length === 0 ? (
          "No events yet"
        ) : (
          <span className="flex flex-col gap-0.5">
            {events.map((e) => (
              <span key={e.id} className="flex justify-between gap-2">
                <span className="truncate">{e.name}</span>
                <span className="text-foreground font-medium tabular-nums">
                  {stats.byEvent[e.id] ?? 0}
                </span>
              </span>
            ))}
            {stats.uninvited > 0 && (
              <span className="text-warning">{stats.uninvited} not invited to any event</span>
            )}
          </span>
        )}
      </Stat>
    </div>
  );
}

function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card min-w-0 rounded-xl border p-3 sm:p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      {value !== undefined && (
        <p className="font-serif text-4xl leading-tight font-semibold tabular-nums">{value}</p>
      )}
      <div className="text-muted-foreground mt-1 text-sm">{children}</div>
    </div>
  );
}
