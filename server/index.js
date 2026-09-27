import { createServer } from 'node:http'
import { createDb } from './db.js'
import { handleAuth } from './auth.js'
import { handleApi } from './api.js'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')
const DIST_DIR = path.join(PROJECT_ROOT, 'dist')
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public')
const PORT = process.env.PORT || 3001

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
}

// 初始化数据库
const db = await createDb()

// 简易 JWT (HMAC-SHA256)
const JWT_SECRET = process.env.JWT_SECRET || 'hana-blog-secret-2026'

function signJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const data = `${header}.${body}`
  const sig = cryptoHmac(data, JWT_SECRET)
  return `${data}.${sig}`
}

function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expected = cryptoHmac(`${header}.${body}`, JWT_SECRET)
  if (sig !== expected) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && payload.exp < Date.now() / 1000) return null
    return payload
  } catch { return null }
}

import crypto from 'node:crypto'

function cryptoHmac(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) reject(new Error('too large')) })
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) }
      catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

function json(res, status, body) {
  const str = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(str),
    'Access-Control-Allow-Origin': '*'
  })
  res.end(str)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const pathname = url.pathname

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    })
    return res.end()
  }

  // API routes
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname.startsWith('/api/auth/')) {
        return await handleAuth(req, res, db, { signJwt, verifyJwt, readBody, json })
      }
      return await handleApi(req, res, db, { verifyJwt, readBody, json })
    } catch (err) {
      json(res, 500, { error: err.message })
    }
    return
  }

  // 静态文件：单进程伺服前端
  // 有 dist/ 构建产物优先用（npm run build 后），否则直接伺服源码（免构建）
  let rel = pathname === '/' ? '/index.html' : pathname
  try { rel = decodeURIComponent(rel) } catch { /* 保持原样 */ }
  const useDist = fs.existsSync(path.join(DIST_DIR, 'index.html'))
  const candidates = useDist
    ? [path.join(DIST_DIR, rel)]
    : [path.join(PUBLIC_DIR, rel), path.join(PROJECT_ROOT, rel)]

  for (const file of candidates) {
    const resolved = path.resolve(file)
    const allowed = useDist
      ? resolved.startsWith(DIST_DIR + path.sep)
      : resolved.startsWith(PUBLIC_DIR + path.sep) || resolved.startsWith(PROJECT_ROOT + path.sep)
    if (!allowed) continue
    let stat
    try { stat = fs.statSync(resolved) } catch { continue }
    if (!stat.isFile()) continue
    const ext = path.extname(resolved).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    fs.createReadStream(resolved).pipe(res)
    return
  }

  // 未命中：无扩展名的路径兜底回首页，其余 404
  const fallback = path.join(useDist ? DIST_DIR : PROJECT_ROOT, 'index.html')
  if (!path.extname(rel) && fs.existsSync(fallback)) {
    res.writeHead(200, { 'Content-Type': MIME['.html'] })
    fs.createReadStream(fallback).pipe(res)
    return
  }
  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`[server] Blog running at http://localhost:${PORT} (前端 + API 单进程)`)
})
