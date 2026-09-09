import { site } from '../data.js'
import { API_BASE } from '../api.js'

function footerHTML() {
  return `
    <footer class="footer">
      <div class="footer-inner">
        <div>
          <div class="footer-brand">${site.name} · ${site.nameEn}</div>
          <div class="footer-note">${site.bio}</div>
        </div>
        <div class="footer-links">
          <a href="${site.links.github}" target="_blank" rel="noopener">GitHub</a>
          <a href="${site.links.weibo}">微博</a>
          <a href="mailto:${site.links.email}">邮箱</a>
        </div>
        <div class="footer-copy">
          <span>© ${new Date().getFullYear()} ${site.name}. 保留所有权利。</span>
          <span>Built with Vanilla JS · 无框架 · 无依赖</span>
        </div>
      </div>
    </footer>
  `
}

function esc(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function aiBadge(rank) {
  if (rank === 1) return '<span class="ai-rank r1">1</span>'
  if (rank === 2) return '<span class="ai-rank r2">2</span>'
  if (rank === 3) return '<span class="ai-rank r3">3</span>'
  return `<span class="ai-rank">${rank}</span>`
}

function aiItemHTML(item, source) {
  const hotLabel = source === 'hn' ? 'pts' : source === 'hf' ? 'up' : 'stars'
  return `
    <a class="ai-item" href="${esc(item.url)}" target="_blank" rel="noopener">
      ${aiBadge(item.rank)}
      <div class="ai-item-body">
        <span class="ai-item-title">${esc(item.title)}</span>
        ${item.description ? `<span class="ai-item-desc">${esc(item.description)}</span>` : ''}
      </div>
      ${item.hot ? `<span class="ai-item-hot">${item.hot} ${hotLabel}</span>` : ''}
    </a>
  `
}

function skeletonItems() {
  return Array.from({ length: 6 }, (_, i) => `
    <div class="ai-item skeleton">
      <div class="skeleton-line" style="width:24px;height:24px;border-radius:50%"></div>
      <div style="flex:1">
        <div class="skeleton-line" style="width:80%;height:14px;margin-bottom:6px"></div>
        <div class="skeleton-line" style="width:50%;height:11px"></div>
      </div>
    </div>
  `).join('')
}

function renderAINews(container) {
  container.innerHTML = `
    <div class="page">
      <div class="ai-header">
        <h1 class="ai-title-big">AI 前沿<span class="ai-spark">⚡</span></h1>
        <p class="ai-sub">Hacker News · TechCrunch AI · GitHub 新星</p>
        <div class="ai-actions">
          <label class="ai-autorefresh">
            <span class="ai-autorefresh-label">自动刷新</span>
            <select id="aiAutoRefresh" class="ai-autorefresh-select">
              <option value="0">关闭</option>
              <option value="60">1 分钟</option>
              <option value="180" selected>3 分钟</option>
              <option value="300">5 分钟</option>
              <option value="600">10 分钟</option>
            </select>
          </label>
          <button class="btn btn-ghost" id="aiRefresh" style="font-size:13px;padding:6px 16px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;margin-right:4px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            刷新
          </button>
          <span class="ai-time" id="aiTime"></span>
        </div>
      </div>

      <div class="ai-grid" id="aiGrid">
        <div class="ai-source-card" style="grid-column:1/-1;padding:40px;text-align:center">
          <p style="color:var(--text-muted)">正在抓取 AI 前沿动态…</p>
        </div>
      </div>
    </div>
    ${footerHTML()}
  `

  loadAINews()
}

async function loadAINews() {
  const grid = document.querySelector('#aiGrid')
  const timeEl = document.querySelector('#aiTime')
  if (!grid) return

  // 骨架
  const sourceNames = ['Hacker News', 'TechCrunch AI', 'GitHub AI 新星']
  grid.innerHTML = sourceNames.map(name => `
    <div class="ai-source-card">
      <div class="ai-source-title"><span class="dot"></span>${name}</div>
      ${skeletonItems()}
    </div>
  `).join('')

  try {
    const res = await fetch(API_BASE + '/api/ainews')
    const d = await res.json()
    const sources = d.sources || {}

    if (Object.keys(sources).length === 0) {
      grid.innerHTML = '<div class="ai-source-card" style="grid-column:1/-1;padding:40px;text-align:center"><p style="color:var(--text-muted)">所有源均不可用，请稍后重试</p></div>'
      return
    }

    grid.innerHTML = Object.entries(sources).map(([key, s]) => `
      <div class="ai-source-card">
        <div class="ai-source-title">
          <span class="dot" style="background:${s.color}"></span>
          ${esc(s.name)}
          ${s.stale ? '<span class="stale-badge">缓存</span>' : ''}
        </div>
        ${s.items.length > 0 ? s.items.map(it => aiItemHTML(it, key)).join('') : '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">暂无数据</p>'}
      </div>
    `).join('')

    if (timeEl) {
      timeEl.textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
  } catch (e) {
    grid.innerHTML = '<div class="ai-source-card" style="grid-column:1/-1;padding:40px;text-align:center"><p style="color:#e07070">加载失败：' + esc(e.message) + '</p></div>'
  }
}

function setupAutoRefresh() {
  const select = document.getElementById('aiAutoRefresh')
  if (!select) return null
  const saved = localStorage.getItem('ai-autorefresh')
  if (saved !== null) select.value = saved

  let timer = null
  function startTimer(seconds) {
    if (timer) { clearInterval(timer); timer = null }
    if (seconds > 0) timer = setInterval(() => loadAINews(), seconds * 1000)
  }
  startTimer(parseInt(select.value, 10))
  select.addEventListener('change', () => {
    localStorage.setItem('ai-autorefresh', select.value)
    startTimer(parseInt(select.value, 10))
  })
  return () => { if (timer) clearInterval(timer) }
}

export default {
  render(container) {
    renderAINews(container)
    const cleanupRefresh = setupAutoRefresh()
    const btn = document.getElementById('aiRefresh')
    if (btn) btn.addEventListener('click', loadAINews)
    return () => { if (cleanupRefresh) cleanupRefresh() }
  },
  cleanup() {}
}
