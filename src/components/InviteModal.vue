<template>
  <UiDialog :open="showModal" @update:open="$emit('close')">
    <UiDialogContent class="sm:max-w-md">
      <UiDialogHeader>
        <UiDialogTitle class="flex items-center gap-2">
          <Share2 class="w-5 h-5" />
          <span>Share Invite Link</span>
        </UiDialogTitle>
        <UiDialogDescription> Anyone with this link can join the group. </UiDialogDescription>
      </UiDialogHeader>

      <div class="flex items-center gap-2">
        <UiInput :model-value="inviteLink" readonly ref="linkInput" class="flex-1" />
      </div>

      <UiDialogFooter>
        <UiButton variant="outline" class="flex-1" @click="$emit('close')"> Close </UiButton>
        <UiButton class="flex-1" @click="copyLink"> Copy </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>

<script>
import { Share2 } from 'lucide-vue-next'

export default {
  components: { Share2 },
  props: ['inviteCode'],
  emits: ['close'],
  data() {
    return {
      showModal: true,
    }
  },
  computed: {
    inviteLink() {
      return `${window.location.origin}/join/${this.inviteCode}`
    },
  },
  methods: {
    copyLink() {
      navigator.clipboard.writeText(this.inviteLink)
      alert('Link copied!')
    },
  },
}
</script>
