<template>
  <div class="min-h-screen">
    <div class="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div class="space-y-2">
        <router-link
          to="/settings"
          class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft class="w-4 h-4" />
          Back to Settings
        </router-link>
        <h1 class="text-xl font-semibold">Edit Profile</h1>
      </div>

      <transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="message.text"
          :class="[
            'p-3.5 rounded-xl text-sm font-medium flex items-center gap-2',
            message.type === 'success'
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20',
          ]"
        >
          <svg
            v-if="message.type === 'success'"
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <svg
            v-else
            class="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {{ message.text }}
        </div>
      </transition>

      <div class="space-y-2">
        <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Profile
        </p>
        <UiCard class="p-5">
          <UiCardContent>
            <div class="flex items-center gap-4">
              <div class="relative group flex-shrink-0">
                <img
                  :src="
                    previewAvatar ||
                    avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(authStore.user?.name || 'User')}&background=random`
                  "
                  alt="Profile Avatar"
                  class="h-20 w-20 rounded-2xl object-cover border shadow-sm"
                />
                <UiButton
                  @click="triggerAvatarUpload"
                  variant="secondary"
                  size="sm"
                  class="absolute inset-x-4 bottom-4 w-auto opacity-0 group-hover:opacity-100 transition-opacity touch-exempt"
                >
                  Change
                </UiButton>
                <UiButton
                  v-if="previewAvatar || avatarUrl"
                  @click="removeAvatar"
                  type="button"
                  variant="destructive"
                  size="icon"
                  class="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full shadow touch-exempt"
                  title="Remove avatar"
                >
                  <X class="w-3.5 h-3.5" />
                </UiButton>
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-semibold truncate">
                  {{ authStore.user?.name }}
                </p>
                <p class="text-sm text-muted-foreground truncate">{{ authStore.user?.email }}</p>
                <UiButton
                  @click="triggerAvatarUpload"
                  variant="link"
                  class="mt-1.5 h-auto p-0 touch-exempt"
                >
                  Upload photo
                </UiButton>
              </div>
              <input
                ref="avatarInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleAvatarChange"
              />
            </div>
          </UiCardContent>
        </UiCard>
      </div>

      <div class="space-y-2">
        <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </p>
        <UiCard class="p-5">
          <UiCardContent class="space-y-4">
            <div>
              <UiLabel class="text-sm font-medium">Full Name</UiLabel>
              <UiInput v-model="form.name" type="text" placeholder="Your full name" class="mt-1.5" />
            </div>

            <div>
              <UiLabel class="text-sm font-medium">Email</UiLabel>
              <UiInput
                v-model="form.email"
                type="email"
                placeholder="your@email.com"
                class="mt-1.5"
              />
            </div>
          </UiCardContent>
        </UiCard>
      </div>

      <div class="space-y-2">
        <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Security
        </p>
        <UiCard class="p-5">
          <UiCardContent class="space-y-4">
            <div>
              <UiLabel class="text-sm font-medium">
                Current Password
                <span class="text-muted-foreground font-normal ml-1"
                  >(required to change email or password)</span
                >
              </UiLabel>
              <UiInput
                v-model="form.currentPassword"
                type="password"
                placeholder="Enter current password"
                autocomplete="current-password"
                class="mt-1.5"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <UiLabel class="text-sm font-medium">New Password</UiLabel>
                <UiInput
                  v-model="form.password"
                  type="password"
                  placeholder="Leave blank to keep"
                  autocomplete="new-password"
                  class="mt-1.5"
                />
              </div>
              <div>
                <UiLabel class="text-sm font-medium">Confirm Password</UiLabel>
                <UiInput
                  v-model="form.confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  autocomplete="new-password"
                  class="mt-1.5"
                />
              </div>
            </div>
          </UiCardContent>
        </UiCard>
      </div>

      <div class="space-y-2">
        <p class="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Actions
        </p>
        <UiCard class="p-4">
          <UiCardContent class="space-y-2">
            <UiButton @click="submitProfile" :disabled="authStore.loading" class="w-full">
              {{ authStore.loading ? 'Saving…' : 'Save Changes' }}
            </UiButton>
            <UiButton @click="authStore.logout()" variant="secondary" class="w-full">
              Log Out
            </UiButton>
          </UiCardContent>
        </UiCard>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { X, ChevronLeft } from 'lucide-vue-next'

const authStore = useAuthStore()
const avatarInput = ref(null)

const form = reactive({
  name: authStore.user?.name || '',
  email: authStore.user?.email || '',
  currentPassword: '',
  password: '',
  confirmPassword: '',
})

const previewAvatar = ref(null)
const avatarFile = ref(null)
const avatarUrl = ref(authStore.user?.avatarUrl || null)
const removeAvatarFlag = ref(false)
const message = reactive({ text: '', type: '' })

const triggerAvatarUpload = () => avatarInput.value?.click()

const handleAvatarChange = (event) => {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    showMessage('File size must be less than 5MB', 'error')
    return
  }
  avatarFile.value = file
  previewAvatar.value = URL.createObjectURL(file)
  removeAvatarFlag.value = false
  clearMessage()
}

const removeAvatar = () => {
  previewAvatar.value = null
  avatarFile.value = null
  avatarUrl.value = null
  removeAvatarFlag.value = true
  if (avatarInput.value) avatarInput.value.value = ''
}

const showMessage = (text, type) => {
  message.text = text
  message.type = type
  setTimeout(clearMessage, 5000)
}
const clearMessage = () => {
  message.text = ''
  message.type = ''
}

const submitProfile = async () => {
  clearMessage()
  if (form.password && form.password !== form.confirmPassword) {
    showMessage('Passwords do not match.', 'error')
    return
  }

  const { success, error } = await authStore.updateProfile({
    name: form.name,
    email: form.email,
    password: form.password || null,
    currentPassword: form.currentPassword || null,
    avatarFile: avatarFile.value,
    removeAvatar: removeAvatarFlag.value,
  })

  if (success) {
    showMessage('Profile updated successfully!', 'success')
    form.currentPassword = ''
    form.password = ''
    form.confirmPassword = ''
    previewAvatar.value = null
    avatarFile.value = null
    removeAvatarFlag.value = false
  } else {
    showMessage(error || 'Failed to update profile.', 'error')
  }
}
</script>
