import { navigate } from '../router.js'

const NAV_ITEMS = [
  { label: '文章', route: '/', path: '/' },
  { label: '热搜', route: '/hot', path: '/hot' },
  { label: 'AI 前沿', route: '/ainews', path: '/ainews' },
  { label: '关于', route: '/about', path: '/about' },
  { label: '标签', route: '/tags', path: '/#tags' },
]

function getTheme() {
  return localStorage.getItem('blog-theme') || 'dark'
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('blog-theme', theme)
}

function toggleTheme() {
  const current = getTheme()
  setTheme(current === 'dark' ? 'light' : 'dark')
}

// 页面加载时立即应用已保存的主题（避免闪烁）
setTheme(getTheme())

function buildNav() {
  const nav = document.createElement('header')
  nav.className = 'nav'
  nav.innerHTML = `
    <div class="nav-inner">
      <a class="brand" href="#/" onclick="event.preventDefault(); navigate('/')">
        <div class="brand-mark">指</div>
        <span class="brand-name">指挥官</span>
        <span class="brand-sub">LOG</span>
      </a>
      <div class="nav-links">
        <div class="search-box" id="searchBox">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="搜索文章…" id="searchInput" autocomplete="off" />
          <kbd>/</kbd>
        </div>
        ${NAV_ITEMS.map(item => `
          <a class="nav-link" data-route="${item.route}" href="#${item.path}">${item.label}</a>
        `).join('')}
        <a class="nav-link nav-login" id="navLogin" href="#/login">登录</a>
        <button class="theme-toggle" id="themeToggle" aria-label="切换主题" title="切换白天/夜晚">
          <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
        <button class="menu-btn" id="menuBtn" aria-label="菜单">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </div>
  `
  document.body.prepend(nav)

  // 主题切换
  nav.querySelector('#themeToggle').addEventListener('click', toggleTheme)

  // 登录/管理状态
  updateLoginState(nav)
  window.addEventListener('hashchange', () => updateLoginState(nav))

  // 移动端菜单
  const mobileMenu = document.createElement('nav')
  mobileMenu.className = 'mobile-menu'
  mobileMenu.innerHTML = NAV_ITEMS.map(item => `
    <a class="nav-link" data-route="${item.route}" href="#${item.path}">${item.label}</a>
  `).join('') + `
    <a class="nav-link nav-login" id="navLoginMobile" href="#/login">登录</a>
  `
  document.body.appendChild(mobileMenu)

  const menuBtn = nav.querySelector('#menuBtn')
  menuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('open')
  })
  mobileMenu.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'))
  })

  // 滚动效果
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 10)
  }, { passive: true })

  // 搜索
  const input = nav.querySelector('#searchInput')
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim()
      if (q) {
        navigate(`/search?q=${encodeURIComponent(q)}`)
        input.value = ''
      }
    }
    if (e.key === 'Escape') input.value = ''
  })

  // 快捷键 "/" 聚焦搜索
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault()
      input.focus()
    }
  })

  // 回到顶部
  const backTop = document.createElement('button')
  backTop.className = 'back-top'
  backTop.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
  document.body.appendChild(backTop)
  window.addEventListener('scroll', () => {
    backTop.classList.toggle('show', window.scrollY > 600)
  }, { passive: true })
}

function updateLoginState(nav) {
  const hasToken = !!localStorage.getItem('blog-token')
  const inAdmin = window.location.hash.startsWith('#/admin')
  const loginEl = nav.querySelector('#navLogin')
  const loginMobile = document.querySelector('#navLoginMobile')
  if (loginEl) {
    loginEl.textContent = hasToken ? '管理面板' : '登录'
    loginEl.href = hasToken ? '#/admin' : '#/login'
    loginEl.classList.toggle('nav-login-active', hasToken)
  }
  if (loginMobile) {
    loginMobile.textContent = hasToken ? '管理面板' : '登录'
    loginMobile.href = hasToken ? '#/admin' : '#/login'
  }
}

document.addEventListener('DOMContentLoaded', buildNav)
