<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4 py-12">
    <div class="w-full max-w-sm space-y-4">
      <div
        v-if="error"
        role="alert"
        class="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <HeartCrack class="h-5 w-5 shrink-0" />
        <p>{{ error }}</p>
      </div>

      <UiCard>
        <UiCardHeader class="items-center text-center">
          <UiCardTitle class="text-2xl">Joining group…</UiCardTitle>
          <UiCardDescription v-if="loading">Please wait while we add you.</UiCardDescription>
          <UiCardDescription v-else-if="error">Something went wrong.</UiCardDescription>
        </UiCardHeader>
        <UiCardContent v-if="loading" class="flex justify-center pb-6">
          <LoaderCircle class="h-8 w-8 animate-spin text-primary" />
        </UiCardContent>
        <UiCardContent v-else-if="error" class="pb-6">
          <UiButton as-child variant="outline" class="w-full">
            <router-link to="/dashboard">Back to dashboard</router-link>
          </UiButton>
        </UiCardContent>
      </UiCard>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { joinByCode } from '@/lib/services/groups'
import { HeartCrack, LoaderCircle } from 'lucide-vue-next'

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
