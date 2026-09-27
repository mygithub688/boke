// AI 日报：定时把聚合新闻交给本地模型写成博客文章自动发布
import { getAINews } from './ainews.js'
import { generateDigestHtml, aiAvailable } from './ai.js'

const DIGEST_TAG = 'AI 日报'
const DIGEST_HOUR = 9 // 每天 9 点后首次访问时生成
let generating = false
let lastTriedDay = ''

function todayStr() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export async function generateDailyDigest(db) {
  if (generating) return { ok: false, message: '日报正在生成中，请稍候' }
  generating = true
  try {
    const day = todayStr()
    const slug = `ai-daily-${day}`
    const exists = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug)
    if (exists) return { ok: false, message: `今天（${day}）的日报已存在` }

    if (!(await aiAvailable())) {
      return { ok: false, message: '本地 AI 服务未启动，无法生成日报' }
    }

    // 拉取各源新闻标题
    const sections = await getAINews()
    const lines = []
    for (const sec of Object.values(sections)) {
      for (const src of Object.values(sec.sources || {})) {
        for (const it of (src.items || []).slice(0, 8)) {
          lines.push(`${it.title} | ${src.name} | ${it.url || ''}`)
        }
      }
    }
    if (lines.length < 5) return { ok: false, message: '今天聚合到的新闻太少，无法生成日报' }

    const bodyHtml = await generateDigestHtml(lines.slice(0, 60).join('\n'), day)

    db.prepare(
      `INSERT INTO posts (title, slug, tag, excerpt, body_html, is_featured, is_draft)
       VALUES (?, ?, ?, ?, ?, 0, 0)`
    ).run(
      `AI 日报 · ${day}`,
      slug,
      DIGEST_TAG,
      `${day} 的 AI 圈发生了什么，本地模型帮你三分钟看完。`,
      bodyHtml
    )
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(DIGEST_TAG)
    console.log(`[aidigest] 已生成今日日报: ${slug}`)
    return { ok: true, message: `已生成 ${slug}` }
  } catch (err) {
    console.error('[aidigest] 生成失败:', err.message)
    return { ok: false, message: `生成失败：${err.message}` }
  } finally {
    generating = false
  }
}

// 每 30 分钟检查一次：过了 DIGEST_HOUR 且今天没生成过就生成
export function scheduleDailyDigest(db) {
  setInterval(async () => {
    const day = todayStr()
    if (lastTriedDay === day) return
    const now = new Date()
    if (now.getHours() < DIGEST_HOUR) return
    lastTriedDay = day
    const exists = db.prepare('SELECT id FROM posts WHERE slug = ?').get(`ai-daily-${day}`)
    if (!exists) await generateDailyDigest(db)
  }, 30 * 60 * 1000).unref()
}
