import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import compsUi from './lib/comps-ui'
import './assets/main.css'
import App from './App.vue'
import router from './router'
import { registerSW } from 'virtual:pwa-register'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)
app.use(compsUi)

const auth = useAuthStore()

auth.initAuth().finally(() => {
  app.mount('#app')

  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm('New version available. Reload now?')) {
        updateSW(true)
      }
    },
    onOfflineReady() {
      console.log('App ready to work offline.')
    },
  })
})
