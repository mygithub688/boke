// 简单内存限流器（零依赖风格）
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map()
  setInterval(() => {
    const now = Date.now()
    for (const [k, arr] of hits) {
      const alive = arr.filter(t => now - t < windowMs)
      if (alive.length === 0) hits.delete(k)
      else hits.set(k, alive)
    }
  }, windowMs).unref()

  return function check(key) {
    if (!key) return true
    const now = Date.now()
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs)
    if (arr.length >= max) { hits.set(key, arr); return false }
    arr.push(now)
    hits.set(key, arr)
    return true
  }
}
