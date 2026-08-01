<template>
  <div class="min-h-screen">
    <div class="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <router-link to="/settings" class="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors">
        <ChevronLeft class="w-4 h-4" />
        Back to Settings
      </router-link>

      <ui-select
        v-model="selectedGroupId"
        :options="groups.map((g) => ({ value: g.$id, text: g.name }))"
        placeholder="Select a group..."
        block
        class="p-2 flex top-0 inset-x-0 z-40 bg-rose-500 rounded-xl"
        @change="changeGroup"
      />

      <!-- Header with Save Button -->
      <header class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-neutral-900 dark:text-white">Group Settings</h1>
        <transition name="fade">
          <button
            v-if="dirty"
            @click="saveGroup"
            :disabled="saving"
            class="btn-primary"
          >
            Save Changes
          </button>
        </transition>
      </header>

      <transition name="fade">
        <div
          v-if="savedAt"
          class="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded-xl flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            ></path>
          </svg>
          <span>Changes saved successfully at {{ savedAt }}</span>
        </div>
      </transition>

      <transition name="fade">
        <div
          v-if="error"
          class="bg-red-50 border border-red-200 text-red-800 p-2 rounded-xl flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <span>{{ error }}</span>
        </div>
      </transition>

      <div v-if="!selectedGroupId" class="p-12 bg-white rounded-xl shadow-sm text-center">
        <svg
          class="mx-auto h-12 w-12 text-neutral-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          ></path>
        </svg>
        <h3 class="mt-4 text-lg font-medium text-neutral-900">No group selected</h3>
        <p class="mt-2 text-neutral-600">
          Select a group from the dropdown above to manage its settings.
        </p>
      </div>

      <div v-else class="space-y-6">
        <!-- Group Info & Invite -->
        <ui-card class="p-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Group Info Section -->
            <div>
              <div class="flex items-center gap-2 pb-3 mb-4">
                <BadgeInfo />
                <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">Group Info</h2>
              </div>

              <div class="space-y-4">
                <div>
                  <label
                    for="group-name"
                    class="block text-sm font-medium text-neutral-700 dark:text-white mb-2"
                    >Group Name</label
                  >
                  <ui-input
                    id="group-name"
                    v-model="groupForm.name"
                    @input="dirty = true"
                    placeholder="Enter group name"
                    class="w-full"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-neutral-700 dark:text-white mb-2"
                    >Group Color</label
                  >
                  <div class="flex items-center gap-3">
                    <label class="inline-flex items-center cursor-pointer">
                      <input
                        type="color"
                        v-model="groupForm.color"
                        @input="dirty = true"
                        class="sr-only"
                      />
                      <span
                        class="w-12 h-12 rounded-xl shadow-md transition-all cursor-pointer"
                        :style="{ backgroundColor: groupForm.color }"
                      ></span>
                    </label>
                    <div class="flex-1">
                      <ui-input
                        v-model="groupForm.color"
                        @input="dirty = true"
                        placeholder="#000000"
                        class="font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Invite Section -->
            <div>
              <div class="flex items-center gap-2 pb-3 mb-4">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  ></path>
                </svg>
                <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">
                  Invite Members
                </h2>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-neutral-700 dark:text-white mb-2"
                    >Invite Code</label
                  >
                  <div class="flex gap-2">
                    <div
                      class="flex-1 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl font-mono text-lg font-semibold text-neutral-900 dark:text-white flex items-center justify-center"
                    >
                      {{ inviteCode || 'Loading...' }}
                    </div>
                    <button
                      @click="copyInviteCode"
                      class="p-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-xl transition-colors"
                      :class="{ 'bg-emerald-100 dark:bg-emerald-900': codeCopied }"
                    >
                      <svg
                        v-if="!codeCopied"
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        class="w-5 h-5 text-emerald-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-medium text-neutral-700 dark:text-white mb-2"
                    >Invite Link</label
                  >
                  <div class="flex gap-2">
                    <div
                      class="flex-1 p-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-sm text-neutral-600 dark:text-neutral-300 truncate"
                    >
                      {{ inviteLink }}
                    </div>
                    <button
                      @click="copyInviteLink"
                      class="p-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-xl transition-colors"
                      :class="{ 'bg-emerald-100 dark:bg-emerald-900': linkCopied }"
                    >
                      <svg
                        v-if="!linkCopied"
                        class="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        class="w-5 h-5 text-emerald-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  Share this code or link with people you want to invite to this group.
                </p>
              </div>
            </div>
          </div>
        </ui-card>

        <!-- Members & Tags -->
        <ui-card class="p-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Members Section -->
            <div>
              <div class="flex items-center gap-2 pb-3 mb-4">
                <Users />
                <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">Members</h2>
                <span class="ml-auto text-sm text-neutral-500">{{ members.length }}</span>
              </div>

              <div v-if="members.length > 0" class="space-y-2 max-h-80 overflow-y-auto overscroll-contain pr-2 touch-pan-y">
                <div
                  v-for="m in members"
                  :key="m.$id"
                  class="flex items-center justify-between p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-900/70 transition-colors group"
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
                    <span class="font-medium text-neutral-900 dark:text-white">{{
                      m.name || m.userId
                    }}</span>
                  </div>
                  <button
                    @click="removeMember(m.$id)"
                    class="text-red-600 hover:text-red-700 transition-opacity font-medium text-sm"
                    :disabled="memberBusy === m.$id"
                  >
                    {{ memberBusy === m.$id ? 'Removing…' : 'Remove' }}
                  </button>
                </div>
              </div>

              <div v-else class="text-center py-8 text-neutral-500">
                <svg
                  class="mx-auto h-10 w-10 text-neutral-400 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  ></path>
                </svg>
                <p class="text-sm">No members yet. Share the invite code to add members.</p>
              </div>

              <p v-if="memberError" class="text-sm text-red-600 mt-3">{{ memberError }}</p>
            </div>

            <!-- Tags Section -->
            <div>
              <div class="flex items-center gap-2 pb-3 mb-4">
                <Tag />
                <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">Tags</h2>
                <span class="ml-auto text-sm text-neutral-500">{{ tags.length }}</span>
              </div>

              <!-- Create New Tag Section -->
              <div class="mb-4">
                <button
                  type="button"
                  @click="showCreateTag = !showCreateTag"
                  class="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors"
                >
                  <span class="text-sm font-medium text-neutral-900 dark:text-white"
                    >Create New Tag</span
                  >
                  <svg
                    class="w-4 h-4 transition-transform duration-200 text-neutral-600"
                    :class="{ 'rotate-180': showCreateTag }"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </button>

                <transition name="expand">
                  <div
                    v-if="showCreateTag"
                    class="mt-3 p-4 border rounded-xl bg-neutral-50 dark:bg-neutral-800 space-y-3"
                  >
                    <div>
                      <label
                        class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                        >Tag Name</label
                      >
                      <ui-input
                        v-model="newTagName"
                        placeholder="e.g., Important, Urgent"
                        @keydown.enter.prevent="addTag"
                      />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                          >Color</label
                        >
                        <label class="inline-flex items-center cursor-pointer">
                          <input v-model="newTagColor" type="color" class="sr-only" />
                          <span
                            class="w-full h-10 rounded-full shadow-sm border-2 border-white ring-2 ring-neutral-200 hover:ring-neutral-300 transition-all"
                            :style="{ backgroundColor: newTagColor }"
                          ></span>
                        </label>
                      </div>

                      <div>
                        <label
                          class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                          >Image</label
                        >
                        <input
                          type="file"
                          accept="image/*"
                          @change="handleTagImageUpload"
                          class="w-full text-xs file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 transition-colors"
                        />
                      </div>
                    </div>

                    <div v-if="previewImage" class="flex justify-center">
                      <img
                        :src="previewImage"
                        alt="Preview"
                        class="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                    </div>

                    <button
                      type="button"
                      class="btn-primary w-full"
                      @click="addTag"
                      :disabled="addingTag || !newTagName.trim()"
                    >
                      {{ addingTag ? 'Creating…' : 'Create Tag' }}
                    </button>
                  </div>
                </transition>
              </div>

              <!-- Tags List -->
              <div v-if="tags.length > 0" class="space-y-2 max-h-80 overflow-y-auto overscroll-contain pr-2 touch-pan-y">
                <div
                  v-for="t in tags"
                  :key="t.$id"
                  class="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 p-3 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors group"
                >
                  <label class="inline-flex items-center cursor-pointer">
                    <input type="color" v-model="t.color" @input="updateTag(t)" class="sr-only" />
                    <span
                      class="w-10 h-10 rounded-full shadow-md transition-all cursor-pointer"
                      :style="{ backgroundColor: t.color || groupForm.color || '#ffffff' }"
                    ></span>
                  </label>

                  <input
                    :id="`tag-name-${t.$id}`"
                    v-model="t.name"
                    class="flex-1 decoration-none bg-transparent border-0 border-dashed border-neutral-300 focus:border-solid focus:ring-0 focus:outline-none text-neutral-900 dark:text-white"
                    @change="updateTag(t)"
                  />

                  <button
                    @click="removeTag(t.$id)"
                    class="text-red-600 hover:text-red-700 transition-opacity"
                    :disabled="tagBusy === t.$id"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>

              <div v-else class="text-center py-8 text-neutral-500">
                <svg
                  class="mx-auto h-10 w-10 text-neutral-400 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  ></path>
                </svg>
                <p class="text-sm">No tags yet. Create one to get started.</p>
              </div>

              <p v-if="tagError" class="text-sm text-red-600 mt-3">{{ tagError }}</p>
            </div>
          </div>
        </ui-card>

        <!-- Delete Group -->
        <ui-card class="p-6">
          <div class="flex flex-col md:flex-row items-start gap-4">
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                Delete Group
              </h3>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                Permanently delete this group and all its data. This action cannot be undone.
              </p>
            </div>
            <button
              @click="confirmDeleteGroup"
              class="btn-danger"
              :disabled="deleting"
            >
              {{ deleting ? 'Deleting…' : 'Delete Group' }}
            </button>
          </div>
        </ui-card>
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
import { formatTime } from '@/lib/dateTimePreferences'
import { Users, BadgeInfo, Tag, ChevronLeft } from 'lucide-vue-next'

