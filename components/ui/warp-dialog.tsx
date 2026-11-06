"use client";

// Warp dialog (from 21st.dev), adapted to Vow:
// - Framer Motion (the same library as "motion/react") and Slot from radix-ui
// - Vow's colour tokens (primary, blush, card) instead of fixed reds
// - a real dialog: role="dialog", Escape closes, focus moves in and back,
//   the page behind doesn't scroll, and it's portalled to <body> so parent
//   transforms (scroll animations) can't trap it.

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

type WarpDialogContextType = {
  open: boolean;
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  titleId: string;
};

const WarpDialogContext = React.createContext<WarpDialogContextType | null>(null);

export function useWarpDialogContext() {
  const ctx = React.useContext(WarpDialogContext);
  if (!ctx) throw new Error("WarpDialog components must be used inside <WarpDialog>");
  return ctx;
}

const EASE = [0.59, 0, 0.35, 1] as const;

export function WarpDialog({
  open: openProp,
  onOpenChange: setOpenProp,
  ...props
}: React.ComponentProps<"div"> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [_open, _setOpen] = React.useState(false);
  const open = openProp ?? _open;
  const titleId = React.useId();

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) setOpenProp(openState);
      else _setOpen(openState);
    },
    [setOpenProp, open],
  );

  const contextValue = React.useMemo<WarpDialogContextType>(
    () => ({ open, setOpen, titleId }),
    [open, setOpen, titleId],
  );

  return (
    <WarpDialogContext.Provider value={contextValue}>
      <div data-slot="dialog" {...props} />
    </WarpDialogContext.Provider>
  );
}

export function WarpDialogTrigger({
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  const { open, setOpen } = useWarpDialogContext();
  return (
    <Comp
      type={asChild ? undefined : "button"}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((prev) => !prev)}
      data-slot="dialog-trigger"
      {...props}
    />
  );
}

/** Give the dialog's heading this so screen readers announce it. */
export function WarpDialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useWarpDialogContext();
  return <h2 id={titleId} className={cn("text-3xl font-light", className)} {...props} />;
}

/** Closes the dialog when clicked (wrap a button or link with asChild). */
export function WarpDialogClose({
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  const { setOpen } = useWarpDialogContext();
  return <Comp data-slot="dialog-close" onClick={() => setOpen(false)} {...props} />;
}

function WarpDialogOverlay() {
  return (
    <motion.div
      aria-hidden
      className="bg-primary/10 fixed inset-0 z-50 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <WarpAnimations />
    </motion.div>
  );
}

export function WarpDialogContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, setOpen, titleId } = useWarpDialogContext();
  const panel = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Escape closes; focus moves into the dialog and back to the trigger; no page scroll behind.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panel.current) {
        // keep Tab inside the dialog
        const items = panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => panel.current?.focus(), 50);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      window.clearTimeout(focusTimer);
      previous?.focus?.();
    };
  }, [open, setOpen]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="warp-dialog">
          <WarpDialogOverlay />
          <motion.div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className={cn(
                "bg-card/95 relative my-auto flex w-full max-w-lg flex-col gap-4 rounded-2xl border p-6 shadow-xl backdrop-blur-md outline-none sm:p-8",
                className,
              )}
              onClick={(e) => e.stopPropagation()}
              initial={{ rotateX: -5, skewY: -1.5, scaleY: 2, scaleX: 0.4, y: 100 }}
              animate={{
                rotateX: 0,
                skewY: 0,
                scaleY: 1,
                scaleX: 1,
                y: 0,
                transition: {
                  duration: 0.35,
                  ease: EASE,
                  y: { type: "spring", visualDuration: 0.7, bounce: 0.2 },
                },
              }}
              exit={{ rotateX: -5, skewY: -1.5, scaleY: 2, scaleX: 0.4, y: 100 }}
              transition={{ duration: 0.35, ease: EASE }}
              style={{ transformPerspective: 1000, originX: 0.5, originY: 0 }}
            >
              {children}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** The soft glow behind the dialog, in Vow's blush and rose colours. */
function WarpAnimations() {
  const enterDuration = 0.5;
  const exitDuration = 0.25;
  const breathe = {
    duration: 15,
    repeat: Infinity,
    repeatType: "loop" as const,
    ease: "easeInOut" as const,
    delay: 0.35,
  };
  return (
    <>
      <motion.div
        className="bg-blush absolute top-[100%] left-[25%] h-1/2 w-1/2 origin-center rounded-full blur-lg will-change-transform"
        initial={{ scale: 0, opacity: 1 }}
        animate={{
          scale: 10,
          opacity: 0.25,
          transition: {
            duration: enterDuration,
            opacity: { duration: enterDuration, ease: "easeInOut" },
          },
        }}
        exit={{ scale: 0, opacity: 1, transition: { duration: exitDuration } }}
      />
      <motion.div
        className="bg-primary/60 absolute top-[-25%] left-[-50%] h-full w-full rounded-full blur-[100px]"
        initial={{ opacity: 0 }}
        animate={{
          opacity: 0.8,
          scale: [1, 0.7, 1],
          transition: { duration: enterDuration, scale: breathe },
        }}
        exit={{ opacity: 0, transition: { duration: exitDuration } }}
      />
      <motion.div
        className="bg-blush absolute top-[25%] left-[50%] h-full w-full rounded-full blur-[100px]"
        initial={{ opacity: 0 }}
        animate={{
          opacity: 0.9,
          scale: [1, 0.7, 1],
          transition: { duration: enterDuration, scale: breathe },
        }}
        exit={{ opacity: 0, transition: { duration: exitDuration } }}
      />
    </>
  );
}
