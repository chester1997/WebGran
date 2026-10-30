import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#121318] px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 shadow-xs transition-all duration-150 outline-none file:inline-flex file:h-7 file:items-center file:justify-center file:rounded-lg file:border-0 file:bg-white/10 file:px-2.5 file:text-xs file:font-medium file:text-zinc-200 hover:border-white/[0.16] focus-visible:border-blue-500/80 focus-visible:ring-2 focus-visible:ring-blue-500/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-red-500/80 aria-invalid:ring-2 aria-invalid:ring-red-500/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
