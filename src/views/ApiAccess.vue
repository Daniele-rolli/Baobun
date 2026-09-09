<template>
  <div class="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
    <router-link
      to="/settings"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft class="h-4 w-4" />
      Back to settings
    </router-link>

    <div>
      <h1 class="text-3xl font-bold">API access</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Create read-only tokens for integrations that pull your groups, events, and tags.
      </p>
    </div>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Create token</UiCardTitle>
        <UiCardDescription>The token is shown only once.</UiCardDescription>
      </UiCardHeader>
      <UiCardContent>
        <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="createToken">
          <UiInput v-model="name" required maxlength="80" placeholder="Integration name" />
          <UiButton type="submit" :disabled="busy || !name.trim()">
            {{ busy ? 'Creating…' : 'Create token' }}
          </UiButton>
        </form>
      </UiCardContent>
    </UiCard>

    <UiCard v-if="newSecret" class="border-emerald-500/40">
      <UiCardHeader>
        <UiCardTitle>Copy your token now</UiCardTitle>
        <UiCardDescription
          >It cannot be displayed again after you leave this page.</UiCardDescription
        >
      </UiCardHeader>
      <UiCardContent class="space-y-3">
        <code class="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{{ newSecret }}</code>
        <UiButton variant="outline" class="w-full" @click="copySecret">
          <Copy class="h-4 w-4" />
          Copy token
        </UiButton>
      </UiCardContent>
    </UiCard>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Active tokens</UiCardTitle>
      </UiCardHeader>
      <UiCardContent>
        <div v-if="loading" class="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        <div v-else-if="tokens.length" class="divide-y">
          <div v-for="token in tokens" :key="token.$id" class="flex items-center gap-3 py-3">
            <KeyRound class="h-5 w-5 text-muted-foreground" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ token.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ token.prefix }}… · created {{ formatDate(token.createdAt) }}
              </p>
            </div>
            <UiButton
              size="sm"
              variant="ghost"
              class="text-destructive"
              :disabled="busy"
              @click="revokeToken(token)"
            >
              Revoke
            </UiButton>
          </div>
        </div>
        <p v-else class="py-8 text-center text-sm text-muted-foreground">No API tokens yet.</p>
      </UiCardContent>
    </UiCard>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Pull data</UiCardTitle>
      </UiCardHeader>
      <UiCardContent class="space-y-3 text-sm">
        <p><code>GET /api/v1/groups</code></p>
        <p><code>GET /api/v1/groups/:id/events?from=&to=</code></p>
        <pre class="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
Authorization: Bearer bbn_…</pre
        >
      </UiCardContent>
    </UiCard>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ChevronLeft, Copy, KeyRound } from 'lucide-vue-next'
import { apiFetch } from '@/lib/api'
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
const tokens = ref([])
const name = ref('')
const newSecret = ref('')
const loading = ref(true)
const busy = ref(false)

const loadTokens = async () => {
  loading.value = true
  try {
    tokens.value = (await apiFetch('/api/tokens')).tokens
  } catch (error) {
    toast.error('Could not load API tokens', error?.message)
  } finally {
    loading.value = false
  }
}

const createToken = async () => {
  busy.value = true
  try {
    const result = await apiFetch('/api/tokens', {
      method: 'POST',
      json: true,
      body: { name: name.value },
    })
    tokens.value.unshift(result.token)
    newSecret.value = result.secret
    name.value = ''
    toast.success('API token created')
  } catch (error) {
    toast.error('Could not create API token', error?.message)
  } finally {
    busy.value = false
  }
}

const revokeToken = async (token) => {
  busy.value = true
  try {
    await apiFetch(`/api/tokens/${token.$id}`, { method: 'DELETE' })
    tokens.value = tokens.value.filter((item) => item.$id !== token.$id)
    toast.success('API token revoked')
  } catch (error) {
    toast.error('Could not revoke API token', error?.message)
  } finally {
    busy.value = false
  }
}

const copySecret = async () => {
  await navigator.clipboard.writeText(newSecret.value)
  toast.success('Token copied')
}

const formatDate = (value) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))

onMounted(loadTokens)
</script>
