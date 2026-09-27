// 站内 AI 问答悬浮窗：访客提问，后端检索文章 + 本地模型作答
import { askAi } from '../api.js'

function buildAskAi() {
  const btn = document.createElement('button')
  btn.className = 'askai-btn'
  btn.title = '问问 AI（基于本站文章）'
  btn.innerHTML = `<span class="askai-spark">✦</span><span class="askai-txt">问 AI</span>`
  document.body.appendChild(btn)

  const panel = document.createElement('div')
  panel.className = 'askai-panel'
  panel.hidden = true
  panel.innerHTML = `
    <div class="askai-head">
      <span>✦ 站内 AI 问答</span>
      <button class="askai-close" title="关闭">✕</button>
    </div>
    <div class="askai-body" id="askaiBody">
      <p class="askai-hint">基于博客文章回答你的问题，比如"哪篇讲了显存计算？"</p>
    </div>
    <form class="askai-form" id="askaiForm">
      <input type="text" id="askaiInput" placeholder="输入你的问题…" maxlength="200" autocomplete="off" />
      <button type="submit">发送</button>
    </form>
  `
  document.body.appendChild(panel)

  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden
    if (!panel.hidden) panel.querySelector('#askaiInput').focus()
  })
  panel.querySelector('.askai-close').addEventListener('click', () => { panel.hidden = true })

  const body = panel.querySelector('#askaiBody')
  panel.querySelector('#askaiForm').addEventListener('submit', async e => {
    e.preventDefault()
    const input = panel.querySelector('#askaiInput')
    const q = input.value.trim()
    if (!q) return
    input.value = ''

    const qEl = document.createElement('div')
    qEl.className = 'askai-q'
    qEl.textContent = q
    body.appendChild(qEl)

    const aEl = document.createElement('div')
    aEl.className = 'askai-a'
    aEl.innerHTML = '<span class="ai-loading">✦ 检索文章并思考中…</span>'
    body.appendChild(aEl)
    body.scrollTop = body.scrollHeight

    try {
      const { answer, sources } = await askAi(q)
      const refHtml = sources && sources.length
        ? `<div class="askai-refs">参考：${sources.map(s => `《${s}》`).join('')}</div>`
        : ''
      aEl.innerHTML = `${answer.replace(/</g, '&lt;').replace(/\n/g, '<br/>')}${refHtml}`
    } catch (err) {
      aEl.textContent = err.message
    }
    body.scrollTop = body.scrollHeight
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildAskAi)
} else {
  buildAskAi()
}
