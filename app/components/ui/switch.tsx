"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, X } from "lucide-react"

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
    ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
        const handleToggle = () => {
            if (!disabled && onCheckedChange) {
                onCheckedChange(!checked)
            }
        }

        return (
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                onClick={handleToggle}
                className={cn(
                    "relative inline-flex h-6 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                    checked ? "bg-primary" : "bg-muted",
                    className
                )}
            >
                <span
                    className={cn(
                        "pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0 transition-transform",
                        checked ? "translate-x-6" : "translate-x-0"
                    )}
                >
                    {checked ? (
                        <Check className="size-3 text-primary" strokeWidth={3} />
                    ) : (
                        <X className="size-3 text-muted-foreground" strokeWidth={3} />
                    )}
                </span>
                <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onCheckedChange?.(e.target.checked)}
                    ref={ref}
                    {...props}
                />
            </button>
        )
    }
)
Switch.displayName = "Switch"

export { Switch }
