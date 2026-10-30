import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const badgeVariants = cva(
  "group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "bg-blue-500/15 text-blue-400 border-blue-500/30 shadow-xs [a]:hover:bg-blue-500/25",
        secondary:
          "bg-white/5 text-zinc-300 border-white/10 [a]:hover:bg-white/10",
        success:
          "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-xs [a]:hover:bg-emerald-500/25",
        warning:
          "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-xs [a]:hover:bg-amber-500/25",
        destructive:
          "bg-red-500/15 text-red-400 border-red-500/30 shadow-xs [a]:hover:bg-red-500/25",
        outline:
          "border-white/15 text-zinc-300 bg-transparent [a]:hover:bg-white/5",
        ghost:
          "text-zinc-400 border-transparent bg-transparent hover:text-zinc-200",
        link: "text-blue-400 underline-offset-4 hover:underline p-0 border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
