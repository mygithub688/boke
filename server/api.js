// 文章 + 标签 CRUD API（需 JWT 认证）+ 搜索 + 草稿 + 浏览量 + 点赞收藏 + 热搜 + AI 新闻
import { getHotTopics, flattenTopics } from './hot.js'
import { getAINews } from './ainews.js'

export async function handleApi(req, res, db, { verifyJwt, readBody, json }) {
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname
  const searchParams = url.searchParams

  // 认证检查（公开读取除外）
  const isPublic =
    (pathname === '/api/posts' && req.method === 'GET') ||
    (pathname === '/api/tags' && req.method === 'GET') ||
    (pathname === '/api/search' && req.method === 'GET') ||
    (pathname === '/api/hot' && req.method === 'GET') ||
    (pathname === '/api/ainews' && req.method === 'GET') ||
    (pathname.startsWith('/api/posts/') && req.method === 'GET') ||
    (pathname === '/api/posts' && req.method === 'GET' && searchParams.has('tag')) ||
    // 点赞/收藏公开（用 user_key）
    (pathname.match(/^\/api\/posts\/\d+\/(like|bookmark|unlike|unbookmark|views)$/) && (req.method === 'POST' || req.method === 'GET'))
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

  // GET /api/posts  公开（支持 ?tag=xxx&page=1&limit=6）
  if (pathname === '/api/posts' && req.method === 'GET') {
    const tag = searchParams.get('tag')
    const page = parseInt(searchParams.get('page')) || 1
    const limit = Math.min(parseInt(searchParams.get('limit')) || 6, 50)
    const offset = (page - 1) * limit

    let where = 'WHERE is_draft = 0'
    const params = []
    if (tag) {
      where += ' AND tag = ?'
      params.push(tag)
    }
    const total = db.prepare(`SELECT COUNT(*) as n FROM posts ${where}`).get(...params).n
    const posts = db.prepare(
      `SELECT id, title, slug, tag, excerpt, is_featured, view_count, created_at, updated_at
       FROM posts ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    const tags = db.prepare(`
      SELECT t.name, COUNT(p.id) as count
      FROM tags t
      LEFT JOIN posts p ON p.tag = t.name AND p.is_draft = 0
      GROUP BY t.name
      ORDER BY count DESC
    `).all()

    return json(res, 200, { posts, tags, total, page, pages: Math.ceil(total / limit) })
  }

  // GET /api/search?q=关键词  公开
  if (pathname === '/api/search' && req.method === 'GET') {
    const q = searchParams.get('q') || ''
    if (!q.trim()) return json(res, 200, { posts: [] })
    const like = `%${q.trim()}%`
    const posts = db.prepare(
      `SELECT id, title, slug, tag, excerpt, is_featured, view_count, created_at
       FROM posts
       WHERE is_draft = 0 AND (title LIKE ? OR excerpt LIKE ? OR body_html LIKE ?)
       ORDER BY created_at DESC LIMIT 20`
    ).all(like, like, like)
    return json(res, 200, { posts, total: posts.length })
  }

  // GET /api/posts/:slug  公开
  const postGet = pathname.match(/^\/api\/posts\/([\w-]+)$/)
  if (postGet && req.method === 'GET') {
    const slug = postGet[1]
    // 排除数字（数字走 POST /like 等子路由）
    if (/^\d+$/.test(slug)) { /* 交给下面处理 */ }
    else {
      const post = db.prepare('SELECT * FROM posts WHERE slug = ?').get(slug)
      if (!post) return json(res, 404, { error: '文章不存在' })
      if (post.is_draft) {
        // 草稿只有登录用户能看
        const authHeader = req.headers['authorization'] || ''
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
        const payload = verifyJwt(token)
        if (!payload) return json(res, 403, { error: '草稿文章，需要登录' })
      }
      // 增加浏览量
      db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(post.id)
      post.view_count += 1

      const related = db.prepare(
        `SELECT id, title, slug, tag, excerpt, is_featured, view_count, created_at
         FROM posts WHERE id != ? AND is_draft = 0 ORDER BY created_at DESC LIMIT 3`
      ).all(post.id)

      return json(res, 200, { post, related })
    }
  }

  // POST /api/posts  需要认证
  if (pathname === '/api/posts' && req.method === 'POST') {
    const body = await readBody(req)
    const { title, tag, excerpt, body: bodyHtml, isFeatured, isDraft } = body
    if (!title || !tag || !bodyHtml) return json(res, 400, { error: 'title, tag, body 必填' })

    const slug = generateSlug(title, db)
    db.prepare('INSERT INTO posts (title, slug, tag, excerpt, body_html, is_featured, is_draft) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(title, slug, tag, excerpt || '', bodyHtml, isFeatured ? 1 : 0, isDraft ? 1 : 0)
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag)

    const post = db.prepare('SELECT id, title, slug, tag, excerpt, is_featured, is_draft, created_at FROM posts WHERE slug = ?').get(slug)
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
    const isDraft = body.isDraft !== undefined ? (body.isDraft ? 1 : 0) : existing.is_draft

    db.prepare(`UPDATE posts SET title=?, tag=?, excerpt=?, body_html=?, is_featured=?, is_draft=?, updated_at=datetime('now') WHERE id=?`)
      .run(title, tag, excerpt, bodyHtml, isFeatured, isDraft, id)
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tag)

    const post = db.prepare('SELECT id, title, slug, tag, excerpt, is_featured, is_draft, view_count, created_at, updated_at FROM posts WHERE id = ?').get(id)
    return json(res, 200, { post })
  }

  // DELETE /api/posts/:id  需要认证
  const postDel = pathname.match(/^\/api\/posts\/(\d+)$/)
  if (postDel && req.method === 'DELETE') {
    const id = parseInt(postDel[1])
    const result = db.prepare('DELETE FROM posts WHERE id = ?').run(id)
    // 清理关联数据
    db.prepare('DELETE FROM likes WHERE post_id = ?').run(id)
    db.prepare('DELETE FROM bookmarks WHERE post_id = ?').run(id)
    if (result.changes === 0) return json(res, 404, { error: '文章不存在' })
    return json(res, 200, { ok: true })
  }

  // ===== 草稿 / 浏览 / 点赞 / 收藏（子路由） =====

  const postSub = pathname.match(/^\/api\/posts\/(\d+)\/(\w+)$/)
  if (postSub) {
    const id = parseInt(postSub[1])
    const action = postSub[2]
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id)
    if (!post) return json(res, 404, { error: '文章不存在' })

    // POST /api/posts/:id/draft  切换草稿状态（需认证）
    if (action === 'draft' && req.method === 'PUT') {
      if (!user) {
        const authHeader = req.headers['authorization'] || ''
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
        const payload = verifyJwt(token)
        if (!payload) return json(res, 401, { error: '未登录' })
      }
      const newDraft = post.is_draft ? 0 : 1
      db.prepare('UPDATE posts SET is_draft = ?, updated_at = datetime(\'now\') WHERE id = ?').run(newDraft, id)
      return json(res, 200, { post: { ...post, is_draft: newDraft } })
    }

    // POST /api/posts/:id/view  增加浏览量（公开）
    if (action === 'view' && req.method === 'POST') {
      db.prepare('UPDATE posts SET view_count = view_count + 1 WHERE id = ?').run(id)
      const vc = db.prepare('SELECT view_count FROM posts WHERE id = ?').get(id).view_count
      return json(res, 200, { view_count: vc })
    }

    // POST /api/posts/:id/like  点赞（公开，用 user_key）
    if (action === 'like' && req.method === 'POST') {
      const body = await readBody(req)
      const userKey = body.user_key || 'anonymous'
      db.prepare('INSERT OR IGNORE INTO likes (post_id, user_key) VALUES (?, ?)').run(id, userKey)
      const likeCount = db.prepare('SELECT COUNT(*) as n FROM likes WHERE post_id = ?').get(id).n
      const liked = db.prepare('SELECT id FROM likes WHERE post_id = ? AND user_key = ?').get(id, userKey)
      return json(res, 200, { like_count: likeCount, liked: !!liked })
    }

    // POST /api/posts/:id/unlike  取消点赞
    if (action === 'unlike' && req.method === 'POST') {
      const body = await readBody(req)
      const userKey = body.user_key || 'anonymous'
      db.prepare('DELETE FROM likes WHERE post_id = ? AND user_key = ?').run(id, userKey)
      const likeCount = db.prepare('SELECT COUNT(*) as n FROM likes WHERE post_id = ?').get(id).n
      return json(res, 200, { like_count: likeCount, liked: false })
    }

    // POST /api/posts/:id/bookmark  收藏
    if (action === 'bookmark' && req.method === 'POST') {
      const body = await readBody(req)
      const userKey = body.user_key || 'anonymous'
      db.prepare('INSERT OR IGNORE INTO bookmarks (post_id, user_key) VALUES (?, ?)').run(id, userKey)
      const bmCount = db.prepare('SELECT COUNT(*) as n FROM bookmarks WHERE post_id = ?').get(id).n
      const bookmarked = db.prepare('SELECT id FROM bookmarks WHERE post_id = ? AND user_key = ?').get(id, userKey)
      return json(res, 200, { bookmark_count: bmCount, bookmarked: !!bookmarked })
    }

    // POST /api/posts/:id/unbookmark  取消收藏
    if (action === 'unbookmark' && req.method === 'POST') {
      const body = await readBody(req)
      const userKey = body.user_key || 'anonymous'
      db.prepare('DELETE FROM bookmarks WHERE post_id = ? AND user_key = ?').run(id, userKey)
      const bmCount = db.prepare('SELECT COUNT(*) as n FROM bookmarks WHERE post_id = ?').get(id).n
      return json(res, 200, { bookmark_count: bmCount, bookmarked: false })
    }

    // GET /api/posts/:id/likes  获取点赞数
    if (action === 'likes' && req.method === 'GET') {
      const likeCount = db.prepare('SELECT COUNT(*) as n FROM likes WHERE post_id = ?').get(id).n
      const bookmarkCount = db.prepare('SELECT COUNT(*) as n FROM bookmarks WHERE post_id = ?').get(id).n
      return json(res, 200, { like_count: likeCount, bookmark_count: bookmarkCount })
    }

    return json(res, 404, { error: 'Not found' })
  }

  // ===== 热搜 =====

  // GET /api/hot  公开（支持 ?source=baidu&toutiao）
  if (pathname === '/api/hot' && req.method === 'GET') {
    const source = searchParams.get('source')
    const agg = await getHotTopics(source)
    const keys = Object.keys(agg)
    if (keys.length === 0) {
      return json(res, 200, { sources: {}, flat: [] })
    }
    const flat = flattenTopics(agg).slice(0, 50)
    return json(res, 200, { sources: agg, flat })
  }

  // ===== AI 新闻 =====

  // GET /api/ainews  公开（支持 ?source=hn&hf&gh）
  if (pathname === '/api/ainews' && req.method === 'GET') {
    const source = searchParams.get('source')
    const agg = await getAINews(source)
    return json(res, 200, { sources: agg })
  }

  // ===== 标签 =====

  // GET /api/tags  公开
  if (pathname === '/api/tags' && req.method === 'GET') {
    const tags = db.prepare(`
      SELECT t.name, COUNT(p.id) as count
      FROM tags t
      LEFT JOIN posts p ON p.tag = t.name AND p.is_draft = 0
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
    const postCount = db.prepare('SELECT COUNT(*) as n FROM posts WHERE is_draft = 0').get().n
    const draftCount = db.prepare('SELECT COUNT(*) as n FROM posts WHERE is_draft = 1').get().n
    const tagCount = db.prepare('SELECT COUNT(*) as n FROM tags').get().n
    const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n
    const totalViews = db.prepare('SELECT COALESCE(SUM(view_count),0) as n FROM posts').get().n
    const totalLikes = db.prepare('SELECT COALESCE(SUM(n),0) as n FROM (SELECT COUNT(*) as n FROM likes GROUP BY post_id)').get().n
    const recentPosts = db.prepare(
      'SELECT id, title, slug, tag, is_draft, view_count, created_at FROM posts ORDER BY created_at DESC LIMIT 5'
    ).all()
    const topViewed = db.prepare(
      'SELECT id, title, slug, view_count FROM posts WHERE is_draft = 0 ORDER BY view_count DESC LIMIT 5'
    ).all()
    return json(res, 200, { postCount, draftCount, tagCount, userCount, totalViews, totalLikes, recentPosts, topViewed })
  }

  // ===== 管理面板专用：获取所有文章（含草稿） =====
  if (pathname === '/api/admin/posts' && req.method === 'GET') {
    const posts = db.prepare(
      'SELECT id, title, slug, tag, excerpt, is_featured, is_draft, view_count, created_at, updated_at FROM posts ORDER BY created_at DESC'
    ).all()
    const tags = db.prepare('SELECT name FROM tags ORDER BY name').all().map(t => t.name)
    return json(res, 200, { posts, tags })
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
