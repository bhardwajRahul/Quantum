import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useSelector } from "react-redux"
import { Toaster as Sonner } from "sonner"

import { cn } from "@/lib/utils"
import { DARK } from "@services/core/themeSlice"

const Toaster = ({ ...props }) => {
  const theme = useSelector((state) => (state.theme?.theme === DARK ? "dark" : "light"))

  return (
    <Sonner
      theme={theme}
      className={cn(
        "toaster group [&>li]:flex [&>li]:items-start [&>li]:gap-3"
      )}
      icons={{
        success: (
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-green-500" />
        ),
        info: <InfoIcon className="mt-0.5 size-4 shrink-0 text-blue-500" />,
        warning: (
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-yellow-500" />
        ),
        error: <OctagonXIcon className="mt-0.5 size-4 shrink-0 text-red-500" />,
        loading: (
          <Loader2Icon className="mt-0.5 size-4 shrink-0 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        }
      }
      {...props}
    />
  )
}

export { Toaster }