// --- stores ---
const authStore = useAuthStore()
const groupStore = useGroupsStore()
const tagsStore = useTagsStore()
const preferencesStore = usePreferencesStore()

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
    const g = groupStore.items.find((x) => x.$id === id)
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
    setTimeout(() => {
      savedAt.value = ''
    }, 3000)
  } catch (e) {
    console.error(e)
    error.value = 'Could not save group.'
  } finally {
    saving.value = false
  }
}

// --- Invite ---
const copyInviteCode = async () => {
  try {
    await navigator.clipboard.writeText(inviteCode.value)
    codeCopied.value = true
    setTimeout(() => {
      codeCopied.value = false
    }, 2000)
  } catch (e) {
    console.error('Failed to copy code:', e)
  }
}

const copyInviteLink = async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 2000)
  } catch (e) {
    console.error('Failed to copy link:', e)
  }
}

// --- Members ---
const removeMember = async (id) => {
  memberBusy.value = id
  memberError.value = ''
  try {
    await groupStore.removeMember(selectedGroupId.value, id)
    members.value = await groupStore.getMembers(selectedGroupId.value, authStore.user)
  } catch (e) {
    console.error(e)
    memberError.value = 'Failed to remove member.'
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
  } catch (e) {
    console.error(e)
    tagError.value = 'Failed to add tag.'
  } finally {
    addingTag.value = false
  }
}

const updateTag = async (tag) => {
  tagBusy.value = tag.$id
  tagError.value = ''
  try {
    await tagsStore.updateTag(tag.$id, { name: tag.name, color: tag.color })
  } catch (e) {
    console.error(e)
    tagError.value = 'Failed to update tag.'
  } finally {
    tagBusy.value = ''
  }
}

const removeTag = async (id) => {
  tagBusy.value = id
  tagError.value = ''
  try {
    await tagsStore.deleteTag(id)
  } catch (e) {
    console.error(e)
    tagError.value = 'Failed to remove tag.'
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
    selectedGroupId.value = groups.value[0].$id
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
