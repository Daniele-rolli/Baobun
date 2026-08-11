import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import { getLiveFeedFileId } from '@baobun/shared'
import { ensureBuckets, putObject, BUCKETS } from '../src/s3.js'

const prisma = new PrismaClient()

const env = (k) => process.env[k]
const dryRun = process.argv.includes('--dry-run')
const listMode = process.argv.includes('--list')

const hashPassword = () =>
  `$random$` + randomBytes(32).toString('base64url') // placeholder; real argon2 set via set-password link

const api = async (path) => {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') },
  })
  if (!res.ok) throw new Error(`Appwrite ${path} -> ${res.status}`)
  return res.json()
}

const PAGE_SIZE = 25

const listAll = async (path) => {
  const out = []
  const seen = new Set()
  let offset = 0
  for (;;) {
    const page = await api(`${path}${path.includes('?') ? '&' : '?'}limit=${PAGE_SIZE}&offset=${offset}`)
    const docs = page.documents || []
    let newCount = 0
    for (const doc of docs) {
      if (!seen.has(doc.$id)) {
        seen.add(doc.$id)
        out.push(doc)
        newCount++
      }
    }
    if (!newCount) break
    offset += docs.length
  }
  return out
}

const baseUrl = () => env('APPWRITE_ENDPOINT').replace(/\/v1\/?$/, '') + '/v1'

