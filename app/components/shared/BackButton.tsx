import { Button } from '@/app/components/ui/button'

interface BackButtonProps {
  onClick: () => void
  disabled?: boolean
  className?: string
}

export function BackButton({ onClick, disabled = false, className = '' }: BackButtonProps) {
  return (
    <div className={`back-button ${className}`}>
      <Button 
        variant="ghost" 
        onClick={onClick} 
        size="sm" 
        disabled={disabled}
      >
        ← Back
      </Button>
    </div>
  )
}
