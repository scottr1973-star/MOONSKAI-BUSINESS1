(function(){
"use strict";

const DB = window.MBO_DB;
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const view = $("#view");
const modalRoot = $("#modalRoot");
const toastRoot = $("#toastRoot");
const fab = $("#fab");

const state = {
  route:"dashboard",
  moneyTab:"expenses",
  calendarDate:new Date(),
  deferredPrompt:null,
  inventorySearch:"",
  inventoryStatus:"all"
};

const STATUSES=["Draft / Finish Cataloging","Available","Reserved","Needs Work","Listed","Sold","Personal / Not For Sale"];
const SOURCE_TYPES=["Online Auction","In-Person Auction","Flea Market / Swap Meet","Garage / Yard Sale","Estate Sale","Facebook Marketplace","Craigslist / Classified","Private Seller","Trade","Other"];
const ONLINE_PLATFORMS=["ShopGoodwill","eBay","HiBid","LiveAuctioneers","Proxibid","Local Auction Site","Other"];
const SHIPPING_STATUSES=["Not Applicable","Watching","Bidding","Won - Awaiting Payment","Paid - Awaiting Shipment","In Transit","Delivered","Pickup Required","Completed","Lost / Did Not Win"];
const EXPENSE_CATEGORIES=["Inventory Purchase","Auction Premium","Repairs","Parts","Strings / Supplies","Booth Fee","Admission","Fuel","Parking","Tolls","Hotel","Meals","Shipping","Packaging","Advertising","Other"];
const EVENT_TYPES={Festival:"#45b7ff",Fair:"#53e2d4","Flea Market":"#43d69f",Auction:"#f7c75d","Estate Sale":"#b18cff",Pickup:"#43d69f",Delivery:"#ff718a",Appointment:"#9cafc6",Other:"#6d7f96"};

boot();

async function boot(){
  try{
    await DB.openDB();
    wireShell();
    requestPersistence();
    registerPWA();
    await render();
  }catch(err){
    console.error(err);
    view.innerHTML = `<section class="panel"><h3>Could not open the local database</h3><p>${esc(err && err.message ? err.message : String(err))}</p></section>`;
  }
}

function wireShell(){
  $$(".nav-item").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.route)));

  fab.addEventListener("click",()=>openQuickActionSheet());

  const globalCamera=$("#globalCameraInput");
  const globalGallery=$("#globalGalleryInput");

  globalCamera.addEventListener("change",async e=>{
    const file=e.target.files&&e.target.files[0];
    e.target.value="";
    if(file) await quickCaptureFromFile(file);
  });

  globalGallery.addEventListener("change",async e=>{
    const files=Array.from(e.target.files||[]);
    e.target.value="";
    if(files.length) await quickCaptureFromFiles(files);
  });

  window.addEventListener("beforeinstallprompt",e=>{
    e.preventDefault();
    state.deferredPrompt=e;
    $("#installBtn").hidden=false;
  });

  $("#installBtn").addEventListener("click",async()=>{
    if(!state.deferredPrompt)return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt=null;
    $("#installBtn").hidden=true;
  });
}

async function requestPersistence(){
  try{ await DB.requestPersistentStorage(); }catch(e){}
}

function registerPWA(){
  if(!("serviceWorker" in navigator))return;
  if(location.protocol!=="http:" && location.protocol!=="https:")return;
  navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("Service worker registration failed",err));
}

async function navigate(route){
  state.route=route;
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.route===route));
  $("#headerSub").textContent = ({
    dashboard:"Your business at a glance",
    inventory:"Everything you own and sell",
    calendar:"Fairs, festivals, pickups and events",
    money:"Sales, expenses and mileage",
    more:"Auctions, backups and tools"
  })[route] || "Business Organizer";

  fab.setAttribute("aria-label", route==="calendar"?"Add event":route==="money"?"Add expense":route==="more"?"Add auction":"Add item");
  await render();
  view.focus();
}

async function render(){
  if(state.route==="dashboard")return renderDashboard();
  if(state.route==="inventory")return renderInventory();
  if(state.route==="calendar")return renderCalendar();
  if(state.route==="money")return renderMoney();
  return renderMore();
}

async function renderDashboard(){
  const [items,events,expenses,mileage,sales,auctions,photos]=await Promise.all([
    DB.getAll("items"),DB.getAll("events"),DB.getAll("expenses"),DB.getAll("mileage"),
    DB.getAll("sales"),DB.getAll("auctions"),DB.getAll("itemPhotos")
  ]);

  const photoItems=new Set(photos.map(p=>p.itemId));
  const unsold=items.filter(i=>i.status!=="Sold");
  const invested=sum(unsold.map(i=>itemCost(i)));
  const asking=sum(unsold.map(i=>num(i.askingPrice)));
  const revenue=sum(sales.map(s=>num(s.soldPrice)));
  const soldCost=sum(sales.map(s=>num(s.costBasis)));
  const expensesTotal=sum(expenses.map(e=>num(e.amount)));
  const profit=revenue-soldCost-expensesTotal;
  const miles=sum(mileage.map(m=>num(m.miles)));

  const needsFinish=items.filter(i=>i.status==="Draft / Finish Cataloging" || !i.name || !i.category).length;
  const needsWork=items.filter(i=>i.status==="Needs Work" || String(i.workNeeded||"").trim()).filter(i=>i.status!=="Sold").length;
  const needsPricing=unsold.filter(i=>num(i.askingPrice)<=0).length;
  const needsPhotos=unsold.filter(i=>!photoItems.has(i.id)).length;

  const upcoming=events.filter(e=>new Date(e.startDate)>=startOfToday()).sort((a,b)=>new Date(a.startDate)-new Date(b.startDate)).slice(0,5);
  const upcomingAuctions=auctions.filter(a=>{
    const v=a.endDateTime||a.date;
    if(!v)return false;
    return new Date(v.length>10?v:v+"T12:00:00")>=startOfToday();
  }).sort((a,b)=>String(a.endDateTime||a.date).localeCompare(String(b.endDateTime||b.date))).slice(0,4);

  view.innerHTML=`
    <section class="capture-hero">
      <div class="capture-copy">
        <div class="hero-label">PAPER REPLACEMENT FOR A MOBILE BUSINESS</div>
        <h2>See it. Photograph it. Catalog it.</h2>
        <p>Start an inventory record the moment you find something worth buying. Add the source, real landed cost, condition, work needed and notes before the details disappear.</p>
      </div>
      <div class="capture-actions">
        <button class="capture-primary" id="homeCamera">
          <span class="capture-big-icon">📷</span>
          <span><strong>Capture Item</strong><small>Camera → catalog immediately</small></span>
        </button>
        <button class="capture-secondary" id="homeGallery">
          <span>🖼</span><strong>Use Existing Photos</strong>
        </button>
        <button class="capture-secondary" id="homeManual">
          <span>＋</span><strong>Add Manually</strong>
        </button>
      </div>
    </section>

    <div class="section-head"><div><h2>Needs attention</h2><p>The app remembers what still needs to be finished.</p></div></div>
    <section class="attention-grid">
      ${attentionCard("Finish Cataloging",needsFinish,"Incomplete item records","📋")}
      ${attentionCard("Needs Work",needsWork,"Cleaning, repair or setup","🛠")}
      ${attentionCard("Needs Pricing",needsPricing,"No asking price yet","🏷")}
      ${attentionCard("Needs Photos",needsPhotos,"No item photo stored","📷")}
    </section>

    <div class="section-head"><div><h2>Business snapshot</h2><p>Live totals from records stored on this device.</p></div></div>
    <section class="stats">
      ${stat("In Stock",unsold.length,"items not marked sold")}
      ${stat("Invested",money(invested),"landed cost in unsold inventory")}
      ${stat("Asking Value",money(asking),"current asking-price total")}
      ${stat("Estimated Net",money(profit),"sales minus sold cost and expenses",profit>=0?"kpi-positive":"kpi-negative")}
    </section>

    <div class="section-head"><div><h2>Quick access</h2></div></div>
    <section class="quick-grid">
      ${quick("▦","Inventory","inventory")}
      ${quick("▣","Calendar","calendar")}
      ${quick("◆","Auctions","more")}
      ${quick("$","Money","money")}
    </section>

    <div class="section-head"><div><h2>Coming up</h2><p>Events and sourcing opportunities.</p></div></div>
    <section class="grid-2">
      <div class="panel"><h3>Upcoming events</h3><div class="list">${upcoming.length?upcoming.map(eventListItem).join(""):empty("No upcoming events yet.")}</div></div>
      <div class="panel"><h3>Online / upcoming auctions</h3><div class="list">${upcomingAuctions.length?upcomingAuctions.map(auctionListItem).join(""):empty("No auctions being tracked yet.")}</div></div>
    </section>
  `;

  $("#homeCamera").onclick=()=>startCameraCapture();
  $("#homeGallery").onclick=()=>$("#globalGalleryInput").click();
  $("#homeManual").onclick=()=>openItemModal();
  $$("[data-jump]").forEach(b=>b.onclick=()=>navigate(b.dataset.jump));
}

