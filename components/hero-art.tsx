import { cn } from "@/lib/utils";

/*
 * The big picture on the start page and the sign-in page: a golden-hour lake
 * in the Alps (a nod to Lake Bled) framed by peonies, roses and eucalyptus,
 * with petals drifting down. Drawn entirely in SVG, so there is no photo to
 * license or download, it stays sharp on every screen, and it fills any box
 * (the edges are cropped, the middle always shows).
 *
 * The drifting petals and twinkling lights are animated in globals.css
 * (hero-petal / hero-twinkle) and stand still for people who prefer less motion.
 */

/** Small seeded random generator, so the picture is the same on every render. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** One petal pointing up from (0,0): wide and cupped, with a soft notch at the tip. */
function petalPath(length: number, width: number) {
  const l = length;
  const w = width;
  return (
    `M0 0 C${r1(-w * 0.9)} ${r1(-l * 0.25)} ${r1(-w * 1.05)} ${r1(-l * 0.85)} ${r1(-w * 0.45)} ${r1(-l)} ` +
    `Q0 ${r1(-l * 0.9)} ${r1(w * 0.45)} ${r1(-l)} ` +
    `C${r1(w * 1.05)} ${r1(-l * 0.85)} ${r1(w * 0.9)} ${r1(-l * 0.25)} 0 0Z`
  );
}

type Tone = "blush" | "ivory" | "rose";

/** A full, layered bloom (peony when big and loose, rose when small and tight). */
function Bloom({
  x,
  y,
  size,
  tone,
  seed,
  tilt = 0,
}: {
  x: number;
  y: number;
  size: number;
  tone: Tone;
  seed: number;
  tilt?: number;
}) {
  const rand = random(seed);
  const rings = [
    { count: 10, length: 1, width: 0.42 },
    { count: 8, length: 0.8, width: 0.4 },
    { count: 7, length: 0.6, width: 0.36 },
    { count: 6, length: 0.42, width: 0.32 },
    { count: 5, length: 0.26, width: 0.3 },
  ];
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt}) scale(1 0.86)`}>
      {/* soft shadow under the bloom */}
      <ellipse
        cx={0}
        cy={size * 0.18}
        rx={size * 1.02}
        ry={size * 0.9}
        fill="#3d2530"
        opacity={0.18}
      />
      {rings.map((ring, ri) => {
        const offset = rand() * 360;
        return (
          <g key={ri}>
            {Array.from({ length: ring.count }).map((_, i) => {
              const angle = offset + (i / ring.count) * 360 + (rand() - 0.5) * 18;
              const len = size * ring.length * (0.92 + rand() * 0.16);
              return (
                <path
                  key={i}
                  d={petalPath(len, size * ring.width)}
                  transform={`rotate(${r1(angle)})`}
                  fill={`url(#vow-hero-petal-${tone}-${ri < 2 ? "outer" : "inner"})`}
                  stroke="#8a4f4f"
                  strokeOpacity={0.16}
                  strokeWidth={0.8}
                />
              );
            })}
          </g>
        );
      })}
      <circle r={size * 0.12} fill={`url(#vow-hero-petal-${tone}-inner)`} />
    </g>
  );
}

/** A curved eucalyptus sprig: round, silvery leaves along a stem. */
function Eucalyptus({
  x,
  y,
  length,
  angle,
  bend,
  seed,
}: {
  x: number;
  y: number;
  length: number;
  angle: number;
  bend: number;
  seed: number;
}) {
  const rand = random(seed);
  const leaves = Math.round(length / 26);
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path
        d={`M0 0 Q${bend} ${-length / 2} 0 ${-length}`}
        fill="none"
        stroke="#6e7f66"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {Array.from({ length: leaves }).map((_, i) => {
        const t = (i + 0.6) / leaves;
        // point on the quadratic curve
        const px = 2 * (1 - t) * t * bend;
        const py = -length * t;
        const side = i % 2 === 0 ? 1 : -1;
        const r = (1 - t * 0.55) * (13 + rand() * 4);
        return (
          <ellipse
            key={i}
            cx={r1(px + side * r * 0.9)}
            cy={r1(py)}
            rx={r1(r)}
            ry={r1(r * 0.82)}
            fill={i % 3 === 0 ? "#a7b7a0" : "#8fa38a"}
            stroke="#5f7259"
            strokeOpacity={0.35}
            strokeWidth={0.8}
          />
        );
      })}
    </g>
  );
}

