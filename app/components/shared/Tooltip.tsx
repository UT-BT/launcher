import { useState, useRef, ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  delay?: number
}

export function Tooltip({ content, children, delay = 200 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)

  const calculatePosition = () => {
    const trigger = triggerRef.current
    const tooltip = tooltipRef.current
    if (!trigger || !tooltip) return

    const rect = trigger.getBoundingClientRect()
    const padding = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    const tipWidth = tooltip.offsetWidth || 300
    const tipHeight = tooltip.offsetHeight || 80

    let top = rect.top - tipHeight - 8
    let left = rect.left + (rect.width / 2) - (tipWidth / 2)

    // Boundary checks
    if (left < padding) left = padding
    if (left + tipWidth + padding > vw) left = vw - tipWidth - padding
    if (top < padding) top = rect.bottom + 8
    if (top + tipHeight + padding > vh) top = Math.max(padding, vh - tipHeight - padding)

    setPosition({ top, left })
  }

  const showTooltip = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      calculatePosition()
      setIsVisible(true)
    }, delay)
  }

  const hideTooltip = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsVisible(false)
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        tabIndex={0}
      >
        {children}
      </span>
      
      <div
        ref={tooltipRef}
        className={`custom-tooltip${isVisible ? ' visible' : ''}`}
        style={{ top: position.top, left: position.left }}
        role="tooltip"
        aria-hidden={!isVisible}
      >
        {content}
      </div>
    </>
  )
}
