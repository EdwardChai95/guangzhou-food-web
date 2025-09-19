let foodsData = null;

// 生成星级评分
function generateStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 !== 0;
  return '★'.repeat(full) + (half ? '☆' : '');
}

// 创建美食卡片
function createFoodCard(food) {
  return `
    <div class="food-card" data-district="${food.district || ''}" onclick="openDetailModal(${food.id})">
      <img src="${food.mainImage}" alt="${food.name}" class="card-image">
      <div class="card-content">
        <div class="card-header">
          <div>
            <h3 class="food-name">${food.name}</h3>
            <span class="food-type">${food.type}</span>
          </div>
        </div>
        <div class="rating-price">
          <div class="rating"><span class="stars">${generateStars(food.rating)}</span><span>${food.rating}</span></div>
          <div class="price">${food.price}</div>
        </div>
        <p class="description">${food.description}</p>
        <div class="specialties">
          ${food.specialties.slice(0,3).map(s=>`<span class="specialty-tag">${s}</span>`).join('')}
        </div>
        <div class="card-footer">
          <div class="location">📍 ${food.location}</div>
          <button class="view-details" onclick="event.stopPropagation(); openDetailModal(${food.id})">查看详情</button>
        </div>
      </div>
    </div>
  `;
}

// 渲染美食列表
function renderFoods(district = 'all') {
  const foodList = document.getElementById('food-list');
  if (!foodsData) {
    foodList.innerHTML = `<div class="loading"><div class="spinner"></div><p>正在加载美食信息...</p></div>`;
    return;
  }

  let foodsToShow = [];
  if (district === 'all') {
    Object.keys(foodsData).forEach(key => {
      foodsData[key].forEach(food => {
        food.district = key;
        foodsToShow.push(food);
      });
    });
  } else {
    foodsToShow = foodsData[district] || [];
    foodsToShow.forEach(food => (food.district = district));
  }

  if (foodsToShow.length === 0) {
    foodList.innerHTML = `<div class="loading"><p>该地区暂无美食信息</p></div>`;
    return;
  }

  foodList.innerHTML = `<div class="food-grid">${foodsToShow.map(createFoodCard).join('')}</div>`;
}

// 查找
function findFoodById(id) {
  for (let district in foodsData) {
    const food = foodsData[district].find(item => item.id === id);
    if (food) {
      food.district = district;
      return food;
    }
  }
  return null;
}

// Modal 逻辑
function openDetailModal(foodId) {
  const food = findFoodById(foodId);
  if (!food) return;

  document.getElementById('modalTitle').textContent = food.name;
  document.getElementById('modalMainImage').src = food.mainImage;
  document.getElementById('modalRating').textContent = `${generateStars(food.rating)} ${food.rating}`;
  document.getElementById('modalPrice').textContent = food.price;
  document.getElementById('modalHours').textContent = food.hours;
  document.getElementById('modalLocation').textContent = food.location;
  document.getElementById('modalPhone').textContent = food.phone || '暂无';
  document.getElementById('modalType').textContent = food.type;
  document.getElementById('modalDescription').textContent = food.description;

  document.getElementById('modalSpecialties').innerHTML =
    food.specialties.map(s => `<div class="specialty-item">${s}</div>`).join('');

  document.getElementById('modalGallery').innerHTML =
    food.gallery.map(img => `<img src="${img}" alt="${food.name}" class="gallery-image" onclick="openImageViewer('${img}')">`).join('');

  const detailedInfoSection = document.getElementById('detailedInfoSection');
  const detailedInfoContent = document.getElementById('detailedInfoContent');

  if (food.detailedInfo) {
    let html = '';
    if (food.detailedInfo.history) html += `<div class="detail-section"><h4>🏛️ 历史沿革</h4><p>${food.detailedInfo.history}</p></div>`;
    if (food.detailedInfo.environment) html += `<div class="detail-section"><h4>🏞️ 环境特色</h4><p>${food.detailedInfo.environment}</p></div>`;
    if (food.detailedInfo.recommendations?.length) {
      html += `<div class="detail-section"><h4>💡 推荐理由</h4><ul>${food.detailedInfo.recommendations.map(r=>`<li>${r}</li>`).join('')}</ul></div>`;
    }
    if (food.detailedInfo.tips?.length) {
      html += `<div class="detail-section"><h4>💭 实用贴士</h4><ul>${food.detailedInfo.tips.map(t=>`<li>${t}</li>`).join('')}</ul></div>`;
    }
    detailedInfoContent.innerHTML = html;
    detailedInfoSection.style.display = 'block';
  } else {
    detailedInfoSection.style.display = 'none';
  }

  document.getElementById('detailModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('active');
  document.body.style.overflow = 'auto';
}

// 图片查看器
function openImageViewer(src) {
  document.getElementById('viewerImage').src = src;
  document.getElementById('imageViewer').classList.add('active');
}
function closeImageViewer() {
  document.getElementById('imageViewer').classList.remove('active');
}

// 事件绑定
document.addEventListener('keydown', e => {
  if (document.getElementById('imageViewer').classList.contains('active') && e.key === 'Escape') closeImageViewer();
  if (document.getElementById('detailModal').classList.contains('active') && e.key === 'Escape') closeDetailModal();
});

document.addEventListener('DOMContentLoaded', async () => {
  // 平滑滚动
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // 地区切换
  document.querySelectorAll('.district-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      document.querySelectorAll('.district-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderFoods(e.target.dataset.district);
    });
  });

  // 拉取 foods.json
  try {
    const res = await fetch('./data/foods.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    foodsData = await res.json();

    // 初次渲染
    renderFoods('all');
  } catch (err) {
    document.getElementById('food-list').innerHTML =
      `<div class="loading"><p>数据加载失败，请稍后重试。</p></div>`;
    // console.error('加载 foods.json 失败：', err);
  }

  // 点击背景关闭
  document.getElementById('imageViewer').addEventListener('click', e => { if (e.target === e.currentTarget) closeImageViewer(); });
  document.getElementById('detailModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeDetailModal(); });
});

// 暴露到全局（给 HTML onclick 使用）
window.openDetailModal = openDetailModal;
window.closeDetailModal = closeDetailModal;
window.openImageViewer = openImageViewer;
window.closeImageViewer = closeImageViewer;