async function renderInventory(){
  const items=(await DB.getAll("items")).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  const photos=await DB.getAll("itemPhotos");
  const primary=new Map();
  photos.forEach(p=>{if(!primary.has(p.itemId))primary.set(p.itemId,p);});

  const filtered=items.filter(i=>{
    const hay=`${i.name||""} ${i.brand||""} ${i.model||""} ${i.serialNumber||""} ${i.category||""} ${i.notes||""}`.toLowerCase();
    return hay.includes(state.inventorySearch.toLowerCase()) && (state.inventoryStatus==="all" || i.status===state.inventoryStatus);
  });

  view.innerHTML=`
    <div class="section-head">
      <div><h2>Inventory</h2><p>${items.length} total item${items.length===1?"":"s"} stored locally.</p></div>
      <div class="inventory-head-actions">
        <button class="btn camera-btn small" id="inventoryCamera">📷 Capture</button>
        <button class="btn secondary small" id="addItemTop">＋ Manual</button>
      </div>
    </div>
    <div class="toolbar">
      <input class="input search" id="inventorySearch" placeholder="Search inventory…" value="${esc(state.inventorySearch)}">
      <select class="select" id="inventoryStatus" style="max-width:220px">
        <option value="all">All statuses</option>
        ${STATUSES.map(s=>`<option ${state.inventoryStatus===s?"selected":""}>${esc(s)}</option>`).join("")}
      </select>
    </div>
    <section class="inventory-grid">
      ${filtered.length?filtered.map(i=>itemCard(i,primary.get(i.id))).join(""):empty("No matching inventory items. Tap + to add your first item.")}
    </section>
  `;

  $("#inventoryCamera").onclick=()=>startCameraCapture();
  $("#addItemTop").onclick=()=>openItemModal();
  $("#inventorySearch").oninput=e=>{state.inventorySearch=e.target.value;renderInventory();};
  $("#inventoryStatus").onchange=e=>{state.inventoryStatus=e.target.value;renderInventory();};
  $$(".item-card[data-id]").forEach(card=>card.onclick=()=>openItemDetail(card.dataset.id));
  hydrateBlobImages();
}

