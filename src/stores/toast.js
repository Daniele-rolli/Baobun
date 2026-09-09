import { defineStore } from 'pinia'
import { ref } from 'vue'

let nextId = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref([])

  const show = ({ title, description = '', variant = 'default', duration = 4000 }) => {
    const id = nextId++
    items.value.push({ id, title, description, variant })
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }

  const dismiss = (id) => {
    items.value = items.value.filter((item) => item.id !== id)
  }

  const success = (title, description = '') => show({ title, description, variant: 'success' })
  const error = (title, description = '') => show({ title, description, variant: 'destructive' })

  return { items, show, success, error, dismiss }
})
