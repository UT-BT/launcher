import { motion } from 'framer-motion'

interface ProgressBarProps {
  progress: number
  className?: string
  showPercentage?: boolean
  variant?: 'default' | 'gradient'
}

export function ProgressBar({ 
  progress, 
  className = '', 
  showPercentage = false,
  variant = 'default'
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress))
  
  return (
    <div className={`progress-bar-container ${className}`}>
      <motion.div 
        className={`progress-bar ${variant === 'gradient' ? 'progress-bar-gradient' : ''}`}
        initial={{ width: 0 }}
        animate={{ width: `${clampedProgress}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
      {showPercentage && (
        <div className="progress-percentage">
          {Math.round(clampedProgress)}%
        </div>
      )}
    </div>
  )
}