async function openItemModal(item,seed){
  const editing=!!item, now=new Date().toISOString();
  const [events,auctions]=await Promise.all([DB.getAll("events"),DB.getAll("auctions")]);

  const base={
    id:DB.uid("item"),name:"",category:"",brand:"",model:"",serialNumber:"",year:"",condition:"",
    status:"Available",color:"#45b7ff",storageLocation:"",purchaseDate:today(),purchaseSource:"",
    sourceType:"",sourcePlatform:"",sourceSeller:"",sourceLocation:"",listingTitle:"",listingUrl:"",
    lotNumber:"",auctionEndDateTime:"",auctionId:"",shippingStatus:"Not Applicable",
    purchasePrice:"",buyerPremium:"",salesTax:"",shippingCost:"",handlingCost:"",otherAcquisitionCosts:"",
    acquisitionCosts:"",totalLandedCost:"",askingPrice:"",minimumPrice:"",soldPrice:"",saleDate:"",
    soldEventId:"",buyerNotes:"",description:"",conditionNotes:"",workNeeded:"",repairNotes:"",
    estimatedRepairCost:"",notes:"",createdAt:now,updatedAt:now
  };
  const draft=Object.assign({},base,item||{},seed||{});

  openModal(`
    <div class="modal-head">
      <div><div class="eyebrow">${editing?"LIVING INVENTORY RECORD":"CATALOG ITEM"}</div><h2>${editing?"Edit Item":"Catalog This Item"}</h2></div>
      <button class="close-btn" data-close type="button">×</button>
    </div>
    <form id="itemForm">
      <div class="modal-body">
        <div class="record-section">
          <div class="record-section-title"><span>📷</span><div><strong>Photos</strong><small>Add front, back, serial, damage, repair and detail photos.</small></div></div>
          <div class="photo-actions">
            <button class="photo-action camera-action" id="takePhotoBtn" type="button"><span class="photo-action-icon">📷</span><span><strong>Take Another Photo</strong><small>Use the phone camera</small></span></button>
            <button class="photo-action" id="choosePhotoBtn" type="button"><span class="photo-action-icon">🖼</span><span><strong>Add From Gallery</strong><small>Select one or more pictures</small></span></button>
          </div>
          <input id="cameraInput" type="file" accept="image/*" capture="environment" hidden>
          <input id="galleryInput" type="file" accept="image/*" multiple hidden>
          <div class="photo-strip" id="photoPreview"></div>
        </div>

        <div class="record-section">
          <div class="record-section-title"><span>🎸</span><div><strong>What is it?</strong><small>Enough detail to recognize it months later.</small></div></div>
          <div class="form-grid">
            ${field("Item name","name",draft.name,true)}
            ${field("Category","category",draft.category)}
            ${field("Brand","brand",draft.brand)}
            ${field("Model","model",draft.model)}
            ${field("Serial number","serialNumber",draft.serialNumber)}
            ${field("Year / approximate year","year",draft.year)}
            ${selectField("Status","status",STATUSES,draft.status)}
            ${field("Physical location","storageLocation",draft.storageLocation)}
            ${textareaField("Detailed description","description",draft.description)}
            ${textareaField("Condition","conditionNotes",draft.conditionNotes)}
          </div>
        </div>

        <div class="record-section">
          <div class="record-section-title"><span>🧾</span><div><strong>Where did it come from?</strong><small>Online auction, flea market, Marketplace, private seller and more.</small></div></div>
          <div class="form-grid">
            ${selectField("Source type","sourceType",[""].concat(SOURCE_TYPES),draft.sourceType)}
            ${selectField("Online platform","sourcePlatform",[""].concat(ONLINE_PLATFORMS),draft.sourcePlatform)}
            ${field("Source / auction / sale name","purchaseSource",draft.purchaseSource)}
            ${field("Seller / auction company","sourceSeller",draft.sourceSeller)}
            ${field("Source location","sourceLocation",draft.sourceLocation)}
            ${field("Purchase date","purchaseDate",draft.purchaseDate,false,"date")}
            ${field("Listing / lot title","listingTitle",draft.listingTitle)}
            ${field("Lot / item number","lotNumber",draft.lotNumber)}
            ${field("Listing URL","listingUrl",draft.listingUrl)}
            ${field("Auction end date/time","auctionEndDateTime",draft.auctionEndDateTime,false,"datetime-local")}
            ${relationField("Tracked auction","auctionId",auctions.map(x=>[x.id,x.name]),draft.auctionId)}
            ${selectField("Shipping / acquisition status","shippingStatus",SHIPPING_STATUSES,draft.shippingStatus)}
          </div>
        </div>

        <div class="record-section">
          <div class="record-section-title"><span>💵</span><div><strong>What did it really cost?</strong><small>Track the full landed cost, not only the winning bid.</small></div></div>
          <div class="form-grid">
            ${field("Purchase / winning bid","purchasePrice",draft.purchasePrice,false,"number","0.01")}
            ${field("Buyer premium","buyerPremium",draft.buyerPremium,false,"number","0.01")}
            ${field("Sales tax","salesTax",draft.salesTax,false,"number","0.01")}
            ${field("Shipping","shippingCost",draft.shippingCost,false,"number","0.01")}
            ${field("Handling","handlingCost",draft.handlingCost,false,"number","0.01")}
            ${field("Other acquisition cost","otherAcquisitionCosts",draft.otherAcquisitionCosts,false,"number","0.01")}
            <div class="field full landed-cost-box"><label>Total landed cost</label><output id="landedCostOutput">${money(itemCost(draft))}</output></div>
          </div>
        </div>

        <div class="record-section">
          <div class="record-section-title"><span>🛠</span><div><strong>What needs to happen?</strong><small>Stop relying on memory or loose paper notes.</small></div></div>
          <div class="form-grid">
            ${textareaField("Work needed / next actions","workNeeded",draft.workNeeded)}
            ${field("Estimated repair / parts cost","estimatedRepairCost",draft.estimatedRepairCost,false,"number","0.01")}
            ${textareaField("Repair / restoration log","repairNotes",draft.repairNotes)}
            ${textareaField("Private notes","notes",draft.notes)}
          </div>
        </div>

        <div class="record-section">
          <div class="record-section-title"><span>🏷</span><div><strong>Pricing & sale</strong><small>Update this same record when it sells.</small></div></div>
          <div class="form-grid">
            ${field("Asking price","askingPrice",draft.askingPrice,false,"number","0.01")}
            ${field("Minimum acceptable price","minimumPrice",draft.minimumPrice,false,"number","0.01")}
            ${field("Sold price","soldPrice",draft.soldPrice,false,"number","0.01")}
            ${field("Sale date","saleDate",draft.saleDate,false,"date")}
            ${relationField("Sold at event","soldEventId",events.map(x=>[x.id,x.title]),draft.soldEventId)}
            ${textareaField("Buyer / sale notes","buyerNotes",draft.buyerNotes)}
            <div class="field"><label>Color tag</label><input class="input" style="padding:5px" type="color" name="color" value="${safeColor(draft.color)}"></div>
          </div>
        </div>
      </div>

      <div class="modal-actions sticky-actions">
        <button class="btn ghost" type="button" data-close>Cancel</button>
        ${!editing?`<button class="btn secondary" type="button" id="saveDraftBtn">Save Draft</button>`:""}
        <button class="btn" type="submit">${editing?"Save Changes":"Save Catalog Record"}</button>
      </div>
    </form>
  `);

  const staged=editing?await DB.getByIndex("itemPhotos","itemId",draft.id):[];
  if(seed&&Array.isArray(seed.__photos)){
    for(const blob of seed.__photos){
      staged.push({id:DB.uid("photo"),itemId:draft.id,blob:blob,createdAt:new Date().toISOString()});
    }
  }
  renderPhotoPreview(staged);

  $("#takePhotoBtn").onclick=async()=>{
    closeModal();
    await startCameraCapture(async blobs=>{
      await openItemModal(editing?draft:null,Object.assign({},draft,{__photos:staged.map(p=>p.blob).filter(Boolean).concat(blobs)}));
    });
  };
  $("#choosePhotoBtn").onclick=()=>$("#galleryInput").click();

  $("#cameraInput").onchange=async e=>{
    for(const file of Array.from(e.target.files||[])){
      staged.push({id:DB.uid("photo"),itemId:draft.id,blob:await compressImage(file),createdAt:new Date().toISOString()});
    }
    e.target.value="";renderPhotoPreview(staged);
  };
  $("#galleryInput").onchange=async e=>{
    for(const file of Array.from(e.target.files||[])){
      staged.push({id:DB.uid("photo"),itemId:draft.id,blob:await compressImage(file),createdAt:new Date().toISOString()});
    }
    e.target.value="";renderPhotoPreview(staged);
  };

  const form=$("#itemForm");
  const recalc=()=>{
    const data=Object.fromEntries(new FormData(form).entries());
    $("#landedCostOutput").textContent=money(itemCost(data));
  };
  ["purchasePrice","buyerPremium","salesTax","shippingCost","handlingCost","otherAcquisitionCosts"].forEach(n=>{
    if(form.elements[n])form.elements[n].addEventListener("input",recalc);
  });

  const saveRecord=async(forceDraft)=>{
    const data=Object.fromEntries(new FormData(form).entries());
    if(!forceDraft && !String(data.name||"").trim()){
      alert("Give the item a name before saving the full catalog record.");
      return;
    }
    if(forceDraft && !String(data.name||"").trim()) data.name="Unfinished Item";
    if(forceDraft) data.status="Draft / Finish Cataloging";

    data.acquisitionCosts=num(data.buyerPremium)+num(data.salesTax)+num(data.shippingCost)+num(data.handlingCost)+num(data.otherAcquisitionCosts);
    data.totalLandedCost=num(data.purchasePrice)+data.acquisitionCosts;

    const saved=Object.assign({},draft,data,{
      createdAt:draft.createdAt||now,
      updatedAt:new Date().toISOString()
    });
    delete saved.__photos;

    await DB.put("items",saved);
    const existing=await DB.getByIndex("itemPhotos","itemId",draft.id);
    const keep=new Set(staged.map(p=>p.id));
    for(const photo of existing)if(!keep.has(photo.id))await DB.remove("itemPhotos",photo.id);
    for(const photo of staged)await DB.put("itemPhotos",photo);

    if(saved.status==="Sold" && num(saved.soldPrice)>0){
      const sales=await DB.getByIndex("sales","itemId",saved.id);
      const sale=sales[0]||{id:DB.uid("sale"),itemId:saved.id};
      Object.assign(sale,{
        date:saved.saleDate||today(),
        soldPrice:num(saved.soldPrice),
        costBasis:itemCost(saved),
        eventId:saved.soldEventId||"",
        notes:saved.buyerNotes||""
      });
      await DB.put("sales",sale);
    }

    await DB.put("itemLogs",{
      id:DB.uid("log"),itemId:saved.id,
      text:editing?"Inventory record updated.":forceDraft?"Quick capture saved as a draft.":"Item cataloged.",
      createdAt:new Date().toISOString()
    });

    closeModal();
    toast(forceDraft?"Draft saved — finish cataloging anytime.":editing?"Item updated.":"Item cataloged.");
    state.route="inventory";
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.route==="inventory"));
    await renderInventory();
  };

  form.onsubmit=async e=>{e.preventDefault();await saveRecord(false);};
  if($("#saveDraftBtn"))$("#saveDraftBtn").onclick=()=>saveRecord(true);

  function renderPhotoPreview(list){
    const wrap=$("#photoPreview");
    wrap.innerHTML=list.map((photo,index)=>`<div class="photo-thumb ${index===0?"primary-photo":""}"><img data-blob-id="${photo.id}" alt=""><span class="photo-number">${index===0?"MAIN":index+1}</span><button type="button" data-remove-photo="${photo.id}">×</button></div>`).join("");
    list.forEach(photo=>{
      const img=wrap.querySelector(`[data-blob-id="${photo.id}"]`);
      if(img&&photo.blob){const url=URL.createObjectURL(photo.blob);img.src=url;img.onload=()=>URL.revokeObjectURL(url);}
    });
    $$("[data-remove-photo]",wrap).forEach(btn=>btn.onclick=()=>{
      const i=list.findIndex(p=>p.id===btn.dataset.removePhoto);if(i>=0)list.splice(i,1);renderPhotoPreview(list);
    });
  }
}

