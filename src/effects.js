// 动态特效层：3D tilt / 光标光晕 / 打字机 / 视差 / 滚动触发
import { posts } from './data.js'

let glowEl = null

// ---------- 光标跟随光晕 ----------
function initCursorGlow() {
  glowEl = document.createElement('div')
  glowEl.className = 'cursor-glow'
  document.body.appendChild(glowEl)

  let tx = -500, ty = -500, cx = -500, cy = -500
  let raf = null

  function tick() {
    cx += (tx - cx) * 0.12
    cy += (ty - cy) * 0.12
    glowEl.style.left = cx + 'px'
    glowEl.style.top = cy + 'px'
    if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) {
      raf = requestAnimationFrame(tick)
    } else {
      raf = null
    }
  }

  document.addEventListener('mousemove', e => {
    tx = e.clientX
    ty = e.clientY
    glowEl.classList.add('visible')
    if (!raf) raf = requestAnimationFrame(tick)
  }, { passive: true })

  document.addEventListener('mouseleave', () => {
    glowEl.classList.remove('visible')
  })
}

// ---------- 卡片 3D 倾斜 ----------
function initCardTilt() {
  const MAX_DEG = 6
  const MAX_MOVE = 8

  document.addEventListener('mouseover', e => {
    const card = e.target.closest('.post-card')
    if (!card) return
    startTilt(card)
  })

  document.addEventListener('mouseout', e => {
    const card = e.target.closest('.post-card')
    if (!card) return
    card.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)'
    card.style.transform = ''
    card.style.transitionEnd = () => {
      card.style.transition = ''
    }
  })

  function startTilt(card) {
    card.addEventListener('mousemove', onMove)
    function onMove(e) {
      const rect = card.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      const rx = (py - 0.5) * -MAX_DEG
      const ry = (px - 0.5) * MAX_DEG
      const tx = (px - 0.5) * MAX_MOVE
      const ty = (py - 0.5) * MAX_MOVE
      card.style.transition = 'none'
      card.style.transform =
        `perspective(800px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate(${tx}px, ${ty}px)`
    }
  }
}

// ---------- 打字机（Hero 标题逐字浮现） ----------
function initTypewriter() {
  const h1 = document.querySelector('.hero h1')
  if (!h1 || h1.dataset.typed) return
  h1.dataset.typed = '1'

  // 用 TreeWalker 遍历所有文本节点，按 DOM 顺序收集字符 + 所在父元素类型
  const chars = []
  const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT, null)
  let node
  while ((node = walker.nextNode())) {
    const isEm = node.parentElement?.tagName === 'EM'
    for (const ch of node.textContent) {
      chars.push({ ch, isEm })
    }
  }

  h1.innerHTML = ''
  let delay = 80
  const frag = document.createDocumentFragment()
  let emEl = null
  let lastIsEm = false

  for (const { ch, isEm } of chars) {
    if (isEm && !lastIsEm) {
      emEl = document.createElement('em')
      frag.appendChild(emEl)
    }
    if (!isEm && lastIsEm) {
      emEl = null
    }
    const span = document.createElement('span')
    span.className = 'char'
    span.style.animationDelay = delay + 'ms'
    span.textContent = ch
    if (emEl) emEl.appendChild(span)
    else frag.appendChild(span)
    lastIsEm = isEm
    delay += 45
  }

  const cursor = document.createElement('span')
  cursor.className = 'type-cursor'
  frag.appendChild(cursor)
  h1.appendChild(frag)
}

// ---------- 滚动视差（Hero 背景层缓慢移动） ----------
function initParallax() {
  const hero = document.querySelector('.hero')
  if (!hero) return
  const before = hero.style
  window.addEventListener('scroll', () => {
    const y = window.scrollY
    if (y < 800) {
      hero.style.transform = `translateY(${y * 0.08}px)`
      hero.style.opacity = Math.max(0, 1 - y / 700)
    }
  }, { passive: true })
}

