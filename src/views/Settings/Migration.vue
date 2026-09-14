<template>
  <div class="min-h-screen">
    <div class="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h1 class="text-lg font-semibold">Appwrite migration</h1>
          <p class="text-sm text-muted-foreground">
            Paste a dry-run log or migration-report.json to review counts before running the CLI.
          </p>
        </div>
        <UiBadge v-if="parsed" variant="secondary">{{ sourceLabel }}</UiBadge>
      </div>

      <UiCard>
        <UiCardHeader>
          <UiCardTitle class="text-sm">Report input</UiCardTitle>
          <UiCardDescription
            >Paste stdout from --dry-run or the contents of migration-report.json. Nothing leaves
            your browser.</UiCardDescription
          >
        </UiCardHeader>
        <UiCardContent class="space-y-3">
          <UiTextarea
            v-model="raw"
            placeholder='{"users": 12, "groups": 3, ...} or [migrate] (dry run) users=12 groups=3 ...'
            class="min-h-32 font-mono text-xs"
          />
          <div class="flex flex-wrap gap-2">
            <UiButton size="sm" @click="parse" :disabled="!raw.trim()">Parse report</UiButton>
            <UiButton size="sm" variant="outline" @click="clear" :disabled="!raw && !parsed"
              >Clear</UiButton
            >
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </UiCardContent>
      </UiCard>

      <UiCard v-if="parsed">
        <UiCardHeader>
          <UiCardTitle class="text-sm">Counts</UiCardTitle>
        </UiCardHeader>
        <UiCardContent>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div
              v-for="row in statRows"
              :key="row.label"
              class="rounded-xl border border-border px-3 py-2"
            >
              <dt class="text-xs text-muted-foreground capitalize">{{ row.label }}</dt>
              <dd class="text-lg font-semibold tabular-nums">{{ row.value }}</dd>
            </div>
          </dl>
        </UiCardContent>
      </UiCard>

      <UiCard v-if="logLines.length">
        <UiCardHeader>
          <UiCardTitle class="text-sm">Log lines</UiCardTitle>
          <UiCardDescription>{{ warnCount }} warning{{ warnCount === 1 ? '' : 's' }}</UiCardDescription>
        </UiCardHeader>
        <UiCardContent>
          <ul class="space-y-1.5 max-h-64 overflow-auto">
            <li
              v-for="(line, i) in logLines"
              :key="i"
              class="flex items-start gap-2 text-xs font-mono rounded-lg px-2 py-1.5"
              :class="
                line.warn
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted/70 text-muted-foreground'
              "
            >
              <UiBadge v-if="line.warn" variant="outline" class="shrink-0">warn</UiBadge>
              <span class="break-all">{{ line.text }}</span>
            </li>
          </ul>
        </UiCardContent>
      </UiCard>

      <UiCard>
        <UiCardHeader>
          <UiCardTitle class="text-sm">Run it (CLI)</UiCardTitle>
          <UiCardDescription
            >Migration writes Postgres + local file storage. UI is review-only for now.</UiCardDescription
          >
        </UiCardHeader>
        <UiCardContent class="space-y-2 text-xs font-mono">
          <p class="rounded-lg bg-muted px-2 py-1.5 break-all">
            node --env-file=.env scripts/migrate-from-appwrite.js --dry-run
          </p>
          <p class="rounded-lg bg-muted px-2 py-1.5 break-all">
            node --env-file=.env scripts/migrate-from-appwrite.js
          </p>
          <p class="font-sans text-xs text-muted-foreground">
            Full env list: apps/api/scripts/migrate-README.md
          </p>
        </UiCardContent>
      </UiCard>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const raw = ref('')
const error = ref('')
const parsed = ref(null)
const sourceLabel = ref('')
const logLines = ref([])

const statRows = computed(() => {
  if (!parsed.value) return []
  return Object.entries(parsed.value)
    .filter(([, v]) => typeof v === 'number')
    .map(([label, value]) => ({ label, value }))
})

const warnCount = computed(() => logLines.value.filter((l) => l.warn).length)

const parseCountsLine = (text) => {
  const m = text.match(/users=(\d+)\s+groups=(\d+)\s+members=(\d+)\s+events=(\d+)\s+tags=(\d+)/)
  if (!m) return null
  const [, users, groups, members, events, tags] = m.map(Number)
  return { users, groups, members, events, tags }
}

// ponytail: single paste-box parser, no file upload until someone asks
const parse = () => {
  error.value = ''
  parsed.value = null
  logLines.value = []
  const text = raw.value.trim()
  if (!text) return
  try {
    const obj = JSON.parse(text)
    parsed.value = obj.report && typeof obj.report === 'object' ? obj.report : obj
    sourceLabel.value = 'report.json'
    return
  } catch {
    // not JSON — try CLI stdout below
  }
  const counts = parseCountsLine(text)
  if (counts) {
    parsed.value = counts
    sourceLabel.value = text.includes('dry run') ? 'dry-run' : 'stdout'
  }
  const lines = text
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 200)
  logLines.value = lines.map((t) => ({
    text: t.length > 300 ? t.slice(0, 300) + '…' : t,
    warn: /warn|skip|error|fail/i.test(t),
  }))
  if (!counts && !lines.length) error.value = 'Could not parse report or log lines.'
  if (!counts && lines.length) sourceLabel.value = 'log only'
}

const clear = () => {
  raw.value = ''
  error.value = ''
  parsed.value = null
  logLines.value = []
}
</script>
