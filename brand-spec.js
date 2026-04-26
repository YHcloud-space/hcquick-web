// ==================== 全局状态 ====================
let currentLine = 'C';
let selectedBrandId = null;
let selectedSpecId = null;

// 原始数据缓存
let brandsData = [];
let specsData = [];
let materialsData = [];
let localVersion = 0;

// ==================== 红点更新（检查本地日志） ====================
async function updateBadge() {
    try {
        const logs = await getAllLogs();
        const hasChanges = logs.length > 0;
        const syncBadge = document.getElementById('sync-badge');
        if (syncBadge) {
            syncBadge.style.display = hasChanges ? 'inline-flex' : 'none';
            if (hasChanges) syncBadge.textContent = logs.length;
        }
    } catch (e) {
        const syncBadge = document.getElementById('sync-badge');
        if (syncBadge) syncBadge.style.display = 'none';
    }
}

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
      updateBadge();
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
    const verResp = await fetch('https://data.cloudgj.cn/version.txt');
    if (!verResp.ok) throw new Error('版本检查失败');
    const remoteVersion = parseInt((await verResp.text()).trim());
    
    if (remoteVersion <= localVersion && brandsData.length > 0) {
      console.log('已经是最新版本:', localVersion);
      return;
    }
    
    console.log(`发现新版本: ${remoteVersion} (本地: ${localVersion})`);
    
    const dataResp = await fetch('https://data.cloudgj.cn/hcquick_data.json');
    if (!dataResp.ok) throw new Error('数据下载失败');
    const json = await dataResp.json();
    
    await openDB();
    // 1. 备份本地所有备注
    const oldSpecs = await getAll('specs');
    const oldMaterials = await getAll('materials');
    const specRemarks = {};
    oldSpecs.forEach(s => { if (s.remark) specRemarks[s.id] = s.remark; });
    const materialRemarks = {};
    oldMaterials.forEach(m => { if (m.remark) materialRemarks[m.id] = { remark: m.remark, type: m.material_type }; });

    // 2. 全量覆盖
    await clearAndPutAll('brands', json.brands || []);
    await clearAndPutAll('specs', json.specs || []);
    await clearAndPutAll('materials', json.material_config || []);

    // 3. 恢复本地备注
    await restoreRemarks(specRemarks, materialRemarks, json.material_config || []);

    // 4. 更新版本号
    await putMeta('local_version', String(json.version || remoteVersion));
    
    brandsData = json.brands || [];
    specsData = json.specs || [];
    materialsData = json.material_config || [];
    localVersion = json.version || remoteVersion;
    
    renderBrands();
    renderSpecs();
    titleEl.textContent = 'HCQuick';
    selectedBrandId = null;
    selectedSpecId = null;
    
    console.log('同步完成，版本:', localVersion);
    updateBadge();
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
    
    brandGrid.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedBrandId = parseInt(btn.dataset.brandId);
            renderBrands();
            renderSpecs();
            const brand = brandsData.find(b => b.id === selectedBrandId);
            if (brand) {
                titleEl.textContent = `${currentLine}线 - ${brand.name}`;
            }
        });
        
        bindLongPress(btn, () => {
            const brand = brandsData.find(b => b.id === parseInt(btn.dataset.brandId));
            showBrandContextMenu(brand, btn);
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
    
    // 只保留长按事件（仅此一处，无需重复）
    specGrid.querySelectorAll('.grid-btn').forEach(btn => {
        bindLongPress(btn, () => {
            const spec = specsData.find(s => s.id === parseInt(btn.dataset.specId));
            showSpecContextMenu(spec, btn);
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
    const syncHTML = `
        <div class="menu-item" onclick="handleSync()">
            🔄 同步
            <span id="sync-badge" style="display:none;">1</span>
        </div>`;
    const logHTML = `<div class="menu-item" onclick="showLogDialog()">📋 日志</div>`;
    const settingsHTML = `<div class="menu-item" onclick="showSettingsDialog()">⚙️ 设置</div>`;
    if (isInCalcPage) {
    menu.innerHTML = `
        <div class="menu-item" onclick="addBottleMaterial()">+ 增加瓶子类</div>
        <div class="menu-item" onclick="addPumpCapMaterial()">+ 增加泵盖类</div>
        <div class="menu-item" onclick="addLabelMaterial()">+ 增加标签类</div>
        <div class="menu-item" onclick="addPromoTagMaterial()">+ 增加促销标签类</div>
        <div class="divider"></div>
        ${syncHTML}
        <div class="divider"></div>
        ${logHTML}
        ${settingsHTML}
    `;
}


menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!menuVisible) {
        renderMenu();
        updateBadge();
        const menu = document.getElementById('dropdown-menu');
        const btnRect = e.target.getBoundingClientRect();
        menu.style.top = btnRect.bottom + 'px';
        menu.style.right = (window.innerWidth - btnRect.right) + 'px';
        menu.style.left = 'auto';
        menu.style.display = 'block';
        menuVisible = true;
    } else {
        document.getElementById('dropdown-menu').style.display = 'none';
        menuVisible = false;
    }
});

document.addEventListener('click', () => {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
});

// ==================== 同步处理 ====================
async function handleSync() {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
    
    // 1. 检查是否有本地修改日志
    const logs = await getAllLogs();
    if (logs.length > 0) {
        checkAndSync(); // 有日志则弹窗确认
        return;
    }
    
    // 2. 无本地修改，直接进行数据更新
    const oldVersion = localVersion;
    await loadData();
    if (localVersion > oldVersion) {
        location.reload(); // 有新版本，刷新页面
    } else {
        alert('数据已是最新版本');
    }
}

async function checkAndSync() {
    try {
        const logs = await getAllLogs();
        if (logs.length > 0) {
            showSyncConfirmDialog(logs);
        } else {
            // 正常情况下不会走到这里（handleSync已判断），但保留兜底
            await loadData();
            location.reload();
        }
    } catch (e) {
        console.error('检查日志失败:', e);
        await loadData();
        location.reload();
    }
}

// ==================== 长按工具 ====================
function bindLongPress(element, callback) {
    let timer;
    element.addEventListener('touchstart', () => {
        timer = setTimeout(() => {
            callback();
            clearTimeout(timer);
        }, 500);
    });
    element.addEventListener('touchend', () => clearTimeout(timer));
    element.addEventListener('touchmove', () => clearTimeout(timer));
}

// ==================== 品牌上下文菜单 ====================
function showBrandContextMenu(brand, element) {
    document.querySelector('.context-menu')?.remove();
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.innerHTML = `
        <div class="context-item" onclick="editBrand(${brand.id})">编辑</div>
        <div class="divider"></div>
        <div class="context-item" style="color:#E53935;" onclick="deleteBrand(${brand.id})">删除</div>
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
        
        brandsData = await getAll('brands');
        renderBrands();
        if (selectedBrandId === id) renderSpecs();
        updateBadge();
    }
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
    updateBadge();
    document.querySelector('.context-menu')?.remove();
}

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
        updateBadge();
    }
}

// ==================== 设置对话框 ====================
async function showSettingsDialog() {
    menuVisible = false;
    document.getElementById('dropdown-menu').style.display = 'none';
    document.getElementById('settings-data-version').textContent = localVersion || '-';
    document.getElementById('settings-apk-version').textContent = '1.0.3';

    // 默认选中“云盘版”
    const currentMode = await getMeta('sync_mode') || 'netdisk';
    const radio = document.querySelector(`input[name="syncMode"][value="${currentMode}"]`);
    if (radio) radio.checked = true;

    // 预填默认服务器地址
    const DEFAULT_BASE = 'https://data.cloudgj.cn/';
    const DEFAULT_DATA_FILE = 'hcquick_data.json';
    const DEFAULT_VERSION_FILE = 'version.txt';
    const baseUrl = await getMeta('custom_base_url') || DEFAULT_BASE;
    const dataFile = await getMeta('custom_data_file') || DEFAULT_DATA_FILE;
    const versionFile = await getMeta('custom_version_file') || DEFAULT_VERSION_FILE;
    
    document.getElementById('settings-base-url').value = baseUrl;
    document.getElementById('settings-data-file').value = dataFile;
    document.getElementById('settings-version-file').value = versionFile;
    updateUrlPreview();

    document.getElementById('settings-overlay').style.display = 'flex';
}

// 切换同步模式
async function setSyncMode(mode) {
    await putMeta('sync_mode', mode);
}

// 更新 URL 预览
function updateUrlPreview() {
    const base = document.getElementById('settings-base-url').value || '';
    const dataFile = document.getElementById('settings-data-file').value || '';
    document.getElementById('settings-url-preview').textContent = base + dataFile;
}

// 输入框自动保存
document.getElementById('settings-base-url').addEventListener('change', async function() {
    await putMeta('custom_base_url', this.value);
    updateUrlPreview();
});
document.getElementById('settings-data-file').addEventListener('change', async function() {
    await putMeta('custom_data_file', this.value);
    updateUrlPreview();
});
document.getElementById('settings-version-file').addEventListener('change', async function() {
    await putMeta('custom_version_file', this.value);
    updateUrlPreview();
});

function closeSettingsDialog() {
    document.getElementById('settings-overlay').style.display = 'none';
}

function saveAndRestart() {
    location.reload();
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

// ==================== 规格上下文菜单 ====================
function showSpecContextMenu(spec, element) {
    document.querySelector('.context-menu')?.remove();
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
    const brandName = brandsData.find(b => b.id === spec.brand_id)?.name || '';
    
    // 第一步：编辑规格数字（限定4位）
    const newSort = prompt('编辑规格数字（1-4位）：', spec.sort_number);
    if (!newSort || isNaN(parseInt(newSort))) {
        document.querySelector('.context-menu')?.remove();
        return;
    }
    const sortNum = parseInt(newSort);
    if (sortNum < 1 || sortNum > 9999) {
        alert('规格数字需为1-4位正整数');
        document.querySelector('.context-menu')?.remove();
        return;
    }
    
    // 第二步：编辑备注
    const newRemark = prompt('编辑规格备注（可为空）：', spec.remark || '');
    if (newRemark === null) {
        document.querySelector('.context-menu')?.remove();
        return;
    }
    
    await openDB();
    const updated = {
        ...spec,
        sort_number: sortNum,
        name: `${brandName} ${sortNum}`,
        remark: newRemark.trim(),
        updated_at: Math.floor(Date.now() / 1000)
    };
    
    const tx = db.transaction('specs', 'readwrite');
    const store = tx.objectStore('specs');
    await new Promise((resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = resolve;
        request.onerror = reject;
    });
    
    // 日志：只记录排序变更，备注绝对不出现在日志中
    const logData = {
        type: 'UPDATE',
        table: 'specs',
        path: `${currentLine} 线 > ${brandName} > ${spec.name}`,
        changes: { '排序': { old: spec.sort_number, new: sortNum } }
    };
    await addLog({
        operation_type: 'UPDATE',
        table_name: 'specs',
        data_json: JSON.stringify(logData),
        created_at: Math.floor(Date.now() / 1000)
    });
    
    specsData = await getAll('specs');
    renderSpecs();
    updateBadge();
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
    updateBadge();
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
        updateBadge();
    }
}

// ==================== 同步确认弹窗 ====================
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

document.getElementById('sync-confirm-ok').addEventListener('click', async () => {
    document.getElementById('sync-confirm-overlay').style.display = 'none';
    await forceSyncAndReload(); // 关键修改
});
document.getElementById('sync-confirm-cancel').addEventListener('click', () => {
    document.getElementById('sync-confirm-overlay').style.display = 'none';
});


async function forceSyncAndReload() {
    try {
        // 直接下载完整 JSON，跳过版本检查
        const dataResp = await fetch('https://data.cloudgj.cn/hcquick_data.json');
        if (!dataResp.ok) throw new Error('数据下载失败');
        const json = await dataResp.json();
        
        await openDB();
        // 1. 备份本地所有备注
        const oldSpecs = await getAll('specs');
        const oldMaterials = await getAll('materials');
        const specRemarks = {};
        oldSpecs.forEach(s => { if (s.remark) specRemarks[s.id] = s.remark; });
        const materialRemarks = {};
        oldMaterials.forEach(m => { if (m.remark) materialRemarks[m.id] = { remark: m.remark, type: m.material_type }; });

        // 2. 全量覆盖 IndexedDB
        await clearAndPutAll('brands', json.brands || []);
        await clearAndPutAll('specs', json.specs || []);
        await clearAndPutAll('materials', json.material_config || []);

        // 3. 恢复本地备注
        await restoreRemarks(specRemarks, materialRemarks, json.material_config || []);

        
                       // 4. 更新版本号
        const verResp = await fetch('https://data.cloudgj.cn/version.txt');
        if (verResp.ok) {
            const remoteVersion = parseInt((await verResp.text()).trim());
            await putMeta('local_version', String(json.version || remoteVersion));
        } else if (json.version) {
            await putMeta('local_version', String(json.version));
        }
        
        // ✅ 清除所有本地修改日志
        await clearAllLogs();
        
        // 重启页面，加载最新数据
        location.reload();
    } catch (e) {
        console.error('强制同步失败:', e);
        alert('强制同步失败，请检查网络后重试');
    }
}
// ==================== 启动 ====================
(async () => {
    await openDB();
    const brands = await getAll('brands');
    if (brands.length > 0) {
        // 已有缓存数据
        brandsData = brands;
        specsData = await getAll('specs');
        materialsData = await getAll('materials');
        const version = await getMeta('local_version');
        localVersion = parseInt(version) || 0;
        renderBrands();
        renderSpecs();
        updateBadge();
        if (localVersion > 0) {
            loadData().catch(() => {});
        }
    } else {
        // 首次访问：自动拉取最新数据
        await loadData();
        updateBadge();
    }
})();
// ==================== 备注恢复 ====================
async function restoreRemarks(specRemarks, materialRemarks, newMaterials) {
    // 1. 恢复规格备注：始终保留本地
    for (const [id, remark] of Object.entries(specRemarks)) {
        const tx = db.transaction('specs', 'readwrite');
        const store = tx.objectStore('specs');
        const spec = await new Promise(resolve => {
            const req = store.get(parseInt(id));
            req.onsuccess = () => resolve(req.result);
        });
        if (spec) {
            spec.remark = remark;
            store.put(spec);
        }
        await new Promise(r => { tx.oncomplete = r; });
    }

    // 2. 恢复材料备注
    for (const [id, data] of Object.entries(materialRemarks)) {
        const materialType = data.type;
        const localRemark = data.remark;

        if (materialType === 'BOTTLE' || materialType === 'PUMP_CAP') {
            // 非标签类：始终恢复本地备注
            const tx = db.transaction('materials', 'readwrite');
            const store = tx.objectStore('materials');
            const mat = await new Promise(resolve => {
                const req = store.get(parseInt(id));
                req.onsuccess = () => resolve(req.result);
            });
            if (mat) {
                mat.remark = localRemark;
                store.put(mat);
            }
            await new Promise(r => { tx.oncomplete = r; });
        } else if (materialType === 'LABEL' || materialType === 'PROMO_TAG') {
            // 标签类：检查官方是否有非空备注
            const newMat = newMaterials.find(m => m.id === parseInt(id));
            if (newMat && (!newMat.remark || newMat.remark.trim() === '')) {
                // 官方无备注或为空，恢复本地备注
                const tx = db.transaction('materials', 'readwrite');
                const store = tx.objectStore('materials');
                const mat = await new Promise(resolve => {
                    const req = store.get(parseInt(id));
                    req.onsuccess = () => resolve(req.result);
                });
                if (mat) {
                    mat.remark = localRemark;
                    store.put(mat);
                }
                await new Promise(r => { tx.oncomplete = r; });
            }
            // 官方有非空备注：不恢复，保持官方备注
        }
    }
}
