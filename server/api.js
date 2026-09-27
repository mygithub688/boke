// 文章 + 标签 CRUD API（需 JWT 认证）+ 搜索 + 草稿 + 浏览量 + 点赞收藏 + 热搜 + AI 新闻
// + 评论 + 归档 + 友链 + 访问统计 + 图片上传 + 本地 AI（摘要/写作助手/日报）
import { getHotTopics, flattenTopics } from './hot.js'
import { getAINews } from './ainews.js'
import { generateSummary, writeAssist } from './ai.js'
import { generateDailyDigest } from './aidigest.js'
import { createRateLimiter } from './ratelimit.js'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

const commentLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 })   // 每 key 10 分钟 5 条
const aiLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 6 })             // AI 摘要 全局 6 次/分钟
const pendingSummaries = new Map() // slug → Promise，防止并发重复生成

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
    (pathname === '/api/archive' && req.method === 'GET') ||
    (pathname === '/api/links' && req.method === 'GET') ||
    (pathname === '/api/track' && req.method === 'POST') ||
    (pathname === '/api/ai/summary' && req.method === 'POST') ||
    (pathname.startsWith('/api/posts/') && req.method === 'GET') ||
    (pathname === '/api/posts' && req.method === 'GET' && searchParams.has('tag')) ||
    // 点赞/收藏公开（用 user_key）
    (pathname.match(/^\/api\/posts\/\d+\/(like|bookmark|unlike|unbookmark|views)$/) && (req.method === 'POST' || req.method === 'GET')) ||
    // 评论：浏览公开，发表公开（限流）
    (pathname.match(/^\/api\/posts\/\d+\/comments$/) && (req.method === 'GET' || req.method === 'POST'))
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
    db.prepare('DELETE FROM comments WHERE post_id = ?').run(id)
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

    // GET /api/posts/:id/comments  评论列表（公开）
    if (action === 'comments' && req.method === 'GET') {
      const comments = db.prepare(
        'SELECT id, nickname, content, created_at FROM comments WHERE post_id = ? ORDER BY created_at DESC LIMIT 100'
      ).all(id)
      return json(res, 200, { comments, total: comments.length })
    }

    // POST /api/posts/:id/comments  发表评论（公开，限流）
    if (action === 'comments' && req.method === 'POST') {
      const body = await readBody(req)
      const nickname = String(body.nickname || '').trim().slice(0, 30)
      const content = String(body.content || '').trim().slice(0, 1000)
      if (!nickname || !content) return json(res, 400, { error: '昵称和内容必填' })
      const userKey = String(body.user_key || '').slice(0, 40) || 'anonymous'
      const ip = req.socket?.remoteAddress || ''
      if (!commentLimiter(userKey + ip)) {
        return json(res, 429, { error: '评论太频繁了，休息一下再发' })
      }
      const r = db.prepare('INSERT INTO comments (post_id, user_key, nickname, content, ip) VALUES (?, ?, ?, ?, ?)')
        .run(id, userKey, nickname, content, ip)
      const comment = db.prepare('SELECT id, nickname, content, created_at FROM comments WHERE id = ?').get(r.lastInsertRowid)
      const total = db.prepare('SELECT COUNT(*) as n FROM comments WHERE post_id = ?').get(id).n
      return json(res, 201, { comment, total })
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
    const agg = await getAINews()
    return json(res, 200, { sections: agg })
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

  // ===== 归档（公开） =====
  if (pathname === '/api/archive' && req.method === 'GET') {
    const posts = db.prepare(
      `SELECT id, title, slug, tag, view_count, created_at FROM posts WHERE is_draft = 0 ORDER BY created_at DESC`
    ).all()
    return json(res, 200, { posts, total: posts.length })
  }

  // ===== 友链 =====
  if (pathname === '/api/links' && req.method === 'GET') {
    const links = db.prepare('SELECT id, name, url, description FROM friend_links ORDER BY sort, id').all()
    return json(res, 200, { links })
  }
  if (pathname === '/api/links' && req.method === 'POST') {
    const body = await readBody(req)
    const name = String(body.name || '').trim().slice(0, 30)
    const linkUrl = String(body.url || '').trim().slice(0, 200)
    const description = String(body.description || '').trim().slice(0, 60)
    if (!name || !linkUrl) return json(res, 400, { error: 'name 和 url 必填' })
    if (!/^https?:\/\//.test(linkUrl)) return json(res, 400, { error: 'url 需以 http(s):// 开头' })
    const r = db.prepare('INSERT INTO friend_links (name, url, description) VALUES (?, ?, ?)').run(name, linkUrl, description)
    return json(res, 201, { link: db.prepare('SELECT id, name, url, description FROM friend_links WHERE id = ?').get(r.lastInsertRowid) })
  }
  const linkDel = pathname.match(/^\/api\/links\/(\d+)$/)
  if (linkDel && req.method === 'DELETE') {
    db.prepare('DELETE FROM friend_links WHERE id = ?').run(parseInt(linkDel[1]))
    return json(res, 200, { ok: true })
  }

  // ===== 访问统计（PV/UV） =====
  if (pathname === '/api/track' && req.method === 'POST') {
    const body = await readBody(req)
    const userKey = String(body.user_key || '').slice(0, 40)
    if (userKey) {
      const day = new Date().toISOString().slice(0, 10)
      db.prepare('INSERT OR IGNORE INTO visits (day, user_key) VALUES (?, ?)').run(day, userKey)
      db.prepare(`INSERT INTO stats_daily (day, pv) VALUES (?, 1)
                  ON CONFLICT(day) DO UPDATE SET pv = pv + 1`).run(day)
    }
    return json(res, 200, { ok: true })
  }
  if (pathname === '/api/stats/chart' && req.method === 'GET') {
    const rows = db.prepare(`
      SELECT s.day, s.pv, COUNT(v.user_key) as uv
      FROM stats_daily s
      LEFT JOIN visits v ON v.day = s.day
      WHERE s.day >= date('now', '-29 days')
      GROUP BY s.day ORDER BY s.day
    `).all()
    // 补全没有数据的日期为 0
    const byDay = Object.fromEntries(rows.map(r => [r.day, r]))
    const chart = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      chart.push({ day: d.slice(5), pv: byDay[d]?.pv || 0, uv: byDay[d]?.uv || 0 })
    }
    return json(res, 200, { chart })
  }

  // ===== 评论管理（需认证） =====
  if (pathname === '/api/admin/comments' && req.method === 'GET') {
    const comments = db.prepare(`
      SELECT c.id, c.post_id, c.nickname, c.content, c.created_at, p.title as post_title, p.slug as post_slug
      FROM comments c LEFT JOIN posts p ON p.id = c.post_id
      ORDER BY c.created_at DESC LIMIT 200
    `).all()
    return json(res, 200, { comments, total: comments.length })
  }
  const commentDel = pathname.match(/^\/api\/comments\/(\d+)$/)
  if (commentDel && req.method === 'DELETE') {
    db.prepare('DELETE FROM comments WHERE id = ?').run(parseInt(commentDel[1]))
    return json(res, 200, { ok: true })
  }

  // ===== 图片上传（需认证，base64 JSON 上传） =====
  if (pathname === '/api/upload' && req.method === 'POST') {
    const body = await readBody(req)
    let data = String(body.data || '')
    const m = data.match(/^data:image\/(\w+);base64,(.+)$/)
    let ext
    if (m) { ext = m[1].toLowerCase(); data = m[2] }
    const EXT_WHITELIST = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg']
    if (!ext) ext = String(body.name || '').split('.').pop().toLowerCase()
    if (!EXT_WHITELIST.includes(ext)) return json(res, 400, { error: `不支持的图片格式: ${ext}` })
    const buf = Buffer.from(data, 'base64')
    if (buf.length === 0) return json(res, 400, { error: '图片数据为空' })
    if (buf.length > 8 * 1024 * 1024) return json(res, 413, { error: '图片超过 8MB 限制' })

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf)
    return json(res, 201, { url: `/uploads/${filename}`, size: buf.length })
  }

  // ===== 本地 AI =====

  // POST /api/ai/summary  { slug }  公开（限流 + 并发锁 + 结果缓存进库）
  if (pathname === '/api/ai/summary' && req.method === 'POST') {
    if (!aiLimiter('global')) return json(res, 429, { error: 'AI 请求太频繁，稍后再试' })
    const body = await readBody(req)
    const post = db.prepare('SELECT id, title, body_html, ai_summary, ai_summary_at FROM posts WHERE slug = ? AND is_draft = 0')
      .get(String(body.slug || ''))
    if (!post) return json(res, 404, { error: '文章不存在' })
    if (post.ai_summary) {
      return json(res, 200, { summary: post.ai_summary, cached: true, generated_at: post.ai_summary_at })
    }
    if (pendingSummaries.has(post.id)) {
      return json(res, 200, { summary: await pendingSummaries.get(post.id), cached: false })
    }
    const p = (async () => {
      const summary = await generateSummary(post.title, post.body_html)
      db.prepare(`UPDATE posts SET ai_summary = ?, ai_summary_at = datetime('now') WHERE id = ?`).run(summary, post.id)
      return summary
    })()
    pendingSummaries.set(post.id, p)
    try {
      return json(res, 200, { summary: await p, cached: false })
    } catch (err) {
      return json(res, 502, { error: err.message })
    } finally {
      pendingSummaries.delete(post.id)
    }
  }

  // POST /api/ai/write  { action, content }  需认证（编辑器 AI 助手）
  if (pathname === '/api/ai/write' && req.method === 'POST') {
    const body = await readBody(req)
    if (!body.content) return json(res, 400, { error: 'content 必填' })
    try {
      const result = await writeAssist(String(body.action), String(body.content))
      return json(res, 200, { result })
    } catch (err) {
      return json(res, 502, { error: err.message })
    }
  }

  // POST /api/ai/digest  手动生成今日 AI 日报（需认证）
  if (pathname === '/api/ai/digest' && req.method === 'POST') {
    const result = await generateDailyDigest(db)
    return json(res, result.ok ? 201 : 409, result)
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
