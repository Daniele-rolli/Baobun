import { readFileSync, writeFileSync } from 'node:fs'
const lines = readFileSync('/tmp/baobun-cookie.txt', 'utf8').split('\n').filter((l) => l && !l.startsWith('#'))
const parts = lines[0].split('\t')
writeFileSync('/tmp/baobun-cookie-hdr.txt', `${parts[5]}=${parts[6]}`)
console.log('cookie name/value:', parts[5], parts[6].slice(0, 8) + '...')
