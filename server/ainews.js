// AI 新闻聚合：国内中文（量子位/机器之心/新智元）+ 国际（HN/TechCrunch/GitHub）
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

// ===== RSS 通用解析器 =====
function parseRSS(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
    const b = m[1]
    return {
      title: (b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1]?.trim() || '',
      link: (b.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim() || '',
      date: (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || ''
    }
  }).filter(it => it.title)
}

// ===== 国内中文源 =====

async function fetchQbitai() {
  // 爬首页 HTML 拿 20 条（RSS 只有 10 条）
  const html = await fetchText('https://www.qbitai.com/')
  const matches = [...html.matchAll(/href="(https:\/\/www\.qbitai\.com\/\d{4}\/\d{2}\/\d+\.html)"[^>]*>([^<]{5,})</g)]
  const seen = new Set()
  const items = []
  for (const m of matches) {
    const url = m[1]
    const title = m[2].trim()
    if (url && title && !seen.has(url)) {
      seen.add(url)
      items.push({ title, url })
    }
  }
  return items.slice(0, 15).map((item, i) => ({
    rank: i + 1,
    title: item.title,
    url: item.url,
    hot: '',
    source: 'qbitai'
  }))
}

async function fetchIfanr() {
  const xml = await fetchText('https://www.ifanr.com/feed')
  const items = parseRSS(xml)
  // 只保留含 AI 相关关键词的
  const aiKeywords = /\b(ai|llm|gpt|claude|模型|人工智能|大模型|机器人|智能|机器学习|深度学习|agent|transformer)\b/i
  const filtered = items.filter(it => aiKeywords.test(it.title))
  const final = filtered.length >= 8 ? filtered : items
  return final.slice(0, 10).map((item, i) => ({
    rank: i + 1,
    title: item.title,
    url: item.link,
    hot: '',
    source: 'ifanr',
    date: item.date
  }))
}

async function fetchXinzhiyuan() {
  const xml = await fetchText('https://decemberpei.cyou/rssbox/wechat-xinzhiyuan.xml')
  const items = parseRSS(xml)
  return items.slice(0, 10).map((item, i) => ({
    rank: i + 1,
    title: item.title,
    url: item.link,
    hot: '',
    source: 'xinzhiyuan',
    date: item.date
  }))
}

// ===== 国际源 =====

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
    .slice(0, 12)
    .map((item, i) => ({
      rank: i + 1,
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      hot: item.score,
      source: 'HN'
    }))
}

async function fetchTechCrunch() {
  const xml = await fetchText('https://techcrunch.com/category/artificial-intelligence/feed/')
  const items = parseRSS(xml)
  return items.slice(0, 10).map((item, i) => ({
    rank: i + 1,
    title: item.title,
    url: item.link,
    hot: '',
    source: 'TC',
    date: item.date
  }))
}

async function fetchGitHub() {
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const q = encodeURIComponent(`created:>${oneWeekAgo} topic:ai topic:llm`)
  const data = await fetchJson(
    `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=10`,
    { 'Accept': 'application/vnd.github+json' }
  )
  const items = data.items || []
  return items.slice(0, 10).map((item, i) => ({
    rank: i + 1,
    title: item.full_name,
    url: item.html_url,
    hot: item.stargazers_count,
    source: 'GH',
    description: (item.description || '').slice(0, 120)
  }))
}

// ===== 板块定义 =====
const SECTIONS = [
  {
    key: 'cn',
    name: '国内中文',
    color: '#e74c3c',
    sources: [
      { key: 'qbitai', name: '量子位', fetch: fetchQbitai, color: '#1a73e8' },
      { key: 'ifanr', name: '爱范儿 AI', fetch: fetchIfanr, color: '#34a853' },
      { key: 'xinzhiyuan', name: '新智元', fetch: fetchXinzhiyuan, color: '#9c27b0' },
    ]
  },
  {
    key: 'intl',
    name: '国际前沿',
    color: '#2980b9',
    sources: [
      { key: 'hn', name: 'Hacker News', fetch: fetchHN, color: '#ff6600' },
      { key: 'tc', name: 'TechCrunch AI', fetch: fetchTechCrunch, color: '#0a9e00' },
      { key: 'gh', name: 'GitHub AI 新星', fetch: fetchGitHub, color: '#58a6ff' },
    ]
  }
]

export async function getAINews() {
  const now = Date.now()
  const sections = {}

  await Promise.allSettled(
    SECTIONS.map(async (section) => {
      const sourceResults = {}
      await Promise.allSettled(
        section.sources.map(async (s) => {
          if (cache[s.key] && now - cache[s.key].fetchedAt < CACHE_TTL) {
            sourceResults[s.key] = { name: s.name, color: s.color, items: cache[s.key].items }
            return
          }
          try {
            const items = await s.fetch()
            if (items.length > 0) {
              cache[s.key] = { items, fetchedAt: now }
              sourceResults[s.key] = { name: s.name, color: s.color, items }
            }
          } catch (e) {
            if (cache[s.key]) {
              sourceResults[s.key] = { name: s.name, color: s.color, items: cache[s.key].items, stale: true }
            }
          }
        })
      )
      sections[section.key] = { name: section.name, color: section.color, sources: sourceResults }
    })
  )

  return sections
}
