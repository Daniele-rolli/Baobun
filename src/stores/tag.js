import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as tagService from '@/lib/services/tags'

export const useTagsStore = defineStore('tags', () => {
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)

  const byId = computed(() => Object.fromEntries(items.value.map((t) => [t.id, t])))

  async function fetchByGroup(groupId) {
    const res = await tagService.listByGroup(groupId)
    items.value = res.tags
  }

  async function createTag(groupId, { name, color, icon, imageFile }) {
    const res = await tagService.create(groupId, { name, color, icon, image: imageFile })
    items.value.push(res.tag)
    return res.tag
  }

  async function updateTag(id, patch) {
    const res = await tagService.update(id, patch)
    const ix = items.value.findIndex((t) => t.id === id)
    if (ix !== -1) items.value[ix] = res.tag
    return res.tag
  }

  async function deleteTag(id) {
    await tagService.remove(id)
    items.value = items.value.filter((t) => t.id !== id)
  }

  return { items, byId, loading, error, fetchByGroup, createTag, updateTag, deleteTag }
})
