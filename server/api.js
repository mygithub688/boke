// 文章 + 标签 CRUD API（需 JWT 认证）
export async function handleApi(req, res, db, { verifyJwt, readBody, json }) {
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname

  // 认证检查（公开读取除外）
  const isPublic = pathname === '/api/posts' && req.method === 'GET'
  let user = null
  if (!isPublic) {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    const payload = verifyJwt(token)
    if (!payload) return json(res, 401, { error: '未登录' })
    user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(payload.sub)
    if (!user) return json(res, 401, { error: '用户不存在' })
  }

  // ===== 文章 =====

  // GET /api/posts  公开
  if (pathname === '/api/posts' && req.method === 'GET') {
    const posts = db.prepare('SELECT id, title, slug, tag, excerpt, is_featured, created_at, updated_at FROM posts ORDER BY created_at DESC').all()
    const tags = db.prepare('SELECT name FROM tags').all().map(t => t.name)
    return json(res, 200, { posts, tags })
  }

  // GET /api/posts/:slug  公开
  const postGet = pathname.match(/^\/api\/posts\/([\w-]+)$/)
  if (postGet && req.method === 'GET') {
    const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(postGet[1])
    if (!post) return json(res, 404, { error: '文章不存在' })
    const related = db.prepare('SELECT id, title, slug, tag, excerpt, is_featured, created_at FROM posts WHERE id != ? ORDER BY created_at DESC LIMIT 2').all(post.id)
    return json(res, 200, { post, related })
  }

  // POST /api/posts  需要认证
  if (pathname === '/api/posts' && req.method === 'POST') {
    const body = await readBody(req)
    const { title, tag, excerpt, body: bodyHtml, isFeatured } = body
    if (!title || !tag || !bodyHtml) return json(res, 400, { error: 'title, tag, body 必填' })

    const slug = generateSlug(title, db)
    db.prepare('INSERT INTO posts (title, slug, tag, excerpt, body_html, is_featured) VALUES (?, ?, ?, ?, ?, ?)')
      .run(title, slug, tag, excerpt || '', bodyHtml, isFeatured ? 1 : 0)

    // 自动添加标签
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag)

    const post = db.prepare('SELECT id, title, slug, tag, excerpt, is_featured, created_at FROM posts WHERE slug = ?').get(slug)
    return json(res, 201, { post })
  }

  // PUT /api/posts/:id  需要认证
  const postPut = pathname.match(/^\/api\/posts\/(\d+)$/)
  if (postPut && req.method === 'PUT') {
    const id = parseInt(postPut[1])
    const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(id)
    if (!existing) return json(res, 404, { error: '文章不存在' })

    const body = await readBody(req)
    const title = body.title || existing.title
    const tag = body.tag || existing.tag
    const excerpt = body.excerpt !== undefined ? body.excerpt : existing.excerpt
    const bodyHtml = body.body || existing.body_html
    const isFeatured = body.isFeatured !== undefined ? (body.isFeatured ? 1 : 0) : existing.is_featured

    db.prepare('UPDATE posts SET title=?, tag=?, excerpt=?, body_html=?, is_featured=?, updated_at=datetime(\'now\') WHERE id=?')
      .run(title, tag, excerpt, bodyHtml, isFeatured, id)
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag)

    const post = db.prepare('SELECT id, title, slug, tag, excerpt, is_featured, created_at, updated_at FROM posts WHERE id = ?').get(id)
    return json(res, 200, { post })
  }

  // DELETE /api/posts/:id  需要认证
  const postDel = pathname.match(/^\/api\/posts\/(\d+)$/)
  if (postDel && req.method === 'DELETE') {
    const id = parseInt(postDel[1])
    const result = db.prepare('DELETE FROM posts WHERE id = ?').run(id)
    if (result.changes === 0) return json(res, 404, { error: '文章不存在' })
    return json(res, 200, { ok: true })
  }

  // ===== 标签 =====

  // GET /api/tags  公开
  if (pathname === '/api/tags' && req.method === 'GET') {
    const tags = db.prepare(`
      SELECT t.name, COUNT(p.id) as count
      FROM tags t
      LEFT JOIN posts p ON p.tag = t.name
      GROUP BY t.name
      ORDER BY count DESC
    `).all()
    return json(res, 200, { tags })
  }

  // POST /api/tags  需要认证
  if (pathname === '/api/tags' && req.method === 'POST') {
    const body = await readBody(req)
    const { name } = body
    if (!name) return json(res, 400, { error: 'name 必填' })
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name)
    const tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(name)
    return json(res, 201, { tag })
  }

  // DELETE /api/tags/:id  需要认证
  const tagDel = pathname.match(/^\/api\/tags\/(\d+)$/)
  if (tagDel && req.method === 'DELETE') {
    const id = parseInt(tagDel[1])
    // 检查是否有文章引用
    const tag = db.prepare('SELECT name FROM tags WHERE id = ?').get(id)
    if (tag) {
      const usedCount = db.prepare('SELECT COUNT(*) as n FROM posts WHERE tag = ?').get(tag.name).n
      if (usedCount > 0) return json(res, 400, { error: `该标签下有 ${usedCount} 篇文章，无法删除` })
    }
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)
    return json(res, 200, { ok: true })
  }

  // ===== 统计 =====

  // GET /api/stats  需要认证
  if (pathname === '/api/stats' && req.method === 'GET') {
    const postCount = db.prepare('SELECT COUNT(*) as n FROM posts').get().n
    const tagCount = db.prepare('SELECT COUNT(*) as n FROM tags').get().n
    const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n
    const recentPosts = db.prepare('SELECT id, title, slug, tag, created_at FROM posts ORDER BY created_at DESC LIMIT 5').all()
    return json(res, 200, { postCount, tagCount, userCount, recentPosts })
  }

  json(res, 404, { error: 'Not found' })
}

function generateSlug(title, db) {
  let base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 60)
  if (!base) base = 'post'

  let slug = base
  let i = 1
  while (db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug)) {
    slug = `${base}-${i++}`
  }
  return slug
}
