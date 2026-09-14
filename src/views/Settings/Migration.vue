<template>
  <div class="min-h-screen">
    <div class="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h1 class="text-lg font-semibold">Appwrite migration</h1>
          <p class="text-sm text-neutral-500">
            Paste a dry-run log or migration-report.json to review counts before running the CLI.
          </p>
        </div>
        <Badge v-if="parsed" variant="secondary">{{ sourceLabel }}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle class="text-sm">Report input</CardTitle>
          <CardDescription
            >Paste stdout from --dry-run or the contents of migration-report.json. Nothing leaves
            your browser.</CardDescription
          >
        </CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            v-model="raw"
            placeholder='{"users": 12, "groups": 3, ...} or [migrate] (dry run) users=12 groups=3 ...'
            class="min-h-32 font-mono text-xs"
          />
          <div class="flex flex-wrap gap-2">
            <Button size="sm" @click="parse" :disabled="!raw.trim()">Parse report</Button>
            <Button size="sm" variant="outline" @click="clear" :disabled="!raw && !parsed"
              >Clear</Button
            >
          </div>
          <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
        </CardContent>
      </Card>

      <Card v-if="parsed">
        <CardHeader>
          <CardTitle class="text-sm">Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <dl class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div
              v-for="row in statRows"
              :key="row.label"
              class="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2"
            >
              <dt class="text-xs text-neutral-500 capitalize">{{ row.label }}</dt>
              <dd class="text-lg font-semibold tabular-nums">{{ row.value }}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card v-if="logLines.length">
        <CardHeader>
          <CardTitle class="text-sm">Log lines</CardTitle>
          <CardDescription>{{ warnCount }} warning{{ warnCount === 1 ? '' : 's' }}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul class="space-y-1.5 max-h-64 overflow-auto">
            <li
              v-for="(line, i) in logLines"
              :key="i"
              class="flex items-start gap-2 text-xs font-mono rounded-lg px-2 py-1.5"
              :class="
                line.warn
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'bg-neutral-100/70 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
              "
            >
              <Badge v-if="line.warn" variant="outline" class="shrink-0">warn</Badge>
              <span class="break-all">{{ line.text }}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-sm">Run it (CLI)</CardTitle>
          <CardDescription
            >Migration writes Postgres + MinIO. UI is review-only for now.</CardDescription
          >
        </CardHeader>
        <CardContent class="space-y-2 text-xs font-mono">
          <p class="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2 py-1.5 break-all">
            node --env-file=.env scripts/migrate-from-appwrite.js --dry-run
          </p>
          <p class="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2 py-1.5 break-all">
            node --env-file=.env scripts/migrate-from-appwrite.js
          </p>
          <p class="font-sans text-xs text-neutral-500">
            Full env list: apps/api/scripts/migrate-README.md
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

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
