"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  BUTTON_MOTION,
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-styles";

export {
  buttonStyles,
  BUTTON_MOTION,
  type ButtonVariant,
  type ButtonSize,
} from "@/components/ui/button-styles";

// framer-motion redefines these DOM handlers with its own signatures.
type ConflictingProps =
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "style";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, ConflictingProps> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Swaps the leading icon for a spinner and blocks interaction. */
  loading?: boolean;
  /** Stretches the button to its container. */
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: HTMLMotionProps<"button">["style"];
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      className,
      children,
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || loading;

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        whileHover={isDisabled ? undefined : BUTTON_MOTION.whileHover}
        whileTap={isDisabled ? undefined : BUTTON_MOTION.whileTap}
        transition={BUTTON_MOTION.transition}
        className={buttonStyles({ variant, size, fullWidth, className })}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </motion.button>
    );
  },
);
