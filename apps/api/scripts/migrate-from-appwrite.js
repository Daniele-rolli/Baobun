import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import { getLiveFeedFileId } from '@baobun/shared'
import { ensureStorage, putObject, BUCKETS } from '../src/storage.js'
import { hashPassword } from '../src/password.js'

const prisma = new PrismaClient()

const env = (k) => process.env[k]
const dryRun = process.argv.includes('--dry-run')
const listMode = process.argv.includes('--list')

const api = async (path) => {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') },
  })
  if (!res.ok) throw new Error(`Appwrite ${path} -> ${res.status}`)
  return res.json()
}

const PAGE_SIZE = 100
const paginationQuery = (method, value) =>
  encodeURIComponent(JSON.stringify({ method, values: [value] }))

const listAll = async (path, resultKey = 'documents') => {
  const out = []
  const seen = new Set()
  let offset = 0
  for (;;) {
    const separator = path.includes('?') ? '&' : '?'
    const page = await api(
      `${path}${separator}queries[]=${paginationQuery('limit', PAGE_SIZE)}&queries[]=${paginationQuery('offset', offset)}`,
    )
    const docs = page[resultKey] || []
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
  const required = [
    'APPWRITE_ENDPOINT',
    'APPWRITE_PROJECT_ID',
    'APPWRITE_API_KEY',
    'APPWRITE_DB_ID',
    'APPWRITE_AVATAR_BUCKET',
    'APPWRITE_TAG_ICONS_BUCKET',
    'APPWRITE_CALENDAR_FEEDS_BUCKET',
  ]
  const missingRequired = required.filter((key) => !env(key))
  if (missingRequired.length) {
    throw new Error(`[validate] Missing env vars: ${missingRequired.join(', ')}`)
  }

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
    await prisma.$disconnect()
    return
  }

  const collections = {
    users: env('APPWRITE_USERS_COLLECTION'),
    groups: env('APPWRITE_GROUPS_COLLECTION'),
    members: env('APPWRITE_MEMBERS_COLLECTION'),
    events: env('APPWRITE_EVENTS_COLLECTION'),
    tags: env('APPWRITE_TAGS_COLLECTION'),
  }
  const missingCollections = Object.entries(collections).filter(([, value]) => !value)
  if (missingCollections.length) {
    throw new Error(
      `[validate] Missing collection env vars: ${missingCollections
        .map(([key]) => `APPWRITE_${key.toUpperCase()}_COLLECTION`)
        .join(', ')}`,
    )
  }

  console.log('[validate] Checking collections exist...')
  await Promise.all(Object.entries(collections).map(([k, v]) => checkCollection(k, v)))

  const dry = dryRun ? ' (dry run)' : ''

  // Fetch auth users first so relations can be validated before anything is written.
  const authUsers = await listAll('/users', 'users')
  console.log(`[migrate] auth users: ${authUsers.length}`)

  const [users, groups, members, events, tags] = await Promise.all([
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_USERS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_GROUPS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_MEMBERS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_EVENTS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_TAGS_COLLECTION')}/documents`),
  ])

  console.log(
    `[migrate]${dry} users=${authUsers.length} groups=${groups.length} members=${members.length} events=${events.length} tags=${tags.length}`,
  )

  if (dry) {
    await prisma.$disconnect()
    return
  }

  if (!authUsers.length) throw new Error('[validate] Appwrite has no auth users to migrate.')
  await ensureStorage()
  const report = { users: 0, groups: 0, members: 0, events: 0, tags: 0, calendarFeeds: 0 }

  // users: merge auth user (email/name) with DB collection (avatarFileId)
  const dbUsersById = new Map()
  for (const u of users) dbUsersById.set(u.$id, u)

  for (const auth of authUsers) {
    const id = auth.$id
    const email = (auth.email || '').toLowerCase()
    if (!email) {
      console.warn(`[migrate] user skip ${id}: no email`)
      continue
    }
    const name = auth.name || email.split('@')[0]
    const dbUser = dbUsersById.get(id)
    const avatarObjectKey = dbUser?.avatarFileId ? `avatar-${id}` : null
    await prisma.user.upsert({
      where: { email },
      update: { name, avatarObjectKey },
      create: {
        id,
        email,
        passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
        name,
        avatarObjectKey,
        needsPasswordSet: true,
      },
    })
    report.users++
    if (dbUser?.avatarFileId) {
      try {
        const file = await fetch(
          `${baseUrl()}/storage/buckets/${env('APPWRITE_AVATAR_BUCKET')}/files/${encodeURIComponent(dbUser.avatarFileId)}/download`,
          { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
        )
        if (!file.ok) throw new Error(`Appwrite avatar download -> ${file.status}`)
        const buf = Buffer.from(await file.arrayBuffer())
        await putObject(BUCKETS.avatars, `avatar-${id}`, buf, file.headers.get('content-type') || 'image/png')
      } catch (err) {
        console.warn(`[migrate] avatar skip ${email}: ${err.message}`)
      }
    }
  }

  for (const g of groups) {
    const ownerUserId = g.ownerId || g.ownerUserId
    const owner =
      (ownerUserId && (await prisma.user.findUnique({ where: { id: ownerUserId } }))) ||
      (await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } }))
    if (!owner) {
      console.warn(`[migrate] group skip "${g.name}": owner not found`)
      continue
    }
    const inviteCode =
      g.inviteCode || g.$id.replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase()
    await prisma.group.upsert({
      where: { id: g.$id },
      update: { name: g.name, color: g.color || '#f43f5e', inviteCode, ownerUserId: owner.id },
      create: {
        id: g.$id,
        name: g.name,
        color: g.color || '#f43f5e',
        ownerUserId: owner.id,
        inviteCode,
      },
    })
    report.groups++
  }

  for (const m of members) {
    const email = (m.email || '').toLowerCase()
    const user =
      (m.userId && (await prisma.user.findUnique({ where: { id: m.userId } }))) ||
      (email && (await prisma.user.findUnique({ where: { email } }).catch(() => null)))
    const group = await prisma.group.findUnique({ where: { id: m.groupId } })
    if (!group) {
      console.warn(`[migrate] member skip ${email}: group ${m.groupId} not found`)
      continue
    }
    const memberData = {
      groupId: m.groupId,
      userId: user?.id ?? null,
      email: email || user?.email || `migrated-${m.$id}@invalid.local`,
      name: m.name || user?.name || email.split('@')[0] || 'Migrated member',
      joinedAt: m.joinedAt ? new Date(m.joinedAt) : new Date(),
      role: user?.id === group.ownerUserId ? 'OWNER' : 'MEMBER',
    }
    await prisma.groupMember.upsert({
      where: { id: m.$id },
      update: memberData,
      create: {
        id: m.$id,
        ...memberData,
      },
    })
    report.members++
  }

  for (const t of tags) {
    const groupExists = groups.some((g) => g.$id === t.groupId)
    if (!groupExists) {
      console.warn(`[migrate] tag skip "${t.name}": group ${t.groupId} not found`)
      continue
    }
    await prisma.tag.upsert({
      where: { id: t.$id },
      update: {
        name: t.name,
        color: t.color || '#6B7280',
        icon: t.icon ?? null,
        imageObjectKey: t.imageId ? `tag-${t.$id}` : null,
      },
      create: {
        id: t.$id,
        groupId: t.groupId,
        name: t.name,
        color: t.color || '#6B7280',
        icon: t.icon ?? null,
        imageObjectKey: t.imageId ? `tag-${t.$id}` : null,
      },
    })
    report.tags++
    if (t.imageId) {
      try {
        const file = await fetch(
          `${baseUrl()}/storage/buckets/${env('APPWRITE_TAG_ICONS_BUCKET')}/files/${encodeURIComponent(t.imageId)}/download`,
          { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
        )
        if (!file.ok) throw new Error(`Appwrite tag icon download -> ${file.status}`)
        const buf = Buffer.from(await file.arrayBuffer())
        await putObject(BUCKETS.tagIcons, `tag-${t.$id}`, buf, file.headers.get('content-type') || 'image/png')
      } catch (err) {
        console.warn(`[migrate] tag icon skip ${t.name}: ${err.message}`)
      }
    }
  }

  for (const e of events) {
    const group = await prisma.group.findUnique({ where: { id: e.groupId } })
    if (!group) {
      console.warn(`[migrate] event skip "${e.title}": group ${e.groupId} not found`)
      continue
    }
    const creator =
      (e.userId && (await prisma.user.findUnique({ where: { id: e.userId } }))) ||
      (await prisma.user.findUnique({ where: { id: group.ownerUserId } }))
    const start = new Date(e.start)
    const end = new Date(e.end || e.start)
    if (!creator || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      console.warn(`[migrate] event skip "${e.title}": invalid creator or date`)
      continue
    }
    await prisma.event.upsert({
      where: { id: e.$id },
      update: {
        title: e.title,
        notes: e.notes || '',
        start,
        end,
        people: Array.isArray(e.people) ? e.people : [],
        tagId: e.tagId || '',
      },
      create: {
        id: e.$id,
        groupId: e.groupId,
        title: e.title,
        notes: e.notes || '',
        start,
        end,
        people: Array.isArray(e.people) ? e.people : [],
        tagId: e.tagId || '',
        userId: creator.id,
      },
    })
    report.events++
  }

  // Calendar feeds: reproduce object keys so existing webcal subscriptions keep working
  for (const g of groups) {
    const migratedMembers = await prisma.groupMember.findMany({
      where: { groupId: g.$id, userId: { not: null } },
    })
    for (const member of migratedMembers) {
      const key = getLiveFeedFileId({ groupId: g.$id, userId: member.userId })
      const src = `${baseUrl()}/storage/buckets/${env('APPWRITE_CALENDAR_FEEDS_BUCKET')}/files/${encodeURIComponent(key)}/download`
      try {
        const res = await fetch(src, {
          headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') },
        })
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          await putObject(BUCKETS.calendarFeeds, key, buf, 'text/calendar; charset=utf-8')
          report.calendarFeeds++
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
