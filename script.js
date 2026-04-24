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
// ==================== 从 IndexedDB 加载缓存数据 ====================
async function loadFromCache() {
  try {
    await openDB();
    const brands = await getAll('brands');
    const specs = await getAll('specs');
    const materials = await getAll('materials');
    const version = await getMeta('local_version');
    if (brands.length > 0) {
      brandsData = brands;
      specsData = specs;
      materialsData = materials;
      localVersion = parseInt(version) || 0;
      renderBrands();
      renderSpecs();
      console.log('从缓存加载成功，版本:', localVersion);
    } else {
      console.log('缓存为空，等待首次同步');
    }
  } catch (e) {
    console.error('缓存加载失败:', e);
  }
}
// ==================== DOM 元素 ====================
const titleEl = document.getElementById('title');
const brandGrid = document.getElementById('brand-grid');
const specGrid = document.getElementById('spec-grid');
const lineBtns = document.querySelectorAll('.line-btn');
const menuBtn = document.getElementById('menu-btn');

// ==================== 数据同步（带版本检查） ====================
async function loadData() {
  try {
    // 1. 检查远程版本
    const verResp = await fetch('https://data.cloudgj.cn/version.txt');
    if (!verResp.ok) throw new Error('版本检查失败');
    const remoteVersion = parseInt((await verResp.text()).trim());
    
    // 2. 如果远程版本不大于本地版本，跳过下载
    if (remoteVersion <= localVersion && brandsData.length > 0) {
      console.log('已经是最新版本:', localVersion);
      return;
    }
    
    console.log(`发现新版本: ${remoteVersion} (本地: ${localVersion})`);
    
    // 3. 下载完整 JSON
    const dataResp = await fetch('https://data.cloudgj.cn/hcquick_data.json');
    if (!dataResp.ok) throw new Error('数据下载失败');
    const json = await dataResp.json();
    
    // 4. 写入 IndexedDB（全量覆盖）
    await openDB();
    await clearAndPutAll('brands', json.brands || []);
    await clearAndPutAll('specs', json.specs || []);
    await clearAndPutAll('materials', json.material_config || []);
    await putMeta('local_version', String(json.version || remoteVersion));
    
    // 5. 更新内存数据
    brandsData = json.brands || [];
    specsData = json.specs || [];
    materialsData = json.material_config || [];
    localVersion = json.version || remoteVersion;
    
    // 6. 刷新 UI
    renderBrands();
    renderSpecs();
    titleEl.textContent = 'HCQuick';
    selectedBrandId = null;
    selectedSpecId = null;
    
    console.log('同步完成，版本:', localVersion);
  } catch (e) {
    console.error('同步失败:', e);
    if (brandsData.length === 0) {
      brandGrid.innerHTML = '<span class="hint">数据加载失败，请检查网络</span>';
    }
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
    
    // 绑定点击事件
    brandGrid.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedBrandId = parseInt(btn.dataset.brandId);
            renderBrands();
            renderSpecs();
        });
        // 长按事件
        bindLongPress(btn, () => {
            const brand = brandsData.find(b => b.id === parseInt(btn.dataset.brandId));
            showBrandContextMenu(brand, btn);
        });
    });
}
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
    
    specGrid.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedSpecId = parseInt(btn.dataset.specId);
            enterCalcPage();
        });
        // 长按事件
        bindLongPress(btn, () => {
            const spec = specsData.find(s => s.id === parseInt(btn.dataset.specId));
            showSpecContextMenu(spec, btn);
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

// ==================== 菜单功能 ====================
let menuVisible = false;
let isInCalcPage = false;

function renderMenu() {
    const menu = document.getElementById('dropdown-menu');
    if (isInCalcPage) {
        // 计算页菜单：同步、日志、设置
        menu.innerHTML = `
            <div class="menu-item" onclick="handleSync()">🔄 同步</div>
            <div class="divider"></div>
            <div class="menu-item" onclick="showLogDialog()">📋 日志</div>
            <div class="menu-item" onclick="showSettingsDialog()">⚙️ 设置</div>
        `;
    } else {
        // 品牌规格页菜单：增加品牌/规格、同步、日志、设置
        menu.innerHTML = `
            <div class="menu-item" onclick="showAddBrandDialog()">+ 增加品牌</div>
            <div class="menu-item" onclick="showAddSpecDialog()">+ 增加规格</div>
            <div class="divider"></div>
            <div class="menu-item" onclick="handleSync()">🔄 同步</div>
            <div class="divider"></div>
            <div class="menu-item" onclick="showLogDialog()">📋 日志</div>
            <div class="menu-item" onclick="showSettingsDialog()">⚙️ 设置</div>
        `;
    }
}
          // ==================== 长按工具 ====================
function bindLongPress(element, callback) {
    let timer;
    element.addEventListener('touchstart', (e) => {
        timer = setTimeout(() => {
            callback();
            clearTimeout(timer);
        }, 500); // 500ms 长按
    });
    element.addEventListener('touchend', () => clearTimeout(timer));
    element.addEventListener('touchmove', () => clearTimeout(timer));
}

// ==================== 品牌上下文菜单 ====================
function showBrandContextMenu(brand, element) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-item" onclick="editBrand(${brand.id})">编辑</div>
        <div class="divider"></div>
        <div class="context-item" style="color:#E53935;" onclick="deleteBrand(${brand.id})">删除</div>
    `;
    document.body.appendChild(menu);
    
    // 定位
    const rect = element.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.display = 'block';
    
    // 点击外部关闭
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

// ==================== 品牌编辑/删除 ====================
async function editBrand(id) {
    const brand = brandsData.find(b => b.id === id);
    const newName = prompt('编辑品牌名称：', brand.name);
    if (newName && newName.trim() !== '') {
        await openDB();
        const tx = db.transaction('brands', 'readwrite');
        const store = tx.objectStore('brands');
        const updated = { ...brand, name: newName.trim(), updated_at: Math.floor(Date.now() / 1000) };
        await new Promise((resolve, reject) => {
            const request = store.put(updated);
            request.onsuccess = resolve;
            request.onerror = reject;
        });
        
        // 记录日志
        const logData = {
            type: 'UPDATE',
            table: 'brands',
            path: `${brand.line_code} 线 > ${brand.name}`,
            changes: { '名称': { old: brand.name, new: updated.name } }
        };
        await addLog({
            operation_type: 'UPDATE',
            table_name: 'brands',
            data_json: JSON.stringify(logData),
            created_at: Math.floor(Date.now() / 1000)
        });
        
        // 刷新数据
        brandsData = await getAll('brands');
        renderBrands();
        if (selectedBrandId === id) {
            renderSpecs(); // 刷新规格（如果有）
        }
    }
    // 移除上下文菜单
    document.querySelector('.context-menu')?.remove();
}

async function deleteBrand(id) {
    if (!confirm('确定删除该品牌吗？')) return;
    const brand = brandsData.find(b => b.id === id);
    await openDB();
    const tx = db.transaction('brands', 'readwrite');
    const store = tx.objectStore('brands');
    await new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = resolve;
        request.onerror = reject;
    });
    
    // 记录日志
    const logData = {
        type: 'DELETE',
        table: 'brands',
        path: `${brand.line_code} 线 > ${brand.name}`,
        deleted_data: brand
    };
    await addLog({
        operation_type: 'DELETE',
        table_name: 'brands',
        data_json: JSON.stringify(logData),
        created_at: Math.floor(Date.now() / 1000)
    });
    
    brandsData = await getAll('brands');
    if (selectedBrandId === id) selectedBrandId = null;
    renderBrands();
    renderSpecs();
    document.querySelector('.context-menu')?.remove();
}

// ==================== 新增品牌 ====================
async function showAddBrandDialog() {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
    const name = prompt('请输入新品牌名称（1-15字符）：');
    if (name && name.trim() !== '') {
        await openDB();
        const newBrand = {
            line_code: currentLine,
            name: name.trim(),
            sort_order: 0,
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
        };
        // 获取新 ID（简单处理：取最大值+1）
        const all = await getAll('brands');
        const maxId = all.reduce((max, b) => Math.max(max, b.id || 0), 0);
        newBrand.id = maxId + 1;
        
        const tx = db.transaction('brands', 'readwrite');
        const store = tx.objectStore('brands');
        await new Promise((resolve, reject) => {
            const request = store.add(newBrand);
            request.onsuccess = resolve;
            request.onerror = reject;
        });
        
        // 记录日志
        const logData = {
            type: 'INSERT',
            table: 'brands',
            path: `${currentLine} 线 > ${newBrand.name}`,
            data: newBrand
        };
        await addLog({
            operation_type: 'INSERT',
            table_name: 'brands',
            data_json: JSON.stringify(logData),
            created_at: Math.floor(Date.now() / 1000)
        });
        
        brandsData = await getAll('brands');
        renderBrands();
    }
}

menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!menuVisible) {
        renderMenu();
        menuVisible = true;
        document.getElementById('dropdown-menu').style.display = 'block';
    } else {
        menuVisible = false;
        document.getElementById('dropdown-menu').style.display = 'none';
    }
});

document.addEventListener('click', () => {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
});

function handleSync() {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
    // 检查本地日志，有则弹窗确认，无则直接同步
    checkAndSync();
}

async function checkAndSync() {
    try {
        const logs = await getAllLogs();
        if (logs.length > 0) {
            showSyncConfirmDialog(logs);
        } else {
            await loadData();
        }
    } catch (e) {
        console.error('检查日志失败:', e);
        await loadData(); // 降级：直接同步
    }
}

// ==================== 设置对话框 ====================
function showSettingsDialog() {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
    document.getElementById('settings-data-version').textContent = localVersion || '-';
    document.getElementById('settings-apk-version').textContent = '1.0.3';
    document.getElementById('settings-overlay').style.display = 'flex';
}

function closeSettingsDialog() {
    document.getElementById('settings-overlay').style.display = 'none';
}

// ==================== 增加品牌/规格对话框（简化版） ====================
function showAddBrandDialog() {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
    const name = prompt('请输入新品牌名称（1-15字符）：');
    // 后续加入 IndexedDB 写入逻辑
}

function showAddSpecDialog() {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
    const name = prompt('请输入新规格名称：');
    // 后续加入 IndexedDB 写入逻辑
}

// ==================== 日志对话框 ====================
function showLogDialog() {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
    alert('本地修改日志功能将在后续版本完善');
}

// ==================== 导入导出 ====================
function importJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        const text = await file.text();
        const json = JSON.parse(text);
        await openDB();
        await clearAndPutAll('brands', json.brands || []);
        await clearAndPutAll('specs', json.specs || []);
        await clearAndPutAll('materials', json.material_config || []);
        await putMeta('local_version', String(json.version || 0));
        location.reload();
    };
    input.click();
}

function exportJson() {
    const json = {
        version: localVersion,
        brands: brandsData,
        specs: specsData,
        material_config: materialsData
    };
    const blob = new Blob([JSON.stringify(json, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hcquick_backup.json';
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== 启动 ====================
(async () => {
  await loadFromCache();
  if (localVersion > 0) {
    loadData().catch(() => {});
  }
})();
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
    isInCalcPage = true;
    const spec = specsData.find(s => s.id === selectedSpecId);
    const brand = brandsData.find(b => b.id === spec?.brand_id);
    titleEl.textContent = `${currentLine}线 - ${spec?.name || ''}`;
    backBtn.style.display = 'inline';
    document.getElementById('nav-icon').style.display = 'none';
    
    // 隐藏品牌规格页，显示全屏计算页
    document.getElementById('brand-spec-page').style.display = 'none';
    calcPage.style.display = 'block';
    
    renderMaterials();
    if (spec?.remark) {
        propertyCard.innerHTML = `<div style="margin-bottom:8px;">规格备注: ${spec.remark}</div>`;
    }
    updateCalcUI();
}

function backToBrandSpec() {
    isInCalcPage = false;
    // 隐藏计算页，显示品牌规格页
    calcPage.style.display = 'none';
    document.getElementById('brand-spec-page').style.display = 'block';
    
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
// ==================== 规格上下文菜单 ====================
function showSpecContextMenu(spec, element) {
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-item" onclick="editSpec(${spec.id})">编辑</div>
        <div class="divider"></div>
        <div class="context-item" style="color:#E53935;" onclick="deleteSpec(${spec.id})">删除</div>
    `;
    document.body.appendChild(menu);
    
    const rect = element.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = rect.bottom + 4 + 'px';
    menu.style.display = 'block';
    
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

async function editSpec(id) {
    const spec = specsData.find(s => s.id === id);
    const newSort = prompt('编辑规格数字：', spec.sort_number);
    if (newSort && !isNaN(parseInt(newSort))) {
        await openDB();
        const updated = {
            ...spec,
            sort_number: parseInt(newSort),
            name: `${brandsData.find(b => b.id === spec.brand_id)?.name} ${newSort}`,
            updated_at: Math.floor(Date.now() / 1000)
        };
        const tx = db.transaction('specs', 'readwrite');
        const store = tx.objectStore('specs');
        await new Promise((resolve, reject) => {
            const request = store.put(updated);
            request.onsuccess = resolve;
            request.onerror = reject;
        });
        
        const logData = {
            type: 'UPDATE',
            table: 'specs',
            path: `${currentLine} 线 > ${brandsData.find(b => b.id === spec.brand_id)?.name} > ${spec.name}`,
            changes: { '排序': { old: spec.sort_number, new: updated.sort_number } }
        };
        await addLog({
            operation_type: 'UPDATE',
            table_name: 'specs',
            data_json: JSON.stringify(logData),
            created_at: Math.floor(Date.now() / 1000)
        });
        
        specsData = await getAll('specs');
        renderSpecs();
    }
    document.querySelector('.context-menu')?.remove();
}

async function deleteSpec(id) {
    if (!confirm('确定删除该规格吗？')) return;
    const spec = specsData.find(s => s.id === id);
    await openDB();
    const tx = db.transaction('specs', 'readwrite');
    const store = tx.objectStore('specs');
    await new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = resolve;
        request.onerror = reject;
    });
    
    const logData = {
        type: 'DELETE',
        table: 'specs',
        path: `${currentLine} 线 > ${brandsData.find(b => b.id === spec.brand_id)?.name} > ${spec.name}`,
        deleted_data: spec
    };
    await addLog({
        operation_type: 'DELETE',
        table_name: 'specs',
        data_json: JSON.stringify(logData),
        created_at: Math.floor(Date.now() / 1000)
    });
    
    specsData = await getAll('specs');
    renderSpecs();
    document.querySelector('.context-menu')?.remove();
}

