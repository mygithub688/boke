export function postCard(post, { featured = false } = {}) {
  const dateFmt = post.date.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1.$2.$3')
  if (featured) {
    return `
      <article class="post-card featured anim-up" onclick="location.hash='/post/${post.id}'" style="cursor:pointer">
        <div class="featured-body">
          <div class="post-meta">
            <span class="tag">${post.tag}</span>
            <span>${dateFmt}</span>
            <span>·</span>
            <span>${post.readMin} 分钟</span>
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
    <article class="post-card anim-up" onclick="location.hash='/post/${post.id}'" style="cursor:pointer">
      <div class="post-meta">
        <span class="tag">${post.tag}</span>
        <span>${dateFmt}</span>
        <span>·</span>
        <span>${post.readMin} min</span>
      </div>
      <h3 class="post-title">${post.title}</h3>
      <p class="post-excerpt">${post.excerpt}</p>
      <div class="post-footer">
        <span>${post.tag}</span>
        <span class="readmore">阅读 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
      </div>
    </article>`
}
