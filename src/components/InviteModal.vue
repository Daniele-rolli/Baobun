<template>
  <AdaptiveModal :open="showModal" dialog-class="sm:max-w-md" @update:open="$emit('close')">
    <template #title>
      <span class="flex items-center gap-2">
        <Share2 class="w-5 h-5" />
        <span>Share Invite Link</span>
      </span>
    </template>

    <p class="text-sm text-muted-foreground">Anyone with this link can join the group.</p>

      <div class="flex items-center gap-2">
        <UiInput :model-value="inviteLink" readonly ref="linkInput" class="flex-1" />
      </div>

    <template #footer>
        <UiButton variant="outline" class="flex-1" @click="$emit('close')"> Close </UiButton>
        <UiButton class="flex-1" @click="copyLink"> {{ copied ? 'Copied' : 'Copy' }} </UiButton>
    </template>
  </AdaptiveModal>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Share2 } from 'lucide-vue-next'
import AdaptiveModal from './AdaptiveModal.vue'

const props = defineProps(['inviteCode'])
defineEmits(['close'])

const showModal = ref(true)
const copied = ref(false)
const inviteLink = computed(() => `${window.location.origin}/join/${props.inviteCode}`)

const copyLink = async () => {
  await navigator.clipboard.writeText(inviteLink.value)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>
