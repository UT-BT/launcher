import { motion } from 'framer-motion'
import { ProgressBar } from './ProgressBar'

interface ProgressSectionProps {
  progress: number
  progressText: string
  speedText?: string
  etaText?: string
  showDetails?: boolean
}

export function ProgressSection({ 
  progress, 
  progressText, 
  speedText, 
  etaText, 
  showDetails = false 
}: ProgressSectionProps) {
  return (
    <motion.div
      className="progress-section"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <ProgressBar progress={progress} variant="gradient" />
      
      <div className="progress-text">
        {progressText}
      </div>
      
      {showDetails && (speedText || etaText) && (
        <div className="progress-details">
          <div>Overall: {Math.round(progress)}%</div>
          {speedText && <div>Speed: {speedText}</div>}
          {etaText && <div>ETA: {etaText}</div>}
        </div>
      )}
    </motion.div>
  )
}
