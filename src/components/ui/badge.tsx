import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide transition-colors",
  {
    variants: {
      variant: {
        high:            "border-red-500/30    bg-red-500/10    text-red-400",
        medium:          "border-amber-500/30  bg-amber-500/10  text-amber-400",
        low:             "border-green-500/30  bg-green-500/10  text-green-400",
        bug:             "border-red-500/20    bg-red-500/8     text-red-400",
        security:        "border-purple-500/30 bg-purple-500/10 text-purple-400",
        performance:     "border-blue-500/30   bg-blue-500/10   text-blue-400",
        style:           "border-zinc-500/30   bg-zinc-500/10   text-zinc-400",
        maintainability: "border-amber-500/20  bg-amber-500/8   text-amber-500",
        suggestion:      "border-green-500/20  bg-green-500/8   text-green-500",
        approve:         "border-green-500/30  bg-green-500/10  text-green-400",
        request_changes: "border-red-500/30    bg-red-500/10    text-red-400",
        comment:         "border-amber-500/30  bg-amber-500/10  text-amber-400",
        default:         "border-border        bg-muted         text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
