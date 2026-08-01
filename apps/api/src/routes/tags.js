import { Hono } from 'hono'
import { prisma } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { notFound, forbidden } from '../errors.js'
import { deleteObject, getObject, BUCKETS, presignGetUrl } from '../s3.js'

export const tagToJson = async (tag) => {
  let imageUrl = null
  if (tag.imageObjectKey) {
    try {
      await getObject(BUCKETS.tagIcons, tag.imageObjectKey)
      imageUrl = await presignGetUrl(BUCKETS.tagIcons, tag.imageObjectKey)
    } catch {
      imageUrl = null
    }
  }
  return {
    $id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon ?? null,
    imageId: tag.imageObjectKey ?? '',
    imageUrl,
  }
}

const requireTagMember = async (c, next) => {
  const user = c.get('user')
  const tag = await prisma.tag.findUnique({ where: { id: c.req.param('id') } })
  if (!tag) throw notFound('Tag not found.')
  const membership = await prisma.groupMember.findFirst({
    where: { groupId: tag.groupId, userId: user.id },
  })
  if (!membership) throw forbidden('You are not a member of this group.')
  c.set('tag', tag)
  await next()
}

const tags = new Hono()

tags.use('*', requireAuth)

tags.patch('/:id', requireTagMember, async (c) => {
  const tag = c.get('tag')
  const form = await c.req.formData().catch(() => null)
  const data = {}
  if (typeof form?.get('name') === 'string' && form.get('name').trim()) data.name = form.get('name').trim()
  if (typeof form?.get('color') === 'string' && form.get('color').trim()) data.color = form.get('color').trim()
  const updated = await prisma.tag.update({ where: { id: tag.id }, data })
  return c.json({ tag: await tagToJson(updated) })
})

tags.delete('/:id', requireTagMember, async (c) => {
  const tag = c.get('tag')
  if (tag.imageObjectKey) await deleteObject(BUCKETS.tagIcons, tag.imageObjectKey).catch(() => {})
  await prisma.tag.delete({ where: { id: tag.id } })
  return c.json({ ok: true })
})

export default tags
