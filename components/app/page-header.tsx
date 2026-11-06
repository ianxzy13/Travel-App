import { Reveal } from "@/components/motion/reveal";

/** Title + subtitle at the top of each app page, with optional buttons on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-10 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <Reveal immediate y={10}>
        <h1 className="text-4xl font-light sm:text-5xl">{title}</h1>
        {description && <p className="text-muted-foreground mt-3 max-w-2xl">{description}</p>}
      </Reveal>
      {actions && (
        <Reveal immediate y={10} delay={0.08} className="flex flex-wrap gap-2">
          {actions}
        </Reveal>
      )}
    </div>
  );
}
