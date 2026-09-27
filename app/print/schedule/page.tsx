import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PrintControls } from "@/components/seating/print-controls";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtTime } from "@/lib/i18n/format";
import { endTime, sortByTime } from "@/lib/schedule/time";
import { createClient } from "@/lib/supabase/server";
import { coupleName, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("schedule.printPage"))("title"), robots: { index: false } };
}

/** A clean run sheet to print or save as PDF, with vendor phone numbers at the bottom. */
export default async function PrintSchedule({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { wedding } = await requireWedding();
  const t = await getTranslations("schedule");
  const locale = await getLocale();
  const requested = (await searchParams).day;
  const day =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested !== wedding.wedding_date
      ? requested
      : null;
  const sb = await createClient();
  const query = sb.from("schedule_items").select("*").eq("wedding_id", wedding.id);
  const [{ data: rows }, { data: vendors }] = await Promise.all([
    day
      ? query.eq("day", day)
      : query.or(`day.is.null${wedding.wedding_date ? `,day.eq.${wedding.wedding_date}` : ""}`),
    sb.from("vendors").select("id, name, contact_name, phone, email").eq("wedding_id", wedding.id),
  ]);
  const items = sortByTime(rows ?? []);
  const date = day ?? wedding.wedding_date;
  const byId = new Map((vendors ?? []).map((v) => [v.id, v]));
  const used = [...new Set(items.map((i) => i.vendor_id).filter((v): v is string => !!v))]
    .map((id) => byId.get(id)!)
    .filter(Boolean);

  return (
    <main className="mx-auto max-w-4xl bg-white p-6 text-stone-900 print:max-w-none print:p-0">
      <style>{`@page { size: A4 portrait; margin: 14mm; } @media print { body { background: white; } }`}</style>
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/schedule">
            <ArrowLeft className="rtl:rotate-180" aria-hidden /> {t("printPage.back")}
          </Link>
        </Button>
        <div className="ms-auto">
          <PrintControls />
        </div>
      </div>

      <header className="mb-6 border-b border-stone-300 pb-4">
        <p className="text-xs tracking-[0.25em] text-stone-500 uppercase">{t("printPage.runSheet")}</p>
        <h1 className="font-serif text-4xl font-semibold">{coupleName(wedding)}</h1>
        <p className="text-stone-600">
          {date ? fmtDate(date, locale, "full") : t("weddingDay")}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-stone-500">{t("printPage.nothing")}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-stone-800 text-start">
              <th scope="col" className="w-24 py-2 pe-3 text-start">
                {t("printPage.time")}
              </th>
              <th scope="col" className="py-2 pe-3 text-start">
                {t("printPage.what")}
              </th>
              <th scope="col" className="w-40 py-2 pe-3 text-start">
                {t("printPage.where")}
              </th>
              <th scope="col" className="w-36 py-2 text-start">
                {t("printPage.who")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const end = endTime(i.start_time, i.duration_min);
              const vendor = i.vendor_id ? byId.get(i.vendor_id) : undefined;
              return (
                <tr key={i.id} className="break-inside-avoid border-b border-stone-200 align-top">
                  <td className="py-2 pe-3 font-semibold tabular-nums">
                    {fmtTime(i.start_time, locale)}
                    {end && (
                      <span className="block text-xs font-normal text-stone-500">
                        {t("printPage.to", { time: fmtTime(end, locale) })}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pe-3">
                    <span className="font-medium">{i.title}</span>
                    {i.notes && (
                      <span className="block whitespace-pre-wrap text-stone-600">{i.notes}</span>
                    )}
                  </td>
                  <td className="py-2 pe-3 text-stone-700">{i.location}</td>
                  <td className="py-2 text-stone-700">
                    {i.owner}
                    {vendor && (
                      <span className="block text-xs text-stone-500">
                        {vendor.name}
                        {vendor.phone ? ` · ${vendor.phone}` : ""}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {used.length > 0 && (
        <section className="mt-8 break-inside-avoid">
          <h2 className="mb-2 font-serif text-2xl font-semibold">{t("printPage.contacts")}</h2>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 print:grid-cols-2">
            {used.map((v) => (
              <li key={v.id}>
                <span className="font-medium">{v.name}</span>
                {v.contact_name && ` (${v.contact_name})`}
                {v.phone && ` · ${v.phone}`}
                {v.email && <span className="block text-xs text-stone-500">{v.email}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