// ---------- 滚动触发：blockquote 左边线生长 ----------
function initScrollReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view')
        observer.unobserve(entry.target)
      }
    })
  }, { threshold: 0.3 })

  document.querySelectorAll('.article-body blockquote').forEach(el => {
    observer.observe(el)
  })
}

// ---------- 文章标题下划线绘制 ----------
function initTitleDraw() {
  const title = document.querySelector('.article-title')
  if (title) {
    setTimeout(() => title.classList.add('drawn'), 100)
  }
}

// ---------- 数字滚动（文章计数） ----------
function initCounters() {
  document.querySelectorAll('.section-label .count').forEach(el => {
    const text = el.textContent
    const match = text.match(/(\d+)/)
    if (!match) return
    const target = parseInt(match[1])
    const suffix = text.replace(match[1], '')
    const start = performance.now()
    const dur = 800
    function tick(now) {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      el.textContent = Math.round(target * eased) + suffix
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

// ---------- 技能格子依次弹出 ----------
function initSkillStagger() {
  document.querySelectorAll('.skill-item').forEach((el, i) => {
    el.style.animationDelay = `${i * 60}ms`
  })
}

// ---------- 导航链接依次滑入 ----------
function initNavStagger() {
  document.querySelectorAll('.nav-link').forEach((el, i) => {
    el.style.animationDelay = `${i * 70 + 150}ms`
  })
}

// ---------- 主题切换时加过渡 class ----------
function initThemeTransition() {
  const root = document.documentElement
  root.addEventListener('transitionstart', () => root.classList.add('theme-transition'))
  // 简易：切换时加 class，1s 后移除
  const observer = new MutationObserver(() => {
    root.classList.add('theme-transition')
    setTimeout(() => root.classList.remove('theme-transition'), 500)
  })
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
}

// ---------- 背景星尘粒子 ----------
function initStardust() {
  const canvas = document.createElement('canvas')
  canvas.id = 'stardust'
  document.body.prepend(canvas)
  const ctx = canvas.getContext('2d')
  let w, h, particles = []
  const COUNT = 60

  function resize() {
    w = canvas.width = window.innerWidth
    h = canvas.height = window.innerHeight
  }
  resize()
  window.addEventListener('resize', resize)

  function spawn() {
    particles = []
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.1,
        alpha: Math.random() * 0.4 + 0.1,
        phase: Math.random() * Math.PI * 2
      })
    }
  }
  spawn()

  let mouseX = w / 2, mouseY = h / 2
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX
    mouseY = e.clientY
  }, { passive: true })

  function frame(t) {
    ctx.clearRect(0, 0, w, h)
    const isLight = document.documentElement.getAttribute('data-theme') === 'light'
    const color = isLight ? '176, 125, 62' : '212, 169, 98'

    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      // 边界回绕
      if (p.x < -5) p.x = w + 5
      if (p.x > w + 5) p.x = -5
      if (p.y < -5) p.y = h + 5
      if (p.y > h + 5) p.y = -5

      // 鼠标微扰动
      const dx = p.x - mouseX
      const dy = p.y - mouseY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 150) {
        const force = (150 - dist) / 150 * 0.3
        p.x += (dx / dist) * force
        p.y += (dy / dist) * force
      }

      // 呼吸闪烁
      const twinkle = 0.5 + 0.5 * Math.sin(t * 0.001 + p.phase)
      const a = p.alpha * twinkle

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${color}, ${a.toFixed(3)})`
      ctx.fill()
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

// ---------- 统一初始化 ----------
export function initEffects() {
  initCursorGlow()
  initCardTilt()
  initParallax()
  initCounters()
  initNavStagger()
  initThemeTransition()
  initStardust()
}

// 每页渲染后调用
export function onPageRender() {
  initTypewriter()
  initScrollReveal()
  initTitleDraw()
  initSkillStagger()
}
