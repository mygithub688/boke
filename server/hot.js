// 热搜聚合模块：抓取各平台热榜，内存缓存 5 分钟
import crypto from 'node:crypto'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const CACHE_TTL = 5 * 60 * 1000 // 5 分钟

// 缓存: { [source]: { items: [], fetchedAt: number } }
const cache = {}

async function fetchUrl(url, extraHeaders = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, ...extraHeaders },
      signal: controller.signal,
      redirect: 'follow'
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

// ===== 各平台解析器 =====

async function fetchBaidu() {
  const html = await fetchUrl('https://top.baidu.com/board?tab=realtime')
  // 数据在 s-data 或 content 属性 JSON 里
  const m = html.match(/content="({.*?})"\s+class="c-single-news-list"/s) || html.match(/content="({.*?})"/s)
  if (m) {
    const raw = m[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
    const d = JSON.parse(raw)
    const content = (d.cards || [])[0]?.content || []
    return content.map((c, i) => ({
      rank: i + 1,
      title: c.word,
      hot: c.hotScore ? parseInt(c.hotScore) : 0,
      url: c.url || `https://www.baidu.com/s?wd=${encodeURIComponent(c.word)}`,
      label: c.label || ''
    }))
  }
  // 备用：正则提取
  const words = [...html.matchAll(/"word":"([^"]+)"/g)].map(m => m[1])
  const scores = [...html.matchAll(/"hotScore":"(\d+)"/g)].map(m => parseInt(m[1]))
  return words.map((w, i) => ({
    rank: i + 1,
    title: w,
    hot: scores[i] || 0,
    url: `https://www.baidu.com/s?wd=${encodeURIComponent(w)}`,
    label: ''
  }))
}

async function fetchToutiao() {
  const text = await fetchUrl('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc')
  const d = JSON.parse(text)
  const items = d.data || []
  return items.map((it, i) => ({
    rank: i + 1,
    title: it.Title || it.title,
    hot: parseInt(it.HotValue || it.hot_value || 0),
    url: it.Url || it.url || '',
    label: it.Label || ''
  }))
}

async function fetchDouyin() {
  const text = await fetchUrl('https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383', {
    'Referer': 'https://www.douyin.com/',
    'Accept': 'application/json'
  })
  const d = JSON.parse(text)
  const items = d.data?.word_list || []
  return items.map((it, i) => ({
    rank: i + 1,
    title: it.word,
    hot: parseInt(it.hot_value || 0),
    url: `https://www.douyin.com/search/${encodeURIComponent(it.word)}`,
    label: it.label || ''
  }))
}

async function fetchZhihu() {
  const text = await fetchUrl('https://api.zhihu.com/topstory/hot-list?limit=20', {
    'Referer': 'https://www.zhihu.com/',
    'Accept': 'application/json'
  })
  const d = JSON.parse(text)
  const items = d.data || []
  return items.map((it, i) => ({
    rank: i + 1,
    title: it.target?.title || '',
    hot: it.detail_text || '',
    url: it.target?.url || '',
    label: ''
  }))
}

async function fetchWeibo() {
  // 微博需要 visitor cookie，尝试通过 m.weibo.cn
  const text = await fetchUrl('https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26launch_time%3D0', {
    'Referer': 'https://m.weibo.cn/'
  })
  const d = JSON.parse(text)
  const groups = d?.data?.cards || []
  for (const g of groups) {
    const cards = g.card_group || []
    if (cards.length > 3) {
      return cards.map((c, i) => ({
        rank: i + 1,
        title: c.desc?.content || c.desc || '',
        hot: c.desc?.content || '',
        url: c.scheme?.replace('sinaurl', 'https://s.weibo.com/weibo') || `https://s.weibo.com/weibo/${c.mid}`,
        label: c.desc?.content?.replace(/[^#\u4e00-\u9fff]/g, '') || ''
      }))
    }
  }
  return []
}

// ===== 聚合 =====

const SOURCES = [
  { key: 'baidu', name: '百度热搜', fetch: fetchBaidu, color: '#2938c8' },
  { key: 'toutiao', name: '今日头条', fetch: fetchToutiao, color: '#f5222d' },
  { key: 'douyin', name: '抖音热榜', fetch: fetchDouyin, color: '#fe2c55' },
  { key: 'zhihu', name: '知乎热榜', fetch: fetchZhihu, color: '#0066ff' },
  { key: 'weibo', name: '微博热搜', fetch: fetchWeibo, color: '#ff8200' },
]

export async function getHotTopics(sourceKey = null) {
  const now = Date.now()
  const result = {}

  const targets = sourceKey ? SOURCES.filter(s => s.key === sourceKey) : SOURCES

  await Promise.allSettled(
    targets.map(async (s) => {
      // 检查缓存
      if (cache[s.key] && now - cache[s.key].fetchedAt < CACHE_TTL) {
        result[s.key] = { name: s.name, color: s.color, items: cache[s.key].items }
        return
      }
      try {
        const items = await s.fetch()
        if (items.length > 0) {
          cache[s.key] = { items, fetchedAt: now }
          result[s.key] = { name: s.name, color: s.color, items }
        }
      } catch (e) {
        // 失败时用旧缓存
        if (cache[s.key]) {
          result[s.key] = { name: s.name, color: s.color, items: cache[s.key].items, stale: true }
        }
      }
    })
  )

  return result
}

// 合并所有源为一个扁平列表（按热度排序，归一化）
export function flattenTopics(aggData) {
  const all = []
  for (const [key, data] of Object.entries(aggData)) {
    for (const item of data.items) {
      all.push({
        ...item,
        source: key,
        sourceName: data.name,
        sourceColor: data.color
      })
    }
  }
  // 去重：同标题只保留一条
  const seen = new Set()
  const unique = all.filter(item => {
    const key = item.title.slice(0, 20)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return unique.sort((a, b) => (b.hot || 0) - (a.hot || 0))
}