async function openItemDetail(id){
  const item=await DB.getOne("items",id);if(!item)return;
  const [photos,logs]=await Promise.all([DB.getByIndex("itemPhotos","itemId",id),DB.getByIndex("itemLogs","itemId",id)]);
  logs.sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));

  openModal(`
    <div class="modal-head"><div><div class="badge"><span class="dot" style="background:${safeColor(item.color)}"></span>${esc(item.status)}</div><h2 style="margin-top:8px">${esc(item.name||"Item")}</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <div class="modal-body">
      <div class="photo-strip">${photos.length?photos.map(p=>`<div class="photo-thumb" style="width:150px;height:118px"><img data-blob-id="${p.id}" alt=""></div>`).join(""):empty("No photos yet.")}</div>
      <section class="stats" style="grid-template-columns:repeat(3,1fr);margin:14px 0">
        ${stat("Purchase",money(item.purchasePrice),"")}
        ${stat("Asking",money(item.askingPrice),"")}
        ${stat("Sold",item.soldPrice?money(item.soldPrice):"—","")}
      </section>
      <div class="grid-2">
        <div class="panel"><h3>Item details</h3>${kv("Category",item.category)}${kv("Brand",item.brand)}${kv("Model",item.model)}${kv("Serial",item.serialNumber)}${kv("Year",item.year)}${kv("Storage",item.storageLocation)}${kv("Source",item.purchaseSource)}</div>
        <div class="panel"><h3>Notes</h3><p>${nl2br(item.description||"No description.")}</p>${item.conditionNotes?`<p><strong>Condition</strong><br>${nl2br(item.conditionNotes)}</p>`:""}${item.workNeeded?`<p><strong>Work needed</strong><br>${nl2br(item.workNeeded)}</p>`:""}${item.repairNotes?`<p><strong>Repair / restoration</strong><br>${nl2br(item.repairNotes)}</p>`:""}${item.notes?`<p><strong>Private</strong><br>${nl2br(item.notes)}</p>`:""}</div>
      </div>
      <div class="section-head"><div><h3>Item log</h3></div><button class="btn small" id="addLogBtn">＋ Log Entry</button></div>
      <div>${logs.length?logs.map(l=>`<div class="log-entry"><small>${dateTime(l.createdAt)}</small><div>${nl2br(l.text)}</div></div>`).join(""):empty("No log entries yet.")}</div>
    </div>
    <div class="modal-actions"><button class="btn danger" id="deleteItemBtn" type="button">Delete</button><button class="btn secondary" id="editItemBtn" type="button">Edit Item</button><button class="btn" data-close type="button">Done</button></div>
  `);

  hydrateBlobImages(photos);
  $("#editItemBtn").onclick=()=>{closeModal();openItemModal(item);};
  $("#addLogBtn").onclick=async()=>{
    const text=prompt("Add a note to this item's history:");
    if(!text||!text.trim())return;
    await DB.put("itemLogs",{id:DB.uid("log"),itemId:id,text:text.trim(),createdAt:new Date().toISOString()});
    closeModal();openItemDetail(id);
  };
  $("#deleteItemBtn").onclick=async()=>{
    if(!confirm(`Delete "${item.name}" and its photos/logs?`))return;
    for(const p of await DB.getByIndex("itemPhotos","itemId",id))await DB.remove("itemPhotos",p.id);
    for(const l of await DB.getByIndex("itemLogs","itemId",id))await DB.remove("itemLogs",l.id);
    for(const s of await DB.getByIndex("sales","itemId",id))await DB.remove("sales",s.id);
    await DB.remove("items",id);closeModal();toast("Item deleted.");renderInventory();
  };
}

