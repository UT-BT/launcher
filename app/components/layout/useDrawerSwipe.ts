import { useEffect, type RefObject } from 'react'
import { closesDrawer, drawerDragOffset, releaseVelocity, swipeAxis, type SwipeAxis } from './drawerSwipe'

interface DrawerDrag {
    pointerId: number
    startX: number
    startY: number
    axis: SwipeAxis
    offset: number
    lastX: number
    lastTime: number
    velocity: number
}

export function useDrawerSwipe(drawerRef: RefObject<HTMLElement | null>, enabled: boolean, onClose: () => void) {
    useEffect(() => {
        const drawer = drawerRef.current
        if (!drawer || !enabled) return

        let drag: DrawerDrag | null = null
        let swallowClick = false
        let swallowTimer: number | undefined

        const stopSwallowing = () => {
            swallowClick = false
            window.clearTimeout(swallowTimer)
        }

        const swallowNextClick = () => {
            stopSwallowing()
            swallowClick = true
            swallowTimer = window.setTimeout(stopSwallowing)
        }

        const clearDragStyle = () => {
            drawer.style.removeProperty('translate')
            drawer.style.removeProperty('transition')
        }

        const handleDown = (event: PointerEvent) => {
            stopSwallowing()
            if (!event.isPrimary || event.button !== 0) return
            drag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                axis: 'undecided',
                offset: 0,
                lastX: event.clientX,
                lastTime: event.timeStamp,
                velocity: 0,
            }
        }

        const handleMove = (event: PointerEvent) => {
            if (!drag || event.pointerId !== drag.pointerId) return
            const dx = event.clientX - drag.startX
            if (drag.axis === 'undecided') drag.axis = swipeAxis(dx, event.clientY - drag.startY)
            if (drag.axis === 'vertical') {
                drag = null
                return
            }
            if (drag.axis !== 'horizontal') return
            const elapsed = event.timeStamp - drag.lastTime
            if (elapsed > 0) drag.velocity = (event.clientX - drag.lastX) / elapsed
            drag.lastX = event.clientX
            drag.lastTime = event.timeStamp
            drag.offset = drawerDragOffset(dx, drawer.offsetWidth)
            drawer.style.transition = 'none'
            drawer.style.translate = `${drag.offset}px 0`
        }

        const handleEnd = (event: PointerEvent) => {
            if (!drag || event.pointerId !== drag.pointerId) return
            const finished = drag
            drag = null
            if (finished.axis !== 'horizontal') return
            swallowNextClick()
            clearDragStyle()
            const velocity = releaseVelocity(finished.velocity, event.timeStamp - finished.lastTime)
            if (event.type === 'pointerup' && closesDrawer(finished.offset, drawer.offsetWidth, velocity)) onClose()
        }

        const handleClick = (event: MouseEvent) => {
            if (!swallowClick) return
            stopSwallowing()
            event.preventDefault()
            event.stopPropagation()
        }

        drawer.addEventListener('pointerdown', handleDown)
        drawer.addEventListener('click', handleClick, true)
        window.addEventListener('pointermove', handleMove)
        window.addEventListener('pointerup', handleEnd)
        window.addEventListener('pointercancel', handleEnd)
        return () => {
            drawer.removeEventListener('pointerdown', handleDown)
            drawer.removeEventListener('click', handleClick, true)
            window.removeEventListener('pointermove', handleMove)
            window.removeEventListener('pointerup', handleEnd)
            window.removeEventListener('pointercancel', handleEnd)
            stopSwallowing()
            clearDragStyle()
        }
    }, [drawerRef, enabled, onClose])
}
