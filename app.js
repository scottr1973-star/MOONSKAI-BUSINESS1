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
inventoryStatus:"active",
inventoryCategory:"all",
inventorySource:"all",
inventoryLocation:"all",
inventorySort:"updated",
inventoryAttention:""
};

const STATUSES=["Draft / Finish Cataloging","Available","Reserved","Needs Work","Listed","Sold","Personal / Not For Sale"];
const SOURCE_TYPES=["Online Auction","In-Person Auction","Flea Market / Swap Meet","Garage / Yard Sale","Estate Sale","Facebook Marketplace","Craigslist / Classified","Private Seller","Trade","Other"];
const ONLINE_PLATFORMS=["ShopGoodwill","eBay","HiBid","LiveAuctioneers","Proxibid","Local Auction Site","Other"];
const LABEL_SHEET_TEMPLATES={
  "22808":{
    id:"22808",
    name:"Avery 22808 / compatible",
    description:"2.5 inch round · 9 per sheet",
    shape:"round",
    columns:3,
    rows:3,
    count:9,
    width:2.5,
    height:2.5
  },
  "22804":{
    id:"22804",
    name:"Avery 22804 / compatible",
    description:"1.5 x 2.5 inch oval · 18 per sheet",
    shape:"oval",
    columns:3,
    rows:6,
    count:18,
    width:2.5,
    height:1.5
  },
  "22807":{
    id:"22807",
    name:"Avery 22807 / compatible",
    description:"2 inch round · 12 per sheet",
    shape:"round",
    columns:3,
    rows:4,
    count:12,
    width:2,
    height:2
  },
  "22806":{
    id:"22806",
    name:"Avery 22806 / compatible",
    description:"2 x 2 inch square · 12 per sheet",
    shape:"square",
    columns:3,
    rows:4,
    count:12,
    width:2,
    height:2
  },
  "5162":{
    id:"5162",
    name:"Avery 5162 / 8162 family",
    description:"1-1/3 x 4 inch · 14 per sheet",
    shape:"rectangle",
    columns:2,
    rows:7,
    count:14,
    width:4,
    height:1.333333
  },
  "5164":{
    id:"5164",
    name:"Avery 5164 / 8164 family",
    description:"3-1/3 x 4 inch · 6 per sheet",
    shape:"rectangle",
    columns:2,
    rows:3,
    count:6,
    width:4,
    height:3.333333
  },
  "5160":{
    id:"5160",
    name:"Avery 5160 / 8160 family",
    description:"1 x 2-5/8 inch · 30 per sheet",
    shape:"rectangle",
    columns:3,
    rows:10,
    count:30,
    width:2.625,
    height:1
  },
  "5163":{
    id:"5163",
    name:"Avery 5163 / 8163 family",
    description:"2 x 4 inch · 10 per sheet",
    shape:"rectangle",
    columns:2,
    rows:5,
    count:10,
    width:4,
    height:2
  }
};

const SHIPPING_STATUSES=["Not Applicable","Watching","Bidding","Won - Awaiting Payment","Paid - Awaiting Shipment","In Transit","Delivered","Pickup Required","Completed","Lost / Did Not Win"];
const EXPENSE_CATEGORIES=["Inventory Purchase","Auction Premium","Repairs","Parts","Strings / Supplies","Booth Fee","Admission","Fuel","Parking","Tolls","Hotel","Meals","Shipping","Packaging","Advertising","Other"];
const DEFAULT_ITEM_CATEGORIES=[
  "Electronics",
  "Tools",
  "Musical Instruments",
  "Collectibles",
  "Games",
  "Home & Garden",
  "Automotive",
  "Clothing",
  "Furniture",
  "Sporting Goods",
  "Parts",
  "Other"
];
const DEFAULT_PAYMENT_METHODS=[
  "Cash",
  "Square - Card",
  "Square - Tap to Pay",
  "Cash App",
  "Venmo",
  "PayPal",
  "Zelle",
  "Check",
  "Other"
];
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
    fab.hidden=route==="guide";
  $("#headerSub").textContent = ({
    dashboard:"Your business at a glance",
    inventory:"Everything you own and sell",
    calendar:"Fairs, festivals, pickups and events",
    money:"Sales, expenses and mileage",
      more:"Auctions, backups and tools",
      guide:"Instructions and everyday workflows"
  })[route] || "Business Organizer";

  fab.setAttribute("aria-label", route==="calendar"?"Add event":route==="money"?"Add expense":route==="more"?"Add auction":"Add item");
  await render();
  view.focus();
}

async function render(){
  if(state.route==="dashboard")return renderDashboard();
  if(state.route==="inventory")return renderInventory();
  if(state.route==="calendar")return renderCalendar();
    if(state.route==="guide")return renderUserGuide();
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
const activeSales=sales.filter(s=>s.status!=="Voided");
const revenue=sum(activeSales.map(s=>num(s.soldPrice)+num(s.shippingCharged)));
const soldCost=sum(activeSales.map(s=>num(s.costBasis)));
const saleCostsTotal=sum(activeSales.map(s=>saleCosts(s)));
const expensesTotal=sum(expenses.filter(e=>!isCapitalizedAcquisitionExpense(e)).map(e=>num(e.amount)));
const profit=revenue-soldCost-saleCostsTotal-expensesTotal;
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
${attentionCard("Finish Cataloging",needsFinish,"Incomplete item records","📋","Finish Cataloging")}
${attentionCard("Needs Work",needsWork,"Cleaning, repair or setup","🛠","Needs Work")}
${attentionCard("Needs Pricing",needsPricing,"No asking price yet","🏷","Needs Pricing")}
${attentionCard("Needs Photos",needsPhotos,"No item photo stored","📷","Needs Photos")}
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
$$("[data-jump]").forEach(b=>b.onclick=()=>{if(b.dataset.attention)state.inventoryAttention=b.dataset.attention;navigate(b.dataset.jump);});
}

async function renderInventory(){
  const items=(await DB.getAll("items")).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  const photos=await DB.getAll("itemPhotos");
  const primary=new Map();
  photos.forEach(p=>{if(!primary.has(p.itemId))primary.set(p.itemId,p);});

  const categories=await getItemCategories();
  const usedSources=items.flatMap(i=>[i.sourcePlatform,i.sourceType,i.purchaseSource]).map(v=>String(v||"").trim()).filter(Boolean);
  const sourcePool=[...SOURCE_TYPES,...ONLINE_PLATFORMS,...usedSources];
  const sources=sourcePool.filter((value,index)=>sourcePool.findIndex(x=>x.toLowerCase()===value.toLowerCase())===index).sort((a,b)=>a.localeCompare(b));
  const locations=await getStorageLocations();

let filtered=items.filter(i=>{
const hay=`${i.sku||""} ${i.upc||""} ${i.manufacturerPartNumber||""} ${i.otherIdentifier||""} ${i.name||""} ${i.brand||""} ${i.model||""} ${i.serialNumber||""} ${i.category||""} ${i.notes||""} ${i.sourcePlatform||""} ${i.sourceType||""} ${i.purchaseSource||""} ${i.storageLocation||""}`.toLowerCase();
  if(!hay.includes(state.inventorySearch.toLowerCase()))return false;
if(state.inventoryStatus==="active" && i.status==="Sold")return false;
if(state.inventoryStatus!=="all" && state.inventoryStatus!=="active" && i.status!==state.inventoryStatus)return false;
  if(state.inventoryCategory!=="all" && i.category!==state.inventoryCategory)return false;
    const itemSources=[i.sourcePlatform,i.sourceType,i.purchaseSource].map(v=>String(v||"").trim()).filter(Boolean);
    if(state.inventorySource!=="all" && !itemSources.includes(state.inventorySource))return false;
  if(state.inventoryLocation!=="all" && i.storageLocation!==state.inventoryLocation)return false;
  if(state.inventoryAttention==="Finish Cataloging" && !(i.status==="Draft / Finish Cataloging" || !i.name || !i.category))return false;
  if(state.inventoryAttention==="Needs Work" && !(i.status!=="Sold" && (i.status==="Needs Work" || String(i.workNeeded||"").trim())))return false;
  if(state.inventoryAttention==="Needs Pricing" && !(i.status!=="Sold" && num(i.askingPrice)<=0))return false;
  if(state.inventoryAttention==="Needs Photos" && !(i.status!=="Sold" && !primary.has(i.id)))return false;
  return true;
});

if(state.inventorySort==="newest")filtered.sort((a,b)=>String(b.purchaseDate||"").localeCompare(String(a.purchaseDate||"")));
else if(state.inventorySort==="oldest")filtered.sort((a,b)=>String(a.purchaseDate||"").localeCompare(String(b.purchaseDate||"")));
else if(state.inventorySort==="costHigh")filtered.sort((a,b)=>itemCost(b)-itemCost(a));
else if(state.inventorySort==="costLow")filtered.sort((a,b)=>itemCost(a)-itemCost(b));
else if(state.inventorySort==="priceHigh")filtered.sort((a,b)=>num(b.askingPrice)-num(a.askingPrice));
else if(state.inventorySort==="priceLow")filtered.sort((a,b)=>num(a.askingPrice)-num(b.askingPrice));

  view.innerHTML=`
    <div class="section-head">
      <div><h2>Inventory</h2><p>${items.length} total item${items.length===1?"":"s"} stored locally.</p></div>
      <div class="inventory-head-actions">
        <button class="btn camera-btn small" id="inventoryCamera">📷 Capture</button>
          <button class="btn secondary small" id="printInventoryLabels">🏷 Print Labels</button>
          <button class="btn secondary small" id="scanInventoryCode">▦ Scan Code</button>
        <button class="btn secondary small" id="addItemTop">＋ Manual</button>
      </div>
    </div>
<div class="toolbar">
  <input class="input search" id="inventorySearch" placeholder="Search inventory…" value="${esc(state.inventorySearch)}">
  <select class="select" id="inventoryStatus">
<option value="active" ${state.inventoryStatus==="active"?"selected":""}>Active inventory</option>
<option value="all" ${state.inventoryStatus==="all"?"selected":""}>All statuses</option>
    ${STATUSES.map(s=>`<option ${state.inventoryStatus===s?"selected":""}>${esc(s)}</option>`).join("")}
  </select>
  <select class="select" id="inventoryCategory">
    <option value="all">All categories</option>
    ${categories.map(s=>`<option value="${esc(s)}" ${state.inventoryCategory===s?"selected":""}>${esc(s)}</option>`).join("")}
  </select>
  <select class="select" id="inventorySource">
    <option value="all">All sources</option>
    ${sources.map(s=>`<option value="${esc(s)}" ${state.inventorySource===s?"selected":""}>${esc(s)}</option>`).join("")}
  </select>
  <select class="select" id="inventoryLocation">
    <option value="all">All locations</option>
    ${locations.map(s=>`<option value="${esc(s)}" ${state.inventoryLocation===s?"selected":""}>${esc(s)}</option>`).join("")}
  </select>
  <select class="select" id="inventorySort">
    <option value="updated" ${state.inventorySort==="updated"?"selected":""}>Recently updated</option>
    <option value="newest" ${state.inventorySort==="newest"?"selected":""}>Newest acquired</option>
    <option value="oldest" ${state.inventorySort==="oldest"?"selected":""}>Oldest acquired</option>
    <option value="costHigh" ${state.inventorySort==="costHigh"?"selected":""}>Cost: high to low</option>
    <option value="costLow" ${state.inventorySort==="costLow"?"selected":""}>Cost: low to high</option>
    <option value="priceHigh" ${state.inventorySort==="priceHigh"?"selected":""}>Price: high to low</option>
    <option value="priceLow" ${state.inventorySort==="priceLow"?"selected":""}>Price: low to high</option>
  </select>
  ${state.inventoryAttention?`<button class="btn secondary small" id="clearAttention">Clear ${esc(state.inventoryAttention)}</button>`:""}
</div>
    <section class="inventory-grid">
      ${filtered.length?filtered.map(i=>itemCard(i,primary.get(i.id))).join(""):empty("No matching inventory items. Tap + to add your first item.")}
    </section>
  `;

  $("#inventoryCamera").onclick=()=>startCameraCapture();
  $("#addItemTop").onclick=()=>openItemModal();
  $("#printInventoryLabels").onclick=()=>openLabelSheetPrinter(filtered);
  $("#scanInventoryCode").onclick=()=>openInventoryCodeScanner();
$("#inventorySearch").oninput=e=>{state.inventorySearch=e.target.value;renderInventory();};
$("#inventoryStatus").onchange=e=>{state.inventoryStatus=e.target.value;state.inventoryAttention="";renderInventory();};
$("#inventoryCategory").onchange=e=>{state.inventoryCategory=e.target.value;renderInventory();};
$("#inventorySource").onchange=e=>{state.inventorySource=e.target.value;renderInventory();};
$("#inventoryLocation").onchange=e=>{state.inventoryLocation=e.target.value;renderInventory();};
$("#inventorySort").onchange=e=>{state.inventorySort=e.target.value;renderInventory();};
const clearAttention=$("#clearAttention");
if(clearAttention)clearAttention.onclick=()=>{state.inventoryAttention="";renderInventory();};
  $$(".item-card[data-id]").forEach(card=>card.onclick=()=>openItemDetail(card.dataset.id));
  hydrateBlobImages();
}

