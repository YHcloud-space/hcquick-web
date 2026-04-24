// ==================== 全局状态 ====================
let currentLine = 'C';
let selectedBrandId = null;
let selectedSpecId = null;

// 原始数据缓存
let brandsData = [];
let specsData = [];
let materialsData = [];
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
    await clearAndPutAll('brands', json.brands || []);
    await clearAndPutAll('specs', json.specs || []);
    await clearAndPutAll('materials', json.material_config || []);
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
    
    specGrid.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedSpecId = parseInt(btn.dataset.specId);
            enterCalcPage();
        });
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
    if (isInCalcPage) {
        menu.innerHTML = `
            <div class="menu-item" onclick="handleSync()">🔄 同步</div>
            <div class="divider"></div>
            <div class="menu-item" onclick="showLogDialog()">📋 日志</div>
            <div class="menu-item" onclick="showSettingsDialog()">⚙️ 设置</div>
        `;
    } else {
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
        await loadData();
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
        if (selectedBrandId === id) {
            renderSpecs();
        }
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

    // 读取自定义 URL
    const baseUrl = await getMeta('custom_base_url') || '';
    const dataFile = await getMeta('custom_data_file') || '';
    const versionFile = await getMeta('custom_version_file') || '';
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

// 输入框内容变更时自动保存到 Metadata
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

document.getElementById('sync-confirm-cancel').addEventListener('click', () => {
    document.getElementById('sync-confirm-overlay').style.display = 'none';
});

document.getElementById('sync-confirm-ok').addEventListener('click', async () => {
    document.getElementById('sync-confirm-overlay').style.display = 'none';
    await loadData();
});