/** A slim, pointed leaf (for greenery between the blooms). */
function Leaf({
  x,
  y,
  length,
  angle,
  dark,
}: {
  x: number;
  y: number;
  length: number;
  angle: number;
  dark?: boolean;
}) {
  const w = length * 0.28;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path
        d={`M0 0 C${r1(-w)} ${r1(-length * 0.3)} ${r1(-w * 0.6)} ${r1(-length * 0.8)} 0 ${-length} C${r1(w * 0.6)} ${r1(-length * 0.8)} ${r1(w)} ${r1(-length * 0.3)} 0 0Z`}
        fill={dark ? "#5b7255" : "#7d9474"}
      />
      <path
        d={`M0 0 L0 ${r1(-length * 0.92)}`}
        stroke="#3f5139"
        strokeOpacity={0.4}
        strokeWidth={1}
      />
    </g>
  );
}

/** Tiny white flowers (baby's breath) scattered around a point. */
function BabysBreath({
  x,
  y,
  spread,
  seed,
}: {
  x: number;
  y: number;
  spread: number;
  seed: number;
}) {
  const rand = random(seed);
  return (
    <g>
      {Array.from({ length: 22 }).map((_, i) => {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * spread;
        return (
          <circle
            key={i}
            cx={r1(x + Math.cos(a) * d)}
            cy={r1(y + Math.sin(a) * d * 0.7)}
            r={r1(2.2 + rand() * 2.4)}
            fill="#fffaf4"
            opacity={0.95}
          />
        );
      })}
    </g>
  );
}

/** One drifting petal; its fall is animated by the hero-petal class. */
function FallingPetal({
  x,
  y,
  size,
  delay,
  duration,
  drift,
  spin,
  tone,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  tone: Tone;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        className="hero-petal"
        style={
          {
            "--petal-delay": `${delay}s`,
            "--petal-duration": `${duration}s`,
            "--petal-drift": `${drift}px`,
            "--petal-spin": `${spin}deg`,
          } as React.CSSProperties
        }
      >
        <path
          d={petalPath(size, size * 0.42)}
          fill={`url(#vow-hero-petal-${tone}-outer)`}
          stroke="#8a4f4f"
          strokeOpacity={0.2}
          strokeWidth={0.6}
        />
      </g>
    </g>
  );
}

