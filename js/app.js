/* app.js — All vs Recommended, drop-in version
   - Loads foods.json and recommends.json
   - District filter + "only recommended" toggle
   - Card + modal with recommended reason & sources
*/

let foodsData = null;                 // { yuexiu:[], tianhe:[], liwan:[] }
let recommendedSet = new Set();       // Set<foodId>
let recommendedMeta = new Map();      // Map<foodId, { rank, tags, reason, sources[] }>
let showRecommendedOnly = false;      // UI toggle
let activeDistrict = 'all';           // 'all' | 'yuexiu' | 'tianhe' | 'liwan'

// ---------- Utilities ----------
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function safeText(s) { return (s ?? '').toString(); }
function generateStars(rating = 5) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  return '★'.repeat(full) + (half ? '½' : '');
}

function findFoodById(id) {
  if (!foodsData) return null;
  for (const k of Object.keys(foodsData)) {
    const hit = foodsData[k].find(x => Number(x.id) === Number(id));
    if (hit) return { ...hit, district: k };
  }
  return null;
}

function buildFoodFromRecommend(foodId) {
  console.log("foodId:", foodId);
  const rec = recommendedMeta.get(Number(foodId));
  if (!rec) return null;
  return {
    id: Number(foodId),
    name: rec.name || `#${foodId}`,
    type: rec.type || '推荐',
    description: rec.reason || '',
    location: rec.location || '',
    rating: rec.rating || 5,
    price: rec.price || '',
    hours: rec.hours || '',
    specialties: Array.isArray(rec.specialties) ? rec.specialties : [],
    mainImage: rec.mainImage || '',
    gallery: Array.isArray(rec.gallery) ? rec.gallery : [],
    district: '' // 推荐-only 没有区就留空
  };
}

// ---------- Rendering ----------
function createFoodCard(food) {
  const isRec = recommendedSet.has(food.id);
  const rec = recommendedMeta.get(food.id);

  const img = safeText(food.mainImage) || '';
  const desc = safeText(food.description);
  const type = safeText(food.type);
  const price = safeText(food.price);
  const loc = safeText(food.location);
  const specs = Array.isArray(food.specialties) ? food.specialties.slice(0, 3) : [];

  return `
    <div class="food-card ${isRec ? 'is-recommended' : ''}" data-id="${food.id}" data-district="${food.district}">
      <div class="card-media">
        ${isRec ? `<div class="card-ribbon">推荐</div>` : ``}
        ${img ? `<img src="${img}" alt="${food.name}" class="card-image">` : `<div class="card-image placeholder"></div>`}
      </div>

      <div class="card-content">
        <div class="card-header">
          <div>
            <h3 class="food-name">${food.name}</h3>
            <span class="food-type">${type}</span>
          </div>
          ${isRec && rec?.rank ? `<span class="rec-rank">#${rec.rank}</span>` : ``}
        </div>

        <div class="rating-price">
          <div class="rating"><span class="stars">${generateStars(food.rating)}</span><span>${food.rating ?? ''}</span></div>
          <div class="price">${price}</div>
        </div>

        <p class="description">${desc}</p>

        ${isRec && rec?.reason ? `<p class="rec-reason">💡 ${rec.reason}</p>` : ``}

        <div class="specialties">
          ${specs.map(s => `<span class="specialty-tag">${s}</span>`).join('')}
        </div>

        <div class="card-footer">
          <div class="location">📍 ${loc}</div>
          <button class="view-details" data-action="open-detail" data-id="${food.id}">查看详情</button>
        </div>
      </div>
    </div>
  `;
}

function collectFoodsForDistrict(district = 'all') {
  let list = [];
  if (!foodsData) return list;

  if (district === 'all') {
    Object.keys(foodsData).forEach(k => {
      (foodsData[k] || []).forEach(item => list.push({ ...item, district: k }));
    });
  } else {
    list = (foodsData[district] || []).map(item => ({ ...item, district }));
  }
  return list;
}

function collectRecommendedForDistrict(district = 'all') {
  // 从 recommendedMeta 组装 “推荐列表”
  const items = [];
  // recommendedMeta: Map<foodId, recObj>
  for (const [id, rec] of recommendedMeta.entries()) {
    const food = findFoodById(id);      // 尝试用 foods.json 补全字段
    // district 过滤：如果指定了区，且找到的 food 不在该区，则跳过
    if (district !== 'all' && food && food.district !== district) continue;

    if (food) {
      items.push({ ...food, district: food.district }); // 完整对象
    } else {
      // 兜底：recommends.json 里至少要有 name，可选 mainImage/price/description
      items.push({
        id,
        name: rec.name || `#${id}`,
        type: '推荐',
        description: rec.reason || '',
        location: rec.location || '',
        rating: rec.rating || 5,
        price: rec.price || '',
        hours: rec.hours || '',
        specialties: rec.specialties || [],
        mainImage: rec.mainImage || '',
        gallery: rec.gallery || ['', '', '', '', ''],
        district: district === 'all' ? '' : district
      });
    }
  }
  return items;
}

function renderFoods(district = activeDistrict) {
  activeDistrict = district;
  const container = $('#food-list');
  if (!container) return;

  container.innerHTML = `<div class="loading"><div class="spinner"></div><p>正在加载...</p></div>`;

  let foodsToShow;
  if (showRecommendedOnly) {
    foodsToShow = collectRecommendedForDistrict(district);
  } else {
    foodsToShow = collectFoodsForDistrict(district);
  }

  if (!foodsToShow.length) {
    container.innerHTML = `<div class="loading"><p>该条件下暂无美食信息</p></div>`;
    return;
  }

  const html = foodsToShow.map(createFoodCard).join('');
  container.innerHTML = `<div class="food-grid">${html}</div>`;
}


