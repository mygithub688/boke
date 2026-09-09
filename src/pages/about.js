import { site, posts } from '../data.js'
import { postCard } from '../components/postCard.js'

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

function renderAbout(container) {
  const SKILLS = ['JavaScript', 'TypeScript', 'Rust', 'Python', 'C# / .NET', 'SQL', 'Docker', 'Kubernetes', 'Vite', 'WebAssembly']

  container.innerHTML = `
    <div class="page narrow">
      <div class="about-hero anim-up">
        <div class="avatar"><span>指</span></div>
        <div>
          <h1>你好，我是指挥官</h1>
          <p>工程师 / 逆向爱好者 / 本地部署实践者。白天写代码，晚上折腾硬件，周末给游戏写复刻。相信第一性原理，也相信好工具应该顺手。</p>
        </div>
      </div>

      <div class="about-section">
        <h2>现在做什么 <span class="en">Now</span></h2>
        <p>主要在做两件事：一是本地大模型部署与推理优化，包括模型量化、KV Cache 调优、投机解码等方向；二是游戏开发，用现代语言复刻经典 8-bit 游戏，把 ECS、状态机、渲染管线这些架构概念落到键盘上。</p>
      </div>

      <div class="about-section">
        <h2>技术栈 <span class="en">Stack</span></h2>
        <div class="skills-grid">
          ${SKILLS.map(s => `<div class="skill-item">${s}</div>`).join('')}
        </div>
      </div>

      <div class="about-section">
        <h2>一些原则 <span class="en">Principles</span></h2>
        <p>
          <strong>先算账，再选型。</strong>显存预算、网络带宽、延迟预算，都是算术题。把数字算清楚，方案自然浮现。<br/><br/>
          <strong>能读源码就别看文档。</strong>文档是别人的理解，源码是事实。逆向 .NET 应用比读官方教程学到的多。<br/><br/>
          <strong>工具应该消失。</strong>好的工具用起来像空气，你甚至忘了它的存在。写工具时把"让人忘记它"当第一目标。
        </p>
      </div>

      <div class="about-section">
        <h2>联系我 <span class="en">Contact</span></h2>
        <p>
          <a href="mailto:${site.links.email}" style="color:var(--accent)">${site.links.email}</a><br/>
          GitHub: <a href="${site.links.github}" target="_blank" rel="noopener" style="color:var(--accent)">github.com/</a>
        </p>
      </div>
    </div>
    ${footerHTML()}
  `
}

export default {
  render(container) { renderAbout(container) },
  cleanup() {}
}
