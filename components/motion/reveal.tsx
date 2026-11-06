"use client";

// Shared Framer Motion pieces so every page moves the same way:
//   <Reveal>          fades and rises into view when scrolled to (once)
//   <Stagger>/<StaggerItem>  children reveal one after another
//   <HoverLift>       a card that lifts gently on hover and presses on tap
// People who ask their device for less motion get simple fades instead
// (see MotionConfig reducedMotion="user" in components/providers.tsx).

import { motion, type HTMLMotionProps, type Transition, type Variants } from "framer-motion";

export const EASE: Transition["ease"] = [0.22, 1, 0.36, 1];
/** Soft spring for hover and tap. */
export const SPRING: Transition = { type: "spring", stiffness: 400, damping: 30, mass: 0.6 };

const VIEWPORT = { once: true, amount: 0.15, margin: "0px 0px -8% 0px" } as const;

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
export function Reveal({ as = "div", delay = 0, y = 16, immediate, children, ...rest }: RevealProps) {
  const Comp = motion[as] as typeof motion.div;
  const shown = { opacity: 1, y: 0 };
  return (
    <Comp
      initial={{ opacity: 0, y }}
      {...(immediate ? { animate: shown } : { whileInView: shown, viewport: VIEWPORT })}
      transition={{ duration: 0.6, ease: EASE, delay }}
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
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
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
  stagger = 0.07,
  delay = 0,
  immediate,
  children,
  ...rest
}: StaggerProps) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
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
};

export function StaggerItem({ as = "div", hover, children, ...rest }: ItemProps) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      variants={itemVariants}
      {...(hover ? { whileHover: { y: -4 }, whileTap: { scale: 0.985 }, transition: SPRING } : {})}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** A card or tile that lifts on hover and presses in slightly on tap. */
export function HoverLift({ as = "div", children, ...rest }: ItemProps) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp whileHover={{ y: -4 }} whileTap={{ scale: 0.985 }} transition={SPRING} {...rest}>
      {children}
    </Comp>
  );
}

/** An icon that hops a little when its parent (with whileHover="hover") is hovered. */
export function HoverIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.span
      className={className}
      style={{ display: "inline-flex" }}
      variants={{ hover: { y: -3, rotate: -6, scale: 1.08 } }}
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