// ---------- Modal ----------
function openDetailModal(foodId) {
  const m = $('#detailModal');
  if (!m) return;
  let food = findFoodById(foodId);
  if (!food) {
    food = buildFoodFromRecommend(foodId);
    console.log("food:", food);
    if (!food) return;
  }
  if (!food) return;

  $('#modalTitle').textContent = food.name || '';
  $('#modalMainImage').src = food.mainImage || '';
  $('#modalRating').innerHTML = `${generateStars(food.rating)} ${food.rating ?? ''}`;
  $('#modalPrice').textContent = food.price || '';
  $('#modalHours').textContent = food.hours || '';
  $('#modalLocation').textContent = food.location || '';
  $('#modalPhone').textContent = food.phone || '暂无';
  $('#modalType').textContent = food.type || '';
  $('#modalDescription').textContent = food.description || '';

  $('#modalSpecialties').innerHTML = (food.specialties || [])
    .map(s => `<div class="specialty-item">${s}</div>`).join('');

  $('#modalGallery').innerHTML = (food.gallery || [])
    .filter(Boolean)
    .map(img => `<img src="${img}" alt="${food.name}" class="gallery-image">`).join('');

  // 详细信息（自带）
  const detailBox = $('#detailedInfoContent');
  let detailHtml = '';
  if (food.detailedInfo) {
    const d = food.detailedInfo;
    if (d.history) detailHtml += `<div class="detail-section"><h4>🏛️ 历史沿革</h4><p>${d.history}</p></div>`;
    if (d.environment) detailHtml += `<div class="detail-section"><h4>🏞️ 环境特色</h4><p>${d.environment}</p></div>`;
    if (Array.isArray(d.recommendations) && d.recommendations.length) {
      detailHtml += `<div class="detail-section"><h4>💡 推荐理由</h4><ul>${d.recommendations.map(x=>`<li>${x}</li>`).join('')}</ul></div>`;
    }
    if (Array.isArray(d.tips) && d.tips.length) {
      detailHtml += `<div class="detail-section"><h4>💭 实用贴士</h4><ul>${d.tips.map(x=>`<li>${x}</li>`).join('')}</ul></div>`;
    }
  }

  // 推荐信息（来自 recommends.json）
  const rec = recommendedMeta.get(food.id);
  if (rec) {
    const tags = (rec.tags || []).map(t => `<span class="specialty-tag">${t}</span>`).join(' ');
    const srcs = (rec.sources || [])
      .map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.name || s.url}</a></li>`).join('');
    detailHtml += `
      <div class="detail-section">
        <h4>🏷️ 推荐信息</h4>
        ${rec.rank ? `<p>推荐排名：#${rec.rank}</p>` : ``}
        ${tags ? `<p>标签：${tags}</p>` : ``}
        ${rec.reason ? `<p>理由：${rec.reason}</p>` : ``}
        ${srcs ? `<div><p>来源：</p><ul>${srcs}</ul></div>` : ``}
      </div>
    `;
  }

  $('#detailedInfoSection').style.display = detailHtml ? 'block' : 'none';
  detailBox.innerHTML = detailHtml;

  m.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
  const m = $('#detailModal');
  if (!m) return;
  m.classList.remove('active');
  document.body.style.overflow = '';
}

// ---------- Bootstrapping ----------
async function loadFoodsJson() {
  const res = await fetch('./data/foods.json');
  if (!res.ok) throw new Error(`foods.json HTTP ${res.status}`);
  return res.json();
}

async function loadRecommendsJson() {
  try {
    const res = await fetch('./data/recommends.json');
    if (!res.ok) return [];  // allows missing file
    return res.json();
  } catch {
    return [];
  }
}

function wireDistrictButtons() {
  $all('.district-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $all('.district-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const dist = btn.dataset.district || 'all';
      renderFoods(dist);
    });
  });
}

function wireRecommendedToggle() {
  const t = $('#toggleRecommended');
  if (!t) return;
  t.addEventListener('change', e => {
    showRecommendedOnly = !!e.target.checked;
    renderFoods(activeDistrict);
  });
}

function wireCardsClick() {
  const list = $('#food-list');
  if (!list) return;
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="open-detail"]');
    if (btn) {
      const id = btn.dataset.id;
      openDetailModal(id);
      return;
    }
    const card = e.target.closest('.food-card');
    if (card && card.dataset.id) {
      openDetailModal(card.dataset.id);
    }
  });
}

function wireModalClose() {
  const modal = $('#detailModal');
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-close') || e.target === modal) {
      closeDetailModal();
    }
  });
  const closeBtn = $('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', closeDetailModal);
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  // 1) load data
  try {
    foodsData = await loadFoodsJson();
  } catch (err) {
    const container = $('#food-list');
    if (container) {
      container.innerHTML = `<div class="loading"><p>数据加载失败：${err.message}</p></div>`;
    }
    return;
  }

  // 替换/增强 loadRecommendsJson 后对数据的处理（示意）：
  const recRaw = await loadRecommendsJson();
  const recList = Array.isArray(recRaw) ? recRaw : (Array.isArray(recRaw?.recommends) ? recRaw.recommends : []);
  recList.forEach(r => {
    const id = Number(r.foodId ?? r.id); // 兼容 foodId / id
    if (!Number.isFinite(id)) return;
    recommendedSet.add(id);
    recommendedMeta.set(id, r);
    console.log("meta:", recommendedMeta);
  });

  // 2) wire UI
  wireDistrictButtons();
  wireRecommendedToggle();
  wireCardsClick();
  wireModalClose();

  // 3) initial render
  renderFoods('all');
});
