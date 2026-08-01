<template>
  <div class="max-w-md mx-auto mt-20 bg-white p-6 rounded-lg shadow">
    <h2 class="text-2xl font-bold mb-4">Joining Group…</h2>
    <div v-if="loading">Please wait…</div>
    <div v-if="error" class="text-red-600 mt-2">{{ error }}</div>
  </div>
</template>

<script>
import { useAuthStore } from '@/stores/auth'
import { joinByCode } from '@/lib/services/groups'

export default {
  data() {
    return { loading: true, error: '' }
  },
  async created() {
    const inviteCode = this.$route.params.id
    const authStore = useAuthStore()

    if (!authStore.user) {
      sessionStorage.setItem('pendingInviteCode', inviteCode)
      this.$router.push('/login')
      return
    }

    await this.joinGroup(inviteCode)
  },
  methods: {
    async joinGroup(inviteCode) {
      try {
        const { group } = await joinByCode(inviteCode)
        if (!group) {
          this.error = 'Invalid invite code.'
          return
        }
        this.$router.push(`/group/${group.$id}`)
      } catch (err) {
        this.error = err?.code === 'not_found' ? 'Invalid invite code.' : 'Could not join group.'
        console.error(err)
      } finally {
        this.loading = false
      }
    },
  },
}
</script>
