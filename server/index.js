import { createServer } from 'node:http'
import { createDb } from './db.js'
import { handleAuth } from './auth.js'
import { handleApi } from './api.js'
import { scheduleDailyDigest } from './aidigest.js'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.join(__dirname, '..')
const DIST_DIR = path.join(PROJECT_ROOT, 'dist')
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public')
const UPLOAD_DIR = path.join(PROJECT_ROOT, 'uploads')
const PORT = process.env.PORT || 3001
const SITE_URL = (process.env.SITE_URL || `http://localhost:${PORT}`).replace(/\/$/, '')

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

  // RSS 订阅
  if (pathname === '/feed.xml' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' })
    return res.end(buildFeed(db, req.headers.host || `localhost:${PORT}`))
  }

  // 静态文件：单进程伺服前端
  // 有 dist/ 构建产物优先用（npm run build 后），否则直接伺服源码（免构建）
  let rel = pathname === '/' ? '/index.html' : pathname
  try { rel = decodeURIComponent(rel) } catch { /* 保持原样 */ }
  const useDist = fs.existsSync(path.join(DIST_DIR, 'index.html'))
  const candidates = []
  if (rel.startsWith('/uploads/')) {
    candidates.push(path.join(UPLOAD_DIR, rel.slice('/uploads/'.length)))
  } else {
    if (!useDist) candidates.push(path.join(PUBLIC_DIR, rel))
    candidates.push(path.join(useDist ? DIST_DIR : PROJECT_ROOT, rel))
  }

  for (const file of candidates) {
    const resolved = path.resolve(file)
    let allowed
    if (resolved.startsWith(UPLOAD_DIR + path.sep)) {
      allowed = true
    } else if (useDist) {
      allowed = resolved.startsWith(DIST_DIR + path.sep)
    } else {
      // 源码模式白名单：只允许 index.html、src/、public/
      allowed =
        resolved === path.join(PROJECT_ROOT, 'index.html') ||
        resolved.startsWith(path.join(PROJECT_ROOT, 'src') + path.sep) ||
        resolved.startsWith(PUBLIC_DIR + path.sep)
    }
    if (!allowed) continue
    let stat
    try { stat = fs.statSync(resolved) } catch { continue }
    if (!stat.isFile()) continue
    const ext = path.extname(resolved).toLowerCase()
    // 协商缓存：文件变了才重新下载
    const etag = `W/"${stat.size.toString(36)}-${stat.mtimeMs.toString(36)}"`
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' })
      return res.end()
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      ETag: etag,
      'Cache-Control': 'no-cache'
    })
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
  scheduleDailyDigest(db)
})

// RSS 2.0 订阅源
function xmlEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function buildFeed(db, host) {
  const siteUrl = process.env.SITE_URL || `http://${host}`
  const posts = db.prepare(
    'SELECT title, slug, excerpt, body_html, created_at FROM posts WHERE is_draft = 0 ORDER BY created_at DESC LIMIT 20'
  ).all()

  const items = posts.map(p => {
    const plain = p.excerpt || String(p.body_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
    const url = `${siteUrl}/#/post/${p.slug}`
    const rfc822 = new Date((p.created_at || '').replace(' ', 'T') + 'Z').toUTCString()
    return `    <item>
      <title>${xmlEsc(p.title)}</title>
      <link>${xmlEsc(url)}</link>
      <guid isPermaLink="true">${xmlEsc(url)}</guid>
      <pubDate>${rfc822}</pubDate>
      <description>${xmlEsc(plain)}</description>
    </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>指挥官的个人博客</title>
    <link>${xmlEsc(siteUrl)}</link>
    <description>技术、硬件与思考 · 指挥官的博客</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEsc(siteUrl)}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`
}
