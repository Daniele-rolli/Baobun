import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import { getLiveFeedFileId } from '@baobun/shared'
import { ensureBuckets, putObject, BUCKETS } from '../src/s3.js'

const prisma = new PrismaClient()

const env = (k) => process.env[k]
const dryRun = process.argv.includes('--dry-run')

const hashPassword = () =>
  `$random$` + randomBytes(32).toString('base64url') // placeholder; real argon2 set via set-password link

const api = async (path) => {
  const res = await fetch(`${env('APPWRITE_ENDPOINT')}/v1${path}`, {
    headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') },
  })
  if (!res.ok) throw new Error(`Appwrite ${path} -> ${res.status}`)
  return res.json()
}

const listAll = async (path) => {
  const out = []
  let offset = 0
  for (;;) {
    const page = await api(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`)
    const docs = page.documents || []
    out.push(...docs)
    if (docs.length < 100) break
    offset += docs.length
  }
  return out
}

const main = async () => {
  await ensureBuckets()
  const dry = dryRun ? ' (dry run)' : ''

  const [users, groups, members, events, tags] = await Promise.all([
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_USERS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_GROUPS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_MEMBERS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_EVENTS_COLLECTION')}/documents`),
    listAll(`/databases/${env('APPWRITE_DB_ID')}/collections/${env('APPWRITE_TAGS_COLLECTION')}/documents`),
  ])

  console.log(`[migrate]${dry} users=${users.length} groups=${groups.length} members=${members.length} events=${events.length} tags=${tags.length}`)

  if (dry) return

  const report = { users: users.length, groups: groups.length, members: members.length, events: events.length, tags: tags.length }

  // users: id = appwrite $id so relationships carry over
  for (const u of users) {
    const email = (u.email || '').toLowerCase()
    await prisma.user.upsert({
      where: { email },
      update: { needsPasswordSet: true },
      create: {
        id: u.$id,
        email,
        passwordHash: hashPassword(),
        name: u.name || email.split('@')[0],
        avatarObjectKey: u.avatarFileId ? `avatar-${u.$id}` : null,
        needsPasswordSet: true,
      },
    })
    if (u.avatarFileId) {
      try {
        const file = await fetch(
          `${env('APPWRITE_ENDPOINT')}/v1/storage/buckets/${env('APPWRITE_AVATAR_BUCKET')}/files/${u.avatarFileId}/download`,
          { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
        )
        const buf = Buffer.from(await file.arrayBuffer())
        await putObject(BUCKETS.avatars, `avatar-${u.$id}`, buf, file.headers.get('content-type') || 'image/png')
      } catch (err) {
        console.warn(`[migrate] avatar skip ${u.email}: ${err.message}`)
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
          `${env('APPWRITE_ENDPOINT')}/v1/storage/buckets/${env('APPWRITE_TAG_ICONS_BUCKET')}/files/${t.imageId}/download`,
          { headers: { 'X-Appwrite-Project': env('APPWRITE_PROJECT_ID'), 'X-Appwrite-Key': env('APPWRITE_API_KEY') } },
        )
        const buf = Buffer.from(await file.arrayBuffer())
        await putObject(BUCKETS.tagIcons, `tag-${t.$id}`, buf, file.headers.get('content-type') || 'image/png')
      } catch (err) {
        console.warn(`[migrate] tag icon skip ${t.name}: ${err.message}`)
      }
    }
  }

  for (const e of events) {
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
      const src = `${env('APPWRITE_ENDPOINT')}/v1/storage/buckets/${env('APPWRITE_CALENDAR_FEEDS_BUCKET')}/files/${encodeURIComponent(key)}/download`
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