async function openItemModal(item,seed){
  const editing=!!item, now=new Date().toISOString();
  const [events,auctions,itemCategories,storageLocations]=await Promise.all([
    DB.getAll("events"),
    DB.getAll("auctions"),
    getItemCategories(),
    getStorageLocations()
  ]);

const generatedSku=(item&&item.sku)||(seed&&seed.sku)||await nextSku();
  const base={
id:DB.uid("item"),sku:generatedSku,upc:"",manufacturerPartNumber:"",otherIdentifier:"",name:"",category:"",brand:"",model:"",serialNumber:"",year:"",condition:"",
status:"Available",color:"#45b7ff",storageLocation:"",purchaseDate:today(),purchaseSource:"",
    sourceType:"",sourcePlatform:"",sourceSeller:"",sourceLocation:"",listingTitle:"",listingUrl:"",
    lotNumber:"",auctionEndDateTime:"",auctionId:"",shippingStatus:"Not Applicable",
    purchasePrice:"",buyerPremium:"",salesTax:"",shippingCost:"",handlingCost:"",otherAcquisitionCosts:"",
acquisitionCosts:"",totalLandedCost:"",askingPrice:"",minimumPrice:"",soldPrice:"",saleDate:"",
soldEventId:"",salePlatform:"",buyerName:"",sellingFees:"",paymentFees:"",shippingCharged:"",outboundShippingCost:"",
buyerNotes:"",description:"",conditionNotes:"",workNeeded:"",repairNotes:"",
    estimatedRepairCost:"",notes:"",createdAt:now,updatedAt:now
  };
  const draft=Object.assign({},base,item||{},seed||{});
  const catalogStatuses=STATUSES.filter(status=>status!=="Sold");

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
${field("SKU","sku",draft.sku,true)}
${field("UPC / Barcode","upc",draft.upc)}
${field("Manufacturer part number","manufacturerPartNumber",draft.manufacturerPartNumber)}
${field("Other identifier","otherIdentifier",draft.otherIdentifier)}
${selectField("Category","category",[""].concat(itemCategories),draft.category)}
${field("Brand","brand",draft.brand)}
${field("Model","model",draft.model)}
${field("Serial number","serialNumber",draft.serialNumber)}
${field("Year / approximate year","year",draft.year)}
${draft.status==="Sold"?`<div class="field"><label>Status</label><div class="input" aria-readonly="true">Sold</div><input type="hidden" name="status" value="Sold"></div>`:selectField("Status","status",catalogStatuses,draft.status)}
${selectField("Physical location","storageLocation",[""].concat(storageLocations),draft.storageLocation)}
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
            <div class="field full landed-cost-box"><label>Total item cost</label><output id="landedCostOutput">${money(itemCost(draft))}</output></div>
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
<div class="field"><label>Sold price</label><div class="input" aria-readonly="true">${draft.soldPrice?money(draft.soldPrice):"—"}</div><input type="hidden" name="soldPrice" value="${esc(draft.soldPrice??"")}"></div>
<div class="field"><label>Sale date</label><div class="input" aria-readonly="true">${draft.saleDate?prettyDate(draft.saleDate):"—"}</div><input type="hidden" name="saleDate" value="${esc(draft.saleDate??"")}"></div>
${relationField("Sold at event","soldEventId",events.map(x=>[x.id,x.title]),draft.soldEventId)}
${field("Sale platform","salePlatform",draft.salePlatform)}
${field("Buyer / customer","buyerName",draft.buyerName)}
${field("Selling / marketplace fees","sellingFees",draft.sellingFees,false,"number","0.01")}
${field("Payment processing fees","paymentFees",draft.paymentFees,false,"number","0.01")}
${field("Shipping charged to buyer","shippingCharged",draft.shippingCharged,false,"number","0.01")}
${field("Outbound shipping cost","outboundShippingCost",draft.outboundShippingCost,false,"number","0.01")}
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
  ["purchasePrice","buyerPremium","salesTax","shippingCost","handlingCost","otherAcquisitionCosts","estimatedRepairCost"].forEach(n=>{
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

    if(editing && draft.status==="Sold"){
      data.status="Sold";
      data.soldPrice=draft.soldPrice;
      data.saleDate=draft.saleDate;
    }else{
      if(!catalogStatuses.includes(data.status))data.status="Available";
      data.soldPrice=draft.soldPrice||"";
      data.saleDate=draft.saleDate||"";
    }

data.sku=String(data.sku||"").trim().toUpperCase();
if(!data.sku)data.sku=await nextSku();

const allItems=await DB.getAll("items");
if(allItems.some(i=>i.id!==draft.id && String(i.sku||"").trim().toUpperCase()===data.sku)){
  alert(`SKU ${data.sku} is already assigned to another item.`);
  return;
}
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
  salePlatform:saved.salePlatform||"",
  buyerName:saved.buyerName||"",
  sellingFees:num(saved.sellingFees),
  paymentFees:num(saved.paymentFees),
  shippingCharged:num(saved.shippingCharged),
  outboundShippingCost:num(saved.outboundShippingCost),
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
  ${stat("Item Cost",money(itemCost(item)),"")}
  ${stat("Asking",money(item.askingPrice),"")}
  ${stat("Sold",item.soldPrice?money(item.soldPrice):"—","")}
  ${stat("Net Proceeds",item.soldPrice?money(num(item.soldPrice)+num(item.shippingCharged)-num(item.sellingFees)-num(item.paymentFees)-num(item.outboundShippingCost)):"—","")}
  ${stat("Profit",item.soldPrice?money(num(item.soldPrice)+num(item.shippingCharged)-num(item.sellingFees)-num(item.paymentFees)-num(item.outboundShippingCost)-itemCost(item)):"—","")}
</section>
      <div class="grid-2">
<div class="panel"><h3>Item details</h3>${kv("SKU",item.sku)}${kv("UPC / Barcode",item.upc)}${kv("Manufacturer Part #",item.manufacturerPartNumber)}${kv("Other Identifier",item.otherIdentifier)}${kv("Category",item.category)}${kv("Brand",item.brand)}${kv("Model",item.model)}${kv("Serial",item.serialNumber)}${kv("Year",item.year)}${kv("Storage",item.storageLocation)}${kv("Source",item.purchaseSource)}</div>
        <div class="panel"><h3>Notes</h3><p>${nl2br(item.description||"No description.")}</p>${item.conditionNotes?`<p><strong>Condition</strong><br>${nl2br(item.conditionNotes)}</p>`:""}${item.workNeeded?`<p><strong>Work needed</strong><br>${nl2br(item.workNeeded)}</p>`:""}${item.repairNotes?`<p><strong>Repair / restoration</strong><br>${nl2br(item.repairNotes)}</p>`:""}${item.notes?`<p><strong>Private</strong><br>${nl2br(item.notes)}</p>`:""}</div>
      </div>
      <div class="section-head"><div><h3>Item log</h3></div><button class="btn small" id="addLogBtn">＋ Log Entry</button></div>
      <div>${logs.length?logs.map(l=>`<div class="log-entry"><small>${dateTime(l.createdAt)}</small><div>${nl2br(l.text)}</div></div>`).join(""):empty("No log entries yet.")}</div>
    </div>
<div class="modal-actions"><button class="btn danger" id="deleteItemBtn" type="button">Delete</button><button class="btn secondary" id="printPriceTagBtn" type="button">Print Label</button><button class="btn secondary" id="editItemBtn" type="button">Edit Item</button>${item.status!=="Sold"?`<button class="btn" id="sellItemBtn" type="button">Sell Item</button>`:""}<button class="btn" data-close type="button">Done</button></div>
  `);

  hydrateBlobImages(photos);
  $("#editItemBtn").onclick=()=>{closeModal();openItemModal(item);};
$("#printPriceTagBtn").onclick=()=>{closeModal();openLabelSheetPrinter([item]);};
if(item.status!=="Sold"){
  $("#sellItemBtn").onclick=()=>openSaleRegisterModal(item.id);
}
  $("#addLogBtn").onclick=async()=>{
    const text=prompt("Add a note to this item's history:");
    if(!text||!text.trim())return;
    await DB.put("itemLogs",{id:DB.uid("log"),itemId:id,text:text.trim(),createdAt:new Date().toISOString()});
    closeModal();openItemDetail(id);
  };
  $("#deleteItemBtn").onclick=async()=>{
    const linkedSales=await DB.getByIndex("sales","itemId",id);
    const transactions=await DB.getAll("transactions");
    const linkedTransactions=transactions.filter(t=>
      (t.itemIds||[]).includes(id) ||
      (t.lineItems||[]).some(line=>line.itemId===id)
    );

    if(item.status==="Sold" || linkedSales.length || linkedTransactions.length){
      alert("This item has sales/register history and cannot be deleted. Void the sale first. If it is already voided, delete the voided transaction from Money → Register before deleting this inventory item.");
      return;
    }

    if(!confirm(`Delete "${item.name}" and its photos/logs?`))return;

    for(const p of await DB.getByIndex("itemPhotos","itemId",id)){
      await DB.remove("itemPhotos",p.id);
    }

    for(const l of await DB.getByIndex("itemLogs","itemId",id)){
      await DB.remove("itemLogs",l.id);
    }

    await DB.remove("items",id);
    closeModal();
    toast("Item deleted.");
    renderInventory();
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
</div></div><div class="modal-actions">${edit?`<button class="btn danger" id="deleteEvent" type="button">Delete</button>`:""}<button class="btn secondary" id="googleCalendarBtn" type="button">Add to Google Calendar</button><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Event</button></div></form>
  `);
$("#googleCalendarBtn").onclick=()=>{
  const data=Object.fromEntries(new FormData($("#eventForm")).entries());
  openGoogleCalendarEvent(Object.assign({},e,data));
};
  $("#eventForm").onsubmit=async x=>{x.preventDefault();await DB.put("events",Object.assign({},e,Object.fromEntries(new FormData(x.currentTarget).entries())));closeModal();toast("Event saved.");renderCalendar();};
  if(edit)$("#deleteEvent").onclick=async()=>{if(confirm("Delete this event?")){await DB.remove("events",e.id);closeModal();renderCalendar();}};
}

async function renderMoney(){
const [expenses,mileage,sales,items,transactions]=await Promise.all([DB.getAll("expenses"),DB.getAll("mileage"),DB.getAll("sales"),DB.getAll("items"),DB.getAll("transactions")]);
const activeSales=sales.filter(s=>s.status!=="Voided");
const expTotal=sum(expenses.filter(e=>!isCapitalizedAcquisitionExpense(e)).map(e=>num(e.amount))),miles=sum(mileage.map(m=>num(m.miles))),revenue=sum(activeSales.map(s=>num(s.soldPrice)+num(s.shippingCharged))),cost=sum(activeSales.map(s=>num(s.costBasis))),saleCostsTotal=sum(activeSales.map(s=>saleCosts(s))),profit=revenue-cost-saleCostsTotal-expTotal;
  view.innerHTML=`
    <div class="section-head"><div><h2>Money</h2><p>Sales, expenses and business mileage.</p></div><button class="btn small" id="addExpenseTop">＋ Expense</button></div>
    <section class="stats">${stat("Sales",money(revenue),"gross revenue")}${stat("Expenses",money(expTotal),"recorded business expenses")}${stat("Mileage",miles.toFixed(1)+" mi","business travel")}${stat("Estimated Net",money(profit),"before taxes",profit>=0?"kpi-positive":"kpi-negative")}</section>
<div class="money-tabs">${["expenses","mileage","sales","register"].map(t=>`<button class="tab-btn ${state.moneyTab===t?"active":""}" data-money-tab="${t}">${t==="register"?"Register":cap(t)}</button>`).join("")}</div>
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
}else if(state.moneyTab==="sales"){
  const itemMap=new Map(items.map(i=>[i.id,i]));
  sales.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
$("#moneyContent").innerHTML=`<div class="section-head"><div><h3>Item Sales</h3></div></div>${table(["Date","Item","Sold","Net Proceeds","Cost","Profit"],activeSales.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(s=>{const soldItem=itemMap.get(s.itemId);return [prettyDate(s.date),`${esc(soldItem?.name||"Unknown item")}${soldItem?.sku?`<br><button class="sku-sale-link" type="button" data-sale-item-id="${esc(s.itemId)}">${esc(soldItem.sku)}</button>`:""}`,money(s.soldPrice),money(saleNetProceeds(s)),money(s.costBasis),money(saleProfit(s))];}))}`;
  $$("[data-sale-item-id]").forEach(button=>{
    button.onclick=()=>openItemDetail(button.dataset.saleItemId);
  });
}else{
  transactions.sort((a,b)=>String(b.date).localeCompare(String(a.date)));

  const completedTransactions=transactions.filter(t=>t.status!=="Voided");
  const todaysTransactions=completedTransactions.filter(t=>String(t.date||"").slice(0,10)===today());
  const todayTotal=sum(todaysTransactions.map(t=>t.total));
const todayPaymentGroups=new Map();

for(const transaction of todaysTransactions){
  const method=String(transaction.paymentMethod||"Unspecified");
  const group=todayPaymentGroups.get(method)||{count:0,total:0};
  group.count+=1;
  group.total+=num(transaction.total);
  todayPaymentGroups.set(method,group);
}

const todayPaymentRows=Array.from(todayPaymentGroups.entries())
  .sort((a,b)=>b[1].total-a[1].total)
  .map(([method,data])=>[
    esc(method),
    String(data.count),
    money(data.total)
  ]);

  $("#moneyContent").innerHTML=`
    <div class="section-head">
      <div>
        <h3>Sales Register</h3>
        <p>Cash, Square, Cash App and other sales together.</p>
      </div>
      <button class="btn small" id="recordSaleTop">＋ Record Sale</button>
    </div>

<section class="stats">
  ${stat("Today",money(todayTotal),`${todaysTransactions.length} transaction${todaysTransactions.length===1?"":"s"}`)}
</section>

<div class="panel">
  <h4>Today's Payment Breakdown</h4>
  ${table(["Payment Method","Transactions","Total"],todayPaymentRows)}
</div>

${table(
  ["Date","Payment","Items","Total","Cash Received","Change","Reference","Status",""],
  transactions.map(t=>[
    prettyDate(t.date),
    esc(t.paymentMethod||""),
    String((t.itemIds||[]).length),
    money(t.total),
    t.paymentMethod==="Cash" ? money(t.cashReceived) : "—",
    t.paymentMethod==="Cash" ? money(t.changeDue) : "—",
    esc(t.externalTransactionId||""),
    esc(t.status||""),
      t.status==="Voided"
        ? `<button class="btn danger small" data-delete-transaction="${esc(t.id)}">Delete</button>`
        : `<button class="btn danger small" data-void-transaction="${esc(t.id)}">Void</button>`
  ])
)}
  `;

  $("#recordSaleTop").onclick=()=>openSaleRegisterModal();
  $$("[data-void-transaction]").forEach(button=>{
    button.onclick=()=>voidTransaction(button.dataset.voidTransaction);
  });
  $$("[data-delete-transaction]").forEach(button=>{
    button.onclick=()=>deleteVoidedTransaction(button.dataset.deleteTransaction);
  });

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
async function openSaleRegisterModal(initialItemId=""){
const [items,events,paymentMethods]=await Promise.all([
  DB.getAll("items"),
  DB.getAll("events"),
  getPaymentMethods()
]);
  const available=items.filter(i=>i.status!=="Sold");
  const selected=new Map();
if(initialItemId){
  const initialItem=available.find(i=>i.id===initialItemId);
  if(initialItem){
    selected.set(initialItem.id,{
      item:initialItem,
      price:num(initialItem.askingPrice)
    });
  }
}

  if(!available.length){
    alert("There are no active inventory items available to sell.");
    return;
  }

  openModal(`
    <div class="modal-head">
      <div><div class="eyebrow">SALES REGISTER</div><h2>Record Sale</h2></div>
      <button class="close-btn" data-close type="button">×</button>
    </div>

    <form id="saleRegisterForm">
      <div class="modal-body">

        <div class="record-section">
          <div class="record-section-title">
            <span>🔎</span>
            <div>
              <strong>Find Inventory Item</strong>
              <small>Enter SKU, UPC/barcode, serial number, manufacturer part number or other identifier.</small>
            </div>
          </div>

          <div class="form-grid">
            <div class="field">
              <label>SKU / Identifier</label>
              <input class="input" id="saleLookup" autocomplete="off" placeholder="ML-000001">
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <button class="btn" id="addSaleItem" type="button">Add Item</button>
            </div>
          </div>

          <div id="saleLookupMessage"></div>
          <div class="list" id="saleCart"></div>
        </div>

        <div class="record-section">
          <div class="record-section-title">
            <span>💳</span>
            <div>
              <strong>Payment</strong>
              <small>Record how the customer paid. Payment itself happens outside this app.</small>
            </div>
          </div>

          <div class="form-grid">
            ${field("Sale date","date",today(),true,"date")}
${selectField("Payment method","paymentMethod",paymentMethods,"Cash")}
            ${field("Buyer / customer","buyerName","")}
            ${field("External transaction / reference ID","externalTransactionId","")}
            ${relationField("Related event","eventId",events.map(x=>[x.id,x.title]),"")}
            ${textareaField("Sale notes","notes","")}
          </div>
<div id="cashCalculator" class="panel" hidden style="margin-top:12px">
  <h4>Cash Calculator</h4>
  <div class="form-grid">
    <div class="field">
      <label>Sale total</label>
      <div class="input" id="cashSaleTotal">$0.00</div>
    </div>
    ${field("Cash received","cashReceived","",false,"number","0.01")}
  </div>
  <p id="cashChangeDue" style="font-weight:700;margin:10px 0 0">Enter cash received.</p>
</div>
        </div>

      </div>

      <div class="modal-actions">
        <button class="btn ghost" data-close type="button">Cancel</button>
        <button class="btn" type="submit">Complete Sale</button>
      </div>
    </form>
  `);

  const form=$("#saleRegisterForm");
  const lookup=$("#saleLookup");
  const message=$("#saleLookupMessage");
  const cart=$("#saleCart");

  const identifiers=i=>[
    i.sku,
    i.upc,
    i.serialNumber,
    i.manufacturerPartNumber,
    i.otherIdentifier
  ].map(v=>String(v||"").trim().toLowerCase()).filter(Boolean);

const paymentSelect=form.elements.paymentMethod;
const cashCalculator=$("#cashCalculator");
const cashSaleTotal=$("#cashSaleTotal");
const cashChangeDue=$("#cashChangeDue");

const saleTotal=()=>sum(
  Array.from(selected.values()).map(entry=>num(entry.price))
);

const updateCashCalculator=()=>{
  const total=saleTotal();
  cashSaleTotal.textContent=money(total);

  const isCash=paymentSelect.value==="Cash";
  cashCalculator.hidden=!isCash;

  if(!isCash)return;

  const raw=String(form.elements.cashReceived.value||"").trim();

  if(!raw){
    cashChangeDue.textContent="Enter cash received.";
    return;
  }

  const received=num(raw);
  const difference=received-total;

  cashChangeDue.textContent=difference>=0
    ? `Change due: ${money(difference)}`
    : `Amount still due: ${money(Math.abs(difference))}`;
};

paymentSelect.onchange=updateCashCalculator;
form.elements.cashReceived.oninput=updateCashCalculator;
  const renderCart=()=>{
    if(!selected.size){
      cart.innerHTML=empty("No items added to this sale yet.");
updateCashCalculator();
      return;
    }

    cart.innerHTML=Array.from(selected.values()).map(entry=>`
      <div class="list-card">
        <div>
          <strong>${esc(entry.item.name||"Untitled Item")}</strong>
          <p>
            SKU ${esc(entry.item.sku||"—")}
            ${entry.item.serialNumber?` · Serial ${esc(entry.item.serialNumber)}`:""}
            · Cost ${money(itemCost(entry.item))}
          </p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input
            class="input"
            style="width:110px"
            type="number"
            min="0"
            step="0.01"
            data-cart-price="${esc(entry.item.id)}"
            value="${num(entry.price).toFixed(2)}"
            aria-label="Selling price"
          >
          <button class="btn danger small" type="button" data-remove-sale-item="${esc(entry.item.id)}">Remove</button>
        </div>
      </div>
    `).join("");

    $$("[data-cart-price]").forEach(input=>{
      input.oninput=()=>{
        const entry=selected.get(input.dataset.cartPrice);
if(entry){
  entry.price=num(input.value);
  updateCashCalculator();
}
      };
    });

    $$("[data-remove-sale-item]").forEach(button=>{
      button.onclick=()=>{
        selected.delete(button.dataset.removeSaleItem);
        renderCart();
      };
    });
updateCashCalculator();
  };

  const addLookupItem=()=>{
    const query=String(lookup.value||"").trim().toLowerCase();

    if(!query){
      message.innerHTML=`<p>Enter an SKU or other identifier.</p>`;
      return;
    }

    const item=available.find(i=>identifiers(i).includes(query));

    if(!item){
      message.innerHTML=`<p>No active inventory item matches <strong>${esc(lookup.value)}</strong>.</p>`;
      return;
    }

    if(selected.has(item.id)){
      message.innerHTML=`<p>${esc(item.name||item.sku)} is already in this sale.</p>`;
      lookup.select();
      return;
    }

    selected.set(item.id,{
      item,
      price:num(item.askingPrice)
    });

    message.innerHTML=`<p>Added <strong>${esc(item.name||"Untitled Item")}</strong> · ${esc(item.sku||"")}</p>`;
    lookup.value="";
    lookup.focus();
    renderCart();
  };

  $("#addSaleItem").onclick=addLookupItem;

  lookup.onkeydown=e=>{
    if(e.key==="Enter"){
      e.preventDefault();
      addLookupItem();
    }
  };

  renderCart();
  lookup.focus();

  form.onsubmit=async e=>{
    e.preventDefault();

    if(!selected.size){
      alert("Add at least one inventory item to the sale.");
      return;
    }

const fd=new FormData(form);
const date=String(fd.get("date")||today());
const paymentMethod=String(fd.get("paymentMethod")||"");
const buyerName=String(fd.get("buyerName")||"");
const externalTransactionId=String(fd.get("externalTransactionId")||"").trim();
const eventId=String(fd.get("eventId")||"");
const notes=String(fd.get("notes")||"");

const checkoutTotal=sum(Array.from(selected.values()).map(entry=>num(entry.price)));
const cashReceived=paymentMethod==="Cash" ? num(fd.get("cashReceived")) : 0;

if(paymentMethod==="Cash" && cashReceived<checkoutTotal){
  alert(`Cash received is ${money(checkoutTotal-cashReceived)} short.`);
  return;
}

const changeDue=paymentMethod==="Cash"
  ? Math.max(0,cashReceived-checkoutTotal)
  : 0;

const transactionId=DB.uid("txn");

    let total=0;
    const lineItems=[];

    for(const entry of selected.values()){
      const current=await DB.getOne("items",entry.item.id);

      if(!current || current.status==="Sold"){
        alert(`${entry.item.name||entry.item.sku} is no longer available.`);
        return;
      }

const previousStatus=current.status||"Available";
      const soldPrice=num(entry.price);
      total+=soldPrice;

      current.status="Sold";
      current.soldPrice=soldPrice;
      current.saleDate=date;
      current.soldEventId=eventId;
      current.buyerName=buyerName;
      current.paymentMethod=paymentMethod;
      current.externalTransactionId=externalTransactionId;
      current.updatedAt=new Date().toISOString();
current.saleTransactionId=transactionId;

      await DB.put("items",current);

const existingSales=await DB.getByIndex("sales","itemId",current.id);
const sale=existingSales.find(s=>s.status!=="Voided")||{
  id:DB.uid("sale"),
  itemId:current.id
};

Object.assign(sale,{
  transactionId,
  status:"Completed",
  previousStatus,
  date,
  soldPrice,
  costBasis:itemCost(current),
  paymentMethod,
  externalTransactionId,
  buyerName,
  eventId,
  notes
});

      await DB.put("sales",sale);

lineItems.push({
  itemId:current.id,
  sku:current.sku||"",
  name:current.name||"",
  soldPrice,
  costBasis:itemCost(current),
  previousStatus
});

      await DB.put("itemLogs",{
        id:DB.uid("log"),
        itemId:current.id,
        text:`Sold for ${money(soldPrice)} via ${paymentMethod}.`,
        createdAt:new Date().toISOString()
      });
    }

    await DB.put("transactions",{
      id:transactionId,
      date,
      status:"Completed",
      source:"Manual",
      paymentMethod,
      externalTransactionId,
      buyerName,
      eventId,
      notes,
      itemIds:lineItems.map(x=>x.itemId),
      lineItems,
      total,
cashReceived,
changeDue,
      createdAt:new Date().toISOString()
    });

    closeModal();
    toast(`Sale recorded: ${money(total)}`);
    state.moneyTab="register";
    navigate("money");
  };
}
async function voidTransaction(transactionId){
  const transaction=await DB.getOne("transactions",transactionId);
  if(!transaction || transaction.status==="Voided")return;

  if(!confirm(`Void this ${money(transaction.total)} sale and return its item${(transaction.itemIds||[]).length===1?"":"s"} to inventory?`))return;

  const allSales=await DB.getAll("sales");
  const voidedAt=new Date().toISOString();

  for(const line of transaction.lineItems||[]){
    const item=await DB.getOne("items",line.itemId);

    if(item && item.saleTransactionId===transactionId){
      item.status=line.previousStatus||"Available";
      item.soldPrice="";
      item.saleDate="";
      item.soldEventId="";
      item.buyerName="";
      item.paymentMethod="";
      item.externalTransactionId="";
      item.saleTransactionId="";
      item.updatedAt=voidedAt;
      await DB.put("items",item);

      await DB.put("itemLogs",{
        id:DB.uid("log"),
        itemId:item.id,
        text:`Sale voided. Item returned to ${item.status}.`,
        createdAt:voidedAt
      });
    }

    for(const sale of allSales.filter(s=>s.transactionId===transactionId && s.itemId===line.itemId)){
      sale.status="Voided";
      sale.voidedAt=voidedAt;
      await DB.put("sales",sale);
    }
  }

  transaction.status="Voided";
  transaction.voidedAt=voidedAt;
  await DB.put("transactions",transaction);

  toast("Sale voided and inventory restored.");
  renderMoney();
}

async function deleteVoidedTransaction(transactionId){
  const transaction=await DB.getOne("transactions",transactionId);
  if(!transaction || transaction.status!=="Voided")return;

  if(!confirm(`Permanently delete this voided ${money(transaction.total)} transaction from the register? This cannot be undone.`))return;

  const linkedSales=(await DB.getAll("sales")).filter(s=>
    s.transactionId===transactionId && s.status==="Voided"
  );

  for(const sale of linkedSales){
    await DB.remove("sales",sale.id);
  }

  await DB.remove("transactions",transactionId);
  toast("Voided transaction deleted.");
  renderMoney();
}

async function renderUserGuide(){
  view.innerHTML=`
    <div class="section-head">
      <div>
        <h2>User Guide</h2>
        <p>How to use Moonskai Business Organizer for everyday resale business work.</p>
      </div>
      <button class="btn secondary small" id="guideBack" type="button">← Back to More</button>
    </div>

    <section class="grid-2">
      <div class="panel">
        <h3>Getting Started</h3>
        <p>Moonskai Business Organizer keeps inventory, sales, events, expenses, mileage, auctions and business records together in one place.</p>
        <p>Most information is stored locally in this browser on this device. Use Backup regularly so the business records can be restored if the browser data or device is lost.</p>
      </div>

      <div class="panel">
        <h3>Main Sections</h3>
        <p><strong>Dashboard:</strong> Business totals, inventory attention items and upcoming activity.</p>
        <p><strong>Inventory:</strong> Everything owned, cataloged, listed or sold.</p>
        <p><strong>Calendar:</strong> Fairs, festivals, pickups, sales and other events.</p>
        <p><strong>Money:</strong> Sales Register, expenses and mileage.</p>
        <p><strong>More:</strong> Auctions, backups, exports and business settings.</p>
      </div>
    </section>

    <div class="section-head"><div><h3>Inventory</h3><p>Catalog, organize and find merchandise.</p></div></div>

    <section class="grid-2">
      <div class="panel">
        <h3>Adding an Item</h3>
        <p>Use Manual or Capture from Inventory or the Dashboard to start a new inventory record.</p>
        <p>Enter the item name and any useful identifiers such as UPC, manufacturer part number, model or serial number. Add photos and acquisition information when available.</p>
        <p>The app creates an internal SKU automatically in the ML-000001 style. This SKU is meant to uniquely identify the item inside the business.</p>
      </div>

      <div class="panel">
        <h3>Categories</h3>
        <p>Choose a category while cataloging an item. Built-in categories are available automatically.</p>
        <p>Use More → Manage Categories to add custom categories. A custom category that is still assigned to inventory cannot be removed until those items are changed to another category.</p>
      </div>

      <div class="panel">
        <h3>Storage Locations</h3>
        <p>Use More → Manage Storage Locations to create physical inventory locations such as Garage Shelf A, Booth Inventory or Storage Bin 3.</p>
        <p>When editing an item, choose its location from the Physical location dropdown. The Inventory location filter can then show only items stored in that location.</p>
        <p>A storage location that is currently assigned to inventory cannot be removed until those items are moved to another location.</p>
      </div>

      <div class="panel">
        <h3>Sources</h3>
        <p>Use Source type for the general acquisition method, such as Online Auction, Estate Sale or Facebook Marketplace.</p>
        <p>Use Online platform for sites such as ShopGoodwill, eBay, HiBid, LiveAuctioneers or Proxibid.</p>
        <p>The Inventory Source filter searches across source type, online platform and the entered source or sale name.</p>
      </div>

      <div class="panel">
        <h3>Inventory Status</h3>
        <p>Available means the item is ready to sell. Catalog statuses include Reserved, Needs Work, Listed, Personal / Not For Sale and Draft / Finish Cataloging. Sold is controlled automatically by the Sales Register and cannot be selected manually.</p>
        <p>The default Active inventory view hides Sold items. Use All statuses when you need to find historical inventory.</p>
      </div>

      <div class="panel">
        <h3>Inventory Filters</h3>
        <p>Inventory can be filtered by status, category, source and storage location. It can also be sorted by acquisition date, cost or asking price.</p>
        <p>Attention shortcuts help find unfinished catalog records, items needing work, items without pricing and items without photos.</p>
      </div>

      <div class="panel">
        <h3>Photos and Item History</h3>
        <p>Add photos from the camera or gallery. Useful photos include front, back, serial number, damage, repairs and identifying details.</p>
        <p>Item notes can be added to the history from the item detail screen so important changes remain attached to that item.</p>
      </div>

      <div class="panel">
        <h3>Deleting Inventory</h3>
        <p>An ordinary unsold item with no sales history can be deleted from its item detail screen.</p>
        <p>An item connected to sales or register history is protected from deletion. This prevents accounting history from being accidentally destroyed.</p>
      </div>

      <div class="panel">
        <h3>Price Tags & Avery Label Sheets</h3>
        <p>For a quick one-item tag, open an inventory item and use Print Price Tag. The tag contains the item name, asking price and internal SKU.</p>
        <p>For full sheets, use Inventory → Print Labels. The batch printer places each selected inventory item on its own physical label instead of wasting one sheet per item.</p>
        <p>Current sheet presets include Avery 22808, 22804, 22807, 22806, 5160 / 8160, 5162 / 8162, 5163 / 8163 and 5164 / 8164 families.</p>
        <p>You can select individual items, begin at a later label position on a partially used sheet, choose which item information appears, and make small horizontal or vertical printer-alignment corrections.</p>
        <p>Printing uses the normal browser and operating-system print dialog, so any printer already available to the device, including Wi-Fi or USB printers, can be selected there.</p>
      </div>
    </section>

    <div class="section-head"><div><h3>Selling and the Sales Register</h3><p>Record sales and keep inventory and money records connected.</p></div></div>

    <section class="grid-2">
      <div class="panel">
        <h3>Quick Sell From Inventory</h3>
        <p>Open an available item and choose Sell Item. The Sales Register opens with that item already added to the sale.</p>
        <p>The asking price is used as the starting sale price, but the price can be changed before completing the transaction.</p>
      </div>

      <div class="panel">
        <h3>Recording a Sale</h3>
        <p>The register can contain one or more inventory items. Confirm the sale date, prices, payment method, buyer information and optional reference information before completing the sale.</p>
        <p>Completing the transaction marks the inventory item Sold and creates the connected sales and register records.</p>
      </div>

      <div class="panel">
        <h3>Payment Methods</h3>
        <p>The register includes common payment methods such as Cash, Square, Cash App, Venmo, PayPal, Zelle and Check.</p>
        <p>Use More → Manage Payment Methods to add additional methods used by the business.</p>
      </div>

      <div class="panel">
        <h3>Cash and Change</h3>
        <p>When Cash is selected, enter the amount received from the customer. The register calculates change automatically.</p>
        <p>A cash sale cannot be completed when the amount received is less than the sale total.</p>
      </div>

      <div class="panel">
        <h3>Register History</h3>
        <p>Money → Register shows transaction date, payment method, number of items, total and status. Cash transactions also show cash received and change given.</p>
        <p>The daily payment breakdown groups the current day totals by the payment methods actually used.</p>
      </div>

      <div class="panel">
        <h3>Voiding a Sale</h3>
        <p>Use Void when a completed transaction needs to be reversed.</p>
        <p>Voiding marks the transaction and connected sales records Voided and restores the item to its previous inventory status when the item still belongs to that transaction.</p>
      </div>

      <div class="panel">
        <h3>Deleting a Voided Transaction</h3>
        <p>After a transaction has been voided, the Register offers Delete. This permanently removes the voided transaction and its linked voided sales records.</p>
        <p>The restored inventory item is not deleted. This is useful for removing test transactions or other voided records that should no longer remain in the register.</p>
      </div>
    </section>

    <div class="section-head"><div><h3>Calendar and Events</h3><p>Track where the business needs to be.</p></div></div>

    <section class="grid-2">
      <div class="panel">
        <h3>Events</h3>
        <p>Create events for fairs, festivals, pickups, booth sales and other business activity. Events can include dates, location, address, contact information, booth information, website and notes.</p>
      </div>

      <div class="panel">
        <h3>Google Calendar</h3>
        <p>Open an Organizer event and choose Add to Google Calendar when you want a copy in Google Calendar.</p>
        <p>The Organizer remains the main business calendar. Google Calendar export is one-way and does not synchronize changes back into the Organizer.</p>
      </div>
    </section>

    <div class="section-head"><div><h3>Money</h3><p>Track the money connected to the business.</p></div></div>

    <section class="grid-2">
      <div class="panel">
        <h3>Expenses</h3>
        <p>Record operating expenses such as repairs, parts, booth fees, fuel, parking, shipping, packaging and advertising.</p>
        <p>Inventory Purchase and Auction Premium costs attached to an item are treated as acquisition costs so they are not counted a second time as general expenses.</p>
      </div>

      <div class="panel">
        <h3>Mileage</h3>
        <p>Use the Mileage area to record business travel. Enter the date, miles and useful notes so the trip can be identified later.</p>
      </div>

      <div class="panel">
        <h3>Profit Information</h3>
        <p>The Organizer uses sale proceeds, item cost basis, selling costs and general expenses to calculate business totals shown on the Dashboard and Money screens.</p>
      </div>
    </section>

    <div class="section-head"><div><h3>Auctions and Sourcing</h3><p>Keep sourcing opportunities organized.</p></div></div>

    <section class="grid-2">
      <div class="panel">
        <h3>Tracking Auctions</h3>
        <p>Use More → Auctions to save online or upcoming auctions. Records can include the auction name, platform, dates and other sourcing information.</p>
      </div>

      <div class="panel">
        <h3>Connecting Inventory</h3>
        <p>When cataloging an item, the Tracked auction field can connect that inventory item back to an auction already stored in the Organizer.</p>
      </div>
    </section>

    <div class="section-head"><div><h3>Backup and Data Safety</h3><p>Protect the business records stored on this device.</p></div></div>

    <section class="grid-2">
      <div class="panel">
        <h3>Export Backup</h3>
        <p>Use More → Export Backup regularly. A full backup includes the Organizer records and stored photos.</p>
        <p>Keep backup copies somewhere outside this browser and preferably outside this device.</p>
      </div>

      <div class="panel">
        <h3>Import Backup</h3>
        <p>Use Import Backup when business data needs to be restored from an Organizer backup file. Review the selected backup carefully before replacing or restoring important data.</p>
      </div>

      <div class="panel">
        <h3>CSV Exports</h3>
        <p>Inventory, Sales, Expenses and Mileage can be exported as CSV files for spreadsheets, bookkeeping or external record keeping.</p>
      </div>

      <div class="panel">
        <h3>Persistent Storage</h3>
        <p>More → Request Persistent Storage asks the browser to give the Organizer stronger protection against automatic storage cleanup when supported.</p>
        <p>Persistent storage is useful protection, but it is not a replacement for regular backups.</p>
      </div>
    </section>

    <div class="section-head"><div><h3>Common Workflows</h3><p>Quick reference for everyday tasks.</p></div></div>

    <section class="grid-2">
      <div class="panel">
        <h3>New Item to Sale</h3>
        <p><strong>1.</strong> Catalog the item.</p>
        <p><strong>2.</strong> Add photos, identifiers, category, source and location.</p>
        <p><strong>3.</strong> Enter cost and asking price.</p>
        <p><strong>4.</strong> When sold, open the item and choose Sell Item.</p>
        <p><strong>5.</strong> Complete the sale in the Register.</p>
      </div>

      <div class="panel">
        <h3>Undo a Sale</h3>
        <p><strong>1.</strong> Open Money → Register.</p>
        <p><strong>2.</strong> Find the transaction.</p>
        <p><strong>3.</strong> Choose Void.</p>
        <p><strong>4.</strong> Confirm the item has returned to inventory.</p>
        <p><strong>5.</strong> If the voided record should be removed permanently, choose Delete.</p>
      </div>

      <div class="panel">
        <h3>Organize Physical Inventory</h3>
        <p><strong>1.</strong> Create real storage locations under More.</p>
        <p><strong>2.</strong> Assign each item a Physical location.</p>
        <p><strong>3.</strong> Use the Inventory Location filter whenever an item needs to be found physically.</p>
      </div>

      <div class="panel">
        <h3>Print Batch Labels</h3>
        <p><strong>1.</strong> Open Inventory and apply any filters you want before printing.</p>
        <p><strong>2.</strong> Choose Print Labels.</p>
        <p><strong>3.</strong> Select the Avery-style template loaded in the printer. Current presets include Avery 22808, 22804, 22807, 22806, 5160 / 8160, 5162 / 8162, 5163 / 8163 and 5164 / 8164 families.</p>
        <p><strong>4.</strong> Check the inventory items that should receive labels. Each selected item prints on its own label.</p>
        <p><strong>5.</strong> Use Start at label position when reusing a partially used sheet. Earlier positions are left blank.</p>
        <p><strong>6.</strong> Choose whether each label shows Item Name, Price, SKU and Storage Location.</p>
        <p><strong>7.</strong> Leave Horizontal and Vertical offsets at zero unless your printer needs a small alignment correction.</p>
        <p><strong>8.</strong> Choose Print Selected Labels, then use the normal browser/system print dialog to select a Wi-Fi or USB printer.</p>
        <p><strong>9.</strong> Print with Letter / 8.5 × 11 paper at 100% or Actual Size. Turn browser headers and footers off and do not use Fit to Page.</p>
        <p><strong>10.</strong> Before using an Avery sheet for the first time, print on plain paper and hold it behind the label sheet against a light to confirm alignment.</p>
      </div>

      <div class="panel">
        <h3>Regular Backup Routine</h3>
        <p>Create a fresh full backup after meaningful inventory or sales work and keep copies somewhere safe outside the browser.</p>
      </div>
    </section>

    <div class="section-head">
      <div><h3>Need to Return?</h3><p>The User Guide can always be opened again from More.</p></div>
      <button class="btn" id="guideBackBottom" type="button">Back to More</button>
    </div>
  `;

  $("#guideBack").onclick=()=>navigate("more");
  $("#guideBackBottom").onclick=()=>navigate("more");
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
        <div class="hero-actions"><button class="btn secondary" data-csv="items">Inventory CSV</button><button class="btn secondary" data-csv="sales">Sales CSV</button><button class="btn secondary" data-csv="expenses">Expenses CSV</button><button class="btn secondary" data-csv="mileage">Mileage CSV</button></div>
      </div>
      <div class="panel">
        <h3>Storage</h3>
        <p style="color:var(--muted);line-height:1.55">Photos are compressed before local storage. Persistent browser storage is requested where supported.</p>
        <button class="btn ghost" id="requestStorage">Request Persistent Storage</button>
      </div>
<div class="panel">
  <h3>Payment methods</h3>
  <p style="color:var(--muted);line-height:1.55">Manage the payment methods available in the Sales Register dropdown.</p>
  <button class="btn secondary" id="managePaymentMethods">Manage Payment Methods</button>
</div>
  <div class="panel">
    <h3>User Guide</h3>
    <p style="color:var(--muted);line-height:1.55">Instructions for inventory, sales, calendar, money, backups and everyday business workflows.</p>
    <button class="btn secondary" id="openUserGuide">Open User Guide</button>
  </div>
  <div class="panel">
    <h3>Storage locations</h3>
    <p style="color:var(--muted);line-height:1.55">Manage the physical locations available when cataloging inventory.</p>
    <button class="btn secondary" id="manageStorageLocations">Manage Storage Locations</button>
  </div>
  <div class="panel">
    <h3>Inventory categories</h3>
    <p style="color:var(--muted);line-height:1.55">Manage the categories available when cataloging inventory.</p>
    <button class="btn secondary" id="manageItemCategories">Manage Categories</button>
  </div>
    </section>
  `;
  $("#addAuctionTop").onclick=()=>openAuctionModal();
  $("#manageAuctions").onclick=()=>renderAuctionManager();
  $("#exportBackup").onclick=exportBackup;
  $("#importBackup").onchange=importBackupFile;
  $$("[data-csv]").forEach(b=>b.onclick=()=>exportCSV(b.dataset.csv));
  $("#managePaymentMethods").onclick=()=>openPaymentMethodsModal();
  $("#openUserGuide").onclick=()=>navigate("guide");
  $("#manageStorageLocations").onclick=()=>openStorageLocationsModal();
$("#manageItemCategories").onclick=()=>openItemCategoriesModal();
  $("#requestStorage").onclick=async()=>toast((await DB.requestPersistentStorage())?"Persistent storage granted.":"Persistent storage not granted or unsupported.");
}
async function getStorageLocations(){
  const [row,items]=await Promise.all([
    DB.getOne("settings","storageLocations"),
    DB.getAll("items")
  ]);

  const custom=Array.isArray(row?.value)
    ? row.value.map(v=>String(v||"").trim()).filter(Boolean)
    : [];

  const used=items
    .map(item=>String(item.storageLocation||"").trim())
    .filter(Boolean);

  const all=[...custom,...used];

  return all.filter((value,index)=>
    all.findIndex(x=>x.toLowerCase()===value.toLowerCase())===index
  ).sort((a,b)=>a.localeCompare(b));
}

async function openStorageLocationsModal(){
  const [row,items]=await Promise.all([
    DB.getOne("settings","storageLocations"),
    DB.getAll("items")
  ]);

  let custom=Array.isArray(row?.value)
    ? row.value.map(v=>String(v||"").trim()).filter(Boolean)
    : [];

  openModal(`
    <div class="modal-head">
      <div>
        <div class="eyebrow">INVENTORY</div>
        <h2>Storage Locations</h2>
      </div>
      <button class="close-btn" data-close type="button">×</button>
    </div>

    <div class="modal-body">
      <div class="record-section">
        <div class="record-section-title">
          <span>📦</span>
          <div>
            <strong>Storage locations</strong>
            <small>Create the physical places where inventory is kept.</small>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label>New storage location</label>
            <input class="input" id="newStorageLocation" autocomplete="off" placeholder="Garage Shelf A">
          </div>
          <div class="field">
            <label>&nbsp;</label>
            <button class="btn" id="addStorageLocation" type="button">Add Location</button>
          </div>
        </div>

        <div class="list" id="storageLocationList"></div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" data-close type="button">Done</button>
    </div>
  `);

  const input=$("#newStorageLocation");
  const list=$("#storageLocationList");

  const save=()=>DB.put("settings",{
    key:"storageLocations",
    value:custom,
    updatedAt:new Date().toISOString()
  });

  const usageCount=name=>items.filter(item=>
    String(item.storageLocation||"").trim().toLowerCase()===name.toLowerCase()
  ).length;

  const renderList=()=>{
    list.innerHTML=custom.length
      ? custom.map((name,index)=>{
          const count=usageCount(name);
          return `
            <div class="list-card">
              <div>
                <strong>${esc(name)}</strong>
                <p>${count} inventory item${count===1?"":"s"}</p>
              </div>
              <button class="btn danger small" type="button" data-remove-storage="${index}">Remove</button>
            </div>
          `;
        }).join("")
      : empty("No custom storage locations yet.");

    $$("[data-remove-storage]").forEach(button=>{
      button.onclick=async()=>{
        const index=Number(button.dataset.removeStorage);
        const name=custom[index];

        if(usageCount(name)>0){
          alert("That storage location is currently assigned to inventory. Move those items before removing it.");
          return;
        }

        custom.splice(index,1);
        await save();
        renderList();
      };
    });
  };

  const addLocation=async()=>{
    const name=String(input.value||"").trim();
    if(!name)return;

    const known=[
      ...custom,
      ...items.map(item=>String(item.storageLocation||"").trim()).filter(Boolean)
    ];

    if(known.some(value=>value.toLowerCase()===name.toLowerCase())){
      alert("That storage location already exists.");
      input.select();
      return;
    }

    custom.push(name);
    await save();
    input.value="";
    renderList();
    input.focus();
    toast("Storage location added.");
  };

  $("#addStorageLocation").onclick=addLocation;

  input.onkeydown=e=>{
    if(e.key==="Enter"){
      e.preventDefault();
      addLocation();
    }
  };

  renderList();
}

async function getPaymentMethods(){
  const row=await DB.getOne("settings","paymentMethods");
  const custom=Array.isArray(row?.value)
    ? row.value.map(v=>String(v||"").trim()).filter(Boolean)
    : [];
  const all=[...DEFAULT_PAYMENT_METHODS,...custom];

  return all.filter((value,index)=>
    all.findIndex(x=>x.toLowerCase()===value.toLowerCase())===index
  );
}

async function openPaymentMethodsModal(){
  const row=await DB.getOne("settings","paymentMethods");
  let custom=Array.isArray(row?.value)
    ? row.value.map(v=>String(v||"").trim()).filter(Boolean)
    : [];

  openModal(`
    <div class="modal-head">
      <div>
        <div class="eyebrow">SALES REGISTER</div>
        <h2>Payment Methods</h2>
      </div>
      <button class="close-btn" data-close type="button">×</button>
    </div>

    <div class="modal-body">
      <div class="panel">
        <h3>Built-in methods</h3>
        <p style="color:var(--muted);line-height:1.55">
          ${DEFAULT_PAYMENT_METHODS.map(esc).join(" · ")}
        </p>
      </div>

      <div class="record-section">
        <div class="record-section-title">
          <span>💳</span>
          <div>
            <strong>Custom payment methods</strong>
            <small>Add payment services or methods used by the business.</small>
          </div>
        </div>

        <div class="form-grid">
          ${field("New payment method","newPaymentMethod","")}
          <div class="field">
            <label>&nbsp;</label>
            <button class="btn" id="addPaymentMethod" type="button">Add Payment Method</button>
          </div>
        </div>

        <div class="list" id="customPaymentMethodList"></div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" data-close type="button">Done</button>
    </div>
  `);

  const input=$("#newPaymentMethod");
  const list=$("#customPaymentMethodList");

  const save=()=>DB.put("settings",{
    key:"paymentMethods",
    value:custom,
    updatedAt:new Date().toISOString()
  });

  const renderList=()=>{
    list.innerHTML=custom.length
      ? custom.map((name,index)=>`
          <div class="list-card">
            <div><strong>${esc(name)}</strong></div>
            <button class="btn danger small" type="button" data-remove-payment="${index}">Remove</button>
          </div>
        `).join("")
      : empty("No custom payment methods yet.");

    $$("[data-remove-payment]",list).forEach(button=>{
      button.onclick=async()=>{
        custom.splice(Number(button.dataset.removePayment),1);
        await save();
        renderList();
      };
    });
  };

  const addMethod=async()=>{
    const name=String(input.value||"").trim();
    if(!name)return;

    const existing=[...DEFAULT_PAYMENT_METHODS,...custom];

    if(existing.some(x=>x.toLowerCase()===name.toLowerCase())){
      alert("That payment method already exists.");
      input.select();
      return;
    }

    custom.push(name);
    await save();
    input.value="";
    renderList();
    input.focus();
    toast("Payment method added.");
  };

  $("#addPaymentMethod").onclick=addMethod;

  input.onkeydown=e=>{
    if(e.key==="Enter"){
      e.preventDefault();
      addMethod();
    }
  };

  renderList();
}

async function getItemCategories(){
  const [row,items]=await Promise.all([
    DB.getOne("settings","itemCategories"),
    DB.getAll("items")
  ]);

  const custom=Array.isArray(row?.value)
    ? row.value.map(v=>String(v||"").trim()).filter(Boolean)
    : [];

  const used=items
    .map(item=>String(item.category||"").trim())
    .filter(Boolean);

  const all=[...DEFAULT_ITEM_CATEGORIES,...custom,...used];

  return all.filter((value,index)=>
    all.findIndex(x=>x.toLowerCase()===value.toLowerCase())===index
  );
}

async function openItemCategoriesModal(){
  const [row,items]=await Promise.all([
    DB.getOne("settings","itemCategories"),
    DB.getAll("items")
  ]);

  let custom=Array.isArray(row?.value)
    ? row.value.map(v=>String(v||"").trim()).filter(Boolean)
    : [];

  openModal(`
    <div class="modal-head">
      <div>
        <div class="eyebrow">INVENTORY</div>
        <h2>Inventory Categories</h2>
      </div>
      <button class="close-btn" data-close type="button">×</button>
    </div>

    <div class="modal-body">
      <div class="panel">
        <h3>Built-in categories</h3>
        <p style="color:var(--muted);line-height:1.55">
          ${DEFAULT_ITEM_CATEGORIES.map(esc).join(" · ")}
        </p>
      </div>

      <div class="record-section">
        <div class="record-section-title">
          <span>🏷️</span>
          <div>
            <strong>Custom categories</strong>
            <small>Add categories that fit the inventory this business actually carries.</small>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label>New category</label>
            <input class="input" id="newItemCategory" autocomplete="off">
          </div>

          <div class="field">
            <label>&nbsp;</label>
            <button class="btn" id="addItemCategory" type="button">Add Category</button>
          </div>
        </div>

        <div class="list" id="customItemCategoryList"></div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" data-close type="button">Done</button>
    </div>
  `);

  const input=$("#newItemCategory");
  const list=$("#customItemCategoryList");

  const save=()=>DB.put("settings",{
    key:"itemCategories",
    value:custom,
    updatedAt:new Date().toISOString()
  });

  const usageCount=name=>items.filter(item=>
    String(item.category||"").trim().toLowerCase()===name.toLowerCase()
  ).length;

  const renderList=()=>{
    list.innerHTML=custom.length
      ? custom.map((name,index)=>{
          const count=usageCount(name);
          return `
            <div class="list-card">
              <div>
                <strong>${esc(name)}</strong>
                <p>${count} inventory item${count===1?"":"s"}</p>
              </div>
              <button class="btn danger small" type="button" data-remove-category="${index}">Remove</button>
            </div>
          `;
        }).join("")
      : empty("No custom categories yet.");

    $$("[data-remove-category]",list).forEach(button=>{
      button.onclick=async()=>{
        const index=Number(button.dataset.removeCategory);
        const name=custom[index];

        if(usageCount(name)>0){
          alert("That category is currently assigned to inventory items. Change those items to another category before removing it.");
          return;
        }

        custom.splice(index,1);
        await save();
        renderList();
      };
    });
  };

  const addCategory=async()=>{
    const name=String(input.value||"").trim();
    if(!name)return;

    const existing=[...DEFAULT_ITEM_CATEGORIES,...custom];

    if(existing.some(x=>x.toLowerCase()===name.toLowerCase())){
      alert("That category already exists.");
      input.select();
      return;
    }

    custom.push(name);
    await save();
    input.value="";
    renderList();
    input.focus();
    toast("Category added.");
  };

  $("#addItemCategory").onclick=addCategory;

  input.onkeydown=e=>{
    if(e.key==="Enter"){
      e.preventDefault();
      addCategory();
    }
  };

  renderList();
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
<button class="action-sheet-btn" id="qaSale"><span>🧾</span><div><strong>Record Sale</strong><small>Find by SKU, barcode or serial and mark sold</small></div></button>
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
$("#qaSale").onclick=()=>{closeModal();openSaleRegisterModal();};
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
async function exportSalesCSV(){
  const [sales,items,transactions]=await Promise.all([
    DB.getAll("sales"),
    DB.getAll("items"),
    DB.getAll("transactions")
  ]);

  if(!sales.length){
    toast("Nothing to export.");
    return;
  }

  const itemMap=new Map(items.map(item=>[item.id,item]));
  const transactionMap=new Map(transactions.map(transaction=>[transaction.id,transaction]));

  const headers=[
    "Date",
    "Status",
    "Sale ID",
    "Transaction ID",
    "SKU",
    "Item Name",
    "Sold Price",
    "Shipping Charged",
    "Selling Fees",
    "Payment Fees",
    "Outbound Shipping Cost",
    "Net Proceeds",
    "Cost Basis",
    "Profit",
    "Payment Method",
    "Buyer Name",
    "External Transaction ID",
    "Event ID",
    "Transaction Total",
    "Cash Received",
    "Change Due",
    "Notes"
  ];

  const rows=sales
    .slice()
    .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))
    .map(sale=>{
      const item=itemMap.get(sale.itemId)||{};
      const transaction=transactionMap.get(sale.transactionId)||{};

      return [
        sale.date||"",
        sale.status||"",
        sale.id||"",
        sale.transactionId||"",
        item.sku||"",
        item.name||"",
        num(sale.soldPrice),
        num(sale.shippingCharged),
        num(sale.sellingFees),
        num(sale.paymentFees),
        num(sale.outboundShippingCost),
        saleNetProceeds(sale),
        num(sale.costBasis),
        saleProfit(sale),
        sale.paymentMethod||transaction.paymentMethod||"",
        sale.buyerName||transaction.buyerName||"",
        sale.externalTransactionId||transaction.externalTransactionId||"",
        sale.eventId||transaction.eventId||"",
        num(transaction.total),
        transaction.paymentMethod==="Cash" ? num(transaction.cashReceived) : "",
        transaction.paymentMethod==="Cash" ? num(transaction.changeDue) : "",
        sale.notes||transaction.notes||""
      ];
    });

  const csv=[headers,...rows]
    .map(row=>row.map(csvCell).join(","))
    .join("\n");

  downloadFile(`sales-${today()}.csv`,csv,"text/csv");
  toast("Sales CSV exported.");
}

