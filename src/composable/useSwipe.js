/**
 * useSwipe – detects horizontal / vertical swipe gestures on a DOM element.
 *
 * Usage:
 *   const { attachSwipe } = useSwipe({ onLeft, onRight, onUp, onDown })
 *   onMounted(() => attachSwipe(el.value))
 */
import { onUnmounted } from 'vue'

const THRESHOLD = 40 // min px to register as a swipe
const MAX_DURATION_MS = 600

export function useSwipe({ onLeft, onRight, onUp, onDown } = {}) {
  let startX = 0
  let startY = 0
  let startTime = 0
  let element = null

  function handleTouchStart(e) {
    const t = e.touches[0]
    startX = t.clientX
    startY = t.clientY
    startTime = Date.now()
  }

  function handleTouchEnd(e) {
    const duration = Date.now() - startTime
    if (duration > MAX_DURATION_MS) return

    const t = e.changedTouches[0]
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (Math.max(absDx, absDy) < THRESHOLD) return

    if (absDx > absDy) {
      // Horizontal swipe
      if (dx < 0 && onLeft) onLeft()
      else if (dx > 0 && onRight) onRight()
    } else {
      // Vertical swipe
      if (dy < 0 && onUp) onUp()
      else if (dy > 0 && onDown) onDown()
    }
  }

  function attachSwipe(el) {
    if (!el) return
    element = el
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
  }

  function detachSwipe() {
    if (!element) return
    element.removeEventListener('touchstart', handleTouchStart)
    element.removeEventListener('touchend', handleTouchEnd)
    element = null
  }

  onUnmounted(detachSwipe)

  return { attachSwipe, detachSwipe }
}
