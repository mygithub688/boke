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

function hotBadge(rank) {
  if (rank === 1) return '<span class="hot-rank r1">1</span>'
  if (rank === 2) return '<span class="hot-rank r2">2</span>'
  if (rank === 3) return '<span class="hot-rank r3">3</span>'
  return `<span class="hot-rank">${rank}</span>`
}

function hotListHTML(items, sourceKey) {
  return items.map(item => `
    <a class="hot-item" href="${esc(item.url || '#')}" target="_blank" rel="noopener">
      ${hotBadge(item.rank)}
      <span class="hot-title">${esc(item.title)}</span>
      ${item.hot ? `<span class="hot-num">${formatHot(item.hot)}</span>` : ''}
    </a>
  `).join('')
}

function formatHot(n) {
  if (typeof n === 'string') return n
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '亿'
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  return String(n)
}

function skeletonSource() {
  return Array.from({ length: 8 }, (_, i) => `
    <div class="hot-item skeleton">
      <div class="skeleton-line" style="width:24px;height:24px;border-radius:50%"></div>
      <div class="skeleton-line" style="width:70%;height:16px"></div>
    </div>
  `).join('')
}

function renderHot(container) {
  container.innerHTML = `
    <div class="page">
      <div class="hot-header">
        <h1 class="hot-title-big">热搜<span class="hot-fire">🔥</span></h1>
        <p class="hot-sub">聚合各平台实时热点</p>
        <div class="hot-actions">
          <label class="hot-autorefresh">
            <span class="hot-autorefresh-label">自动刷新</span>
            <select id="hotAutoRefresh" class="hot-autorefresh-select">
              <option value="0">关闭</option>
              <option value="30">30 秒</option>
              <option value="60">1 分钟</option>
              <option value="120">2 分钟</option>
              <option value="180">3 分钟</option>
              <option value="300" selected>5 分钟</option>
              <option value="600">10 分钟</option>
            </select>
          </label>
          <button class="btn btn-ghost" id="hotRefresh" style="font-size:13px;padding:6px 16px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;margin-right:4px"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            刷新
          </button>
          <span class="hot-time" id="hotTime"></span>
        </div>
      </div>

      <div class="hot-grid" id="hotGrid">
        <div class="hot-source-card" style="grid-column:1/-1;padding:40px;text-align:center">
          <p style="color:var(--text-muted)">正在抓取各平台热榜…</p>
        </div>
      </div>

      <section class="hot-flat-section">
        <h2 class="hot-flat-title">跨平台热榜</h2>
        <div class="hot-flat" id="hotFlat">
          <p style="color:var(--text-muted);padding:20px 0">加载中…</p>
        </div>
      </section>
    </div>
    ${footerHTML()}
  `

  loadHot()
}

async function loadHot() {
  const grid = document.querySelector('#hotGrid')
  const flat = document.querySelector('#hotFlat')
  const timeEl = document.querySelector('#hotTime')
  if (!grid) return

  // 显示骨架
  const sourceNames = ['百度热搜', '今日头条', '抖音热榜', '知乎热榜', '微博热搜']
  grid.innerHTML = sourceNames.map(name => `
    <div class="hot-source-card">
      <div class="hot-source-title"><span class="dot"></span>${name}</div>
      ${skeletonSource()}
    </div>
  `).join('')

  try {
    const res = await fetch(API_BASE + '/api/hot')
    const d = await res.json()
    const sources = d.sources || {}

    if (Object.keys(sources).length === 0) {
      grid.innerHTML = '<div class="hot-source-card" style="grid-column:1/-1;padding:40px;text-align:center"><p style="color:var(--text-muted)">所有源均不可用，请稍后重试</p></div>'
      if (flat) flat.innerHTML = '<p style="color:var(--text-muted)">无数据</p>'
      return
    }

    grid.innerHTML = Object.entries(sources).map(([key, s]) => `
      <div class="hot-source-card">
        <div class="hot-source-title">
          <span class="dot" style="background:${s.color}"></span>
          ${esc(s.name)}
          ${s.stale ? '<span class="stale-badge">缓存</span>' : ''}
        </div>
        ${s.items.length > 0 ? hotListHTML(s.items.slice(0, 10), key) : '<p style="color:var(--text-muted);font-size:13px;padding:8px 0">暂无数据</p>'}
      </div>
    `).join('')

    // 跨平台热榜
    if (flat && d.flat?.length) {
      flat.innerHTML = d.flat.slice(0, 20).map((item, i) => `
        <a class="hot-flat-item" href="${esc(item.url || '#')}" target="_blank" rel="noopener">
          <span class="hot-flat-rank ${i < 3 ? 'top' : ''}">${i + 1}</span>
          <span class="hot-flat-title">${esc(item.title)}</span>
          <span class="hot-flat-src" style="color:${item.sourceColor}">${esc(item.sourceName)}</span>
        </a>
      `).join('')
    }

    if (timeEl) {
      timeEl.textContent = '更新于 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
  } catch (e) {
    grid.innerHTML = '<div class="hot-source-card" style="grid-column:1/-1;padding:40px;text-align:center"><p style="color:#e07070">加载失败：' + esc(e.message) + '</p></div>'
  }
}

function setupAutoRefresh() {
  const select = document.getElementById('hotAutoRefresh')
  if (!select) return null

  // 恢复上次选择
  const saved = localStorage.getItem('hot-autorefresh')
  if (saved !== null) select.value = saved

  let timer = null

  function startTimer(seconds) {
    if (timer) { clearInterval(timer); timer = null }
    if (seconds > 0) {
      timer = setInterval(() => loadHot(), seconds * 1000)
    }
  }

  // 初始启动
  startTimer(parseInt(select.value, 10))

  select.addEventListener('change', () => {
    localStorage.setItem('hot-autorefresh', select.value)
    startTimer(parseInt(select.value, 10))
  })

  return () => { if (timer) clearInterval(timer) }
}

export default {
  render(container) {
    renderHot(container)
    const cleanupRefresh = setupAutoRefresh()
    const btn = document.getElementById('hotRefresh')
    if (btn) btn.addEventListener('click', loadHot)
    return () => { if (cleanupRefresh) cleanupRefresh() }
  },
  cleanup() {}
}
