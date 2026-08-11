import { ref, computed, onMounted, onUnmounted } from 'vue'

export function useModalViewport() {
  const visualViewportHeight = ref(
    typeof window !== 'undefined'
      ? (window.visualViewport?.height ?? window.innerHeight)
      : 600,
  )

  const keyboardOffset = computed(() => {
    if (typeof window === 'undefined') return 0
    return Math.max(0, window.innerHeight - visualViewportHeight.value)
  })

  const bodyPaddingBottom = computed(() => {
    if (keyboardOffset.value > 0) {
      return `${keyboardOffset.value + 20}px`
    }
    return 'max(1.25rem, env(keyboard-inset-height, 0px) + 1.25rem)'
  })

  let pendingUpdate = false
  const onViewportResize = () => {
    if (pendingUpdate) return
    pendingUpdate = true
    requestAnimationFrame(() => {
      pendingUpdate = false
      visualViewportHeight.value = window.visualViewport?.height ?? window.innerHeight
    })
  }

  const isMobileSheet = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches

  const contentMaxHeight = computed(() => {
    if (isMobileSheet()) {
      return `${Math.round(visualViewportHeight.value * 0.92)}px`
    }
    return '92dvh'
  })

  onMounted(() => {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportResize)
      window.visualViewport.addEventListener('scroll', onViewportResize)
    }
  })

  onUnmounted(() => {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onViewportResize)
      window.visualViewport.removeEventListener('scroll', onViewportResize)
    }
  })

  return {
    visualViewportHeight,
    keyboardOffset,
    bodyPaddingBottom,
    contentMaxHeight,
    isMobileSheet,
  }
}