const checkCollection = async (label, collectionId) => {
  const dbId = env('APPWRITE_DB_ID')
  const res = await fetch(
    `${baseUrl()}/databases/${dbId}/collections/${collectionId}`,
    { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const msg = body?.message || res.statusText
    throw new Error(`[validate] ${label}: collection "${collectionId}" not found (${res.status}: ${msg})`)
  }
  console.log(`[validate] ${label}: OK`)
}

const main = async () => {
  if (listMode) {
    const dbId = env('APPWRITE_DB_ID')
    const res = await fetch(
      `${baseUrl()}/databases/${dbId}/collections?limit=100`,
      { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
    )
    const data = await res.json()
    console.log(`Collections in database ${dbId}:`)
    for (const c of data.collections || []) {
      console.log(`  ${c.$id}  ${c.name}`)
    }
    return
  }

  const collections = {
    users: env('APPWRITE_USERS_COLLECTION'),
    groups: env('APPWRITE_GROUPS_COLLECTION'),
    members: env('APPWRITE_MEMBERS_COLLECTION'),
    events: env('APPWRITE_EVENTS_COLLECTION'),
    tags: env('APPWRITE_TAGS_COLLECTION'),
  }
  const missing = Object.entries(collections).filter(([, v]) => !v)
  if (missing.length) {
    throw new Error(`[validate] Missing env vars: ${missing.map(([k]) => k.toUpperCase()).join(', ')}`)
  }

  console.log('[validate] Checking collections exist...')
  await Promise.all(Object.entries(collections).map(([k, v]) => checkCollection(k, v)))

  await ensureBuckets()
  const dry = dryRun ? ' (dry run)' : ''

  // Fetch auth users first (needed for per-user event fetching)
  const authUsersRes = await api('/users?limit=100')
  const authUsersById = new Map()
  for (const au of authUsersRes.users || []) authUsersById.set(au.$id, au)
  console.log(`[migrate] auth users: ${authUsersById.size}`)

  const [users, groups, members, tags] = await Promise.all([
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_USERS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_GROUPS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_MEMBERS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_TAGS_COLLECTION')}/documents`),
  ])

  const allEvents = [] // skipping events (Appwrite Cloud free tier limit)

  console.log(`[migrate]${dry} users=${users.length} groups=${groups.length} members=${members.length} events=${allEvents.length} tags=${tags.length}`)

  if (dry) return

  const report = { users: 0, groups: groups.length, members: members.length, events: allEvents.length, tags: tags.length }

  // users: merge auth user (email/name) with DB collection (avatarFileId)
  const dbUsersById = new Map()
  for (const u of users) dbUsersById.set(u.$id, u)

  for (const [id, auth] of authUsersById) {
    const email = (auth.email || '').toLowerCase()
    if (!email) {
      console.warn(`[migrate] user skip ${id}: no email`)
      continue
    }
    const name = auth.name || email.split('@')[0]
    const dbUser = dbUsersById.get(id)
    await prisma.user.upsert({
      where: { email },
      update: { needsPasswordSet: true },
      create: {
        id,
        email,
        passwordHash: hashPassword(),
        name,
        avatarObjectKey: dbUser?.avatarFileId ? `avatar-${id}` : null,
        needsPasswordSet: true,
      },
    })
    report.users++
    if (dbUser?.avatarFileId) {
      try {
        const file = await fetch(
          `${baseUrl()}/storage/buckets/${env('APPWRITE_AVATAR_BUCKET')}/files/${dbUser.avatarFileId}/download`,
          { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
        )
        const buf = Buffer.from(await file.arrayBuffer())
        await putObject(BUCKETS.avatars, `avatar-${id}`, buf, file.headers.get('content-type') || 'image/png')
      } catch (err) {
        console.warn(`[migrate] avatar skip ${email}: ${err.message}`)
      }
    }
  }

  for (const g of groups) {
    await prisma.group.upsert({
      where: { id: g.$id },
      update: { name: g.name, color: g.color || '#f43f5e', inviteCode: g.inviteCode },
      create: {
        id: g.$id,
        name: g.name,
        color: g.color || '#f43f5e',
        ownerUserId: g.ownerId || g.ownerUserId || users[0]?.$id,
        inviteCode: g.inviteCode,
      },
    })
  }

  for (const m of members) {
    const email = (m.email || '').toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } }).catch(() => null)
    const groupExists = groups.some((g) => g.$id === m.groupId)
    if (!groupExists) {
      console.warn(`[migrate] member skip ${email}: group ${m.groupId} not found`)
      continue
    }
    await prisma.groupMember.upsert({
      where: { id: m.$id },
      update: {},
      create: {
        id: m.$id,
        groupId: m.groupId,
        userId: user?.id ?? null,
        email,
        name: m.name || email.split('@')[0],
        joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
      },
    })
  }

  for (const t of tags) {
    const groupExists = groups.some((g) => g.$id === t.groupId)
    if (!groupExists) {
      console.warn(`[migrate] tag skip "${t.name}": group ${t.groupId} not found`)
      continue
    }
    await prisma.tag.upsert({
      where: { id: t.$id },
      update: { name: t.name, color: t.color || '#6B7280' },
      create: {
        id: t.$id,
        groupId: t.groupId,
        name: t.name,
        color: t.color || '#6B7280',
        icon: t.icon ?? null,
        imageObjectKey: t.imageId ? `tag-${t.$id}` : null,
      },
    })
    if (t.imageId) {
      try {
        const file = await fetch(
          `${baseUrl()}/storage/buckets/${env('APPWRITE_TAG_ICONS_BUCKET')}/files/${t.imageId}/download`,
          { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
        )
        const buf = Buffer.from(await file.arrayBuffer())
        await putObject(BUCKETS.tagIcons, `tag-${t.$id}`, buf, file.headers.get('content-type') || 'image/png')
      } catch (err) {
        console.warn(`[migrate] tag icon skip ${t.name}: ${err.message}`)
      }
    }
  }

  for (const e of allEvents) {
    const groupExists = groups.some((g) => g.$id === e.groupId)
    if (!groupExists) {
      console.warn(`[migrate] event skip "${e.title}": group ${e.groupId} not found`)
      continue
    }
    await prisma.event.upsert({
      where: { id: e.$id },
      update: {},
      create: {
        id: e.$id,
        groupId: e.groupId,
        title: e.title,
        notes: e.notes || '',
        start: new Date(e.start),
        end: new Date(e.end || e.start),
        people: Array.isArray(e.people) ? e.people : [],
        tagId: e.tagId || '',
        userId: e.userId || groups.find((g) => g.$id === e.groupId)?.ownerId || users[0]?.$id,
      },
    })
  }

  // Calendar feeds: reproduce object keys so existing webcal subscriptions keep working
  for (const g of groups) {
    for (const m of members.filter((mm) => mm.groupId === g.$id && mm.userId)) {
      const key = getLiveFeedFileId({ groupId: g.$id, userId: m.userId })
      const src = `${baseUrl()}/storage/buckets/${env('APPWRITE_CALENDAR_FEEDS_BUCKET')}/files/${encodeURIComponent(key)}/download`
      try {
        const res = await fetch(src, {
          headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') },
        })
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          await putObject(BUCKETS.calendarFeeds, key, buf, 'text/calendar; charset=utf-8')
          report.calendarFeeds = (report.calendarFeeds || 0) + 1
        }
      } catch {
        // no feed yet — fine
      }
    }
  }

  await prisma.$disconnect()
  await import('node:fs/promises').then((fs) =>
    fs.writeFile('migration-report.json', JSON.stringify(report, null, 2)),
  )
  console.log('[migrate] done', report)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
