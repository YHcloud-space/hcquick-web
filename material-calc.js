// ==================== 材料计算 DOM 元素 ====================
const backBtn = document.getElementById('back-btn');
const calcPage = document.getElementById('calc-page');
const brandSpecPage = document.getElementById('brand-spec-page');
const inputX = document.getElementById('input-x');
const resultBox = document.getElementById('result-box');
const materialGrid = document.getElementById('material-grid');
const promoCard = document.getElementById('promo-card');
const subOptions = document.getElementById('sub-options');
const propertyCard = document.getElementById('property-card');
inputX.addEventListener('focus', function() {
    this.value = '';
});

let selectedMaterial = null;
let isFirstMaterialClick = true;
let selectedPromoTag = null;
let rollCount = 1;
let peelMode = 'NONE';
let bottleAccum = { expression: '', totalEA: 0 };



function enterCalcPage() {
    isInCalcPage = true;
    isFirstMaterialClick = true;
    const spec = specsData.find(s => s.id === selectedSpecId);
    const brand = brandsData.find(b => b.id === spec?.brand_id);
    titleEl.textContent = `${currentLine}线 - ${spec?.name || ''}`;
    backBtn.style.display = 'inline';
    document.getElementById('nav-icon').style.display = 'none';
    
    document.getElementById('brand-spec-page').style.display = 'none';
    calcPage.style.display = 'block';
    
    renderMaterials();
    if (spec?.remark) {
        propertyCard.innerHTML = `<div style="margin-bottom:8px;">规格备注: ${spec.remark}</div>`;
    }
    updateCalcUI();
    inputX.focus(); // 新增
}

function backToBrandSpec() {
    isInCalcPage = false;
    isFirstMaterialClick = true;
    calcPage.style.display = 'none';
    document.getElementById('brand-spec-page').style.display = 'block';
    
    backBtn.style.display = 'none';
    document.getElementById('nav-icon').style.display = 'inline';
    selectedSpecId = null;
    selectedMaterial = null;
    selectedPromoTag = null;
    inputX.value = '';
    resultBox.textContent = '0.0';
    // ✅ 重置促销标签卡片
    promoCard.textContent = '促销标签: 请选择代码';
    promoCard.classList.remove('active');
    
    // ✅ 重置瓶子累计
    bottleAccum = { expression: '', totalEA: 0 };
    
    titleEl.textContent = selectedBrandId 
        ? `${currentLine}线-${brandsData.find(b => b.id === selectedBrandId)?.name || ''}`
        : 'HCQuick';
    renderSpecs();
    (async () => {
        try {
            const logs = await getAllLogs();
            if (logs.length > 0) {
                setTimeout(() => {
                    alert('您有未同步的本地修改，请确认修改正确后联系管理员更新主数据。');
                }, 300);
            }
        } catch (e) {}
    })();
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
            // 首次点击材料：不清空输入框，直接计算
        if (!isFirstMaterialClick) {
            inputX.value = '';
            resultBox.textContent = '0.0';
        }
        isFirstMaterialClick = false;   // 标记已成非首次
        
        updateCalcUI();
        inputX.focus();
    });
});

// ==================== 规格上下文菜单（在材料计算 JS 中，因为需要长按规格时调用，但实际已在 brand-spec.js 中定义，此处无需重复） ====================
// 注意：showSpecContextMenu、editSpec、deleteSpec、showAddSpecDialog 已在 brand-spec.js 中定义

