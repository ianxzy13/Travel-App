import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./page-header";

/** Placeholder for modules that are built in later phases. */
export function ComingSoon({
  title,
  description,
  icon: Icon,
  phase,
  features,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  phase: number;
  features: string[];
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="bg-card flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
        <span className="bg-primary-soft text-primary mb-4 inline-flex size-14 items-center justify-center rounded-full">
          <Icon className="size-7" aria-hidden />
        </span>
        <h2 className="text-3xl">Coming soon</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          This part of your planner arrives in phase {phase}. Here&apos;s what it will do:
        </p>
        <ul className="mt-6 grid max-w-lg gap-2 text-left text-sm sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="bg-primary mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
