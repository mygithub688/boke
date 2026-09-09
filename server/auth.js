import { hashPassword, verifyPassword } from './db.js'

export async function handleAuth(req, res, db, { signJwt, verifyJwt, readBody, json }) {
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname

  // POST /api/auth/register
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const body = await readBody(req)
    const { username, password, displayName } = body
    if (!username || !password) return json(res, 400, { error: 'username 和 password 必填' })
    if (password.length < 6) return json(res, 400, { error: '密码至少 6 位' })

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existing) return json(res, 409, { error: '用户名已存在' })

    const hash = hashPassword(password)
    db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
      .run(username, hash, displayName || username, 'admin')

    const user = db.prepare('SELECT id, username, display_name, role FROM users WHERE username = ?').get(username)
    const token = signJwt({ sub: user.id, username: user.username, exp: Date.now() / 1000 + 7 * 86400 })
    return json(res, 201, { user, token })
  }

  // POST /api/auth/login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req)
    const { username, password } = body
    if (!username || !password) return json(res, 400, { error: 'username 和 password 必填' })

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
    if (!user) return json(res, 401, { error: '用户名或密码错误' })
    if (!verifyPassword(password, user.password_hash)) return json(res, 401, { error: '用户名或密码错误' })

    const token = signJwt({ sub: user.id, username: user.username, exp: Date.now() / 1000 + 7 * 86400 })
    return json(res, 200, { user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role }, token })
  }

  // GET /api/auth/me
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    const payload = verifyJwt(token)
    if (!payload) return json(res, 401, { error: '未登录或 token 过期' })

    const user = db.prepare('SELECT id, username, display_name, role, created_at FROM users WHERE id = ?').get(payload.sub)
    if (!user) return json(res, 404, { error: '用户不存在' })
    return json(res, 200, { user })
  }

  // PUT /api/auth/password
  if (pathname === '/api/auth/password' && req.method === 'PUT') {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    const payload = verifyJwt(token)
    if (!payload) return json(res, 401, { error: '未登录' })

    const body = await readBody(req)
    const { oldPassword, newPassword } = body
    if (!oldPassword || !newPassword) return json(res, 400, { error: 'oldPassword 和 newPassword 必填' })
    if (newPassword.length < 6) return json(res, 400, { error: '新密码至少 6 位' })

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
    if (!verifyPassword(oldPassword, user.password_hash)) return json(res, 401, { error: '旧密码错误' })

    const newHash = hashPassword(newPassword)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, payload.sub)
    return json(res, 200, { ok: true })
  }

  json(res, 404, { error: 'Not found' })
}
