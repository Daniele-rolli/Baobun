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
        <UiButton class="flex-1" @click="copyLink"> {{ copied ? 'Copied' : 'Copy' }} </UiButton>
      </UiDialogFooter>
    </UiDialogContent>
  </UiDialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Share2 } from 'lucide-vue-next'

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
