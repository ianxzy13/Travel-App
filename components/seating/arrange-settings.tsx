"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_WEIGHTS, type ArrangeWeights } from "@/lib/seating/auto-arrange";

const WEIGHT_KEYS: (keyof ArrangeWeights)[] = [
  "keepTogether",
  "side",
  "tag",
  "language",
  "ageGroup",
  "hostPrefer",
  "fillFirst",
];

export function ArrangeSettings({
  weights,
  onChange,
  hasHostTag,
}: {
  weights: ArrangeWeights;
  onChange: (w: ArrangeWeights) => void;
  hasHostTag: boolean;
}) {
  const t = useTranslations("seating");

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">{t("arrangeSettingsHint")}</p>
      {WEIGHT_KEYS.map((key) => (
        <div key={key} className="flex items-center gap-2">
          <Label className="flex-1 text-xs">{t(`weights.${key}`)}</Label>
          <Input
            type="number"
            min={0}
            max={key === "keepTogether" ? 200 : 10}
            step={1}
            value={weights[key]}
            onChange={(e) =>
              onChange({ ...weights, [key]: Math.max(0, parseInt(e.target.value) || 0) })
            }
            className="h-7 w-14 px-2 text-center text-xs tabular-nums"
          />
        </div>
      ))}
      {!hasHostTag && (
        <p className="text-muted-foreground text-xs italic">{t("noHostTag")}</p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={() => onChange(DEFAULT_WEIGHTS)}
      >
        <RotateCcw className="size-3.5" aria-hidden /> {t("resetWeights")}
      </Button>
    </div>
  );
}
