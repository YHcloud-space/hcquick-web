// ==================== 全局状态 ====================
let currentLine = 'C';
let selectedBrandId = null;
let selectedSpecId = null;

// 原始数据缓存
let brandsData = [];
let specsData = [];
let materialsData = [];
let promoTagsData = [];
let localVersion = 0;

// ==================== DOM 元素 ====================
const titleEl = document.getElementById('title');
const brandGrid = document.getElementById('brand-grid');
const specGrid = document.getElementById('spec-grid');
const lineBtns = document.querySelectorAll('.line-btn');
const menuBtn = document.getElementById('menu-btn');

// ==================== 数据加载 ====================
async function loadData() {
    try {
        const resp = await fetch('https://data.cloudgj.cn/hcquick_data.json');
        if (!resp.ok) throw new Error('网络错误');
        const json = await resp.json();
        brandsData = json.brands || [];
        specsData = json.specs || [];
        materialsData = json.material_config || [];
        localVersion = json.version || 0;
        renderBrands();
        renderSpecs();
        titleEl.textContent = 'HCQuick';
        selectedBrandId = null;
        selectedSpecId = null;
    } catch (e) {
        brandGrid.innerHTML = '<span class="hint">数据加载失败，请检查网络</span>';
        specGrid.innerHTML = '';
        console.error('数据加载失败:', e);
    }
}

// ==================== 品牌渲染 ====================
function renderBrands() {
    const filtered = brandsData.filter(b => b.line_code === currentLine);
    if (filtered.length === 0) {
        brandGrid.innerHTML = '<span class="hint">暂无品牌</span>';
        return;
    }
    brandGrid.innerHTML = filtered.map(b => `
        <button class="grid-btn ${b.id === selectedBrandId ? 'selected' : ''}"
                data-brand-id="${b.id}">
            ${b.name}
        </button>
    `).join('');
    
    // 绑定品牌点击事件
    brandGrid.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedBrandId = parseInt(btn.dataset.brandId);
            renderBrands();
            renderSpecs();
        });
    });
}

// ==================== 规格渲染 ====================
function renderSpecs() {
    if (!selectedBrandId) {
        specGrid.innerHTML = '<span class="hint">请先选择一个品牌</span>';
        return;
    }
    const filtered = specsData.filter(s => s.brand_id === selectedBrandId);
    if (filtered.length === 0) {
        specGrid.innerHTML = '<span class="hint">暂无规格</span>';
        return;
    }
    specGrid.innerHTML = filtered.map(s => `
        <button class="grid-btn ${s.id === selectedSpecId ? 'selected' : ''}"
                data-spec-id="${s.id}">
            ${s.name}
        </button>
    `).join('');
    
    // 绑定规格点击事件
    specGrid.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedSpecId = parseInt(btn.dataset.specId);
            renderSpecs();
            // 后续：进入材料计算页面
        });
    });
}

// ==================== 线号切换 ====================
lineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        lineBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        currentLine = btn.dataset.line;
        selectedBrandId = null;
        selectedSpecId = null;
        titleEl.textContent = 'HCQuick';
        renderBrands();
        renderSpecs();
    });
});

// ==================== 菜单按钮（同步） ====================
menuBtn.addEventListener('click', () => {
    loadData();
});

// ==================== 启动 ====================
loadData();
