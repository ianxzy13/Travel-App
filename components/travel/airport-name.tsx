"use client";

import { useEffect, useState } from "react";

export function AirportName({
  code,
  fallback,
}: {
  code: string;
  fallback?: string;
}) {
  const [name, setName] = useState(fallback ?? code);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    import("@/lib/places/airports").then(({ airportByCode }) =>
      airportByCode(code).then((a) => {
        if (cancelled || !a) return;
        setName(`${a.name} (${a.code})`);
      }),
    ).catch(() => {});
    return () => { cancelled = true; };
  }, [code]);

  return <>{name}</>;
}
