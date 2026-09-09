import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, 'blog.db')

export async function createDb() {
  const db = new DatabaseSync(dbPath)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      tag TEXT NOT NULL,
      excerpt TEXT DEFAULT '',
      body_html TEXT NOT NULL,
      is_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_posts_tag ON posts(tag);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
  `)

  // 种子数据（首次运行）
  const count = db.prepare('SELECT COUNT(*) as n FROM posts').get()
  if (count.n === 0) {
    seedPosts(db)
    seedTags(db)
  }

  // 确保默认管理员存在
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get()
  if (userCount.n === 0) {
    const hash = hashPassword('admin123')
    db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
      .run('admin', hash, '指挥官', 'admin')
    console.log('[db] 默认管理员已创建: admin / admin123')
  }

  return db
}

function seedPosts(db) {
  const seeds = [
    {
      title: '给本地大模型装上一台 MTP 引擎', slug: 'mtp-acceleration', tag: 'AI 工程', featured: 1,
      excerpt: 'Multi-Token Prediction 不是玄学，而是一套把"猜一个词"变成"猜一句话"的架构改造。',
      body: `<p>自回归生成是大语言模型最优雅的机制，也是最贵的一环。每一个 token 都要走一次完整的 forward，KV Cache 越来越大，显存带宽越来越成为瓶颈。MTP（Multi-Token Prediction）做的事情很直接：<strong>让模型一次预测多个未来的 token</strong>，用更少的 forward 换取更长的输出。</p><h2>为什么是 MTP</h2><p>直觉上，"一次猜多个词"似乎只是把损失函数从 next-token 换成 next-k-token。但真正的设计难点在于：这些辅助的预测头会反过来改善主干表示。</p><blockquote>预测头是免费的蒸馏老师：它们强迫主干网络把未来的轮廓也编码进当前的隐状态里。</blockquote><h2>投机解码视角</h2><p>推理阶段，MTP 头天然就是一个草稿模型。用主干生成第 1 个 token 的同时，MTP 头顺带产出 2~4 个候选，再由主干一次性验证。</p><pre><code>for pos in positions:\n    draft = mtp_head[depth](hidden[pos])\n    main  = verify(hidden[pos])\n    if sample(main) == sample(draft):\n        accept(draft)\n    else:\n        break</code></pre><h2>实测数据</h2><p>在 RTX 4090（24GB）上，27B 级别 Qwen 模型开启 MTP 后吞吐从 14.2 tok/s 提升到 19.8 tok/s。</p><ul><li>显存占用：额外约 4%</li><li>接受率：平均 0.72</li><li>生成质量无可感知差异</li></ul>`
    },
    {
      title: '上下文窗口的军备竞赛：从 4K 到 10M', slug: 'context-window-evolution', tag: '大模型', featured: 0,
      excerpt: '四年前 4K 上下文还是卖点，现在百万级已成标配。但窗口长度和"真正可用的有效上下文"是两回事。',
      body: `<p>上下文窗口（context window）是大模型最显眼的规格参数，也是营销最重的参数。4096 → 32K → 128K → 1M → 10M，数字翻了上千倍。</p><h2>位置编码的进化</h2><p>RoPE（旋转位置编码）把位置信息编码进注意力分数的旋转角度里，天然具备外推能力。</p><blockquote>RoPE 的妙处在于：位置关系被表示为"旋转了多少度"，而不是"第几格"。</blockquote><h2>注意力是平方级成本</h2><p>标准自注意力的复杂度是 O(n²)。1M 上下文意味着注意力矩阵有 10¹² 个元素。</p><h2>迷失在中间</h2><p>"lost in the middle"现象：把关键信息放在长文开头或结尾，模型表现远好于放在中间。</p>`
    },
    {
      title: '24GB 显存能装下什么：本地推理的容量账本', slug: 'rtx4090-local-inference', tag: '硬件', featured: 0,
      excerpt: '一张 4090 到底能跑多大的模型？量化位宽、KV Cache 开销、框架损耗，把这笔账算清楚。',
      body: `<p>本地推理的显存预算是一道算术题，而且是一道不能出错、不能凑整的算术题。</p><h2>模型权重的显存占用</h2><p>27B 参数 FP16 需要 54GB；Q8 量化约 28GB；Q4 量化约 15GB。</p><pre><code>权重显存 ≈ 参数量 × 每参数字节数\nQ8:  27e9 × 1.06 ≈ 28.6 GB\nQ4:  27e9 × 0.57 ≈ 15.4 GB</code></pre><h2>KV Cache 是被低估的大户</h2><p>27B 模型 8K 上下文下 KV Cache 就要 2~3GB，32K 翻四倍。</p><ul><li>权重 + KV Cache + 框架 overhead ≈ 总显存需求</li><li>留 2GB 余量给系统和驱动</li></ul>`
    },
    {
      title: '用 Rust 重构坦克大战：从"能跑"到"优雅"', slug: 'tank-battle-refactor', tag: '游戏开发', featured: 0,
      excerpt: '复刻 8-bit 坦克大战是个经典练手项目，真正的收获不在像素还原，而在架构。',
      body: `<p>坦克大战（Battle City）是 NES 上最经典的射击游戏之一。用现代语言重写它，表面上是像素复刻，实际上是一整套游戏架构的演练。</p><h2>实体组件系统</h2><p>第二版改成 ECS：每个实体只是一组组件的集合，系统按帧遍历。</p><blockquote>游戏架构的核心不是"怎么画"，而是"状态怎么流转"。</blockquote><h2>碰撞检测的坑</h2><p>子弹是高速小物体，AABB 检测会出现穿透。解决方案是连续碰撞检测（CCD）。</p><pre><code>fn move_bullet(bullet: &mut Bullet, dt: f32) {\n    let steps = (bullet.speed * dt / 2.0).ceil() as usize;\n    let sub_dt = dt / steps as f32;\n    for _ in 0..steps {\n        bullet.pos += bullet.vel * sub_dt;\n        if check_collision(bullet) { handle_hit(bullet); break; }\n    }\n}</code></pre>`
    },
    {
      title: '.NET WPF 登录验证逆向：从反编译到 IL 补丁', slug: 'dotnet-wpf-reverse', tag: '逆向工程', featured: 0,
      excerpt: '一个 .NET WPF 应用的登录校验，背后是静态方法、WeakReferenceMessenger、WPF 绑定的三层嵌套。',
      body: `<p>逆向 .NET 应用比逆向原生二进制要友好得多。但 WPF 应用的登录校验往往不是一处，而是分散在三个地方的协同。</p><h2>第一层：GetLoginState</h2><pre><code>// IL: 替换 GetLoginState 方法体\nldc.i4.1\nret</code></pre><h2>第二层：WeakReferenceMessenger</h2><blockquote>逆向 .NET 应用的核心技巧：找到"最终判断点"，而不是"最显眼的入口"。</blockquote><h2>第三层：OnActivated</h2><pre><code>// IL: 在 OnActivated 方法开头插入\nldarg.0\nldc.i4.1\nstfld loginState</code></pre><ul><li>ilspycmd 反编译 → 定位三处目标</li><li>Mono.Cecil → 修改 IL 指令流</li><li>.NET 8 SDK → 编译补丁工具</li></ul>`
    },
    {
      title: '2026 国模横评：开源大模型的真实实力榜', slug: 'local-model-ranking', tag: '大模型', featured: 0,
      excerpt: '不看跑分看实效。从代码生成、数学推理、长文理解、工具调用四个维度做盲测。',
      body: `<p>模型评测榜是营销工具，不是选型依据。本文用四个真实场景做盲测。</p><h2>测试方法</h2><ul><li>代码生成：20 个真实需求，评分 0-5</li><li>数学推理：10 道竞赛级题目</li><li>长文理解：3 万 token 文档，15 个定位问题</li><li>工具调用：10 个 API 编排任务</li></ul><h2>意外发现</h2><p>排行榜第一的模型在工具调用维度只排第三。function calling 格式对多轮嵌套调用支持较弱。</p><blockquote>选模型不是选"最聪明的"，是选"在你的工作流里最稳的"。</blockquote>`
    }
  ]

  const insert = db.prepare('INSERT INTO posts (title, slug, tag, excerpt, body_html, is_featured) VALUES (?, ?, ?, ?, ?, ?)')
  for (const s of seeds) {
    insert.run(s.title, s.slug, s.tag, s.excerpt, s.body, s.featured)
  }
  console.log(`[db] 种子文章已导入: ${seeds.length} 篇`)
}

function seedTags(db) {
  const tags = ['大模型', 'AI 工程', '硬件', '游戏开发', '逆向工程', '生活', '效率工具', '读书笔记']
  const insert = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
  for (const t of tags) insert.run(t)
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'))
}
