import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hono } from 'hono'

let staticPath
let app

describe('static application server', () => {
  beforeAll(async () => {
    staticPath = await mkdtemp(join(tmpdir(), 'baobun-static-'))
    await mkdir(join(staticPath, 'assets'))
    await writeFile(join(staticPath, 'index.html'), '<h1>Baobun</h1>')
    await writeFile(join(staticPath, 'assets', 'app.js'), 'console.log("baobun")')
    process.env.STATIC_DIR = staticPath

    const { serveStaticApp } = await import('../src/staticApp.js')
    app = new Hono()
    app.get('*', serveStaticApp)
  })

  afterAll(() => rm(staticPath, { recursive: true, force: true }))

  it('serves assets and falls back to the SPA entry point', async () => {
    const asset = await app.request('/assets/app.js')
    expect(asset.status).toBe(200)
    expect(asset.headers.get('cache-control')).toContain('immutable')

    const route = await app.request('/settings/groups')
    expect(route.status).toBe(200)
    expect(await route.text()).toContain('Baobun')
  })

  it('does not turn missing API routes into HTML', async () => {
    expect((await app.request('/api/missing')).status).toBe(404)
  })
})
