// 博客数据 · 前端写死，后续可替换为 API 或 Markdown
export const site = {
  name: '指挥官',
  nameEn: 'COMMANDER',
  bio: '在代码与生活的缝隙里，记录关于技术、硬件与思考的一切。相信第一性原理，也相信好茶要趁热喝。',
  links: {
    github: 'https://github.com/',
    weibo: '#',
    email: 'hello@example.com'
  }
}

export const posts = [
  {
    id: 'mtp-acceleration',
    title: '给本地大模型装上一台 MTP 引擎',
    tag: 'AI 工程',
    date: '2026-09-02',
    readMin: 12,
    featured: true,
    excerpt: 'Multi-Token Prediction 不是玄学，而是一套把"猜一个词"变成"猜一句话"的架构改造。这篇文章从 Transformer 的自回归瓶颈讲起，拆解 MTP 模块的训练目标、投机解码的接受率计算，以及在 4090 上实测 Qwen 模型前后的吞吐对比。',
    body: `
<p>自回归生成是大语言模型最优雅的机制，也是最贵的一环。每一个 token 都要走一次完整的 forward，KV Cache 越来越大，显存带宽越来越成为瓶颈。MTP（Multi-Token Prediction）做的事情很直接：<strong>让模型一次预测多个未来的 token</strong>，用更少的 forward 换取更长的输出。</p>

<h2>为什么是 MTP</h2>
<p>直觉上，"一次猜多个词"似乎只是把损失函数从 next-token 换成 next-k-token。但真正的设计难点在于：这些辅助的预测头会反过来改善主干表示。模型为了预测第 +2、+3 个词，被迫在每一层编码更完整的时序结构，而不是只盯着"下一个词最像什么"。</p>

<blockquote>预测头是免费的蒸馏老师：它们强迫主干网络把未来的轮廓也编码进当前的隐状态里。</blockquote>

<h2>投机解码视角</h2>
<p>推理阶段，MTP 头天然就是一个草稿模型。用主干生成第 1 个 token 的同时，MTP 头顺带产出 2~4 个候选，再由主干一次性验证：接受的 token 直接落盘，拒绝的位置回退重试。接受率取决于草稿与主干分布的接近程度——这也是为什么 MTP 头需要和主干一起训练。</p>

<pre><code>// 简化版的 MTP 验证流程
for pos in positions:
    draft = mtp_head[depth](hidden[pos])
    main  = verify(hidden[pos])
    if sample(main) == sample(draft):
        accept(draft)   # 一次 forward，多个 token 落盘
    else:
        break           # 回退到拒绝位置</code></pre>

<h2>实测数据</h2>
<p>在 RTX 4090（24GB）上，对 27B 级别的 Qwen 模型开启 MTP 加速后：吞吐从 14.2 tok/s 提升到 19.8 tok/s，首 token 延迟基本不变。加速比大约 1.4x，且接受率稳定在 0.72 左右。对本地部署这种"没有无限算力"的场景，这种近乎白嫖的提速非常关键。</p>

<ul>
  <li>显存占用：主干 + 3 个 MTP 头，额外约 4% 显存</li>
  <li>接受率：平均 0.72，长对话场景略有下降</li>
  <li>副作用：生成质量无可感知差异，困惑度变化在噪声范围内</li>
</ul>

<hr />

<p>技术选型的乐趣就在于此：一个训练期的辅助头，换来推理期实打实的 40% 提速。MTP 目前还处在快速演进阶段，值得持续跟踪。</p>
    `
  },
  {
    id: 'context-window-evolution',
    title: '上下文窗口的军备竞赛：从 4K 到 10M',
    tag: '大模型',
    date: '2026-08-28',
    readMin: 9,
    excerpt: '四年前 4K 上下文还是卖点，现在百万级已成标配。但窗口长度和"真正可用的有效上下文"是两回事。这篇聊聊长上下文背后的注意力机制改造、位置编码外推，以及实际使用中长文的"迷失在中间"现象。',
    body: `
<p>上下文窗口（context window）是大模型最显眼的规格参数，也是营销最重的参数。4096 → 32K → 128K → 1M → 10M，数字翻了上千倍。但参数好看和使用体验之间，隔着好几层技术细节。</p>

<h2>位置编码的进化</h2>
<p>原始 Transformer 用的是可学习的位置嵌入，训练时见过多长就只能用多长。RoPE（旋转位置编码）把位置信息编码进注意力分数的旋转角度里，天然具备外推能力——这也是为什么几乎所有现代模型都转向了 RoPE 或它的变体。</p>

<blockquote>RoPE 的妙处在于：位置关系被表示为"旋转了多少度"，而不是"第几格"。相对位置在数学上被保留了下来。</blockquote>

<h2>注意力是平方级成本</h2>
<p>标准自注意力的复杂度是 O(n²)。1M 上下文意味着注意力矩阵有 10¹² 个元素，靠堆硬件硬算是不现实的。所以长上下文模型几乎都配了稀疏注意力、滑动窗口、或者线性注意力变体。窗口大不等于每个 token 都能"看到"全局——有效信息密度往往远低于名义长度。</p>

<h2>迷失在中间</h2>
<p>学界反复验证过"lost in the middle"现象：把关键信息放在长文开头或结尾，模型的表现远好于放在中间。这不是玄学，而是注意力权重在长序列上的分布不均导致的。实际使用建议：重要的指令和约束尽量放在 prompt 首尾，中间留给上下文。</p>

<hr />

<p>窗口长度是入场券，不是竞争力。真正决定长文可用性的，是位置编码方案、注意力架构和 RLHF 阶段的训练数据配比。看参数表之前，先看评测里"needle in a haystack"的分段得分曲线。</p>
    `
  },
  {
    id: 'rtx4090-local-inference',
    title: '24GB 显存能装下什么：本地推理的容量账本',
    tag: '硬件',
    date: '2026-08-25',
    readMin: 8,
    excerpt: '一张 4090 到底能跑多大的模型？量化位宽、KV Cache 开销、框架损耗，把这笔账算清楚之后你会发现：70B 级模型在 24GB 上不是"勉强能跑"，而是"有讲究地能跑"。',
    body: `
<p>本地推理的显存预算是一道算术题，而且是一道不能出错、不能凑整的算术题。</p>

<h2>模型权重的显存占用</h2>
<p>参数数量直接决定权重体积。一个 27B 参数的模型，在 FP16 下需要 54GB；Q8 量化后约 28GB；Q4 量化后约 15GB。数字看起来 4090 的 24GB 装不下 28GB 的 Q8 版本？对，所以量化位宽是第一个决策变量。</p>

<pre><code>权重显存 ≈ 参数量 × 每参数字节数
Q8:  27e9 × 1.06 ≈ 28.6 GB
Q4:  27e9 × 0.57 ≈ 15.4 GB   ← 4090 可容纳，还剩 ~8GB</code></pre>

<h2>KV Cache 是被低估的大户</h2>
<p>很多人只算权重，忘了 KV Cache。它对显存的需求 = 2 × 层数 × 注意力头维度 × 头数 × 序列长度 × 字节数。27B 模型在 8K 上下文下，KV Cache 就要吃掉 2~3GB。上下文拉到 32K，这个数字翻四倍。</p>

<ul>
  <li>权重 + KV Cache + 框架 overhead ≈ 总显存需求</li>
  <li>overhead 通常有 1~2GB，别忽略</li>
  <li>留 2GB 余量给系统和驱动</li>
</ul>

<h2>量化不是免费的</h2>
<p>Q4 和 Q8 的困惑度差距很小，但在长对话、数学推理、代码生成这类"一步错步步错"的任务上，低比特量化会累积误差。经验法则：通用对话 Q4 够用，代码和推理任务尽量 Q6/Q8。</p>

<hr />

<p>算完这笔账，"能跑多大"就有了确定答案。剩下的就是工程问题：offload 策略、分页 KV Cache、批处理调度，这些都是让账本上数字真正落地的活。</p>
    `
  },
  {
    id: 'tank-battle-refactor',
    title: '用 Rust 重构坦克大战：从"能跑"到"优雅"',
    tag: '游戏开发',
    date: '2026-08-24',
    readMin: 11,
    excerpt: '复刻 8-bit 坦克大战是个经典练手项目，但真正的收获不在像素还原，而在架构：实体组件、状态机、碰撞检测、渲染管线，每一个模块都在逼你把设计模式落到键盘上。',
    body: `
<p>坦克大战（Battle City）是 NES 上最经典的射击游戏之一。用现代语言重写它，表面上是像素复刻，实际上是一整套游戏架构的演练。</p>

<h2>实体组件系统</h2>
<p>第一版用 class 继承写，坦克、子弹、砖墙、钢墙、基地各一个类，碰撞检测变成一堆 if-else。第二版改成 ECS：每个实体只是一组组件的集合（Position、Velocity、Collidable、Renderable），系统按帧遍历。代码量没少多少，但扩展性天差地别——加一种新道具从"改五个文件"变成"加一个组件"。</p>

<blockquote>游戏架构的核心不是"怎么画"，而是"状态怎么流转"。渲染只是状态的一种投影。</blockquote>

<h2>碰撞检测的坑</h2>
<p>子弹是高速小物体，砖墙是网格。 naive 的 AABB 检测会出现穿透：子弹一帧移动 8 像素，砖墙格子宽 8 像素，直接从砖缝里穿过去了。解决方案是连续碰撞检测（CCD）：把子弹移动拆成子步，每步 2 像素，逐步检测。性能开销可以忽略，但正确性完全不一样。</p>

<pre><code>fn move_bullet(bullet: &mut Bullet, dt: f32) {
    let steps = (bullet.speed * dt / 2.0).ceil() as usize;
    let sub_dt = dt / steps as f32;
    for _ in 0..steps {
        bullet.pos += bullet.vel * sub_dt;
        if check_collision(bullet) {
            handle_hit(bullet);
            break;
        }
    }
}</code></pre>

<h2>像素还原的细节</h2>
<p>8-bit 游戏的灵魂在细节：坦克开火时车身会停顿一帧、基地被炸时有一声特殊的低频音、通关时基地从铁丝网变成金色。这些细节不需要高性能，但需要耐心。还原它们的过程，本质上是在逆向一个没有文档的像素级规格。</p>

<hr />

<p>重写经典游戏的最大价值不是"我也能写一个坦克大战"，而是：当你把一个足够小的系统从混沌写到清晰，你会对"架构"这个词产生肌肉记忆。这种肌肉记忆，换任何语言、任何领域都还在。</p>
    `
  },
  {
    id: 'dotnet-wpf-reverse',
    title: '.NET WPF 登录验证逆向：从反编译到 IL 补丁',
    tag: '逆向工程',
    date: '2026-08-23',
    readMin: 14,
    excerpt: '一个 .NET WPF 应用的登录校验，表面是"输错密码就弹窗"，背后是静态方法、WeakReferenceMessenger、WPF 绑定的三层嵌套。用 ilspycmd 反编译、Mono.Cecil 打补丁、.NET 8 SDK 编译，三个工具配合把 loginState 字段直接写死为 true。',
    body: `
<p>逆向 .NET 应用比逆向原生二进制要友好得多——IL 代码几乎是伪代码级别的可读性。但 WPF 应用的登录校验往往不是一处，而是分散在消息总线、属性绑定、字段赋值三个地方的协同。漏掉任何一处，界面就会进入半残状态。</p>

<h2>第一层：静态方法 GetLoginState</h2>
<p>反编译后，<code>GetLoginState()</code> 是最显眼的入口。它读取本地存储的凭据，调用服务器验证，返回 bool。最直接的补丁：直接返回 true。</p>

<pre><code>// IL: 替换 GetLoginState 方法体
ldc.i4.1    // push true
ret         // return true</code></pre>

<p>但这只解决了"判断"，没解决"状态"。WPF 界面读取的是 <code>loginState</code> 字段，不经过 <code>GetLoginState()</code>。这是 .NET WPF 应用常见的反模式：字段和方法各走各的，靠人工保证一致性。</p>

<h2>第二层：WeakReferenceMessenger</h2>
<p>WPF 应用内部通信常用 CommunityToolkit.Mvvm 的 WeakReferenceMessenger。登录状态变化时，某处会发一条 <code>UserStatus</code> 消息，导航组件收到后检查 <code>Is_V_I_P || loginState</code>。只要 <code>loginState</code> 为 true，短路求值直接通过——不需要改 <code>Is_V_I_P</code> 属性本身。</p>

<blockquote>逆向 .NET 应用的核心技巧：找到"最终判断点"，而不是"最显眼的入口"。消息总线的消费者才是真正的关卡。</blockquote>

<h2>第三层：OnActivated 里的字段赋值</h2>
<p>WPF 的导航框架（如 Prism）在页面激活时调用 <code>OnActivated()</code>。原始代码在这里会读取 <code>GetLoginState()</code> 的结果，写入 <code>loginState</code> 字段。补丁策略：保留原始的消息注册逻辑，只在前面插入 <code>loginState = true</code> 赋值。</p>

<pre><code>// IL: 在 OnActivated 方法开头插入
ldarg.0           // this
ldc.i4.1          // true
stfld loginState  // this.loginState = true
// ... 原始方法体继续执行 ...</code></pre>

<h2>编译环境的坑</h2>
<p>用 .NET 10 SDK 编译补丁工具会碰到 CET（Control Flow Enforcement Technology）兼容性问题。降级到 .NET 8 SDK（8.0.424），用 global.json 锁定版本，编译一次通过。写回 DLL 时注意文件锁：先写到临时文件，再替换目标。</p>

<ul>
  <li>ilspycmd 反编译 → 定位三处目标</li>
  <li>Mono.Cecil → 修改 IL 指令流</li>
  <li>.NET 8 SDK → 编译补丁工具</li>
  <li>临时文件 → 替换 DLL → 反编译验证</li>
</ul>

<hr />

<p>逆向的意义不在于"破解"，而在于理解软件如何运作。当你能用 IL 级别的精度描述一个 WPF 应用的登录流程时，你对 .NET、WPF、Mvvm 三者的理解，已经超过了 90% 只写上层代码的人。</p>
    `
  },
  {
    id: 'local-model-ranking',
    title: '2026 国模横评：开源大模型的真实实力榜',
    tag: '大模型',
    date: '2026-08-20',
    readMin: 7,
    excerpt: '不看跑分看实效。从代码生成、数学推理、长文理解、工具调用四个维度，对当前主流开源模型做了一轮盲测。结论可能和排行榜上的排名不太一样。',
    body: `
<p>模型评测榜（MMLU、HumanEval、GSM8K）是营销工具，不是选型依据。同一个模型在 MMLU 上 90 分，不代表它在你的实际工作流里好用。本文用四个真实场景做盲测。</p>

<h2>测试方法</h2>
<ul>
  <li>代码生成：给 20 个真实需求，评分 0-5（正确、可运行、风格）</li>
  <li>数学推理：10 道竞赛级题目，看推理链完整性</li>
  <li>长文理解：3 万 token 的技术文档，问 15 个定位问题</li>
  <li>工具调用：10 个 API 编排任务，看参数正确率和错误恢复</li>
</ul>

<h2>意外发现</h2>
<p>排行榜上第一的模型，在工具调用维度只排第三。原因：它的 function calling 格式对多轮嵌套调用的支持较弱，第三轮之后开始丢参数。而排行榜第四的模型，因为工具调用格式更稳健，在实际编排场景里体验最好。</p>

<blockquote>选模型不是选"最聪明的"，是选"在你的工作流里最稳的"。稳定性的权重应该高于峰值能力。</blockquote>

<h2>量化对推理的影响</h2>
<p>同一个模型，FP16 和 Q4 在数学推理上的差距比在对话上大得多。Q4 的困惑度只高了 5%，但多步推理的"一步错步步错"效应让正确率掉了 12%。结论：推理任务用 Q6 以上，对话任务 Q4 够用。</p>

<hr />

<p>横评的价值不在排名，在于方法论：建立你自己的评测集，用你真实的任务来打分。别人的排行榜是别人的工作流，你的才是你的。</p>
    `
  }
]

export const tags = [
  { name: '大模型', count: 8 },
  { name: 'AI 工程', count: 5 },
  { name: '硬件', count: 4 },
  { name: '游戏开发', count: 3 },
  { name: '逆向工程', count: 2 },
  { name: '生活', count: 6 },
  { name: '效率工具', count: 3 },
  { name: '读书笔记', count: 4 }
]