async function exportCSV(store){
  if(store==="sales"){
    await exportSalesCSV();
    return;
  }
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
function attentionCard(label,value,sub,icon,filter){return `<button class="attention-card" data-jump="inventory" data-attention="${esc(filter)}"><span class="attention-icon">${icon}</span><span class="attention-number">${value}</span><strong>${label}</strong><small>${sub}</small></button>`;}
function itemCost(i){
  const repair=num(i.estimatedRepairCost);
  const explicit=num(i.totalLandedCost);
  if(explicit>0)return explicit+repair;
  const detailed=num(i.purchasePrice)+num(i.buyerPremium)+num(i.salesTax)+num(i.shippingCost)+num(i.handlingCost)+num(i.otherAcquisitionCosts);
  if(detailed>num(i.purchasePrice))return detailed+repair;
  return num(i.purchasePrice)+num(i.acquisitionCosts)+repair;
}
function isCapitalizedAcquisitionExpense(e){
  if(!e || !e.itemId)return false;
  return e.category==="Inventory Purchase" || e.category==="Auction Premium";
}
function saleCosts(s){
  return num(s.sellingFees)+num(s.paymentFees)+num(s.outboundShippingCost);
}
function saleNetProceeds(s){
  return num(s.soldPrice)+num(s.shippingCharged)-saleCosts(s);
}
function saleProfit(s){
  return saleNetProceeds(s)-num(s.costBasis);
}
function stat(label,value,sub="",cls=""){return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value ${cls}">${value}</div>${sub?`<div class="stat-sub">${sub}</div>`:""}</div>`;}
function quick(icon,label,route){return `<button class="quick-card" data-jump="${route}"><span class="quick-icon">${icon}</span><strong>${label}</strong></button>`;}
function empty(text){return `<div class="empty">${esc(text)}</div>`;}
function kv(k,v){return `<p><strong>${esc(k)}:</strong> ${esc(v||"—")}</p>`;}
function googleCalendarDate(value){
  if(!value)return "";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return "";
  return d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z");
}

function openGoogleCalendarEvent(event){
  const start=event.startDate ? new Date(event.startDate) : null;

  if(!start || Number.isNaN(start.getTime())){
    alert("Add a valid start date and time before sending this event to Google Calendar.");
    return;
  }

  let end=event.endDate ? new Date(event.endDate) : null;
  if(!end || Number.isNaN(end.getTime()) || end<=start){
    end=new Date(start.getTime()+60*60*1000);
  }

  const details=[
    event.type ? `Type: ${event.type}` : "",
    event.contact ? `Contact: ${event.contact}` : "",
    event.boothNumber ? `Booth: ${event.boothNumber}` : "",
    event.website ? `Website: ${event.website}` : "",
    event.notes || ""
  ].filter(Boolean).join("\n");

  const location=[event.location,event.address].filter(Boolean).join(" - ");

  const params=new URLSearchParams({
    action:"TEMPLATE",
    text:event.title||"Business Event",
    dates:`${googleCalendarDate(start)}/${googleCalendarDate(end)}`,
    details,
    location
  });

  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`,"_blank","noopener");
}
function eventListItem(e){return `<div class="list-card" data-event-id="${e.id}"><div><div class="badge"><span class="dot" style="background:${safeColor(e.color)}"></span>${esc(e.type||"Event")}</div><h4>${esc(e.title)}</h4><p>${prettyDateTime(e.startDate)}${e.location?` · ${esc(e.location)}`:""}</p></div></div>`;}
function auctionListItem(a){const when=a.endDateTime?prettyDateTime(a.endDateTime):prettyDate(a.date);return `<div class="list-card"><div><div class="badge"><span class="dot" style="background:${safeColor(a.color||"#f7c75d")}"></span>${esc(a.platform||"Auction")}</div><h4>${esc(a.name)}</h4><p>${when}${a.location?` · ${esc(a.location)}`:""}${a.status?` · ${esc(a.status)}`:""}</p></div></div>`;}
async function findInventoryByScannedCode(value){
  const code=String(value||"").trim();
  if(!code)return null;

  const items=await DB.getAll("items");
  const target=code.toLowerCase();

  return items.find(item=>
    String(item.sku||"").trim().toLowerCase()===target
  )||null;
}

async function openInventoryCodeScanner(preferredDeviceId=""){
  if(typeof ZXingBrowser==="undefined"){
    alert("The barcode scanner library is not available.");
    return;
  }

  openModal(`
    <div class="modal-head">
      <div>
        <div class="eyebrow">INVENTORY</div>
        <h2>Scan Barcode or QR Code</h2>
      </div>
      <button class="close-btn" id="scannerClose" type="button">×</button>
    </div>

    <div class="modal-body">
      <div class="record-section">
        <div class="record-section-title">
          <span>▦</span>
          <div>
            <strong>Point the camera at an inventory label</strong>
            <small>Scan a Code 128 barcode or QR code containing an internal ML SKU.</small>
          </div>
        </div>

        <div class="field" id="scannerCameraPicker" style="display:none;margin:0 0 10px">
          <label>Camera</label>
          <select class="select" id="scannerCameraSelect"></select>
          <small style="color:var(--muted)">If one rear lens looks blurry, try another camera here.</small>
        </div>
        <div class="camera-stage" style="position:relative">
          <video id="inventoryScannerVideo" playsinline muted style="display:block;width:100%;max-height:62vh;object-fit:contain;background:#000;border-radius:18px"></video>
          <div id="scannerCameraControls" style="position:absolute;left:10px;right:10px;bottom:10px;z-index:20;display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
            <button class="btn secondary small" id="scannerTorchOverlay" type="button" disabled style="background:rgba(18,24,32,.92)">💡 Light On</button>
            <button class="btn secondary small" id="scannerRefocusOverlay" type="button" disabled style="background:rgba(18,24,32,.92)">◎ Refocus</button>
          </div>
        </div>

        <p id="inventoryScannerStatus" style="color:var(--muted);line-height:1.5;margin:12px 0 0">Starting camera…</p>
      </div>

      <div class="record-section">
        <div class="record-section-title">
          <span>⌨</span>
          <div>
            <strong>Manual fallback</strong>
            <small>Enter the SKU if the camera cannot be used.</small>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label>Internal SKU</label>
            <input class="input" id="scannerManualSku" autocomplete="off" placeholder="ML-000123">
          </div>
          <div class="field">
            <label>&nbsp;</label>
            <button class="btn secondary" id="scannerManualFind" type="button">Find Item</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn secondary" id="scannerCancel" type="button">Cancel</button>
    </div>
  `);

  const video=$("#inventoryScannerVideo");
  const status=$("#inventoryScannerStatus");
  const manual=$("#scannerManualSku");
  const cameraPicker=$("#scannerCameraPicker");
  const cameraSelect=$("#scannerCameraSelect");
  let controls=null;
  let finished=false;
  let lastCode="";
  let cameraDetail="";
  let cameraTrack=null;
  let torchOn=false;
  let cameraCapabilities={};
  let nativeBarcodeDetector=null;
  let nativeBarcodeTimer=null;

  const stopScanner=()=>{
    if(nativeBarcodeTimer){
      clearTimeout(nativeBarcodeTimer);
      nativeBarcodeTimer=null;
    }
    nativeBarcodeDetector=null;
    if(cameraTrack && torchOn){
      try{cameraTrack.applyConstraints({advanced:[{torch:false}]});}catch(err){}
    }
    torchOn=false;
    cameraTrack=null;
    cameraCapabilities={};
    if(controls){
      try{controls.stop();}catch(err){}
      controls=null;
    }

    if(video && video.srcObject){
      try{
        video.srcObject.getTracks().forEach(track=>track.stop());
      }catch(err){}
      video.srcObject=null;
    }
  };

  const updateTorchButton=()=>{
    const button=$("#scannerTorchOverlay");
    if(!button)return;
    button.textContent=torchOn?"💡 Light Off":"💡 Light On";
  };

  const toggleTorch=async()=>{
    if(!cameraTrack || !cameraCapabilities.torch)return;

    try{
      torchOn=!torchOn;
      await cameraTrack.applyConstraints({advanced:[{torch:torchOn}]});
      updateTorchButton();
      status.textContent=torchOn
        ?"Camera light is on. Hold the code steady and avoid glare."
        :"Camera light is off. Hold the code steady inside the camera view.";
    }catch(err){
      torchOn=false;
      updateTorchButton();
      console.warn("Scanner torch control unavailable",err);
      status.textContent="This camera could not change the light setting.";
    }
  };

  const refocusScanner=async()=>{
    if(!cameraTrack)return;

    try{
      const modes=Array.isArray(cameraCapabilities.focusMode)
        ? cameraCapabilities.focusMode
        : [];

      if(modes.includes("single-shot")){
        await cameraTrack.applyConstraints({advanced:[{focusMode:"single-shot"}]});
        status.textContent="Refocusing camera…";

        setTimeout(async()=>{
          try{
            if(cameraTrack && modes.includes("continuous")){
              await cameraTrack.applyConstraints({advanced:[{focusMode:"continuous"}]});
            }
            if(!finished)status.textContent="Camera refocused. Hold the code steady.";
          }catch(err){}
        },700);
      }else if(modes.includes("continuous")){
        await cameraTrack.applyConstraints({advanced:[{focusMode:"continuous"}]});
        status.textContent="Autofocus refreshed. Hold the code steady.";
      }else{
        status.textContent="This camera does not expose manual focus control.";
      }
    }catch(err){
      console.warn("Scanner refocus unavailable",err);
      status.textContent="The camera could not be refocused manually.";
    }
  };


  const cancel=()=>{
    finished=true;
    stopScanner();
    closeModal();
  };

  const openMatchedItem=async code=>{
    const clean=String(code||"").trim();
    if(!clean)return false;

    const item=await findInventoryByScannedCode(clean);

    if(!item){
      status.textContent=`No inventory item found with SKU ${clean}. Keep scanning or enter another SKU.`;
      return false;
    }

    finished=true;
    stopScanner();
    closeModal();
    await openItemDetail(item.id);
    return true;
  };

  $("#scannerClose").onclick=cancel;
  $("#scannerCancel").onclick=cancel;
  $("#scannerTorchOverlay").onclick=toggleTorch;
  $("#scannerRefocusOverlay").onclick=refocusScanner;

  $("#scannerManualFind").onclick=()=>openMatchedItem(manual.value);

  manual.onkeydown=e=>{
    if(e.key==="Enter"){
      e.preventDefault();
      openMatchedItem(manual.value);
    }
  };

  try{
    const reader=new ZXingBrowser.BrowserMultiFormatReader();

    const videoConstraints=preferredDeviceId
      ? {
          deviceId:{exact:preferredDeviceId},
          width:{ideal:1920},
          height:{ideal:1080},
          frameRate:{ideal:30}
        }
      : {
          facingMode:{ideal:"environment"},
          width:{ideal:1920},
          height:{ideal:1080},
          frameRate:{ideal:30}
        };

    controls=await reader.decodeFromConstraints({video:videoConstraints,audio:false},
      video,
      async(result,error)=>{
        if(finished || !result)return;

        const code=String(result.getText?result.getText():result.text||"").trim();
        if(!code || code===lastCode)return;

        lastCode=code;
        status.textContent=`Scanned ${code}. Looking up inventory…`;

        const matched=await openMatchedItem(code);
        if(!matched){
          setTimeout(()=>{
            if(!finished)lastCode="";
          },1200);
        }
      }
    );

    const stream=video.srcObject;
    const track=stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;

    if(track){
      cameraTrack=track;
      try{
        const capabilities=typeof track.getCapabilities==="function" ? track.getCapabilities() : {};
        cameraCapabilities=capabilities;

        const torchButton=$("#scannerTorchOverlay");
        const refocusButton=$("#scannerRefocusOverlay");

        if(torchButton){
          torchButton.disabled=!capabilities.torch;
          torchButton.title=capabilities.torch
            ?"Turn the rear camera light on or off"
            :"Camera light control is not available on this device";
        }

        if(refocusButton){
          const modes=Array.isArray(capabilities.focusMode)?capabilities.focusMode:[];
          refocusButton.disabled=!(modes.includes("continuous") || modes.includes("single-shot"));
        }

        if(Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes("continuous")){
          await track.applyConstraints({advanced:[{focusMode:"continuous"}]});
        }

        const settings=typeof track.getSettings==="function" ? track.getSettings() : {};

        try{
          if(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices){
            const devices=(await navigator.mediaDevices.enumerateDevices())
              .filter(device=>device.kind==="videoinput");

            if(devices.length>1 && cameraPicker && cameraSelect){
              const activeDeviceId=String(settings.deviceId||"");

              cameraSelect.innerHTML="";

              devices.forEach((device,index)=>{
                const option=document.createElement("option");
                option.value=device.deviceId;
                option.textContent=device.label||`Camera ${index+1}`;
                cameraSelect.appendChild(option);
              });

              if(activeDeviceId && devices.some(device=>device.deviceId===activeDeviceId)){
                cameraSelect.value=activeDeviceId;
              }

              cameraPicker.style.display="block";

              cameraSelect.onchange=()=>{
                const nextDeviceId=String(cameraSelect.value||"");

                if(!nextDeviceId || nextDeviceId===activeDeviceId)return;

                finished=true;
                stopScanner();
                closeModal();
                openInventoryCodeScanner(nextDeviceId);
              };

              cameraDetail+=` ${devices.length} cameras available.`;
            }
          }
        }catch(err){
          console.warn("Camera enumeration unavailable",err);
        }
        if(settings.width && settings.height){
          cameraDetail+=` Camera: ${settings.width} × ${settings.height}.`;
        }

        if(settings.focusMode){
          cameraDetail+=` Focus: ${settings.focusMode}.`;
        }
      }catch(err){
        console.warn("Scanner camera focus enhancement unavailable",err);
      }
    }

    if("BarcodeDetector" in window){
      try{
        let nativeFormats=["qr_code","code_128"];

        if(typeof window.BarcodeDetector.getSupportedFormats==="function"){
          const supported=await window.BarcodeDetector.getSupportedFormats();
          nativeFormats=nativeFormats.filter(format=>supported.includes(format));
        }

        if(nativeFormats.length){
          nativeBarcodeDetector=new window.BarcodeDetector({formats:nativeFormats});

          const runNativeBarcodeScan=async()=>{
            if(finished || !nativeBarcodeDetector)return;

            try{
              if(video.readyState>=2){
                const results=await nativeBarcodeDetector.detect(video);

                if(results && results.length){
                  const code=String(results[0].rawValue||"").trim();

                  if(code && code!==lastCode){
                    lastCode=code;
                    status.textContent=`Detected ${code}. Looking up inventory…`;

                    const matched=await openMatchedItem(code);

                    if(!matched){
                      setTimeout(()=>{
                        if(!finished)lastCode="";
                      },1200);
                    }
                  }
                }
              }
            }catch(err){
              if(!finished){
                console.debug("Native barcode frame not decoded",err);
              }
            }

            if(!finished && nativeBarcodeDetector){
              nativeBarcodeTimer=setTimeout(runNativeBarcodeScan,180);
            }
          };

          nativeBarcodeTimer=setTimeout(runNativeBarcodeScan,180);
          cameraDetail+=` Native detector: ${nativeFormats.join(" + ")}.`;
        }
      }catch(err){
        console.warn("Native BarcodeDetector could not start",err);
        nativeBarcodeDetector=null;
      }
    }

    if(!finished){
      status.textContent=`Camera ready.${cameraDetail} Hold the barcode or QR code steady inside the camera view.`;
    }else{
      stopScanner();
    }
  }catch(err){
    console.warn("Inventory scanner could not start",err);
    stopScanner();
    status.textContent="Camera scanning is unavailable. Check camera permission or use the manual SKU field below.";
  }
}


function makeInventoryCodeDataUrl(value,type){
  const text=String(value||"").trim();
  if(!text || typeof bwipjs==="undefined")return "";

  const canvas=document.createElement("canvas");

  try{
    const config={
      bcid:type==="qr"?"qrcode":"code128",
      text,
      scale:type==="qr"?3:2,
      paddingwidth:0,
      paddingheight:0
    };

    if(type!=="qr"){
      config.height=8;
      config.includetext=false;
    }

    bwipjs.toCanvas(canvas,config);
    return canvas.toDataURL("image/png");
  }catch(err){
    console.warn("Could not generate inventory code",err);
    return "";
  }
}


function openLabelSheetPrinter(items){
  const printable=Array.isArray(items)?items.filter(Boolean):[];

  if(!printable.length){
    alert("There are no inventory items in the current filtered view to print.");
    return;
  }

  const templates=Object.values(LABEL_SHEET_TEMPLATES);

  openModal(`
    <div class="modal-head">
      <div>
        <div class="eyebrow">INVENTORY LABELS</div>
        <h2>Print Label Sheets</h2>
      </div>
      <button class="close-btn" data-close type="button">×</button>
    </div>

    <div class="modal-body">
      <div class="record-section">
        <div class="record-section-title">
          <span>🏷</span>
          <div>
            <strong>Label sheet</strong>
            <small>Choose the Avery-style sheet loaded in the printer.</small>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label>Template</label>
            <select class="select" id="labelTemplate">
              ${templates.map(t=>`<option value="${esc(t.id)}">${esc(t.name)} — ${esc(t.description)}</option>`).join("")}
            </select>
          </div>

          <div class="field">
            <label>Start at label position</label>
            <input class="input" id="labelStartPosition" type="number" min="1" value="1">
          </div>
        </div>

        <p id="labelTemplateInfo" style="color:var(--muted);line-height:1.5;margin-bottom:0"></p>
      </div>

      <div class="record-section">
        <div class="record-section-title">
          <span>☑</span>
          <div>
            <strong>Items to print</strong>
            <small>The list below comes from the inventory filters currently on screen.</small>
          </div>
        </div>

        <div class="hero-actions" style="margin-top:0;margin-bottom:14px">
          <button class="btn secondary small" id="labelSelectAll" type="button">Select All</button>
          <button class="btn ghost small" id="labelSelectNone" type="button">Select None</button>
        </div>

        <div class="list" id="labelItemList">
          ${printable.map(item=>`
            <label class="list-card" style="cursor:pointer">
              <input type="checkbox" data-label-item="${esc(item.id)}" checked>
              <div style="flex:1">
                <strong>${esc(item.name||"Untitled Item")}</strong>
                <p>${esc(item.sku||"No SKU")} · ${money(item.askingPrice)}</p>
              </div>
            </label>
          `).join("")}
        </div>
      </div>

      <div class="record-section">
        <div class="record-section-title">
          <span>✎</span>
          <div>
            <strong>Label contents</strong>
            <small>Choose what appears on each individual item label.</small>
          </div>
        </div>

        <div class="form-grid">
          <label class="field"><span>Item name</span><input id="labelShowName" type="checkbox" checked></label>
          <label class="field"><span>Price</span><input id="labelShowPrice" type="checkbox" checked></label>
          <label class="field"><span>SKU</span><input id="labelShowSku" type="checkbox" checked></label>
          <label class="field"><span>Storage location</span><input id="labelShowLocation" type="checkbox"></label>
          <label class="field"><span>Barcode</span><input id="labelShowBarcode" type="checkbox"></label>
          <label class="field"><span>QR code</span><input id="labelShowQr" type="checkbox"></label>
        </div>
      </div>

      <div class="record-section">
        <div class="record-section-title">
          <span>↔</span>
          <div>
            <strong>Printer alignment</strong>
            <small>Leave these at zero unless a test sheet needs a small alignment correction.</small>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label>Horizontal offset (inches)</label>
            <input class="input" id="labelOffsetX" type="number" step="0.01" value="0">
          </div>
          <div class="field">
            <label>Vertical offset (inches)</label>
            <input class="input" id="labelOffsetY" type="number" step="0.01" value="0">
          </div>
        </div>
      </div>

      <div class="panel">
        <h3>Printer settings</h3>
        <p style="color:var(--muted);line-height:1.55;margin-bottom:0">Use Letter / 8.5 × 11 paper, 100% or Actual Size, and turn off browser headers and footers. Avoid Fit to Page because it can move the labels out of alignment.</p>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn secondary" data-close type="button">Cancel</button>
      <button class="btn" id="buildLabelSheet" type="button">Print Selected Labels</button>
    </div>
  `);

  const templateSelect=$("#labelTemplate");
  const startInput=$("#labelStartPosition");
  const info=$("#labelTemplateInfo");

  const updateTemplateInfo=()=>{
    const template=LABEL_SHEET_TEMPLATES[templateSelect.value];
    if(!template)return;
    startInput.max=String(template.count);
    if(num(startInput.value)<1)startInput.value="1";
    if(num(startInput.value)>template.count)startInput.value=String(template.count);
    info.textContent=`${template.name}: ${template.description}. Valid starting positions are 1 through ${template.count}.`;
  };

  templateSelect.onchange=updateTemplateInfo;
  startInput.oninput=updateTemplateInfo;

  $("#labelSelectAll").onclick=()=>{
    $$("[data-label-item]").forEach(box=>box.checked=true);
  };

  $("#labelSelectNone").onclick=()=>{
    $$("[data-label-item]").forEach(box=>box.checked=false);
  };

  $("#buildLabelSheet").onclick=()=>{
    const selectedIds=new Set(
      $$("[data-label-item]:checked").map(box=>box.dataset.labelItem)
    );

    const selectedItems=printable.filter(item=>selectedIds.has(item.id));

    if(!selectedItems.length){
      alert("Select at least one inventory item to print.");
      return;
    }

    const template=LABEL_SHEET_TEMPLATES[templateSelect.value];
    const startPosition=Math.max(1,Math.min(template.count,Math.floor(num(startInput.value)||1)));

    const options={
      showName:$("#labelShowName").checked,
      showPrice:$("#labelShowPrice").checked,
      showSku:$("#labelShowSku").checked,
      showLocation:$("#labelShowLocation").checked,
      showBarcode:$("#labelShowBarcode").checked,
      showQr:$("#labelShowQr").checked,
      offsetX:num($("#labelOffsetX").value),
      offsetY:num($("#labelOffsetY").value)
    };

    printLabelSheet(selectedItems,template.id,startPosition,options);
  };

  updateTemplateInfo();
}


function printLabelSheet(items,templateId,startPosition,options){
  const template=LABEL_SHEET_TEMPLATES[templateId];
  if(!template || !Array.isArray(items) || !items.length)return;

  const geometry={
    "22808":{marginX:0.375,marginY:0.5,gapX:0.125,gapY:1.25},
    "22804":{marginX:0.375,marginY:0.5,gapX:0.125,gapY:0.2},
    "22807":{marginX:0.625,marginY:0.625,gapX:0.625,gapY:0.583333},
    "22806":{marginX:0.625,marginY:0.625,gapX:0.625,gapY:0.583333},
    "5162":{marginX:0.156,marginY:0.833,gapX:0.188,gapY:0},
    "5164":{marginX:0.156,marginY:0.5,gapX:0.188,gapY:0},
    "5160":{marginX:0.1875,marginY:0.5,gapX:0.125,gapY:0},
    "5163":{marginX:0.15625,marginY:0.5,gapX:0.1875,gapY:0}
  }[template.id];

  if(!geometry){
    alert("That label template does not have print geometry yet.");
    return;
  }

  const firstPosition=Math.max(1,Math.min(template.count,Math.floor(num(startPosition)||1)));
  const slots=Array(firstPosition-1).fill(null).concat(items);

  while(slots.length%template.count)slots.push(null);

  const pages=[];
  for(let i=0;i<slots.length;i+=template.count){
    pages.push(slots.slice(i,i+template.count));
  }

  const w=window.open("","_blank","width=1000,height=800");
  if(!w){
    alert("Allow pop-ups to print label sheets.");
    return;
  }

  const showName=options.showName!==false;
  const showPrice=options.showPrice!==false;
  const showSku=options.showSku!==false;
  const showLocation=options.showLocation===true;
  const showBarcode=options.showBarcode===true;
  const showQr=options.showQr===true;
  const offsetX=num(options.offsetX);
  const offsetY=num(options.offsetY);

  const nameSize=template.height<=1?10:template.height<=1.5?11:template.height<=2?14:16;
  const priceSize=template.height<=1?17:template.height<=1.5?20:template.height<=2?27:31;
  const metaSize=template.height<=1?8:template.height<=1.5?9:10;
  const pad=template.height<=1?0.08:template.height<=1.5?0.12:0.18;
  const barcodeHeight=template.height<=1?0.22:template.height<=1.5?0.3:0.38;
  const qrSize=template.height<=1?0.26:template.height<=1.5?0.38:template.height<=2?0.48:0.58;

  const labelHtml=item=>{
    if(!item)return `<div class="label empty-label"></div>`;

    const barcodeUrl=showBarcode && item.sku
      ? makeInventoryCodeDataUrl(item.sku,"barcode")
      : "";

    const qrUrl=showQr && item.sku
      ? makeInventoryCodeDataUrl(item.sku,"qr")
      : "";

    return `
      <div class="label">
        <div class="label-content">
          ${showName?`<div class="item-name">${esc(item.name||"Item")}</div>`:""}
          ${showPrice?`<div class="item-price">${money(item.askingPrice)}</div>`:""}
          ${showSku?`<div class="item-sku">${esc(item.sku||"")}</div>`:""}
          ${showLocation && item.storageLocation?`<div class="item-location">${esc(item.storageLocation)}</div>`:""}
          ${showBarcode && barcodeUrl?`<img src="${barcodeUrl}" alt="Barcode" style="display:block;max-width:96%;width:auto;height:${barcodeHeight}in;object-fit:contain;margin:3px auto 0">`:""}
          ${showQr && qrUrl?`<img src="${qrUrl}" alt="QR code" style="display:block;width:${qrSize}in;height:${qrSize}in;object-fit:contain;margin:3px auto 0">`:""}
        </div>
      </div>
    `;
  };

  const pageHtml=page=>`
    <section class="sheet">
      ${page.map(labelHtml).join("")}
    </section>
  `;

  w.document.write(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Inventory Labels - Avery ${esc(template.id)}</title>
      <style>
        @page{
          size:letter;
          margin:0;
        }

        *{
          box-sizing:border-box;
        }

        html,body{
          margin:0;
          padding:0;
          background:#fff;
          color:#000;
          font-family:Arial,Helvetica,sans-serif;
        }

        .sheet{
          width:8.5in;
          height:11in;
          padding:${geometry.marginY}in ${geometry.marginX}in;
          display:grid;
          grid-template-columns:repeat(${template.columns},${template.width}in);
          grid-template-rows:repeat(${template.rows},${template.height}in);
          column-gap:${geometry.gapX}in;
          row-gap:${geometry.gapY}in;
          position:relative;
          left:${offsetX}in;
          top:${offsetY}in;
          overflow:hidden;
          break-after:page;
          page-break-after:always;
        }

        .sheet:last-child{
          break-after:auto;
          page-break-after:auto;
        }

        .label{
          width:${template.width}in;
          height:${template.height}in;
          display:flex;
          align-items:center;
          justify-content:center;
          text-align:center;
          overflow:hidden;
          padding:${pad}in;
        }

        .label-content{
          width:100%;
          max-width:100%;
          overflow:hidden;
        }

        .item-name{
          font-size:${nameSize}px;
          line-height:1.08;
          font-weight:700;
          overflow:hidden;
          margin:0 0 3px;
        }

        .item-price{
          font-size:${priceSize}px;
          line-height:1;
          font-weight:800;
          margin:2px 0 3px;
        }

        .item-sku,
        .item-location{
          font-size:${metaSize}px;
          line-height:1.1;
          font-weight:700;
          overflow:hidden;
        }

        .item-location{
          font-weight:500;
          margin-top:2px;
        }

        .empty-label{
          visibility:hidden;
        }

        body.template-round .label{
          border-radius:50%;
        }

        body.template-oval .label{
          border-radius:50%;
        }

        @media screen{
          body{
            background:#ddd;
          }

          .sheet{
            margin:20px auto;
            background:white;
            box-shadow:0 2px 12px rgba(0,0,0,.18);
          }

          .label:not(.empty-label){
            outline:1px dashed #aaa;
          }
        }

        @media print{
          html,body{
            width:8.5in;
            margin:0;
            padding:0;
          }

          .sheet{
            margin:0;
            box-shadow:none;
          }

          .label{
            outline:none;
          }
        }
      </style>
    </head>
    <body class="template-${esc(template.shape)}">
      ${pages.map(pageHtml).join("")}
    </body>
    </html>
  `);

  w.document.close();
  w.focus();
  setTimeout(()=>w.print(),250);
}


function printPriceTag(item){
  const w=window.open("","_blank","width=480,height=360");
  if(!w){
    alert("Allow pop-ups to print a price tag.");
    return;
  }

  w.document.write(`
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Price Tag - ${esc(item.sku||"Item")}</title>
      <style>
        body{
          margin:0;
          font-family:Arial,sans-serif;
          display:flex;
          justify-content:center;
          align-items:center;
          min-height:100vh;
          background:white;
          color:#000;
        }
        .tag{
          width:3.5in;
          min-height:2in;
          border:2px solid #000;
          padding:18px;
          box-sizing:border-box;
          text-align:center;
        }
        .name{
          font-size:20px;
          font-weight:700;
          margin-bottom:14px;
        }
        .price{
          font-size:42px;
          font-weight:800;
          margin:10px 0 18px;
        }
        .sku{
          font-size:18px;
          font-weight:700;
          letter-spacing:1px;
        }
        .label{
          font-size:11px;
          text-transform:uppercase;
          margin-bottom:4px;
        }
        @media print{
          body{min-height:auto;}
          .tag{margin:0;}
        }
      </style>
    </head>
    <body>
      <div class="tag">
        <div class="name">${esc(item.name||"Item")}</div>
        <div class="price">${money(item.askingPrice)}</div>
        <div class="label">SKU</div>
        <div class="sku">${esc(item.sku||"—")}</div>
      </div>
    </body>
    </html>
  `);

  w.document.close();
  w.focus();
  setTimeout(()=>w.print(),150);
}
async function nextSku(){
  const items=await DB.getAll("items");
  let max=0;
  for(const item of items){
    const match=String(item.sku||"").match(/^ML-(\d{6})$/);
    if(match)max=Math.max(max,Number(match[1]));
  }
  return `ML-${String(max+1).padStart(6,"0")}`;
}
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
