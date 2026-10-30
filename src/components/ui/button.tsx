import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150 ease-out outline-none select-none focus-visible:border-blue-500/80 focus-visible:ring-2 focus-visible:ring-blue-500/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 active:bg-blue-700 border border-blue-500/30",
        outline:
          "border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-zinc-200 hover:text-white shadow-xs",
        secondary:
          "bg-[#181A22] hover:bg-[#202430] text-zinc-200 border border-white/[0.06] hover:border-white/10 shadow-xs",
        ghost:
          "hover:bg-white/[0.06] hover:text-white text-zinc-400 hover:text-zinc-200",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 focus-visible:ring-red-500/30",
        link: "text-blue-400 underline-offset-4 hover:underline hover:text-blue-300 p-0 h-auto",
      },
      size: {
        default:
          "h-9 gap-2 px-3.5 rounded-xl text-xs sm:text-sm font-medium has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-md px-2 text-[11px] in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7.5 gap-1.5 rounded-lg px-2.5 text-xs font-medium in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2.5 rounded-xl px-5 text-sm font-semibold shadow-md has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9 rounded-xl",
        "icon-xs":
          "size-6 rounded-md in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7.5 rounded-lg in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11 rounded-xl [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
