"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";
import { SPRING } from "@/components/motion/reveal";

// Framer Motion handles the movement (a small lift on hover, a press on tap);
// colours still change with a short CSS transition. Links and other elements
// passed with asChild move the same way.
const MotionButton = motion.button;
const MotionSlot = motion.create(Slot.Root);

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity] duration-200 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "text-[0.72rem] tracking-[0.16em] uppercase bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive:
          "text-[0.72rem] tracking-[0.16em] uppercase bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "text-[0.72rem] tracking-[0.16em] uppercase border border-foreground/25 bg-transparent hover:border-primary hover:bg-primary-soft/60 dark:border-foreground/30",
        secondary:
          "text-[0.72rem] tracking-[0.16em] uppercase bg-sand text-secondary-foreground hover:bg-blush",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary-ink normal-case tracking-normal text-sm underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3.5 has-[>svg]:px-2.5",
        lg: "h-12 rounded-md px-8 has-[>svg]:px-6",
        icon: "size-10",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// Text-like buttons only fade their colour; the rest also lift and press.
const STILL = new Set(["link", "ghost"]);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  disabled,
  ...props
}: ButtonProps) {
  const moves = !disabled && !STILL.has(variant ?? "default");
  const motionProps = moves
    ? { whileHover: { y: -1 }, whileTap: { scale: 0.97, y: 0 }, transition: SPRING }
    : { whileTap: disabled ? undefined : { scale: 0.97 }, transition: SPRING };
  const shared = {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    className: cn(buttonVariants({ variant, size, className })),
    disabled,
    ...motionProps,
  };

  // Framer Motion's own drag/animation handlers share names with DOM events;
  // the button only ever receives plain DOM props, so this cast is safe.
  const rest = props as React.ComponentProps<typeof MotionButton>;
  return asChild ? <MotionSlot {...shared} {...rest} /> : <MotionButton {...shared} {...rest} />;
}

export { Button, buttonVariants };
