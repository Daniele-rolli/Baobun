import { ref } from 'vue'

// Shared open-state for the PWA install dialog (owned by App.vue,
// opened on demand from Settings). Never auto-opened: popping a modal
// over first paint hides <main> from assistive tech until dismissed.
const installOpen = ref(false)

export const useInstallPrompt = () => ({
  installOpen,
  openInstall: () => {
    installOpen.value = true
  },
})
