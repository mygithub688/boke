import { createServer } from 'node:http'
import { createDb } from './db.js'
import { handleAuth } from './auth.js'
import { handleApi } from './api.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001

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

  // 静态文件（前端 build 产物或 vite dev）
  // 开发模式下 Vite 跑在 5173，这里只处理 API
  // 生产模式下可以加静态文件服务
  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`[server] API running at http://localhost:${PORT}`)
  console.log(`[server] Blog frontend at http://localhost:5173`)
})
