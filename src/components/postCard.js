export function postCard(post, { featured = false } = {}) {
  // 兼容 API 返回格式（created_at, is_featured）和本地格式（date, featured）
  const rawDate = post.date || post.created_at || ''
  const dateFmt = rawDate.replace(/(\d{4})-(\d{2})-(\d{2})/,'$1.$2.$3').split(' ')[0]
  const readMin = post.readMin || Math.max(1, Math.round((post.body_html || post.body || '').length / 800))
  const slug = post.slug || post.id
  const tag = post.tag

  if (featured || post.is_featured) {
    return `
      <article class="post-card featured anim-up" onclick="location.hash='/post/${slug}'" style="cursor:pointer">
        <div class="featured-body">
          <div class="post-meta">
            <span class="tag">${tag}</span>
            <span>${dateFmt}</span>
            <span>·</span>
            <span>${readMin} 分钟</span>
          </div>
          <h3 class="post-title" style="font-size:24px">${post.title}</h3>
          <p class="post-excerpt">${post.excerpt}</p>
          <div class="post-footer">
            <span>精选</span>
            <span class="readmore">阅读全文 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
          </div>
        </div>
        <div class="featured-art">
          <div class="art-orbit">
            <div class="ring"></div>
            <div class="ring r2"></div>
            <div class="ring r3"></div>
            <div class="core"></div>
            <div class="sat"></div>
            <div class="sat s2"></div>
          </div>
          <div class="art-label">FEATURED</div>
        </div>
      </article>`
  }
  return `
    <article class="post-card anim-up" onclick="location.hash='/post/${slug}'" style="cursor:pointer">
      <div class="post-meta">
        <span class="tag">${tag}</span>
        <span>${dateFmt}</span>
        <span>·</span>
        <span>${readMin} min</span>
      </div>
      <h3 class="post-title">${post.title}</h3>
      <p class="post-excerpt">${post.excerpt}</p>
      <div class="post-footer">
        <span>${tag}</span>
        <span class="readmore">阅读 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
      </div>
    </article>`
}