async function showAddSpecDialog() {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
    if (!selectedBrandId) {
        alert('请先选择一个品牌');
        return;
    }
    const sort = prompt('请输入规格数字：');
    if (sort && !isNaN(parseInt(sort))) {
        await openDB();
        const all = await getAll('specs');
        const maxId = all.reduce((max, s) => Math.max(max, s.id || 0), 0);
        const brand = brandsData.find(b => b.id === selectedBrandId);
        const newSpec = {
            id: maxId + 1,
            brand_id: selectedBrandId,
            name: `${brand.name} ${sort}`,
            sort_number: parseInt(sort),
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
        };
        const tx = db.transaction('specs', 'readwrite');
        const store = tx.objectStore('specs');
        await new Promise((resolve, reject) => {
            const request = store.add(newSpec);
            request.onsuccess = resolve;
            request.onerror = reject;
        });
        
        const logData = {
            type: 'INSERT',
            table: 'specs',
            path: `${currentLine} 线 > ${brand.name} > ${newSpec.name}`,
            data: newSpec
        };
        await addLog({
            operation_type: 'INSERT',
            table_name: 'specs',
            data_json: JSON.stringify(logData),
            created_at: Math.floor(Date.now() / 1000)
        });
        
        specsData = await getAll('specs');
        renderSpecs();
    }
}
// ==================== 计算更新 ====================
function updateCalcUI() {
    const active = selectedMaterial || selectedPromoTag;
    if (!active) {
        subOptions.innerHTML = '';
        propertyCard.innerHTML = '';
        return;
    }
    renderMaterials();
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
    // 瓶子累计行
if (active && active.material_type === 'BOTTLE') {
    subOptions.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;width:100%;background:#F5F5F5;padding:8px;border-radius:8px;">
            <span style="font-size:12px;color:#888;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${bottleAccum.expression || '—'}</span>
            <button class="sub-btn" onclick="bottleTotal()">Total</button>
            <span style="background:#FFF0F5;padding:4px 8px;border-radius:8px;font-weight:bold;color:#1565C0;">${bottleAccum.totalEA.toFixed(1)}</span>
        </div>
    `;
}
    // 属性显示
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
let promoTagUsageMap = {}; // spec_id -> { promo_tag_id: count }

function openPromoDialog() {
    const dialog = document.getElementById('promo-dialog-overlay');
    const searchInput = document.getElementById('promo-search');
    searchInput.value = '';
    dialog.style.display = 'flex';
    renderPromoTags('');
}

function closePromoDialog() {
    document.getElementById('promo-dialog-overlay').style.display = 'none';
}

document.getElementById('promo-search').addEventListener('input', (e) => {
    renderPromoTags(e.target.value);
});

document.getElementById('promo-dialog-close').addEventListener('click', closePromoDialog);

// 点击遮罩关闭
document.getElementById('promo-dialog-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePromoDialog();
});

function renderPromoTags(query) {
    const grid = document.getElementById('promo-grid');
    const promos = materialsData.filter(m => m.material_type === 'PROMO_TAG');

    // 按使用次数排序
    const sorted = promos.sort((a, b) => {
        const countA = promoTagUsageMap[a.id] || 0;
        const countB = promoTagUsageMap[b.id] || 0;
        return countB - countA || (b.updated_at || 0) - (a.updated_at || 0);
    });

    // 过滤
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
        const order = (i + 1).toString().split('').map(d => 
    String.fromCodePoint(0x2070 + parseInt(d))
).join('');
        return `
    <button class="promo-tag-btn ${selected ? 'selected' : ''}" data-promo-id="${t.id}">
        <span class="order">${order}</span>
        ${displayCode}
    </button>
`;
    }).join('');

    // 绑定点击
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
    
    // 刷新材料按钮状态
    renderMaterials();
    
    // 更新促销标签卡片显示
    promoCard.textContent = `促销标签: ${promo.m_code || '请选择代码'}`;
    promoCard.classList.add('active');
    
    // 清空输入
    inputX.value = '';
    resultBox.textContent = '0.0';
    
    updateCalcUI();
}
// ==================== 同步确认弹窗 ====================
let pendingLogs = []; // 本地修改日志（Web 端暂存）

function showSyncConfirmDialog(logs) {
    const overlay = document.getElementById('sync-confirm-overlay');
    const list = document.getElementById('sync-confirm-list');
    
    list.innerHTML = logs.slice(0, 10).map(log => {
        try {
            const data = JSON.parse(log.data_json);
            return `<div>• ${data.type}: ${data.path}</div>`;
        } catch {
            return `<div>• 未知操作</div>`;
        }
    }).join('');
    
    if (logs.length > 10) {
        list.innerHTML += `<div style="color:#888;margin-top:4px;">... 共 ${logs.length} 条修改记录</div>`;
    }
    
    overlay.style.display = 'flex';
}

document.getElementById('sync-confirm-cancel').addEventListener('click', () => {
    document.getElementById('sync-confirm-overlay').style.display = 'none';
});

document.getElementById('sync-confirm-ok').addEventListener('click', async () => {
    document.getElementById('sync-confirm-overlay').style.display = 'none';
    await loadData(); // 直接全量覆盖
});
