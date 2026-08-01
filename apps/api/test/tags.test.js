import { describe, it, expect, beforeAll } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/db.js'

const email = 'tags-test@example.com'
let cookie = ''
let groupId = ''
let tagId = ''

const req = (path, { method = 'GET', body } = {}) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  })

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email } })
  const reg = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'T', email, password: 'password123' }),
  })
  cookie = reg.headers.get('set-cookie') || ''
  const create = await req('/api/groups', { method: 'POST', body: { name: 'TagsG' } })
  groupId = (await create.json()).group.$id
})

describe('tags', () => {
  it('creates, lists, patches and deletes a tag', async () => {
    const form = new FormData()
    form.append('name', 'Urgent')
    form.append('color', '#ef4444')
    const create = await app.request(`/api/groups/${groupId}/tags`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    })
    expect(create.status).toBe(201)
    const { tag } = await create.json()
    tagId = tag.$id
    expect(tag.name).toBe('Urgent')
    expect(tag.imageUrl).toBeNull()

    const list = await req(`/api/groups/${groupId}/tags`)
    expect((await list.json()).tags.some((t) => t.$id === tagId)).toBe(true)

    const patchForm = new FormData()
    patchForm.append('color', '#f97316')
    const patch = await app.request(`/api/tags/${tagId}`, {
      method: 'PATCH',
      headers: { cookie },
      body: patchForm,
    })
    expect((await patch.json()).tag.color).toBe('#f97316')

    const del = await req(`/api/tags/${tagId}`, { method: 'DELETE' })
    expect(del.status).toBe(200)
  })
})
