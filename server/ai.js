// 本地 AI 模块：对接 OpenAI 兼容接口（默认 LocalAI Studio 的 127.0.0.1:8787）
// 环境变量：AI_BASE（接口地址）、AI_MODEL（模型 ID）

const AI_BASE = (process.env.AI_BASE || 'http://127.0.0.1:8787/v1').replace(/\/$/, '')
const AI_MODEL = process.env.AI_MODEL || 'qwen3.8-27b'

// 去掉思考模型的 <think>…</think> 段落
function stripThink(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim()
}

// HTML → 纯文本（喂给模型用）
export function stripHtml(html) {
  return String(html || '')
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' [代码块] ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

async function chat(messages, { maxTokens = 800, temperature = 0.7 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  let res
  try {
    res = await fetch(`${AI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model: AI_MODEL, messages, max_tokens: maxTokens, temperature, stream: false })
    })
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('AI 响应超时（模型可能正在处理长文）')
    throw new Error(`本地 AI 服务未连接（${AI_BASE}），请先启动 LocalAI Studio`)
  } finally {
    clearTimeout(timer)
  }
  try {
    if (!res.ok) throw new Error(`AI 接口返回 HTTP ${res.status}`)
    const data = await res.json()
    const content = stripThink(data.choices?.[0]?.message?.content || '')
    if (!content) throw new Error('AI 返回了空内容（可能本地模型正在忙）')
    return content
  } catch (err) {
    if (String(err.message).startsWith('AI')) throw err
    throw new Error('AI 返回内容解析失败')
  }
}

export async function aiAvailable() {
  try {
    const res = await fetch(`${AI_BASE}/models`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch { return false }
}

// 文章摘要：2~3 句话
export async function generateSummary(title, bodyHtml) {
  const text = stripHtml(bodyHtml).slice(0, 4000)
  return await chat([
    { role: 'system', content: '你是博客文章摘要助手。用中文写一段 2~3 句话的摘要，客观概括文章核心内容，不要废话，不要以"这篇文章"开头。' },
    { role: 'user', content: `标题：${title}\n\n正文：\n${text}` }
  ], { maxTokens: 300, temperature: 0.5 })
}

// 写作助手：润色 / 续写 / 起标题 / 推荐标签
export async function writeAssist(action, content) {
  const text = String(content || '').slice(0, 8000)
  const prompts = {
    polish: {
      system: '你是博客文章编辑。把用户给出的 HTML 片段润色得更通顺、更有文采，保持原有 HTML 标签结构不变，只输出结果，不要解释。',
      user: text, maxTokens: 2000
    },
    continue: {
      system: '你是博客作者的创作搭档。接着用户给出的 HTML 内容继续写 2~3 段，使用与原文一致的 HTML 标签风格（<p>/<h2>/<ul> 等），只输出新写的部分，不要重复原文。',
      user: text, maxTokens: 1200
    },
    title: {
      system: '你是标题党中的清流。根据正文给出 5 个候选标题，每个一行，风格：准确、有信息量、略带锋芒。不要编号，不要解释。',
      user: stripHtml(text).slice(0, 3000), maxTokens: 300
    },
    tags: {
      system: '根据文章内容推荐 3~5 个中文标签，一行一个，每个标签不超过 6 个字。不要解释。',
      user: stripHtml(text).slice(0, 3000), maxTokens: 150
    },
    excerpt: {
      system: '为这篇博客文章写一句 40 字以内的摘要，放在列表页展示。只输出这句话。',
      user: stripHtml(text).slice(0, 3000), maxTokens: 120
    }
  }
  const p = prompts[action]
  if (!p) throw new Error(`未知的 AI 动作: ${action}`)
  return await chat(
    [{ role: 'system', content: p.system }, { role: 'user', content: p.user }],
    { maxTokens: p.maxTokens, temperature: 0.7 }
  )
}

// 评论审核：返回 'ok'（正常）或 'spam'（垃圾/广告）
export async function moderateComment(nickname, content) {
  const verdict = await chat([
    { role: 'system', content: '你是博客评论审核器。判断评论是否为垃圾内容（广告、引流、灌水、辱骂、无关推广）。只输出一个词：OK 或 SPAM。' },
    { role: 'user', content: `昵称：${nickname}\n评论：${content}` }
  ], { maxTokens: 5, temperature: 0 })
  return /spam/i.test(verdict) ? 'spam' : 'ok'
}

// 站内问答：基于检索到的文章片段回答
export async function answerQuestion(question, articles) {
  const context = articles
    .map((a, i) => `【文章${i + 1}】《${a.title}》\n${a.text.slice(0, 1500)}`)
    .join('\n\n')
  return await chat([
    { role: 'system', content: '你是这个博客的 AI 问答助手。根据给出的博客文章片段回答访客问题；如果片段不足以回答，就诚实说博客里没有相关内容。回答末尾用一行"参考：《文章标题》"列出用到的文章。用中文，简洁。' },
    { role: 'user', content: `博客文章片段：\n${context}\n\n访客问题：${question}` }
  ], { maxTokens: 800, temperature: 0.5 })
}

// AI 日报正文：把聚合到的新闻标题写成一篇可发布的 HTML 文章
export async function generateDigestHtml(newsText, dateStr) {
  return await chat([
    { role: 'system', content: '你是 AI 资讯编辑。根据用户提供的当日新闻标题列表，写一篇"AI 日报"博客文章，输出 HTML 片段：开头一段 <p> 总述今日看点，然后用 <h2>分主题</h2> + <ul><li><a href="链接">标题</a>：一句话点评</li></ul> 组织，最后一段 <p> 短评收尾。语言简洁有态度，不要套话。' },
    { role: 'user', content: `今天是 ${dateStr}。以下是今天聚合到的 AI 新闻（标题 | 来源 | 链接）：\n\n${newsText}` }
  ], { maxTokens: 3000, temperature: 0.6 })
}
