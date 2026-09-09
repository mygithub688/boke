// AI 新闻聚合：Hacker News + TechCrunch AI + GitHub Trending AI
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const CACHE_TTL = 10 * 60 * 1000 // 10 分钟

const cache = {}

async function fetchText(url, extraHeaders = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, ...extraHeaders },
      signal: controller.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(url, extraHeaders = {}) {
  const text = await fetchText(url, extraHeaders)
  return JSON.parse(text)
}

// ===== Hacker News =====
async function fetchHN() {
  const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json')
  const top = ids.slice(0, 30)
  const items = await Promise.all(
    top.map(async (id) => {
      try {
        return await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
      } catch {
        return null
      }
    })
  )
  const aiKeywords = /\b(ai|llm|gpt|claude|gemini|model|transformer|neural|deep ?learning|machine ?learning|openai|anthropic|deepseek|mistral|llama|diffusion|agent|inference|training|fine-?tun|rag|token|embedding|multimodal|vllm|ollama|copilot|chatbot|language model|artificial intelligence|navier|stokes|muse|quantum)\b/i
  return items
    .filter(Boolean)
    .filter(item => item.title && (aiKeywords.test(item.title) || item.score >= 100))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map((item, i) => ({
      rank: i + 1,
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      hot: item.score,
      source: 'HN',
      sourceUrl: `https://news.ycombinator.com/item?id=${item.id}`
    }))
}

// ===== TechCrunch AI =====
async function fetchTechCrunch() {
  const xml = await fetchText('https://techcrunch.com/category/artificial-intelligence/feed/')
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const block = m[1]
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || ''
    const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim() || ''
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || ''
    return { title, link, pubDate }
  }).filter(it => it.title)

  return items.slice(0, 12).map((item, i) => ({
    rank: i + 1,
    title: item.title,
    url: item.link,
    hot: '',
    source: 'TC',
    sourceUrl: item.link,
    date: item.pubDate
  }))
}

// ===== GitHub Trending AI =====
async function fetchGitHub() {
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const q = encodeURIComponent(`created:>${oneWeekAgo} topic:ai topic:llm`)
  const data = await fetchJson(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=15`,
    { 'Accept': 'application/vnd.github+json' }
  )
  const items = data.items || []
  return items.slice(0, 10).map((item, i) => ({
    rank: i + 1,
    title: item.full_name,
    url: item.html_url,
    hot: item.stargazers_count,
    source: 'GH',
    sourceUrl: item.html_url,
    description: (item.description || '').slice(0, 120)
  }))
}

// ===== 聚合 =====
const SOURCES = [
  { key: 'hn', name: 'Hacker News', fetch: fetchHN, color: '#ff6600' },
  { key: 'tc', name: 'TechCrunch AI', fetch: fetchTechCrunch, color: '#0a9e00' },
  { key: 'gh', name: 'GitHub AI 新星', fetch: fetchGitHub, color: '#58a6ff' },
]

export async function getAINews(sourceKey = null) {
  const now = Date.now()
  const result = {}
  const targets = sourceKey ? SOURCES.filter(s => s.key === sourceKey) : SOURCES

  await Promise.allSettled(
    targets.map(async (s) => {
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
        if (cache[s.key]) {
          result[s.key] = { name: s.name, color: s.color, items: cache[s.key].items, stale: true }
        }
      }
    })
  )

  return result
}
