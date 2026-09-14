<template>
  <div class="min-h-screen">
    <div class="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <router-link
        to="/settings"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft class="w-4 h-4" />
        Back to Settings
      </router-link>

      <UiSelect v-model="selectedGroupId" @update:model-value="changeGroup">
        <UiSelectTrigger
          class="w-full h-auto rounded-xl bg-primary py-2 px-3 text-primary-foreground border-transparent hover:bg-primary/90 focus-visible:ring-ring data-placeholder:text-primary-foreground/80 [&_svg]:text-primary-foreground/80"
        >
          <UiSelectValue placeholder="Select a group..." />
        </UiSelectTrigger>
        <UiSelectContent>
          <UiSelectItem v-for="g in groups" :key="g.id" :value="g.id">
            {{ g.name }}
          </UiSelectItem>
        </UiSelectContent>
      </UiSelect>

      <!-- Header with Save Button -->
      <header class="flex items-center justify-between">
        <h1 class="text-3xl font-bold">Group Settings</h1>
        <transition name="fade">
          <UiButton v-if="dirty && canEditGroup" @click="saveGroup" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save Changes' }}
          </UiButton>
        </transition>
      </header>

      <transition name="fade">
        <div
          v-if="savedAt"
          class="bg-primary/10 border border-primary/20 text-primary p-2 rounded-xl flex items-center gap-2"
        >
          <CircleCheck class="w-5 h-5 shrink-0" />
          <span>Changes saved successfully at {{ savedAt }}</span>
        </div>
      </transition>

      <transition name="fade">
        <div
          v-if="error"
          class="bg-destructive/10 border border-destructive/20 text-destructive p-2 rounded-xl flex items-center gap-2"
        >
          <CircleAlert class="w-5 h-5 shrink-0" />
          <span>{{ error }}</span>
        </div>
      </transition>

      <UiCard v-if="!selectedGroupId">
        <UiCardContent class="p-12 text-center">
          <Users class="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 class="mt-4 text-lg font-medium">No group selected</h3>
          <p class="mt-2 text-muted-foreground">
            Select a group from the dropdown above to manage its settings.
          </p>
        </UiCardContent>
      </UiCard>

      <div v-else class="space-y-6">
        <!-- Group Info & Invite -->
        <UiCard class="p-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Group Info Section -->
            <div>
              <div class="flex items-center gap-2 pb-3 mb-4">
                <BadgeInfo />
                <h2 class="text-lg font-semibold">Group Info</h2>
              </div>

              <div class="space-y-4">
                <div>
                  <UiLabel for="group-name" class="mb-2 block">Group Name</UiLabel>
                  <UiInput
                    id="group-name"
                    v-model="groupForm.name"
                    @input="dirty = true"
                    placeholder="Enter group name"
                    class="w-full"
                    :disabled="!canEditGroup"
                  />
                </div>

                <div>
                  <UiLabel class="mb-2 block"
                    >Group Color</UiLabel
                  >
                  <div class="flex items-center gap-3">
                    <label class="inline-flex items-center cursor-pointer">
                      <input
                        type="color"
                        v-model="groupForm.color"
                        @input="dirty = true"
                        class="sr-only"
                        :disabled="!canEditGroup"
                      />
                      <span
                        class="w-12 h-12 rounded-xl shadow-md transition-all cursor-pointer"
                        :style="{ backgroundColor: groupForm.color }"
                      ></span>
                    </label>
                    <div class="flex-1">
                      <UiInput
                        v-model="groupForm.color"
                        @input="dirty = true"
                        placeholder="#000000"
                        class="font-mono"
                        :disabled="!canEditGroup"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Invite Section -->
            <div>
              <div class="flex items-center gap-2 pb-3 mb-4">
                <ArrowLeftRight class="w-5 h-5" />
                <h2 class="text-lg font-semibold">
                  Invite Members
                </h2>
              </div>

              <div class="space-y-4">
                <div>
                  <UiLabel class="mb-2 block"
                    >Invite Code</UiLabel
                  >
                  <div class="flex gap-2">
                    <div
                      class="flex-1 p-2 bg-muted rounded-xl font-mono text-lg font-semibold flex items-center justify-center"
                    >
                      {{ inviteCode || 'Loading...' }}
                    </div>
                    <UiButton
                      variant="outline"
                      size="icon"
                      @click="copyInviteCode"
                      aria-label="Copy invite code"
                    >
                      <Check v-if="codeCopied" class="w-5 h-5 text-primary" />
                      <Copy v-else class="w-5 h-5" />
                    </UiButton>
                  </div>
                </div>

                <div>
                  <UiLabel class="mb-2 block"
                    >Invite Link</UiLabel
                  >
                  <div class="flex gap-2">
                    <div
                      class="flex-1 p-2 bg-muted rounded-xl text-sm text-muted-foreground truncate"
                    >
                      {{ inviteLink }}
                    </div>
                    <UiButton
                      variant="outline"
                      size="icon"
                      @click="copyInviteLink"
                      aria-label="Copy invite link"
                    >
                      <Check v-if="linkCopied" class="w-5 h-5 text-primary" />
                      <Copy v-else class="w-5 h-5" />
                    </UiButton>
                  </div>
                </div>

                <p class="text-xs text-muted-foreground">
                  Share this code or link with people you want to invite to this group.
                </p>
              </div>
            </div>
          </div>
        </UiCard>

        <!-- Members & Tags -->
        <UiCard class="p-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Members Section -->
            <div>
              <div class="flex items-center gap-2 pb-3 mb-4">
                <Users />
                <h2 class="text-lg font-semibold">Members</h2>
                <span class="ml-auto text-sm text-muted-foreground">{{ members.length }}</span>
              </div>

              <div
                v-if="members.length > 0"
                class="space-y-2 max-h-80 overflow-y-auto overscroll-contain pr-2 touch-pan-y"
              >
                <div
                  v-for="m in members"
                  :key="m.id"
                  class="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted  transition-colors group"
                >
                  <div class="flex items-center gap-3">
                    <img
                      :src="
                        m.avatarUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(m.name || m.userId)}&background=f1f5f9&color=64748b`
                      "
                      class="w-8 h-8 rounded-full border-2 border shadow-sm"
                      :alt="m.name"
                    />
                    <span class="font-medium">{{
                      m.name || m.userId
                    }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <UiSelect
                      v-if="canManageRoles && m.role !== 'OWNER'"
                      :model-value="m.role"
                      :disabled="memberBusy === m.id"
                      @update:model-value="updateMemberRole(m, $event)"
                    >
                      <UiSelectTrigger class="h-8 w-28 text-xs">
                        <UiSelectValue />
                      </UiSelectTrigger>
                      <UiSelectContent>
                        <UiSelectItem value="ADMIN">Admin</UiSelectItem>
                        <UiSelectItem value="MEMBER">Member</UiSelectItem>
                        <UiSelectItem value="VIEWER">Viewer</UiSelectItem>
                      </UiSelectContent>
                    </UiSelect>
                    <UiBadge v-else variant="secondary">{{ formatRole(m.role) }}</UiBadge>
                    <UiButton
                      v-if="canManageMembers && m.role !== 'OWNER'"
                      variant="ghost"
                      size="sm"
                      class="text-destructive hover:text-destructive"
                      @click="removeMember(m.id)"
                      :disabled="memberBusy === m.id"
                    >
                      {{ memberBusy === m.id ? 'Removing…' : 'Remove' }}
                    </UiButton>
                  </div>
                </div>
              </div>

              <div v-else class="text-center py-8 text-muted-foreground">
                <Users class="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p class="text-sm">No members yet. Share the invite code to add members.</p>
              </div>

              <p v-if="memberError" class="text-sm text-destructive mt-3">{{ memberError }}</p>
            </div>

            <!-- Tags Section -->
            <div>
              <div class="flex items-center gap-2 pb-3 mb-4">
                <Tag />
                <h2 class="text-lg font-semibold">Tags</h2>
                <span class="ml-auto text-sm text-muted-foreground">{{ tags.length }}</span>
              </div>

              <!-- Create New Tag Section -->
              <div v-if="canEditContent" class="mb-4">
                <button
                  type="button"
                  @click="showCreateTag = !showCreateTag"
                  class="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <span class="text-sm font-medium"
                    >Create New Tag</span
                  >
                  <ChevronDown
                    class="w-4 h-4 transition-transform duration-200 text-muted-foreground"
                    :class="{ 'rotate-180': showCreateTag }"
                  />
                </button>

                <transition name="expand">
                  <div
                    v-if="showCreateTag"
                    class="mt-3 p-4 border rounded-xl bg-muted/50 space-y-3"
                  >
                    <div>
                      <UiLabel class="mb-1 block text-xs">Tag Name</UiLabel>
                      <UiInput
                        v-model="newTagName"
                        placeholder="e.g., Important, Urgent"
                        @keydown.enter.prevent="addTag"
                      />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <UiLabel class="mb-1 block text-xs">Color</UiLabel>
                        <label class="inline-flex items-center cursor-pointer">
                          <input v-model="newTagColor" type="color" class="sr-only" />
                          <span
                            class="w-full h-10 rounded-full shadow-sm border-2 border-white ring-2 ring-border hover:ring-ring transition-all"
                            :style="{ backgroundColor: newTagColor }"
                          ></span>
                        </label>
                      </div>

                      <div>
                        <UiLabel class="mb-1 block text-xs">Image</UiLabel>
                        <input
                          type="file"
                          accept="image/*"
                          @change="handleTagImageUpload"
                          class="w-full text-xs file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-muted file:text-foreground hover:file:bg-muted transition-colors"
                        />
                      </div>
                    </div>

                    <div v-if="previewImage" class="flex justify-center">
                      <img
                        :src="previewImage"
                        alt="Preview"
                        class="h-12 w-12 rounded-full object-cover border-2 border-card shadow-sm"
                      />
                    </div>

                    <UiButton
                      type="button"
                      class="w-full"
                      @click="addTag"
                      :disabled="addingTag || !newTagName.trim()"
                    >
                      {{ addingTag ? 'Creating…' : 'Create Tag' }}
                    </UiButton>
                  </div>
                </transition>
              </div>

              <!-- Tags List -->
              <div
                v-if="tags.length > 0"
                class="space-y-2 max-h-80 overflow-y-auto overscroll-contain pr-2 touch-pan-y"
              >
                <div
                  v-for="t in tags"
                  :key="t.id"
                  class="flex items-center gap-3 rounded-xl border p-3 hover:border-border  transition-colors group"
                >
                  <label
                    class="inline-flex items-center"
                    :class="{ 'cursor-pointer': canEditContent }"
                  >
                    <input
                      type="color"
                      v-model="t.color"
                      @input="updateTag(t)"
                      class="sr-only"
                      :disabled="!canEditContent"
                    />
                    <span
                      class="w-10 h-10 rounded-full shadow-md transition-all cursor-pointer"
                      :style="{ backgroundColor: t.color || groupForm.color || '#ffffff' }"
                    ></span>
                  </label>

                  <input
                    :id="`tag-name-${t.id}`"
                    v-model="t.name"
                    class="flex-1 decoration-none bg-transparent border-0 border-dashed border-border focus:border-solid focus:ring-0 focus:outline-none"
                    @change="updateTag(t)"
                    :disabled="!canEditContent"
                  />

                  <UiButton
                    v-if="canEditContent"
                    variant="ghost"
                    size="icon"
                    class="text-destructive hover:text-destructive"
                    @click="removeTag(t.id)"
                    :disabled="tagBusy === t.id"
                    aria-label="Remove tag"
                  >
                    <Trash2 class="w-5 h-5" />
                  </UiButton>
                </div>
              </div>

              <div v-else class="text-center py-8 text-muted-foreground">
                <Tag class="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                <p class="text-sm">No tags yet. Create one to get started.</p>
              </div>

              <p v-if="tagError" class="text-sm text-destructive mt-3">{{ tagError }}</p>
            </div>
          </div>
        </UiCard>

        <!-- Delete Group -->
        <UiCard v-if="canEditGroup" class="p-6">
          <div class="flex flex-col md:flex-row items-start gap-4">
            <div class="flex-1">
              <h3 class="text-lg font-semibold mb-1">
                Delete Group
              </h3>
              <p class="text-sm text-muted-foreground">
                Permanently delete this group and all its data. This action cannot be undone.
              </p>
            </div>
            <UiButton @click="confirmDeleteGroup" variant="destructive" :disabled="deleting">
              {{ deleting ? 'Deleting…' : 'Delete Group' }}
            </UiButton>
          </div>
        </UiCard>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/group'
import { useTagsStore } from '@/stores/tag'
import { usePreferencesStore } from '@/stores/preferences'
import { useToastStore } from '@/stores/toast'
import { formatTime } from '@/lib/dateTimePreferences'
import {
  Users,
  BadgeInfo,
  Tag,
  ChevronLeft,
  ChevronDown,
  CircleCheck,
  CircleAlert,
  Copy,
  Check,
  Trash2,
  ArrowLeftRight,
} from 'lucide-vue-next'

// --- stores ---
const authStore = useAuthStore()
const groupStore = useGroupsStore()
const tagsStore = useTagsStore()
const preferencesStore = usePreferencesStore()
const toastStore = useToastStore()

// --- reactive state ---
const selectedGroupId = ref('')
const groupForm = ref({ name: '', color: '#4f46e5' })
const original = ref({ name: '', color: '#4f46e5' })
const dirty = ref(false)
const saving = ref(false)
const savedAt = ref('')
const error = ref('')

const inviteCode = ref('')
const inviteLink = ref('')
const codeCopied = ref(false)
const linkCopied = ref(false)

const memberBusy = ref('')
const memberError = ref('')
const members = ref([])

const showCreateTag = ref(false)
const newTagName = ref('')
const newTagColor = ref('#6366f1')
const newTagImageFile = ref(null)
const previewImage = ref('')
const tagBusy = ref('')
const addingTag = ref(false)
const tagError = ref('')

const router = useRouter()

// --- computed ---
const groups = computed(() => groupStore.items)
const tags = computed(() => tagsStore.items)
const selectedGroup = computed(() =>
  groupStore.items.find((group) => group.id === selectedGroupId.value),
)
const canEditGroup = computed(() => selectedGroup.value?.role === 'OWNER')
const canEditContent = computed(() => selectedGroup.value?.role !== 'VIEWER')
const canManageRoles = computed(() => selectedGroup.value?.role === 'OWNER')
const canManageMembers = computed(() => ['OWNER', 'ADMIN'].includes(selectedGroup.value?.role))
const formatRole = (role) =>
  ({ OWNER: 'Owner', ADMIN: 'Admin', MEMBER: 'Member', VIEWER: 'Viewer' })[role] || 'Member'

// Watch for changes to groupForm
watch(
  () => [groupForm.value.name, groupForm.value.color],
  () => {
    if (
      original.value.name &&
      (groupForm.value.name !== original.value.name ||
        groupForm.value.color !== original.value.color)
    ) {
      dirty.value = true
    }
  },
  { deep: true },
)

// --- utils ---
const loadGroup = async (id) => {
  try {
    error.value = ''
    savedAt.value = ''
    const g = groupStore.items.find((x) => x.id === id)
    if (!g) return
    groupForm.value = { name: g.name, color: g.color || '#4f46e5' }
    original.value = { ...groupForm.value }
    dirty.value = false

    // Load invite code
    inviteCode.value = g.inviteCode || ''
    inviteLink.value = `${window.location.origin}/join/${g.inviteCode || ''}`

    members.value = await groupStore.getMembers(id, authStore.user)
    await tagsStore.fetchByGroup(id)
  } catch (e) {
    console.error('Failed to load group:', e)
    error.value = 'Failed to load group.'
  }
}

// --- actions ---
const changeGroup = async () => {
  if (!selectedGroupId.value) return
  await loadGroup(selectedGroupId.value)
}

const saveGroup = async () => {
  if (!dirty.value) return
  saving.value = true
  error.value = ''
  try {
    await groupStore.updateGroup(selectedGroupId.value, groupForm.value)
    original.value = { ...groupForm.value }
    dirty.value = false
    savedAt.value = formatTime(new Date(), preferencesStore.timeFormat, true)
    toastStore.success('Group settings saved.')
    setTimeout(() => {
      savedAt.value = ''
    }, 3000)
  } catch (e) {
    console.error(e)
    error.value = 'Could not save group.'
    toastStore.error('Could not save group.')
  } finally {
    saving.value = false
  }
}

// --- Invite ---
const copyInviteCode = async () => {
  try {
    await navigator.clipboard.writeText(inviteCode.value)
    codeCopied.value = true
    toastStore.success('Invite code copied.')
    setTimeout(() => {
      codeCopied.value = false
    }, 2000)
  } catch (e) {
    console.error('Failed to copy code:', e)
    toastStore.error('Could not copy the invite code.')
  }
}

const copyInviteLink = async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    linkCopied.value = true
    toastStore.success('Invite link copied.')
    setTimeout(() => {
      linkCopied.value = false
    }, 2000)
  } catch (e) {
    console.error('Failed to copy link:', e)
    toastStore.error('Could not copy the invite link.')
  }
}

// --- Members ---
const removeMember = async (id) => {
  memberBusy.value = id
  memberError.value = ''
  try {
    await groupStore.removeMember(selectedGroupId.value, id)
    members.value = await groupStore.getMembers(selectedGroupId.value, authStore.user)
    toastStore.success('Member removed.')
  } catch (e) {
    console.error(e)
    memberError.value = 'Failed to remove member.'
    toastStore.error('Failed to remove member.')
  } finally {
    memberBusy.value = ''
  }
}

const updateMemberRole = async (member, role) => {
  memberBusy.value = member.id
  memberError.value = ''
  try {
    const updated = await groupStore.updateMemberRole(selectedGroupId.value, member.id, role)
    Object.assign(member, updated)
    toastStore.success(`${member.name || member.email}'s role is now ${formatRole(role)}.`)
  } catch (e) {
    console.error(e)
    memberError.value = 'Failed to update member role.'
    toastStore.error('Failed to update member role.')
  } finally {
    memberBusy.value = ''
  }
}