export function HeroArt({ className }: { className?: string }) {
  const rand = random(7);

  // Out-of-focus lights over the lake and in the sky.
  const bokeh = Array.from({ length: 26 }).map((_, i) => ({
    x: r1(rand() * 1000),
    y: r1(120 + rand() * 640),
    r: r1(6 + rand() * 22),
    o: r1(0.12 + rand() * 0.28),
    delay: r1(rand() * 6),
    twinkle: i % 3 === 0,
  }));

  // Short sparkles of sunlight on the water, spreading out towards the viewer.
  const glitter = Array.from({ length: 34 }).map(() => {
    const t = rand();
    const spread = 30 + t * 150;
    return {
      x: r1(560 + (rand() - 0.5) * 2 * spread),
      y: r1(662 + t * t * 220),
      w: r1(8 + rand() * (24 + (1 - t) * 30)),
      width: r1(1.2 + t * 1.6),
      o: r1(0.85 - t * 0.55),
    };
  });

  const petals = Array.from({ length: 16 }).map((_, i) => ({
    x: r1(80 + rand() * 840),
    y: r1(-120 - rand() * 200),
    size: r1(12 + rand() * 10),
    delay: r1(-rand() * 18),
    duration: r1(13 + rand() * 9),
    drift: r1((rand() - 0.3) * 260),
    spin: r1(180 + rand() * 540),
    tone: (["blush", "ivory", "rose"] as const)[i % 3],
  }));

  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block size-full", className)}
    >
      <defs>
        <linearGradient id="vow-hero-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5e4256" />
          <stop offset="0.28" stopColor="#9a6672" />
          <stop offset="0.48" stopColor="#d88f84" />
          <stop offset="0.6" stopColor="#f2bb94" />
          <stop offset="0.66" stopColor="#fbdcb0" />
        </linearGradient>
        <radialGradient id="vow-hero-sun-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff4dc" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#ffdcae" stopOpacity="0.6" />
          <stop offset="1" stopColor="#f6b08f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vow-hero-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3c39f" />
          <stop offset="0.25" stopColor="#c98a86" />
          <stop offset="0.7" stopColor="#7d5868" />
          <stop offset="1" stopColor="#4e3747" />
        </linearGradient>
        <linearGradient id="vow-hero-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbd9b5" stopOpacity="0" />
          <stop offset="1" stopColor="#fbd9b5" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="vow-hero-vignette" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.6" stopColor="#2b1b25" stopOpacity="0" />
          <stop offset="1" stopColor="#2b1b25" stopOpacity="0.38" />
        </radialGradient>
        <radialGradient id="vow-hero-bokeh">
          <stop offset="0" stopColor="#fff2d6" stopOpacity="1" />
          <stop offset="0.7" stopColor="#ffe2b8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffe2b8" stopOpacity="0" />
        </radialGradient>

        {/* petal colours: lighter at the heart of the flower, deeper at the edges */}
        {(
          [
            ["blush", "#fdeee8", "#e7b3a6", "#f9dcd2", "#d99486"],
            ["ivory", "#fffcf7", "#ecd8c8", "#fff6ec", "#e2c3ae"],
            ["rose", "#efb4a8", "#b9676a", "#e59e95", "#a2525a"],
          ] as const
        ).map(([tone, outerA, outerB, innerA, innerB]) => (
          <g key={tone}>
            <radialGradient
              id={`vow-hero-petal-${tone}-outer`}
              cx="0.5"
              cy="1"
              r="1.1"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0" stopColor={outerB} />
              <stop offset="0.35" stopColor={outerA} />
              <stop offset="1" stopColor={outerB} />
            </radialGradient>
            <radialGradient
              id={`vow-hero-petal-${tone}-inner`}
              cx="0.5"
              cy="1"
              r="1.1"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0" stopColor={innerB} />
              <stop offset="0.5" stopColor={innerA} />
              <stop offset="1" stopColor={innerB} />
            </radialGradient>
          </g>
        ))}

        <linearGradient id="vow-hero-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1cf" />
          <stop offset="0.45" stopColor="#f3cf8e" />
          <stop offset="1" stopColor="#d9a35f" />
        </linearGradient>
        <filter id="vow-hero-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="vow-hero-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="vow-hero-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix values="0 0 0 0 0.3 0 0 0 0 0.2 0 0 0 0 0.2 0 0 0 0.11 0" />
        </filter>
      </defs>

      {/* sky and the low sun */}
      <rect width="1000" height="1000" fill="url(#vow-hero-sky)" />
      <circle cx="560" cy="540" r="430" fill="url(#vow-hero-sun-glow)" />
      <circle cx="560" cy="548" r="50" fill="#fff6e4" opacity="0.95" />

      {/* soft clouds */}
      <g fill="#ffd9c0" opacity="0.35" filter="url(#vow-hero-blur)">
        <ellipse cx="230" cy="330" rx="190" ry="18" />
        <ellipse cx="760" cy="280" rx="230" ry="16" />
        <ellipse cx="620" cy="420" rx="160" ry="12" />
      </g>

      {/* mountains, far to near */}
      <path
        d="M0 600 L70 548 L120 566 L190 498 L250 540 L300 520 L360 560 L420 530 L470 556 L640 556 L700 520 L760 470 L800 500 L850 462 L910 520 L960 500 L1000 520 L1000 660 L0 660Z"
        fill="#c78a8d"
        opacity="0.75"
      />
      <path
        d="M0 620 L60 590 L140 600 L210 552 L280 596 L330 584 L400 616 L470 606 L520 626 L640 626 L720 590 L780 560 L830 584 L900 548 L960 586 L1000 576 L1000 660 L0 660Z"
        fill="#a06f7e"
      />
      <path
        d="M0 646 C80 630 140 640 220 628 C300 618 360 640 420 644 L1000 646 L1000 660 L0 660Z"
        fill="#7a5466"
      />
      <rect y="560" width="1000" height="100" fill="url(#vow-hero-mist)" />

      {/* the island church, mirrored in the lake */}
      <g fill="#6e4a5d">
        <path d="M330 652 C345 630 372 622 392 624 C415 626 436 636 452 652Z" />
        <rect x="378" y="606" width="34" height="22" />
        <path d="M376 607 L395 594 L414 607Z" />
        <rect x="414" y="584" width="10" height="44" />
        <path d="M412 585 L419 556 L426 585Z" />
      </g>

      {/* lake */}
      <rect y="652" width="1000" height="348" fill="url(#vow-hero-lake)" />
      <g fill="#6e4a5d" opacity="0.28" transform="translate(0 1304) scale(1 -1)">
        <path d="M330 652 C345 630 372 622 392 624 C415 626 436 636 452 652Z" />
        <rect x="378" y="606" width="34" height="22" />
        <rect x="414" y="584" width="10" height="44" />
        <path d="M412 585 L419 556 L426 585Z" />
      </g>
      {/* sunlight glittering on the water */}
      <g stroke="#fff1d6" strokeLinecap="round">
        {glitter.map((g, i) => (
          <line
            key={i}
            x1={g.x - g.w / 2}
            x2={g.x + g.w / 2}
            y1={g.y}
            y2={g.y}
            strokeWidth={g.width}
            opacity={g.o}
          />
        ))}
      </g>

      {/* out-of-focus lights */}
      <g>
        {bokeh.map((b, i) => (
          <circle
            key={i}
            cx={b.x}
            cy={b.y}
            r={b.r}
            fill="url(#vow-hero-bokeh)"
            opacity={b.o}
            className={b.twinkle ? "hero-twinkle" : undefined}
            style={
              b.twinkle ? ({ "--twinkle-delay": `${b.delay}s` } as React.CSSProperties) : undefined
            }
          />
        ))}
      </g>

      {/* hanging eucalyptus, top corners */}
      <g opacity="0.95">
        <Eucalyptus x={-10} y={70} length={330} angle={160} bend={-70} seed={11} />
        <Eucalyptus x={60} y={30} length={260} angle={-170} bend={60} seed={12} />
        <Eucalyptus x={1010} y={60} length={300} angle={-160} bend={70} seed={13} />
        <Eucalyptus x={950} y={20} length={220} angle={170} bend={-50} seed={14} />
      </g>
      <Bloom x={40} y={150} size={70} tone="blush" seed={21} tilt={20} />
      <Bloom x={135} y={95} size={44} tone="ivory" seed={22} />
      <Bloom x={975} y={150} size={64} tone="ivory" seed={23} tilt={-15} />
      <Bloom x={880} y={90} size={40} tone="rose" seed={24} />

      {/* the big bouquet along the bottom */}
      <g>
        <Eucalyptus x={60} y={1010} length={360} angle={20} bend={60} seed={31} />
        <Eucalyptus x={250} y={1010} length={300} angle={-8} bend={-50} seed={32} />
        <Eucalyptus x={820} y={1010} length={330} angle={-22} bend={-60} seed={33} />
        <Eucalyptus x={980} y={1010} length={380} angle={-40} bend={50} seed={34} />
        <Leaf x={150} y={930} length={150} angle={-40} />
        <Leaf x={330} y={950} length={130} angle={35} dark />
        <Leaf x={700} y={950} length={140} angle={-30} dark />
        <Leaf x={880} y={930} length={150} angle={42} />
        <Leaf x={520} y={1000} length={120} angle={-10} />
        <BabysBreath x={300} y={850} spread={70} seed={41} />
        <BabysBreath x={720} y={840} spread={80} seed={42} />
        <BabysBreath x={60} y={790} spread={60} seed={43} />
      </g>
      <Bloom x={110} y={900} size={120} tone="blush" seed={51} tilt={-10} />
      <Bloom x={270} y={960} size={95} tone="ivory" seed={52} tilt={8} />
      <Bloom x={30} y={1000} size={90} tone="rose" seed={53} />
      <Bloom x={220} y={840} size={52} tone="rose" seed={54} />
      <Bloom x={420} y={990} size={70} tone="blush" seed={55} tilt={-14} />
      <Bloom x={890} y={890} size={125} tone="ivory" seed={56} tilt={12} />
      <Bloom x={740} y={960} size={98} tone="blush" seed={57} />
      <Bloom x={990} y={990} size={95} tone="rose" seed={58} />
      <Bloom x={790} y={830} size={55} tone="rose" seed={59} />
      <Bloom x={600} y={1010} size={72} tone="ivory" seed={60} tilt={10} />

      {/* "Vow" with the logo's ring-and-infinity mark, in gold across the sky */}
      <g filter="url(#vow-hero-glow)">
        <g transform="translate(372 150) scale(4)" fill="none" stroke="url(#vow-hero-gold)">
          <path
            d="M32 21C24 9 6 9 6 21C6 33 24 33 32 21C40 9 58 9 58 21C58 33 40 33 32 21Z"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M41 6.5L43.5 3H50.5L53 6.5L47 13Z M41 6.5H53 M45 6.5L47 13L49 6.5"
            strokeWidth="0.8"
            strokeLinejoin="round"
            fill="#fff6e4"
            fillOpacity="0.35"
          />
        </g>
        <text
          x="500"
          y="390"
          textAnchor="middle"
          fill="url(#vow-hero-gold)"
          fontSize="120"
          style={{ fontFamily: "var(--font-accent)" }}
        >
          Vow
        </text>
      </g>

      {/* petals drifting down */}
      <g>
        {petals.map((p, i) => (
          <FallingPetal key={i} {...p} />
        ))}
      </g>

      {/* fine film grain and a gentle vignette for a photographic finish */}
      <rect width="1000" height="1000" filter="url(#vow-hero-grain)" opacity="0.7" />
      <rect width="1000" height="1000" fill="url(#vow-hero-vignette)" />
    </svg>
  );
}