// ==================== 计算更新 ====================
function updateCalcUI() {
    const active = selectedMaterial || selectedPromoTag;
    if (!active) {
        subOptions.innerHTML = '';
        propertyCard.innerHTML = '';
        return;
    }
    renderMaterials();
    
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
    
    if (active && active.material_type === 'BOTTLE') {
        subOptions.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;width:100%;background:#F5F5F5;padding:8px;border-radius:8px;">
                <span style="font-size:12px;color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${bottleAccum.expression || '—'}</span>
                <button class="sub-btn" onclick="bottleTotal()">Total</button>
                <span style="background:#FFF0F5;padding:4px 8px;border-radius:8px;font-weight:bold;color:#1565C0;">${bottleAccum.totalEA.toFixed(1)}</span>
            </div>
        `;
    }
    
    propertyCard.innerHTML = buildPropertyText(active);
    promoCard.classList.toggle('active', !!selectedPromoTag);
    calcResult();
}

function setPeel(mode) { peelMode = mode; updateCalcUI(); }
function setRoll(n) { rollCount = n; updateCalcUI(); }

function buildPropertyText(m) {
    let text;
    switch (m.material_type) {
        case 'BOTTLE': text = `p1: ${m.p1} g`; break;
        case 'PUMP_CAP': text = `p1: ${m.p1} g | t1: ${m.t1} kg | t2: ${m.t2} kg`; break;
        case 'LABEL': case 'PROMO_TAG':
            const n = m.q / (m.m - m.c);
            text = `m: ${m.m} kg | c: ${m.c} kg | q: ${m.q} EA`;
            if (m.m > m.c && m.q > 0) text += ` | n: ${n.toFixed(1)} EA/kg`;
            break;
        default: text = '';
    }
    if (m.remark) {
        text += `<br>备注: ${m.remark}`;
    }
    return text;
}

// ==================== 计算逻辑 ====================
inputX.addEventListener('input', calcResult);

function calcResult() {
    // [新增] 全局过滤：限制只能输入最多7位数字（含小数点）
    let rawValue = inputX.value;
    // 只允许数字和小数点，且最多1个小数点
    let filtered = rawValue.replace(/[^0-9.]/g, '');
    const dotIndex = filtered.indexOf('.');
    if (dotIndex !== -1) {
        filtered = filtered.substring(0, dotIndex + 1) + filtered.substring(dotIndex + 1).replace(/\./g, '');
    }
    // 截断到7位
    if (filtered.length > 7) {
        filtered = filtered.substring(0, 7);
    }
    // 如果过滤后与原始值不同，则更新输入框并重新获取值
    if (filtered !== rawValue) {
        inputX.value = filtered;
    }
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
function bottleTotal() {
    const x = parseFloat(inputX.value);
    if (!isNaN(x) && x > 0) {
        bottleAccum.expression += `${x}kg + `;
        bottleAccum.totalEA += parseFloat(resultBox.textContent) || 0;
        inputX.value = '';
        resultBox.textContent = '0.0';
        updateCalcUI();
    }
}

// ==================== 促销标签对话框 ====================
let promoTagUsageMap = {};

function openPromoDialog() {
    const dialog = document.getElementById('promo-dialog-overlay');
    const searchInput = document.getElementById('promo-search');
    searchInput.value = '';
    dialog.style.display = 'flex';
    renderPromoTags('');
    // [新增] 自动聚焦到促销标签搜索框，让键盘保持弹出
    setTimeout(() => {
        searchInput.focus();
    }, 100);
}

function closePromoDialog() {
    document.getElementById('promo-dialog-overlay').style.display = 'none';
    inputX.focus(); // 新增
}

document.getElementById('promo-search').addEventListener('input', (e) => {
    renderPromoTags(e.target.value);
});

document.getElementById('promo-dialog-close').addEventListener('click', closePromoDialog);

document.getElementById('promo-dialog-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePromoDialog();
});

function renderPromoTags(query) {
    const grid = document.getElementById('promo-grid');
    const promos = materialsData.filter(m => m.material_type === 'PROMO_TAG');

    const sorted = promos.sort((a, b) => {
        const countA = promoTagUsageMap[a.id] || 0;
        const countB = promoTagUsageMap[b.id] || 0;
        return countB - countA || (b.updated_at || 0) - (a.updated_at || 0);
    });

    const filtered = query 
        ? sorted.filter(t => (t.m_code || '').includes(query))
        : sorted;

    if (filtered.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">未找到匹配的Code</div>';
        return;
    }

    grid.innerHTML = filtered.map((t, i) => {
        const selected = selectedPromoTag?.id === t.id;
        const code = t.m_code || '未知';
        const displayCode = query 
            ? code.replace(new RegExp(`(${query})`, 'gi'), '<span style="color:#FF0000;font-weight:bold;">$1</span>')
            : code;
        const superscriptMap = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
};
const order = (i + 1).toString().split('').map(d => superscriptMap[d] || d).join('');
        return `
            <button class="promo-tag-btn ${selected ? 'selected' : ''}" data-promo-id="${t.id}">
                <span class="order">${order}</span>
                ${displayCode}
            </button>
        `;
    }).join('');

    grid.querySelectorAll('.promo-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const promo = materialsData.find(m => m.id === parseInt(btn.dataset.promoId));
            selectPromoTag(promo);
            closePromoDialog();
        });
    });
}

function selectPromoTag(promo) {
    selectedPromoTag = promo;
    selectedMaterial = null;
    promoTagUsageMap[promo.id] = (promoTagUsageMap[promo.id] || 0) + 1;
    
    renderMaterials();
    
    promoCard.textContent = `促销标签: ${promo.m_code || '请选择代码'}`;
    promoCard.classList.add('active');
    
    inputX.value = '';
    resultBox.textContent = '0.0';
    
    updateCalcUI();
}
// material-calc.js → 文件最底部，在所有函数定义之后
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('grid-btn') && e.target.dataset.specId) {
        selectedSpecId = parseInt(e.target.dataset.specId);
        enterCalcPage();
    }
});
