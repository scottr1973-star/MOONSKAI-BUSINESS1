(function(){
  "use strict";

  const DB_NAME = "moonskai-business-organizer";
const DB_VERSION = 2;
  let dbPromise = null;

  function createStore(db, name, keyPath, indexes) {
    if (db.objectStoreNames.contains(name)) return;
    const store = db.createObjectStore(name, { keyPath });
    indexes.forEach(function(pair){
      store.createIndex(pair[0], pair[1], { unique:false });
    });
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve,reject){
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(){
        const db = req.result;
        createStore(db,"items","id",[["name","name"],["status","status"],["category","category"],["purchaseDate","purchaseDate"],["saleDate","saleDate"],["updatedAt","updatedAt"]]);
        createStore(db,"itemPhotos","id",[["itemId","itemId"],["createdAt","createdAt"]]);
        createStore(db,"itemLogs","id",[["itemId","itemId"],["createdAt","createdAt"]]);
        createStore(db,"events","id",[["startDate","startDate"],["type","type"]]);
        createStore(db,"auctions","id",[["date","date"],["status","status"]]);
        createStore(db,"auctionLots","id",[["auctionId","auctionId"],["inventoryItemId","inventoryItemId"]]);
        createStore(db,"expenses","id",[["date","date"],["category","category"],["itemId","itemId"],["eventId","eventId"],["auctionId","auctionId"]]);
        createStore(db,"mileage","id",[["date","date"],["eventId","eventId"],["auctionId","auctionId"]]);
        createStore(db,"sales","id",[["itemId","itemId"],["eventId","eventId"],["date","date"]]);
        createStore(db,"transactions","id",[["date","date"],["status","status"],["paymentMethod","paymentMethod"],["source","source"],["externalTransactionId","externalTransactionId"],["eventId","eventId"]]);
        createStore(db,"attachments","id",[["ownerType","ownerType"],["ownerId","ownerId"]]);
        createStore(db,"settings","key",[]);
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
    return dbPromise;
  }

  function tx(storeName, mode, operation) {
    return openDB().then(function(db){
      return new Promise(function(resolve,reject){
        const transaction = db.transaction(storeName,mode);
        const req = operation(transaction.objectStore(storeName));
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ reject(req.error); };
      });
    });
  }

  function getAll(store){ return tx(store,"readonly",function(s){ return s.getAll(); }); }
  function getOne(store,key){ return tx(store,"readonly",function(s){ return s.get(key); }); }
  function put(store,val){ return tx(store,"readwrite",function(s){ return s.put(val); }); }
  function remove(store,key){ return tx(store,"readwrite",function(s){ return s.delete(key); }); }
  function clearStore(store){ return tx(store,"readwrite",function(s){ return s.clear(); }); }

  function getByIndex(store,index,value){
    return openDB().then(function(db){
      return new Promise(function(resolve,reject){
        const tr = db.transaction(store,"readonly");
        const req = tr.objectStore(store).index(index).getAll(value);
        req.onsuccess = function(){ resolve(req.result || []); };
        req.onerror = function(){ reject(req.error); };
      });
    });
  }

  function uid(prefix){
    prefix = prefix || "id";
    if (crypto.randomUUID) return prefix + "_" + crypto.randomUUID();
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2);
  }

  function blobToDataURL(blob){
    return new Promise(function(resolve,reject){
      const r = new FileReader();
      r.onload = function(){ resolve(r.result); };
      r.onerror = function(){ reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(url,type){
    const parts = url.split(",");
    const binary = atob(parts[1]);
    const bytes = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    return new Blob([bytes],{type:type || "application/octet-stream"});
  }

  async function exportDatabase(){
    const db = await openDB();
    const stores = Array.from(db.objectStoreNames);
    const result = {app:"Moonskai Business Organizer",schemaVersion:DB_VERSION,exportedAt:new Date().toISOString(),stores:{}};
    for(const storeName of stores){
      const rows = await getAll(storeName);
      result.stores[storeName] = [];
      for(const rec of rows){
        const copy = Object.assign({},rec);
        for(const key of Object.keys(copy)){
          if(copy[key] instanceof Blob){
            copy[key] = {__blob:true,type:copy[key].type,data:await blobToDataURL(copy[key])};
          }
        }
        result.stores[storeName].push(copy);
      }
    }
    return result;
  }

  async function importDatabase(payload,replace){
    if(!payload || !payload.stores) throw new Error("Invalid backup.");
    const db = await openDB();
    const known = new Set(Array.from(db.objectStoreNames));
    if(replace){
      for(const name of known) await clearStore(name);
    }
    for(const storeName of Object.keys(payload.stores)){
      if(!known.has(storeName)) continue;
      for(const raw of payload.stores[storeName]){
        const row = Object.assign({},raw);
        for(const key of Object.keys(row)){
          const v = row[key];
          if(v && v.__blob && v.data) row[key] = dataURLToBlob(v.data,v.type);
        }
        await put(storeName,row);
      }
    }
  }

  async function requestPersistentStorage(){
    if(!navigator.storage || !navigator.storage.persist) return false;
    try { return await navigator.storage.persist(); }
    catch(e){ return false; }
  }

  window.MBO_DB = {
    openDB, getAll, getOne, put, remove, clearStore, getByIndex,
    exportDatabase, importDatabase, requestPersistentStorage, uid
  };
})();