async function renderCalendar(){
  const events=await DB.getAll("events");
  const d=state.calendarDate,year=d.getFullYear(),month=d.getMonth();
  const first=new Date(year,month,1),start=new Date(year,month,1-first.getDay());
  const days=Array.from({length:42},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
  const upcoming=events.filter(e=>new Date(e.startDate)>=startOfToday()).sort((a,b)=>new Date(a.startDate)-new Date(b.startDate)).slice(0,8);

  view.innerHTML=`
    <div class="section-head"><div><h2>Calendar</h2><p>Keep fairs, festivals, pickups, auctions and appointments together.</p></div><button class="btn small" id="addEventTop">＋ Event</button></div>
    <section class="calendar-wrap">
      <div class="calendar">
        <div class="cal-head"><button class="btn ghost small" id="prevMonth">←</button><strong>${first.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</strong><button class="btn ghost small" id="nextMonth">→</button></div>
        <div class="cal-grid">
          ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<div class="cal-dow">${x}</div>`).join("")}
          ${days.map(day=>calendarDay(day,month,events)).join("")}
        </div>
      </div>
      <div class="panel"><h3>Upcoming</h3><div class="list">${upcoming.length?upcoming.map(eventListItem).join(""):empty("No upcoming events yet.")}</div></div>
    </section>
  `;
  $("#addEventTop").onclick=()=>openEventModal();
  $("#prevMonth").onclick=()=>{state.calendarDate=new Date(year,month-1,1);renderCalendar();};
  $("#nextMonth").onclick=()=>{state.calendarDate=new Date(year,month+1,1);renderCalendar();};
  $$("[data-event-id]").forEach(el=>el.onclick=()=>openEventModal(events.find(e=>e.id===el.dataset.eventId)));
}

function calendarDay(day,currentMonth,events){
  const key=ymd(day),dayEvents=events.filter(e=>String(e.startDate||"").slice(0,10)===key);
  let cls="cal-day";if(day.getMonth()!==currentMonth)cls+=" muted";if(key===today())cls+=" today";
  return `<div class="${cls}"><div class="cal-num">${day.getDate()}</div><div class="cal-events">${dayEvents.slice(0,5).map(e=>`<button class="cal-event" title="${esc(e.title)}" data-event-id="${e.id}" style="background:${safeColor(e.color)}"></button>`).join("")}</div></div>`;
}

async function openEventModal(event){
  const edit=!!event;
  const e=event||{id:DB.uid("event"),title:"",type:"Festival",startDate:`${today()}T09:00`,endDate:"",location:"",address:"",contact:"",website:"",boothNumber:"",boothFee:"",expectedMiles:"",color:EVENT_TYPES.Festival,notes:""};
  openModal(`
    <div class="modal-head"><h2>${edit?"Edit Event":"Add Event"}</h2><button class="close-btn" data-close type="button">×</button></div>
    <form id="eventForm"><div class="modal-body"><div class="form-grid">
      ${field("Title","title",e.title,true)}
      ${selectField("Type","type",Object.keys(EVENT_TYPES),e.type)}
      ${field("Start","startDate",e.startDate,false,"datetime-local")}
      ${field("End","endDate",e.endDate,false,"datetime-local")}
      ${field("Location","location",e.location)}
      ${field("Address","address",e.address)}
      ${field("Contact","contact",e.contact)}
      ${field("Website","website",e.website)}
      ${field("Booth number","boothNumber",e.boothNumber)}
      ${field("Booth fee","boothFee",e.boothFee,false,"number","0.01")}
      ${field("Expected miles","expectedMiles",e.expectedMiles,false,"number","0.1")}
      <div class="field"><label>Color</label><input class="input" style="padding:5px" type="color" name="color" value="${safeColor(e.color)}"></div>
      ${textareaField("Notes","notes",e.notes)}
    </div></div><div class="modal-actions">${edit?`<button class="btn danger" id="deleteEvent" type="button">Delete</button>`:""}<button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Event</button></div></form>
  `);
  $("#eventForm").onsubmit=async x=>{x.preventDefault();await DB.put("events",Object.assign({},e,Object.fromEntries(new FormData(x.currentTarget).entries())));closeModal();toast("Event saved.");renderCalendar();};
  if(edit)$("#deleteEvent").onclick=async()=>{if(confirm("Delete this event?")){await DB.remove("events",e.id);closeModal();renderCalendar();}};
}

async function renderMoney(){
  const [expenses,mileage,sales,items]=await Promise.all([DB.getAll("expenses"),DB.getAll("mileage"),DB.getAll("sales"),DB.getAll("items")]);
  const expTotal=sum(expenses.map(e=>num(e.amount))),miles=sum(mileage.map(m=>num(m.miles))),revenue=sum(sales.map(s=>num(s.soldPrice))),cost=sum(sales.map(s=>num(s.costBasis))),profit=revenue-cost-expTotal;
  view.innerHTML=`
    <div class="section-head"><div><h2>Money</h2><p>Sales, expenses and business mileage.</p></div><button class="btn small" id="addExpenseTop">＋ Expense</button></div>
    <section class="stats">${stat("Sales",money(revenue),"gross revenue")}${stat("Expenses",money(expTotal),"recorded business expenses")}${stat("Mileage",miles.toFixed(1)+" mi","business travel")}${stat("Estimated Net",money(profit),"before taxes",profit>=0?"kpi-positive":"kpi-negative")}</section>
    <div class="money-tabs">${["expenses","mileage","sales"].map(t=>`<button class="tab-btn ${state.moneyTab===t?"active":""}" data-money-tab="${t}">${cap(t)}</button>`).join("")}</div>
    <div id="moneyContent"></div>
  `;
  $("#addExpenseTop").onclick=()=>openExpenseModal();
  $$("[data-money-tab]").forEach(b=>b.onclick=()=>{state.moneyTab=b.dataset.moneyTab;renderMoney();});

  if(state.moneyTab==="expenses"){
    expenses.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    $("#moneyContent").innerHTML=`<div class="section-head"><div><h3>Expenses</h3></div><button class="btn secondary small" id="addMileageShortcut">＋ Mileage</button></div>${table(["Date","Category","Vendor","Description","Amount",""],expenses.map(e=>[prettyDate(e.date),esc(e.category),esc(e.vendor||""),esc(e.description||""),money(e.amount),`<button class="btn secondary small" data-expense-id="${e.id}">Edit</button>`]))}`;
    $("#addMileageShortcut").onclick=()=>openMileageModal();
    $$("[data-expense-id]").forEach(b=>b.onclick=()=>openExpenseModal(expenses.find(e=>e.id===b.dataset.expenseId)));
  }else if(state.moneyTab==="mileage"){
    mileage.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    $("#moneyContent").innerHTML=`<div class="section-head"><div><h3>Mileage</h3></div><button class="btn small" id="addMileage">＋ Mileage</button></div>${table(["Date","Purpose","From","To","Miles",""],mileage.map(m=>[prettyDate(m.date),esc(m.purpose||""),esc(m.from||""),esc(m.to||""),num(m.miles).toFixed(1),`<button class="btn secondary small" data-mileage-id="${m.id}">Edit</button>`]))}`;
    $("#addMileage").onclick=()=>openMileageModal();
    $$("[data-mileage-id]").forEach(b=>b.onclick=()=>openMileageModal(mileage.find(m=>m.id===b.dataset.mileageId)));
  }else{
    const itemMap=new Map(items.map(i=>[i.id,i]));
    sales.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    $("#moneyContent").innerHTML=`<div class="section-head"><div><h3>Sales</h3></div></div>${table(["Date","Item","Sold","Cost","Gross"],sales.map(s=>[prettyDate(s.date),esc(itemMap.get(s.itemId)?.name||"Unknown item"),money(s.soldPrice),money(s.costBasis),money(num(s.soldPrice)-num(s.costBasis))]))}`;
  }
}

async function openExpenseModal(exp){
  const [items,events,auctions]=await Promise.all([DB.getAll("items"),DB.getAll("events"),DB.getAll("auctions")]);
  const e=exp||{id:DB.uid("expense"),date:today(),category:"Fuel",amount:"",vendor:"",description:"",itemId:"",eventId:"",auctionId:"",paymentMethod:"",notes:""};
  openModal(`
    <div class="modal-head"><h2>${exp?"Edit Expense":"Add Expense"}</h2><button class="close-btn" data-close type="button">×</button></div>
    <form id="expenseForm"><div class="modal-body"><div class="form-grid">
      ${field("Date","date",e.date,true,"date")}${selectField("Category","category",EXPENSE_CATEGORIES,e.category)}${field("Amount","amount",e.amount,true,"number","0.01")}${field("Vendor","vendor",e.vendor)}${field("Description","description",e.description)}${field("Payment method","paymentMethod",e.paymentMethod)}
      ${relationField("Related item","itemId",items.map(x=>[x.id,x.name]),e.itemId)}${relationField("Related event","eventId",events.map(x=>[x.id,x.title]),e.eventId)}${relationField("Related auction","auctionId",auctions.map(x=>[x.id,x.name]),e.auctionId)}${textareaField("Notes","notes",e.notes)}
    </div></div><div class="modal-actions">${exp?`<button class="btn danger" id="deleteExpense" type="button">Delete</button>`:""}<button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Expense</button></div></form>
  `);
  $("#expenseForm").onsubmit=async x=>{x.preventDefault();await DB.put("expenses",Object.assign({},e,Object.fromEntries(new FormData(x.currentTarget).entries())));closeModal();toast("Expense saved.");renderMoney();};
  if(exp)$("#deleteExpense").onclick=async()=>{if(confirm("Delete this expense?")){await DB.remove("expenses",e.id);closeModal();renderMoney();}};
}

async function openMileageModal(row){
  const [events,auctions]=await Promise.all([DB.getAll("events"),DB.getAll("auctions")]);
  const m=row||{id:DB.uid("mileage"),date:today(),purpose:"",from:"",to:"",startOdometer:"",endOdometer:"",miles:"",eventId:"",auctionId:"",notes:""};
  openModal(`
    <div class="modal-head"><h2>${row?"Edit Mileage":"Add Mileage"}</h2><button class="close-btn" data-close type="button">×</button></div>
    <form id="mileageForm"><div class="modal-body"><div class="form-grid">
      ${field("Date","date",m.date,true,"date")}${field("Purpose","purpose",m.purpose,true)}${field("From","from",m.from)}${field("To","to",m.to)}${field("Start odometer","startOdometer",m.startOdometer,false,"number","0.1")}${field("End odometer","endOdometer",m.endOdometer,false,"number","0.1")}${field("Total miles","miles",m.miles,false,"number","0.1")}
      ${relationField("Related event","eventId",events.map(x=>[x.id,x.title]),m.eventId)}${relationField("Related auction","auctionId",auctions.map(x=>[x.id,x.name]),m.auctionId)}${textareaField("Notes","notes",m.notes)}
    </div></div><div class="modal-actions">${row?`<button class="btn danger" id="deleteMileage" type="button">Delete</button>`:""}<button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Mileage</button></div></form>
  `);
  const form=$("#mileageForm");
  const calc=()=>{const s=num(form.elements.startOdometer.value),e=num(form.elements.endOdometer.value);if(e>=s&&s>0&&e>0)form.elements.miles.value=(e-s).toFixed(1);};
  form.elements.startOdometer.oninput=calc;form.elements.endOdometer.oninput=calc;
  form.onsubmit=async e=>{e.preventDefault();await DB.put("mileage",Object.assign({},m,Object.fromEntries(new FormData(e.currentTarget).entries())));closeModal();toast("Mileage saved.");renderMoney();};
  if(row)$("#deleteMileage").onclick=async()=>{if(confirm("Delete this mileage record?")){await DB.remove("mileage",m.id);closeModal();renderMoney();}};
}

async function renderMore(){
  const auctions=(await DB.getAll("auctions")).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  view.innerHTML=`
    <div class="section-head"><div><h2>More</h2><p>Auctions, backups and data tools.</p></div><button class="btn small" id="addAuctionTop">＋ Auction</button></div>
    <section class="grid-2">
      <div class="panel">
        <h3>Online Auctions & Sourcing</h3>
        <div class="list">${auctions.length?auctions.slice(0,5).map(auctionListItem).join(""):empty("No auctions tracked yet.")}</div>
        <div class="hero-actions"><button class="btn secondary" id="manageAuctions">Manage Auctions</button></div>
      </div>
      <div class="panel">
        <h3>Backup & restore</h3>
        <p style="color:var(--muted);line-height:1.55">IndexedDB is local to this device/browser. Export backups regularly. Full backups include your stored photos.</p>
        <div class="hero-actions"><button class="btn" id="exportBackup">Export Backup</button><label class="btn secondary">Import Backup<input id="importBackup" type="file" accept="application/json" hidden></label></div>
      </div>
      <div class="panel">
        <h3>CSV exports</h3>
        <div class="hero-actions"><button class="btn secondary" data-csv="items">Inventory CSV</button><button class="btn secondary" data-csv="expenses">Expenses CSV</button><button class="btn secondary" data-csv="mileage">Mileage CSV</button></div>
      </div>
      <div class="panel">
        <h3>Storage</h3>
        <p style="color:var(--muted);line-height:1.55">Photos are compressed before local storage. Persistent browser storage is requested where supported.</p>
        <button class="btn ghost" id="requestStorage">Request Persistent Storage</button>
      </div>
    </section>
  `;
  $("#addAuctionTop").onclick=()=>openAuctionModal();
  $("#manageAuctions").onclick=()=>renderAuctionManager();
  $("#exportBackup").onclick=exportBackup;
  $("#importBackup").onchange=importBackupFile;
  $$("[data-csv]").forEach(b=>b.onclick=()=>exportCSV(b.dataset.csv));
  $("#requestStorage").onclick=async()=>toast((await DB.requestPersistentStorage())?"Persistent storage granted.":"Persistent storage not granted or unsupported.");
}

async function renderAuctionManager(){
  const [auctions,lots]=await Promise.all([DB.getAll("auctions"),DB.getAll("auctionLots")]);
  auctions.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  view.innerHTML=`
    <div class="section-head"><div><h2>Auctions & sourcing</h2><p>Watch opportunities before they become inventory.</p></div><button class="btn small" id="addAuction">＋ Auction</button></div>
    <div class="list">${auctions.length?auctions.map(a=>`<div class="list-card"><div><div class="badge"><span class="dot" style="background:${safeColor(a.color||"#f7c75d")}"></span>${esc(a.status||"Planned")}</div><h4>${esc(a.name)}</h4><p>${prettyDate(a.date)}${a.location?` · ${esc(a.location)}`:""} · ${lots.filter(l=>l.auctionId===a.id).length} watched lots</p></div><button class="btn secondary small" data-auction-id="${a.id}">Open</button></div>`).join(""):empty("No auctions yet.")}</div>
  `;
  $("#addAuction").onclick=()=>openAuctionModal();
  $$("[data-auction-id]").forEach(b=>b.onclick=()=>openAuctionDetail(b.dataset.auctionId));
}

async function openAuctionModal(auction){
  const a=auction||{
    id:DB.uid("auction"),name:"",auctionMode:"Online",platform:"ShopGoodwill",date:today(),startTime:"",
    endDateTime:"",location:"",company:"",website:"",previewDate:"",status:"Watching",
    shippingStatus:"Watching",color:"#f7c75d",notes:""
  };
  openModal(`
    <div class="modal-head"><div><div class="eyebrow">SOURCING</div><h2>${auction?"Edit Auction":"Track Auction"}</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <form id="auctionForm"><div class="modal-body">
      <div class="record-section"><div class="record-section-title"><span>🌐</span><div><strong>Auction</strong><small>Designed for ShopGoodwill and other online auction sources.</small></div></div>
      <div class="form-grid">
        ${field("Auction / saved search name","name",a.name,true)}
        ${selectField("Auction type","auctionMode",["Online","In Person"],a.auctionMode||"Online")}
        ${selectField("Platform","platform",ONLINE_PLATFORMS,a.platform||"ShopGoodwill")}
        ${field("Auction company / seller","company",a.company)}
        ${field("Listing / auction URL","website",a.website)}
        ${field("Location","location",a.location)}
        ${field("Auction date","date",a.date,false,"date")}
        ${field("End date/time","endDateTime",a.endDateTime,false,"datetime-local")}
        ${field("Preview / pickup date","previewDate",a.previewDate,false,"date")}
        ${selectField("Status","status",["Watching","Bidding","Won","Lost / Did Not Win","Completed","Cancelled"],a.status)}
        ${selectField("Shipping / fulfillment","shippingStatus",SHIPPING_STATUSES,a.shippingStatus||"Watching")}
        <div class="field"><label>Color</label><input class="input" style="padding:5px" type="color" name="color" value="${safeColor(a.color)}"></div>
        ${textareaField("Notes","notes",a.notes)}
      </div></div>
    </div><div class="modal-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Auction</button></div></form>
  `);
  $("#auctionForm").onsubmit=async e=>{
    e.preventDefault();
    await DB.put("auctions",Object.assign({},a,Object.fromEntries(new FormData(e.currentTarget).entries())));
    closeModal();toast("Auction saved.");renderMore();
  };
}

async function openAuctionDetail(id){
  const auction=await DB.getOne("auctions",id);if(!auction)return;
  const lots=await DB.getByIndex("auctionLots","auctionId",id);
  openModal(`
    <div class="modal-head"><div><div class="badge"><span class="dot" style="background:${safeColor(auction.color)}"></span>${esc(auction.status)}</div><h2 style="margin-top:8px">${esc(auction.name)}</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <div class="modal-body">
      <p style="color:var(--muted)">${prettyDate(auction.date)}${auction.location?` · ${esc(auction.location)}`:""}</p>
      ${auction.notes?`<div class="panel"><p>${nl2br(auction.notes)}</p></div>`:""}
      <div class="section-head"><div><h3>Watch list</h3></div><button class="btn small" id="addLot">＋ Lot</button></div>
      <div class="list">${lots.length?lots.map(l=>`<div class="list-card"><div><h4>${esc(l.name)}</h4><p>Lot ${esc(l.lotNumber||"—")} · Expected ${money(l.expectedResale)} · Max ${money(l.maxBid)}${l.winningBid?` · Won ${money(l.winningBid)}`:""}</p></div><button class="btn secondary small" data-lot-id="${l.id}">Edit</button></div>`).join(""):empty("No watched lots yet.")}</div>
    </div>
    <div class="modal-actions"><button class="btn danger" id="deleteAuction" type="button">Delete</button><button class="btn secondary" id="editAuction" type="button">Edit Auction</button><button class="btn" data-close type="button">Done</button></div>
  `);
  $("#addLot").onclick=()=>openLotModal(auction);
  $("#editAuction").onclick=()=>{closeModal();openAuctionModal(auction);};
  $("#deleteAuction").onclick=async()=>{if(confirm("Delete this auction and its watch-list lots?")){for(const l of lots)await DB.remove("auctionLots",l.id);await DB.remove("auctions",id);closeModal();renderAuctionManager();}};
  $$("[data-lot-id]").forEach(b=>b.onclick=()=>openLotModal(auction,lots.find(l=>l.id===b.dataset.lotId)));
}

async function openLotModal(auction,lot){
  const l=lot||{
    id:DB.uid("lot"),auctionId:auction.id,name:"",lotNumber:"",listingUrl:"",currentBid:"",
    expectedResale:"",maxBid:"",winningBid:"",buyerPremium:"",tax:"",shippingCost:"",handlingCost:"",
    conditionAdvertised:"",notes:"",inventoryItemId:""
  };
  openModal(`
    <div class="modal-head"><h2>${lot?"Edit Watch Lot":"Add Watch Lot"}</h2><button class="close-btn" data-close type="button">×</button></div>
    <form id="lotForm"><div class="modal-body"><div class="record-section">
      <div class="record-section-title"><span>👀</span><div><strong>Watch item</strong><small>Know the ceiling before bidding and the real cost after winning.</small></div></div>
      <div class="form-grid">
        ${field("Item / lot name","name",l.name,true)}
        ${field("Lot / item number","lotNumber",l.lotNumber)}
        ${field("Listing URL","listingUrl",l.listingUrl)}
        ${field("Current bid","currentBid",l.currentBid,false,"number","0.01")}
        ${field("Expected resale","expectedResale",l.expectedResale,false,"number","0.01")}
        ${field("Maximum bid","maxBid",l.maxBid,false,"number","0.01")}
        ${field("Winning bid","winningBid",l.winningBid,false,"number","0.01")}
        ${field("Buyer premium","buyerPremium",l.buyerPremium,false,"number","0.01")}
        ${field("Tax","tax",l.tax,false,"number","0.01")}
        ${field("Shipping","shippingCost",l.shippingCost,false,"number","0.01")}
        ${field("Handling","handlingCost",l.handlingCost,false,"number","0.01")}
        ${textareaField("Advertised condition","conditionAdvertised",l.conditionAdvertised)}
        ${textareaField("Notes","notes",l.notes)}
      </div></div></div>
      <div class="modal-actions">
        ${lot?`<button class="btn danger" id="deleteLot" type="button">Delete</button>`:""}
        ${lot&&num(l.winningBid)>0&&!l.inventoryItemId?`<button class="btn secondary" id="lotToInventory" type="button">Catalog Winning Item</button>`:""}
        <button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Lot</button>
      </div></form>
  `);
  $("#lotForm").onsubmit=async e=>{
    e.preventDefault();
    await DB.put("auctionLots",Object.assign({},l,Object.fromEntries(new FormData(e.currentTarget).entries())));
    closeModal();openAuctionDetail(auction.id);
  };
  if(lot)$("#deleteLot").onclick=async()=>{await DB.remove("auctionLots",l.id);closeModal();openAuctionDetail(auction.id);};
  if(lot&&num(l.winningBid)>0&&!l.inventoryItemId)$("#lotToInventory").onclick=async()=>{
    const itemId=DB.uid("item");
    const extra=num(l.buyerPremium)+num(l.tax)+num(l.shippingCost)+num(l.handlingCost);
    const item={
      id:itemId,name:l.name,category:"",brand:"",model:"",serialNumber:"",year:"",condition:"",
      status:"Draft / Finish Cataloging",color:auction.color||"#f7c75d",storageLocation:"",
      purchaseDate:auction.date||today(),sourceType:auction.auctionMode==="In Person"?"In-Person Auction":"Online Auction",
      sourcePlatform:auction.platform||"",purchaseSource:auction.name,sourceSeller:auction.company||"",
      sourceLocation:auction.location||"",listingTitle:l.name,listingUrl:l.listingUrl||auction.website||"",
      lotNumber:l.lotNumber||"",auctionEndDateTime:auction.endDateTime||"",auctionId:auction.id,
      shippingStatus:auction.shippingStatus||"Won - Awaiting Payment",
      purchasePrice:l.winningBid,buyerPremium:l.buyerPremium,tax:"",salesTax:l.tax,
      shippingCost:l.shippingCost,handlingCost:l.handlingCost,otherAcquisitionCosts:"",
      acquisitionCosts:extra,totalLandedCost:num(l.winningBid)+extra,
      askingPrice:l.expectedResale,minimumPrice:"",soldPrice:"",saleDate:"",soldEventId:"",
      description:"",conditionNotes:l.conditionAdvertised||"",workNeeded:"",repairNotes:"",
      estimatedRepairCost:"",notes:`Imported from tracked auction lot ${l.lotNumber||""}. ${l.notes||""}`.trim(),
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    };
    await DB.put("items",item);
    await DB.put("itemLogs",{id:DB.uid("log"),itemId:itemId,text:`Won from ${auction.name} for ${money(l.winningBid)}. Landed cost currently ${money(item.totalLandedCost)}.`,createdAt:new Date().toISOString()});
    l.inventoryItemId=itemId;await DB.put("auctionLots",l);
    toast("Winning auction item created as an inventory draft.");
    closeModal();openItemModal(item);
  };
}


function openQuickActionSheet(){
  openModal(`
    <div class="modal-head"><div><div class="eyebrow">QUICK ACTION</div><h2>What do you need to record?</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <div class="modal-body">
      <div class="action-sheet-grid">
        <button class="action-sheet-main" id="qaCamera"><span>📷</span><div><strong>Capture Item</strong><small>Take a photo and catalog it immediately</small></div></button>
        <button class="action-sheet-btn" id="qaGallery"><span>🖼</span><div><strong>Photos → Item</strong><small>Start from existing pictures</small></div></button>
        <button class="action-sheet-btn" id="qaManual"><span>＋</span><div><strong>Add Item Manually</strong><small>Create an inventory record without a photo</small></div></button>
        <button class="action-sheet-btn" id="qaExpense"><span>💵</span><div><strong>Expense</strong><small>Fuel, parts, booth fees, shipping and more</small></div></button>
        <button class="action-sheet-btn" id="qaEvent"><span>📅</span><div><strong>Event</strong><small>Fair, festival, pickup or appointment</small></div></button>
        <button class="action-sheet-btn" id="qaAuction"><span>🌐</span><div><strong>Online Auction</strong><small>Track ShopGoodwill or another auction</small></div></button>
      </div>
    </div>
  `);
  $("#qaCamera").onclick=()=>{closeModal();startCameraCapture();};
  $("#qaGallery").onclick=()=>{closeModal();$("#globalGalleryInput").click();};
  $("#qaManual").onclick=()=>{closeModal();openItemModal();};
  $("#qaExpense").onclick=()=>{closeModal();openExpenseModal();};
  $("#qaEvent").onclick=()=>{closeModal();openEventModal();};
  $("#qaAuction").onclick=()=>{closeModal();openAuctionModal();};
}

async function startCameraCapture(onCaptured){
  if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext){
    let stream=null;
    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
      openModal(`
        <div class="modal-head"><div><div class="eyebrow">CAMERA</div><h2>Capture Inventory</h2></div><button class="close-btn" id="cameraClose" type="button">×</button></div>
        <div class="camera-stage">
          <video id="liveCamera" autoplay playsinline muted></video>
          <div class="camera-help">Fill the frame with the item. You can add more photos after cataloging starts.</div>
        </div>
        <div class="camera-controls">
          <button class="btn secondary" id="cameraCancel" type="button">Cancel</button>
          <button class="shutter" id="cameraShutter" type="button" aria-label="Take photo"><span></span></button>
          <button class="btn ghost" id="cameraFallback" type="button">Phone Camera</button>
        </div>
      `);
      const video=$("#liveCamera");
      video.srcObject=stream;
      const stop=()=>{if(stream)stream.getTracks().forEach(t=>t.stop());};
      const cancel=()=>{stop();closeModal();};
      $("#cameraClose").onclick=cancel;
      $("#cameraCancel").onclick=cancel;
      $("#cameraFallback").onclick=()=>{stop();closeModal();$("#globalCameraInput").click();};
      $("#cameraShutter").onclick=async()=>{
        if(!video.videoWidth){toast("Camera is still starting.");return;}
        const canvas=document.createElement("canvas");
        const maxDim=1800;
        const scale=Math.min(1,maxDim/Math.max(video.videoWidth,video.videoHeight));
        canvas.width=Math.round(video.videoWidth*scale);
        canvas.height=Math.round(video.videoHeight*scale);
        canvas.getContext("2d").drawImage(video,0,0,canvas.width,canvas.height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.86));
        stop();closeModal();
        if(blob){
          if(onCaptured) await onCaptured([blob]);
          else await quickCaptureFromBlobs([blob]);
        }
      };
      return;
    }catch(err){
      if(stream)stream.getTracks().forEach(t=>t.stop());
    }
  }
  $("#globalCameraInput").click();
}

async function quickCaptureFromFile(file){
  await quickCaptureFromFiles([file]);
}
async function quickCaptureFromFiles(files){
  const blobs=[];
  for(const file of files)blobs.push(await compressImage(file));
  await quickCaptureFromBlobs(blobs);
}
async function quickCaptureFromBlobs(blobs){
  await openItemModal(null,{
    status:"Draft / Finish Cataloging",
    sourceType:"Online Auction",
    sourcePlatform:"ShopGoodwill",
    __photos:blobs
  });
}

async function exportBackup(){
  const data=await DB.exportDatabase();
  downloadFile(`moonskai-business-organizer-backup-${today()}.json`,JSON.stringify(data,null,2),"application/json");
  toast("Backup exported.");
}
async function importBackupFile(e){
  const file=e.target.files&&e.target.files[0];if(!file)return;
  try{
    const payload=JSON.parse(await file.text());
    const replace=confirm("Replace all current local records with this backup?\n\nOK = replace everything\nCancel = merge");
    await DB.importDatabase(payload,replace);toast("Backup imported.");navigate("dashboard");
  }catch(err){alert("Import failed: "+err.message);}
  e.target.value="";
}
async function exportCSV(store){
  const rows=await DB.getAll(store);
  if(!rows.length){toast("Nothing to export.");return;}
  const clean=rows.map(r=>{const o={};Object.keys(r).forEach(k=>{if(!(r[k] instanceof Blob))o[k]=r[k]??"";});return o;});
  const headers=Array.from(new Set(clean.flatMap(r=>Object.keys(r))));
  const csv=[headers,...clean.map(r=>headers.map(h=>r[h]))].map(row=>row.map(csvCell).join(",")).join("\n");
  downloadFile(`${store}-${today()}.csv`,csv,"text/csv");
}

async function hydrateBlobImages(records){
  const photos=records||await DB.getAll("itemPhotos");
  const map=new Map(photos.map(p=>[p.id,p]));
  $$("[data-photo-record],[data-blob-id]").forEach(img=>{
    const p=map.get(img.dataset.photoRecord||img.dataset.blobId);
    if(!p||!p.blob)return;
    const url=URL.createObjectURL(p.blob);img.src=url;img.onload=()=>URL.revokeObjectURL(url);
  });
}
async function compressImage(file,maxDim=1600,quality=.82){
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,maxDim/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);if(bitmap.close)bitmap.close();
  return await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
}

function openModal(html){
  modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal">${html}</section></div>`;
  $$("[data-close]",modalRoot).forEach(b=>b.onclick=closeModal);
  $(".modal-backdrop",modalRoot).onclick=e=>{if(e.target.classList.contains("modal-backdrop"))closeModal();};
}
function closeModal(){modalRoot.innerHTML="";}
function toast(msg){const t=document.createElement("div");t.className="toast";t.textContent=msg;toastRoot.appendChild(t);setTimeout(()=>t.remove(),3000);}
function field(label,name,value="",required=false,type="text",step=""){return `<div class="field"><label>${esc(label)}</label><input class="input" name="${esc(name)}" type="${esc(type)}" value="${esc(value??"")}" ${required?"required":""} ${step?`step="${step}"`:""}></div>`;}
function textareaField(label,name,value=""){return `<div class="field full"><label>${esc(label)}</label><textarea class="textarea" name="${esc(name)}">${esc(value??"")}</textarea></div>`;}
function selectField(label,name,options,value=""){return `<div class="field"><label>${esc(label)}</label><select class="select" name="${esc(name)}">${options.map(o=>`<option ${String(o)===String(value)?"selected":""}>${esc(o)}</option>`).join("")}</select></div>`;}
function relationField(label,name,options,value=""){return `<div class="field"><label>${esc(label)}</label><select class="select" name="${esc(name)}"><option value="">— None —</option>${options.map(([id,n])=>`<option value="${esc(id)}" ${id===value?"selected":""}>${esc(n)}</option>`).join("")}</select></div>`;}
function attentionCard(label,value,sub,icon){return `<button class="attention-card" data-jump="inventory"><span class="attention-icon">${icon}</span><span class="attention-number">${value}</span><strong>${label}</strong><small>${sub}</small></button>`;}
function itemCost(i){
  const explicit=num(i.totalLandedCost);
  if(explicit>0)return explicit;
  const detailed=num(i.purchasePrice)+num(i.buyerPremium)+num(i.salesTax)+num(i.shippingCost)+num(i.handlingCost)+num(i.otherAcquisitionCosts);
  if(detailed>num(i.purchasePrice))return detailed;
  return num(i.purchasePrice)+num(i.acquisitionCosts);
}
function stat(label,value,sub="",cls=""){return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value ${cls}">${value}</div>${sub?`<div class="stat-sub">${sub}</div>`:""}</div>`;}
function quick(icon,label,route){return `<button class="quick-card" data-jump="${route}"><span class="quick-icon">${icon}</span><strong>${label}</strong></button>`;}
function empty(text){return `<div class="empty">${esc(text)}</div>`;}
function kv(k,v){return `<p><strong>${esc(k)}:</strong> ${esc(v||"—")}</p>`;}
function eventListItem(e){return `<div class="list-card" data-event-id="${e.id}"><div><div class="badge"><span class="dot" style="background:${safeColor(e.color)}"></span>${esc(e.type||"Event")}</div><h4>${esc(e.title)}</h4><p>${prettyDateTime(e.startDate)}${e.location?` · ${esc(e.location)}`:""}</p></div></div>`;}
function auctionListItem(a){const when=a.endDateTime?prettyDateTime(a.endDateTime):prettyDate(a.date);return `<div class="list-card"><div><div class="badge"><span class="dot" style="background:${safeColor(a.color||"#f7c75d")}"></span>${esc(a.platform||"Auction")}</div><h4>${esc(a.name)}</h4><p>${when}${a.location?` · ${esc(a.location)}`:""}${a.status?` · ${esc(a.status)}`:""}</p></div></div>`;}
function itemCard(i,p){const fallback=num(i.askingPrice)||itemCost(i);const source=[i.sourcePlatform,i.sourceType,i.purchaseSource].filter(Boolean)[0]||"";return `<article class="item-card" data-id="${i.id}"><div class="item-photo">${p?`<img data-photo-record="${p.id}" alt="${esc(i.name)}">`:`<span class="no-photo-mark">📷<small>Add photo</small></span>`}</div><div class="item-body"><h3>${esc(i.name||"Untitled Item")}</h3><div class="item-meta">${esc(i.brand||i.category||"Uncategorized")}${i.model?` · ${esc(i.model)}`:""}${source?`<br>${esc(source)}`:""}${i.serialNumber?`<br>Serial: ${esc(i.serialNumber)}`:""}</div><div class="item-foot"><span class="badge"><span class="dot" style="background:${safeColor(i.color)}"></span>${esc(i.status)}</span><span class="item-price">${money(i.status==="Sold"&&i.soldPrice?i.soldPrice:fallback)}</span></div></div></article>`;}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${headers.length}">No records yet.</td></tr>`}</tbody></table></div>`;}

function startOfToday(){const d=new Date();d.setHours(0,0,0,0);return d;}
function today(){return ymd(new Date());}
function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0;}
function sum(a){return a.reduce((x,y)=>x+num(y),0);}
function money(v){return num(v).toLocaleString(undefined,{style:"currency",currency:"USD"});}
function prettyDate(v){if(!v)return"—";return new Date(String(v).slice(0,10)+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});}
function prettyDateTime(v){if(!v)return"—";return new Date(v).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
function dateTime(v){return v?new Date(v).toLocaleString():"";}
function cap(v){return v.charAt(0).toUpperCase()+v.slice(1);}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function nl2br(v){return esc(v).replace(/\n/g,"<br>");}
function safeColor(v){return /^#[0-9a-f]{6}$/i.test(String(v||""))?v:"#45b7ff";}
function csvCell(v){return `"${String(v??"").replace(/"/g,'""')}"`;}
function downloadFile(name,content,type){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
})();