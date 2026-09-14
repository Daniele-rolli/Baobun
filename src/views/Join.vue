<template>
  <div class="max-w-md mx-auto mt-20 bg-white p-6 rounded-lg shadow">
    <h2 class="text-2xl font-bold mb-4">Joining Group…</h2>
    <div v-if="loading">Please wait…</div>
    <div v-if="error" class="text-red-600 mt-2">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { joinByCode } from '@/lib/services/groups'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const error = ref('')

const joinGroup = async (inviteCode) => {
  try {
    const { group } = await joinByCode(inviteCode)
    if (!group) {
      error.value = 'Invalid invite code.'
      return
    }
    router.push(`/group/${group.id}`)
  } catch (err) {
    error.value = err?.code === 'not_found' ? 'Invalid invite code.' : 'Could not join group.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const inviteCode = route.params.id
  const authStore = useAuthStore()

  if (!authStore.user) {
    sessionStorage.setItem('pendingInviteCode', inviteCode)
    router.push('/login')
    return
  }

  await joinGroup(inviteCode)
})
</script>
