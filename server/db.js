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
      is_draft INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_key TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(post_id, user_key)
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_key TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(post_id, user_key)
    );

    CREATE INDEX IF NOT EXISTS idx_posts_tag ON posts(tag);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_draft ON posts(is_draft);
    CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_key);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_key);
  `)

  // 兼容旧库：补加新字段
  try { db.prepare('ALTER TABLE posts ADD COLUMN is_draft INTEGER DEFAULT 0').run() } catch {}
  try { db.prepare('ALTER TABLE posts ADD COLUMN view_count INTEGER DEFAULT 0').run() } catch {}

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
      body: `<p>本地推理的显存预算是一道算术题，而且是一道不能出错、不能凑整的算术题。</p><h2>模型权重的显存占用</h2><p>27B 参数 FP16 需要 54GB；Q8 量化后约 28GB；Q4 量化后约 15GB。</p><pre><code>权重显存 ≈ 参数量 × 每参数字节数\nQ8:  27e9 × 1.06 ≈ 28.6 GB\nQ4:  27e9 × 0.57 ≈ 15.4 GB</code></pre><h2>KV Cache 是被低估的大户</h2><p>27B 模型 8K 上下文下 KV Cache 就要 2~3GB，32K 翻四倍。</p><ul><li>权重 + KV Cache + 框架 overhead ≈ 总显存需求</li><li>留 2GB 余量给系统和驱动</li></ul>`
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
    },
    {
      title: 'Windows 上把 Ubuntu 装进 2GB 的 VHD：WSL2 最小化配置', slug: 'wsl2-ubuntu-setup', tag: '效率工具', featured: 0,
      excerpt: 'WSL2 默认的 Ubuntu 镜像占 3.8GB。这篇记录了一套把 WSL2 压到 2GB 以下的配置方案。',
      body: `<p>WSL2 默认的 Ubuntu 镜像越来越臃肿。一个"干净"的 Ubuntu 22.04 WSL2 实例，不装任何额外软件，也要 3.8GB。</p><h2>从 Alpine 起步</h2><p>Alpine Linux 的 WSL2 镜像只有 130MB。apk 包管理器比 apt 快一个量级。</p><pre><code>wsl --import myalpine .\\alpine.tar.gz --version 2\napk add bash git curl python3 nodejs npm</code></pre><h2>Docker Desktop 的替代</h2><p>直接用 WSL2 里的 Docker Engine，不装 Desktop。或者用 Podman（rootless），内存占用减半。</p><blockquote>WSL2 的 2GB 上限不是物理限制，是你给自己设的心理锚点。</blockquote>`
    },
    {
      title: '2026 年个人硬件采购指南：钱花在刀刃上', slug: 'hobbyist-hardware-2026', tag: '硬件', featured: 0,
      excerpt: '从 CPU 到显卡到显示器，每个位置都算过 TCO。不是"最新最好"，而是"在你的使用场景下，边际收益最高"的那一档。',
      body: `<p>硬件采购最忌两个极端：一是"追新"，二是"极致性价比"。我的原则：<strong>在边际收益曲线上找拐点</strong>。</p><h2>CPU：核心数 vs 单核性能</h2><p>如果你主要跑本地模型推理和编译，单核性能权重高于核心数。</p><pre><code>场景            权重分配          推荐\nAI 推理         单核 70% 核心 30%  9800X3D\n游戏            单核 50% 核心 50%  9800X3D\n编译/CI         核心 60% 单核 40%  14900K</code></pre><h2>显卡：本地推理的唯一真神</h2><p>24GB 显存的 4090 是目前性价比天花板。能装下模型是第一优先级。</p><blockquote>显卡选购的唯一指标：显存容量 > 核心数量 > 频率。</blockquote>`
    },
    {
      title: '我的笔记系统：从 Notion 到纯文本的三年迁移', slug: 'note-taking-system', tag: '效率工具', featured: 0,
      excerpt: '用 Notion 三年之后，我把它删了。现在的方案：纯文本 + Git + 一个 50 行的搜索脚本。',
      body: `<p>2023 年开始用 Notion 做知识管理。三年下来，笔记有 2000+ 条，数据库建了 7 个。然后有一天我打开 Notion，发现我在"管理笔记"上花的时间，比"写笔记"多三倍。</p><h2>工具在偷注意力</h2><p>每一个数据库视图、每一个模板、每一个集成都在消耗认知带宽。</p><blockquote>好的笔记工具应该消失在背景里。</blockquote><h2>纯文本 + Git 方案</h2><p><code>~/notes/</code> 目录下全是 <code>.md</code> 文件，按主题分目录，用 Git 做版本控制。</p><ul><li>零依赖：20 年后还能打开</li><li>零学习成本：<code>cat</code> 就能看</li><li>版本控制：Git 的 commit history 比任何笔记软件的时间线都强大</li></ul>`
    },
    {
      title: '杭州 42°C：一个工程师的夏天生存策略', slug: 'hangzhou-summer-heat', tag: '生活', featured: 0,
      excerpt: '连续 12 天 38°C+ 的杭州，空调电费涨了 80%。记录一些真正有效的降温策略。',
      body: `<p>2026 年 7 月底到 8 月中旬，杭州连续 12 天白天最高温 38°C 以上，体感 45°C+。</p><h2>有效的降温策略</h2><ul><li>空调温度设 26°C，不追求 22°C</li><li>下午 2-5 点最热时段，拉窗帘挡阳光直射</li><li>睡前开空调定时 2 小时</li><li>冰毛巾敷后颈</li></ul><h2>无效但看起来有用的"技巧"</h2><ul><li>"多喝温水"：体感温度不变</li><li>"绿豆汤"：心理安慰大于生理降温</li></ul><blockquote>高温下最有效的降温策略是降低产热：少写代码，少开会。</blockquote>`
    },
    {
      title: 'Rust 和 Python 在 2026 年还是对手吗？', slug: 'rust-vs-python-2026', tag: 'AI 工程', featured: 0,
      excerpt: 'Rust 在系统编程站稳，Python 在 AI/ML 仍是绝对王者。但 2026 年的真实情况是：它们越来越多地在同一个项目里共存。',
      body: `<p>"Rust 会取代 Python"这个说法在 2020 年很流行，到 2026 年已经基本消亡。</p><h2>实际项目中的共存模式</h2><p>Python 做模型加载、推理调度、API 服务；Rust 做高性能推理引擎、图像处理。</p><pre><code>from inference_engine import fast_decode  # Rust 扩展\ndef run_inference(model, prompt):\n    tokens = tokenizer.encode(prompt)\n    result = fast_decode(model, tokens)\n    return tokenizer.decode(result)</code></pre><h2>什么时候选 Rust</h2><ul><li>性能敏感：GPU 推理、实时渲染</li><li>内存安全：长驻服务、系统工具</li><li>编译产物：CLI 工具、跨平台二进制</li></ul><h2>什么时候选 Python</h2><ul><li>AI/ML：PyTorch、JAX、HuggingFace 生态</li><li>快速原型：想法验证、数据探索</li></ul><blockquote>让每种语言待在摩擦最低的位置。</blockquote>`
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
