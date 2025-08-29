import { useRef } from 'react'
import { motion } from 'framer-motion'
import './styles.css'
import { Button } from '@/app/components/ui/button'
import logo from '@/app/assets/logo.png'
import { SiDiscord } from 'react-icons/si'

export default function Welcome() {
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--parallax-x', String(x * 30))
    el.style.setProperty('--parallax-y', String(y * 30))
  }

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} className="welcome-container">
      <div className="nebula-bg" aria-hidden="true" />
      <motion.div
        className="welcome-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.img
          src={logo}
          alt="UTBT.net Logo"
          className="logo"
          draggable="false"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.2,
            ease: "easeOut"
          }}
        />
        <motion.h1
          className="gradient-title parallax"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          Welcome to UTBT
        </motion.h1>
      </motion.div>
    </div>
  )
}