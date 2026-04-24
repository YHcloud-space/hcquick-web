// ==================== IndexedDB 数据库模块 ====================
const DB_NAME = 'hcquick_db';
const DB_VERSION = 1;

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('brands')) {
        db.createObjectStore('brands', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('specs')) {
        db.createObjectStore('specs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('materials')) {
        db.createObjectStore('materials', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 清空并批量写入
function clearAndPutAll(storeName, items) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.clear();
    items.forEach(item => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 根据索引获取全部
function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 获取元数据值
function getMeta(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('metadata', 'readonly');
    const store = tx.objectStore('metadata');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

// 写入元数据
function putMeta(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('metadata', 'readwrite');
    const store = tx.objectStore('metadata');
    store.put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