// --- Tags ---
const handleTagImageUpload = (e) => {
  const file = e.target.files[0]
  if (file) {
    newTagImageFile.value = file
    previewImage.value = URL.createObjectURL(file)
  }
}

const addTag = async () => {
  if (!newTagName.value.trim()) return
  addingTag.value = true
  tagError.value = ''
  try {
    await tagsStore.createTag(selectedGroupId.value, {
      name: newTagName.value.trim(),
      color: newTagColor.value,
      imageFile: newTagImageFile.value || null,
    })
    newTagName.value = ''
    newTagColor.value = '#6366f1'
    newTagImageFile.value = null
    previewImage.value = ''
    showCreateTag.value = false
    toastStore.success('Tag created.')
  } catch (e) {
    console.error(e)
    tagError.value = 'Failed to add tag.'
    toastStore.error('Failed to add tag.')
  } finally {
    addingTag.value = false
  }
}

const updateTag = async (tag) => {
  tagBusy.value = tag.id
  tagError.value = ''
  try {
    await tagsStore.updateTag(tag.id, { name: tag.name, color: tag.color })
    toastStore.success('Tag updated.')
  } catch (e) {
    console.error(e)
    tagError.value = 'Failed to update tag.'
    toastStore.error('Failed to update tag.')
  } finally {
    tagBusy.value = ''
  }
}

const removeTag = async (id) => {
  tagBusy.value = id
  tagError.value = ''
  try {
    await tagsStore.deleteTag(id)
    toastStore.success('Tag deleted.')
  } catch (e) {
    console.error(e)
    tagError.value = 'Failed to remove tag.'
    toastStore.error('Failed to remove tag.')
  } finally {
    tagBusy.value = ''
  }
}

// --- Delete group ---
const deleting = ref(false)
const confirmDeleteGroup = async () => {
  if (!selectedGroupId.value) return
  const ok = confirm('Are you sure you want to permanently delete this group and all its data?')
  if (!ok) return

  deleting.value = true
  try {
    await groupStore.deleteGroup(selectedGroupId.value)
    selectedGroupId.value = ''
    router.push('/')
  } catch (e) {
    console.error(e)
    error.value = 'Failed to delete group.'
  } finally {
    deleting.value = false
  }
}

// --- initial fetch ---
onMounted(async () => {
  await groupStore.fetchAll()
  if (groups.value.length && !selectedGroupId.value) {
    selectedGroupId.value = groups.value[0].id
    await loadGroup(selectedGroupId.value)
  }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
