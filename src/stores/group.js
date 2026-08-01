import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as groupService from '@/lib/services/groups'

export const useGroupsStore = defineStore('groups', () => {
  const items = ref([])
  const loading = ref(false)
  const error = ref(null)

  const byId = computed(() => Object.fromEntries(items.value.map((g) => [g.$id, g])))

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const res = await groupService.list()
      items.value = res.groups
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function createGroup(payload) {
    const res = await groupService.create(payload)
    items.value.push(res.group)
    return res.group
  }

  async function updateGroup(id, patch) {
    const res = await groupService.update(id, patch)
    const ix = items.value.findIndex((x) => x.$id === id)
    if (ix !== -1) items.value[ix] = res.group
    return res.group
  }

  async function deleteGroup(id) {
    await groupService.remove(id)
    items.value = items.value.filter((g) => g.$id !== id)
  }

  async function listMembers(groupId) {
    const res = await groupService.listMembers(groupId)
    return res.members
  }

  async function getMembers(groupId) {
    const res = await groupService.listMembers(groupId)
    return res.members.map((doc) => ({
      $id: doc.$id,
      email: doc.email,
      name: doc.name || doc.email.split('@')[0],
      avatarUrl:
        doc.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name || doc.email.split('@')[0])}&background=random`,
      addedAt: doc.addedAt,
      userId: doc.userId || null,
    }))
  }

  async function addMember(groupId, email) {
    const res = await groupService.addMember(groupId, email)
    return res.member
  }

  async function removeMember(memberId) {
    const member = items.value.flatMap((g) => g.members || []).find((m) => m.$id === memberId)
    return await groupService.removeMember(member?.groupId || '', memberId)
  }

  async function getInviteCode(code) {
    void code
    return null
  }

  return {
    items,
    byId,
    loading,
    error,
    fetchAll,
    createGroup,
    getMembers,
    updateGroup,
    deleteGroup,
    listMembers,
    addMember,
    getInviteCode,
    removeMember,
  }
})
