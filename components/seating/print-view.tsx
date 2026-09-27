import { seatMap } from "@/lib/seating/state";
import type { SeatingGuest, SeatingState } from "@/lib/seating/types";
import { CatererSummary, guestsAtTable, sortedTables } from "./caterer-summary";
import { guestColor, ObjectShape, SeatingDefs, StaticSeat } from "./shapes";
import { useSeatingWords } from "./use-seating-words";

// No "use client": rendered on the server for the print pages.

/** What can be printed (labels in messages "seating.printViews"). */
export const VIEWS = ["plan", "tables", "alpha", "cards", "caterer"] as const;
export type ViewKey = (typeof VIEWS)[number];

/** The printable content for one view of a seating chart. */
export function PrintSeatingView({
  view,
  title,
  state,
  guests,
  mealOptions,
}: {
  view: ViewKey;
  title: string;
  state: SeatingState;
  guests: SeatingGuest[];
  mealOptions: { id: string; name: string }[];
}) {
  const { t, tableName } = useSeatingWords();
  const guestsById = new Map(guests.map((g) => [g.id, g]));
  const meals = new Map(mealOptions.map((m) => [m.id, m.name]));
  const tables = sortedTables(state);
  const data = { guests, mealOptions };

  return (
    <>
      {view !== "cards" && (
        <header className="mb-6">
          <p className="text-sm tracking-widest text-stone-500 uppercase">{t(`printViews.${view}`)}</p>
          <h1 className="text-4xl">{title}</h1>
        </header>
      )}

      {view === "plan" && (
        <svg
          viewBox={`-20 -20 ${state.room.width + 40} ${state.room.height + 40}`}
          className="w-full rounded border print:border-0"
          style={{ maxHeight: "170mm" }}
        >
          <SeatingDefs />
          <rect
            width={state.room.width}
            height={state.room.height}
            fill="#fff"
            stroke="#57534e"
            strokeWidth={4}
          />
          {Object.values(state.objects).map((o) => {
            const seats = seatMap(state);
            return (
              <ObjectShape
                key={o.id}
                object={o}
                renderSeat={(i) => {
                  const g = guestsById.get(seats.get(`${o.id}:${i}`) ?? "");
                  return (
                    <StaticSeat guest={g} color={guestColor(g, "side", [])} rotation={o.rotation} />
                  );
                }}
              />
            );
          })}
        </svg>
      )}

      {view === "tables" && (
        <div className="columns-1 gap-8 sm:columns-2 print:columns-2">
          {tables.map((t) => {
            const people = guestsAtTable(state, guestsById, t);
            return (
              <section key={t.id} className="mb-6 break-inside-avoid">
                <h2 className="border-b border-stone-300 pb-1 text-2xl">
                  {tableName(t)}{" "}
                  <span className="font-sans text-sm text-stone-500">
                    ({people.length}/{t.seatCount})
                  </span>
                </h2>
                <ol className="mt-2 space-y-0.5 text-sm">
                  {people.map((g) => (
                    <li key={g.id} className="flex justify-between gap-3">
                      <span>{g.name}</span>
                      <span className="text-right text-stone-500">
                        {[g.mealOptionId && meals.get(g.mealOptionId), g.dietary]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}

      {view === "alpha" && <FindYourSeat state={state} guests={data.guests} />}

      {view === "cards" && (
        <div className="grid grid-cols-2 gap-0">
          {tables.flatMap((t) =>
            guestsAtTable(state, guestsById, t).map((g) => (
              // A tent card: fold along the dashed line; the top half is upside down.
              <div
                key={g.id}
                className="flex h-[65mm] break-inside-avoid flex-col border border-dashed border-stone-300"
              >
                <div className="flex flex-1 rotate-180 flex-col items-center justify-center border-b border-dashed border-stone-300">
                  <PlaceCardText guest={g} table={tableName(t)} />
                </div>
                <div className="flex flex-1 flex-col items-center justify-center">
                  <PlaceCardText guest={g} table={tableName(t)} />
                </div>
              </div>
            )),
          )}
        </div>
      )}

      {view === "caterer" && (
        <CatererSummary
          state={state}
          tables={tables}
          mealOptions={data.mealOptions}
          guestsAt={(t) => guestsAtTable(state, guestsById, t)}
        />
      )}

      {tables.length === 0 && (
        <p className="py-10 text-center text-stone-500">{t("printPage.noTables")}</p>
      )}
    </>
  );
}

function PlaceCardText({ guest, table }: { guest: SeatingGuest; table: string }) {
  return (
    <>
      <p className="px-4 text-center font-serif text-3xl leading-tight">{guest.name}</p>
      <p className="mt-1 text-xs tracking-widest text-stone-500 uppercase">{table}</p>
    </>
  );
}

/** Alphabetical escort list: "Smith, Ann ...... Table 3". */
function FindYourSeat({ state, guests }: { state: SeatingState; guests: SeatingGuest[] }) {
  const { tableName } = useSeatingWords();
  const rows = guests
    .filter((g) => state.assignments[g.id])
    .map((g) => {
      const t = state.objects[state.assignments[g.id].objectId];
      const sortName = (g.lastName || g.name).toLocaleLowerCase();
      return { g, sortName, table: t ? tableName(t) : "" };
    })
    .sort((a, b) => a.sortName.localeCompare(b.sortName) || a.g.name.localeCompare(b.g.name));

  return (
    <ol className="columns-1 gap-10 text-sm sm:columns-2 print:columns-2">
      {rows.map(({ g, table }) => (
        <li key={g.id} className="flex break-inside-avoid items-baseline gap-2 py-0.5">
          <span>{g.lastName ? `${g.lastName}, ${g.firstName}` : g.name}</span>
          <span className="flex-1 border-b border-dotted border-stone-300" aria-hidden />
          <span className="font-medium">{table}</span>
        </li>
      ))}
    </ol>
  );
}
