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
// ==================== 材料计算 ====================
const backBtn = document.getElementById('back-btn');
const calcPage = document.getElementById('calc-page');
const brandSpecPage = document.getElementById('brand-spec-page');
const inputX = document.getElementById('input-x');
const resultBox = document.getElementById('result-box');
const materialGrid = document.getElementById('material-grid');
const promoCard = document.getElementById('promo-card');
const subOptions = document.getElementById('sub-options');
const propertyCard = document.getElementById('property-card');

let selectedMaterial = null;
let selectedPromoTag = null;
let rollCount = 1;
let peelMode = 'NONE';
let bottleAccum = { expression: '', totalEA: 0 };

// 规格点击 → 进入计算页面
specGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('grid-btn')) {
        selectedSpecId = parseInt(e.target.dataset.specId);
        enterCalcPage();
    }
});

function enterCalcPage() {
    const spec = specsData.find(s => s.id === selectedSpecId);
    const brand = brandsData.find(b => b.id === spec?.brand_id);
    titleEl.textContent = `${currentLine}线 - ${spec?.name || ''}`;
    backBtn.style.display = 'inline';
    document.getElementById('nav-icon').style.display = 'none';
    calcPage.style.display = 'block';
    renderMaterials();
    updateCalcUI();
}

function backToBrandSpec() {
    calcPage.style.display = 'none';
    backBtn.style.display = 'none';
    document.getElementById('nav-icon').style.display = 'inline';
    selectedSpecId = null;
    selectedMaterial = null;
    selectedPromoTag = null;
    inputX.value = '';
    resultBox.textContent = '0.0';
    titleEl.textContent = selectedBrandId 
        ? `${currentLine}线-${brandsData.find(b => b.id === selectedBrandId)?.name || ''}`
        : 'HCQuick';
    renderSpecs();
}

// ==================== 材料渲染 ====================
function renderMaterials() {
    const filtered = materialsData.filter(m => 
        m.spec_id === selectedSpecId && m.material_type !== 'PROMO_TAG'
    );
    materialGrid.innerHTML = filtered.map(m => `
        <button class="grid-btn ${selectedMaterial?.id === m.id ? 'selected' : ''}"
                data-mat-id="${m.id}">
            ${m.custom_name}
        </button>
    `).join('');
    
    materialGrid.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedMaterial = materialsData.find(m => m.id === parseInt(btn.dataset.matId));
            selectedPromoTag = null;
            updateCalcUI();
        });
    });
}

// ==================== 计算更新 ====================
function updateCalcUI() {
    const active = selectedMaterial || selectedPromoTag;
    if (!active) {
        subOptions.innerHTML = '';
        propertyCard.innerHTML = '';
        return;
    }
    
    // 子选项
    if (active.material_type === 'PUMP_CAP') {
        subOptions.innerHTML = `
            <button class="sub-btn ${peelMode === 'NONE' ? 'selected' : ''}" onclick="setPeel('NONE')">无</button>
            <button class="sub-btn ${peelMode === 'CARTON' ? 'selected' : ''}" onclick="setPeel('CARTON')">纸箱去皮</button>
            <button class="sub-btn ${peelMode === 'PLASTIC' ? 'selected' : ''}" onclick="setPeel('PLASTIC')">胶箱去皮</button>
        `;
    } else if (['LABEL', 'PROMO_TAG'].includes(active.material_type)) {
        subOptions.innerHTML = `
            <button class="sub-btn ${rollCount === 1 ? 'selected' : ''}" onclick="setRoll(1)">1 卷</button>
            <button class="sub-btn ${rollCount === 2 ? 'selected' : ''}" onclick="setRoll(2)">2 卷</button>
            <button class="sub-btn ${rollCount === 3 ? 'selected' : ''}" onclick="setRoll(3)">3 卷</button>
        `;
    } else {
        subOptions.innerHTML = '';
    }
    
    // 属性显示
    propertyCard.innerHTML = buildPropertyText(active);
    promoCard.classList.toggle('active', !!selectedPromoTag);
    calcResult();
}

function setPeel(mode) { peelMode = mode; updateCalcUI(); }
function setRoll(n) { rollCount = n; updateCalcUI(); }

function buildPropertyText(m) {
    switch (m.material_type) {
        case 'BOTTLE': return `p1: ${m.p1} g`;
        case 'PUMP_CAP': return `p1: ${m.p1} g | t1: ${m.t1} kg | t2: ${m.t2} kg`;
        case 'LABEL': case 'PROMO_TAG': {
            const n = m.q / (m.m - m.c);
            let text = `m: ${m.m} kg | c: ${m.c} kg | q: ${m.q} EA`;
            if (m.m > m.c && m.q > 0) text += ` | n: ${n.toFixed(1)} EA/kg`;
            return text;
        }
        default: return '';
    }
}

// ==================== 计算逻辑 ====================
inputX.addEventListener('input', calcResult);

function calcResult() {
    const active = selectedMaterial || selectedPromoTag;
    const x = parseFloat(inputX.value);
    if (!active || isNaN(x) || x <= 0) { resultBox.textContent = '0.0'; return; }
    
    let result;
    switch (active.material_type) {
        case 'BOTTLE':
            result = (x * 1000) / active.p1;
            break;
        case 'PUMP_CAP':
            const peel = peelMode === 'CARTON' ? active.t1 : peelMode === 'PLASTIC' ? active.t2 : 0;
            result = ((x - peel) * 1000) / active.p1;
            break;
        case 'LABEL': case 'PROMO_TAG':
            if (active.m <= active.c || active.q <= 0) { result = 0; break; }
            const n = active.q / (active.m - active.c);
            result = (x - active.c * rollCount) * n;
            break;
        default: result = 0;
    }
    resultBox.textContent = result > 0 ? result.toFixed(1) : '0.0';
}

function clearCalc() { inputX.value = ''; resultBox.textContent = '0.0'; }

// ==================== 促销标签（简化版，后续完善） ====================
function openPromoDialog() {
    alert('促销标签选择功能将在下一步完成');
}
