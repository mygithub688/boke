// 站点调度器：定时发布 + 热搜每日快照（AI 日报调度在 aidigest.js）
import { getHotTopics } from './hot.js'

let snapshotDay = ''

function todayStr() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// 定时发布：到点的草稿自动转正式
function publishDuePosts(db) {
  const due = db.prepare(`
    SELECT id, title, scheduled_at FROM posts
    WHERE is_draft = 1 AND scheduled_at IS NOT NULL AND scheduled_at <= datetime('now', 'localtime')
  `).all()
  for (const p of due) {
    db.prepare(`UPDATE posts SET is_draft = 0, updated_at = datetime('now') WHERE id = ?`).run(p.id)
    console.log(`[scheduler] 定时发布: ${p.title} (${p.scheduled_at})`)
  }
  return due.length
}

// 热搜每日快照：每天第一次检查时存一份（各源前 10 条）
async function captureHotSnapshot(db) {
  const day = todayStr()
  if (snapshotDay === day) return
  const exists = db.prepare('SELECT day FROM hot_history WHERE day = ?').get(day)
  if (exists) { snapshotDay = day; return }

  try {
    const agg = await getHotTopics()
    const snapshot = {}
    for (const [key, src] of Object.entries(agg)) {
      snapshot[key] = { name: src.name, items: (src.items || []).slice(0, 10) }
    }
    if (Object.keys(snapshot).length > 0) {
      db.prepare('INSERT OR REPLACE INTO hot_history (day, snapshot) VALUES (?, ?)')
        .run(day, JSON.stringify(snapshot))
      console.log(`[scheduler] 已存热搜快照: ${day}`)
    }
    snapshotDay = day
  } catch (err) {
    console.error('[scheduler] 热搜快照失败:', err.message)
  }
}

export function startScheduler(db) {
  // 每分钟：定时发布检查
  setInterval(() => {
    try { publishDuePosts(db) } catch (err) { console.error('[scheduler] 发布检查失败:', err.message) }
  }, 60 * 1000).unref()

  // 每小时：热搜快照（每天只会真正抓一次）
  setInterval(() => { captureHotSnapshot(db) }, 60 * 60 * 1000).unref()
  captureHotSnapshot(db)
}
