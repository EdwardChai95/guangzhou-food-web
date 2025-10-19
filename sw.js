// sw.js
const CACHE_VERSION = 'v1.0.0'; // 手动改这个版本号即可强制全量更新
const CACHE_NAME = `gf-cache-${CACHE_VERSION}`;

// 你想缓存的资源清单（按需增减）
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './js/app.js',         // ← 改这里
  './data/foods.json',
  './data/recommends.json',
  './css/style.css'
];

// 安装：仅创建空缓存；是否预缓存由“手动触发”决定
self.addEventListener('install', (e) => {
  // 跳过等待，使新 SW 立刻接管（可选）
  self.skipWaiting();
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(key => key.startsWith('gf-cache-') && key !== CACHE_NAME ? caches.delete(key) : null)
    );
    // 让页面立刻受控
    await self.clients.claim();
  })());
});

// 手动消息：预缓存 or 清空缓存
self.addEventListener('message', async (event) => {
  const { type } = event.data || {};
  if (type === 'PRECACHE_NOW') {
    const cache = await caches.open(CACHE_NAME);
    // 强制绕过浏览器 HTTP 缓存去抓最新
    const reqs = PRECACHE_ASSETS.map(u => new Request(u, { cache: 'reload' }));
    await cache.addAll(reqs);
    event.source.postMessage({ type: 'PRECACHE_DONE', version: CACHE_VERSION });
  }
  if (type === 'CLEAR_CACHE') {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(key => key.startsWith('gf-cache-') ? caches.delete(key) : null)
    );
    event.source.postMessage({ type: 'CLEAR_DONE' });
  }
});

// 网络策略：优先缓存，失败再网络（对 precache 的文件）
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 只处理同源资源
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 只对我们的清单/同源静态资源走缓存优先（可按需细化匹配规则）
    const match = await cache.match(e.request, { ignoreSearch: true });
    if (match) return match;

    try {
      const resp = await fetch(e.request);
      // 可选择性地把静态资源写入缓存（避免把 POST/动态接口塞缓存）
      if (e.request.method === 'GET' && resp.ok) {
        cache.put(e.request, resp.clone());
      }
      return resp;
    } catch (err) {
      // 离线兜底：如果请求的是数据文件，且有旧缓存，可返回旧缓存
      const fallback = await cache.match(e.request, { ignoreSearch: true });
      if (fallback) return fallback;
      // 也可在此返回一个离线提示页
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
