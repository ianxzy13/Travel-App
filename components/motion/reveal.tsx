"use client";

// Shared Framer Motion pieces so every page moves the same way:
//   <Reveal>          fades and rises into view when scrolled to (once)
//   <Stagger>/<StaggerItem>  children reveal one after another
//   <HoverLift>       a card that lifts gently on hover and presses on tap
// People who ask their device for less motion get simple fades instead
// (see MotionConfig reducedMotion="user" in components/providers.tsx).

import { createContext, useContext, useState } from "react";
import { motion, type HTMLMotionProps, type Transition, type Variants } from "framer-motion";

export const EASE: Transition["ease"] = [0.22, 1, 0.36, 1];
/** Soft spring for hover and tap. */
export const SPRING: Transition = { type: "spring", stiffness: 400, damping: 30, mass: 0.6 };

// Start as soon as the top edge is a little way onto the screen. A share of the
// block ("amount") would never be reached by tall lists or wide tables on phones.
const VIEWPORT = { once: true, amount: 0, margin: "0px 0px -12% 0px" } as const;

type Tag = "div" | "section" | "header" | "ul" | "ol" | "li" | "article" | "p" | "footer" | "aside";

type RevealProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: React.ReactNode;
  as?: Tag;
  /** seconds to wait before starting */
  delay?: number;
  /** how far it rises, in px (0 = fade only) */
  y?: number;
  /** animate straight away instead of waiting to be scrolled into view */
  immediate?: boolean;
};

/** Fades in and rises a little the first time it scrolls into view. */
export function Reveal({
  as = "div",
  delay = 0,
  y = 32,
  immediate,
  children,
  ...rest
}: RevealProps) {
  const Comp = motion[as] as typeof motion.div;
  const shown = { opacity: 1, y: 0 };
  return (
    <Comp
      data-reveal
      initial={{ opacity: 0, y }}
      {...(immediate ? { animate: shown } : { whileInView: shown, viewport: VIEWPORT })}
      transition={{ duration: 0.8, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

const container = (stagger: number, delay: number): Variants => ({
  hidden: {},
  shown: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.65, ease: EASE } },
};

type StaggerProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: React.ReactNode;
  as?: Tag;
  /** seconds between children */
  stagger?: number;
  delay?: number;
  immediate?: boolean;
};

/** Reveals its <StaggerItem> children one after another when scrolled into view. */
export function Stagger({
  as = "div",
  stagger = 0.09,
  delay = 0,
  immediate,
  children,
  ...rest
}: StaggerProps) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      data-reveal
      variants={container(stagger, delay)}
      initial="hidden"
      {...(immediate ? { animate: "shown" } : { whileInView: "shown", viewport: VIEWPORT })}
      {...rest}
    >
      {children}
    </Comp>
  );
}

type ItemProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children?: React.ReactNode;
  as?: Tag;
  /** also lift on hover (for cards and tiles you can click) */
  hover?: boolean;
  /** tell <HoverIcon>s inside when the pointer is over this item */
  hoverGroup?: boolean;
};

// Whether the pointer is over the surrounding item. A context instead of
// whileHover="hover": a hover *label* on a list item would stop it from
// starting hidden with its list, and the reveal would never play.
const HoverGroup = createContext(false);

export function StaggerItem({ as = "div", hover, hoverGroup, children, ...rest }: ItemProps) {
  const Comp = motion[as] as typeof motion.div;
  const [over, setOver] = useState(false);
  return (
    <Comp
      data-reveal
      variants={itemVariants}
      {...(hover ? { whileHover: { y: -6 }, whileTap: { scale: 0.98 }, transition: SPRING } : {})}
      {...(hoverGroup
        ? { onHoverStart: () => setOver(true), onHoverEnd: () => setOver(false) }
        : {})}
      {...rest}
    >
      <HoverGroup.Provider value={over}>{children}</HoverGroup.Provider>
    </Comp>
  );
}

/** A card or tile that lifts on hover and presses in slightly on tap. */
export function HoverLift({ as = "div", children, ...rest }: ItemProps) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }} transition={SPRING} {...rest}>
      {children}
    </Comp>
  );
}

/** An icon that hops when the pointer is over its <StaggerItem hoverGroup>. */
export function HoverIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const over = useContext(HoverGroup);
  return (
    <motion.span
      className={className}
      style={{ display: "inline-flex" }}
      animate={over ? { y: -4, rotate: -8, scale: 1.15 } : { y: 0, rotate: 0, scale: 1 }}
      transition={SPRING}
    >
      {children}
    </motion.span>
  );
}

/** A progress bar fill that grows to `percent` when it scrolls into view. */
export function GrowBar({ percent, className }: { percent: number; className?: string }) {
  const width = `${Math.max(0, Math.min(100, percent))}%`;
  return (
    <motion.div
      className={className}
      initial={{ width: 0 }}
      whileInView={{ width }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
    />
  );
}

/**
 * A picture that settles from slightly zoomed-in as the page opens. Only the
 * size moves (never the opacity), so the image still shows at once and page
 * speed scores are unaffected.
 */
export function SettleIn({
  children,
  className,
  onView,
}: {
  children: React.ReactNode;
  className?: string;
  /** wait until it scrolls into view instead of starting on page load */
  onView?: boolean;
}) {
  const settled = { scale: 1 };
  return (
    <motion.div
      className={className}
      initial={{ scale: 1.08 }}
      {...(onView
        ? { whileInView: settled, viewport: { once: true, amount: 0.3 } }
        : { animate: settled })}
      transition={{ duration: 1.6, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
