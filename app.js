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
inventoryAttention:"",
auctionAttention:""
};

const STATUSES=["Draft / Finish Cataloging","Available","Reserved","Needs Work","Listed","Sold","Personal / Not For Sale"];
const SOURCE_TYPES=["Online Auction","In-Person Auction","Flea Market / Swap Meet","Garage / Yard Sale","Estate Sale","Facebook Marketplace","Craigslist / Classified","Private Seller","Trade","Other"];
const ONLINE_PLATFORMS=["eBay","HiBid","LiveAuctioneers","Proxibid","Local Auction Site","Other"];
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
      auctions:"Auctions, watch lots and sourcing",
      more:"Backups, exports and business tools",
      guide:"Instructions and everyday workflows"
  })[route] || "Business Organizer";

  fab.setAttribute("aria-label", route==="calendar"?"Add event":route==="money"?"Add expense":route==="auctions"?"Add auction":"Add item");
  await render();
  view.focus();
}

async function render(){
  if(state.route==="dashboard")return renderDashboard();
  if(state.route==="inventory")return renderInventory();
  if(state.route==="calendar")return renderCalendar();
    if(state.route==="guide")return renderUserGuide();
  if(state.route==="money")return renderMoney();
  if(state.route==="auctions")return renderAuctionManager();
  return renderMore();
}

async function renderDashboard(){
  const [items,events,expenses,mileage,sales,auctions,photos,auctionLots]=await Promise.all([
    DB.getAll("items"),DB.getAll("events"),DB.getAll("expenses"),DB.getAll("mileage"),
    DB.getAll("sales"),DB.getAll("auctions"),DB.getAll("itemPhotos"),DB.getAll("auctionLots")
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
  const needsAuctionFollowUp=auctions.filter(a=>auctionNeedsAttention(a,auctionLots)).length;

  const upcoming=events.filter(e=>new Date(e.startDate)>=startOfToday()).sort((a,b)=>new Date(a.startDate)-new Date(b.startDate)).slice(0,5);
const upcomingAuctionRows=auctions.filter(a=>{    const v=a.endDateTime||a.date;    if(!v)return false;    return new Date(v.length>10?v:v+"T12:00:00")>=startOfToday();  }).sort((a,b)=>String(a.endDateTime||a.date).localeCompare(String(b.endDateTime||b.date)));  const dashboardAuctionGroups=new Map();  upcomingAuctionRows.forEach(a=>{    const day=String(a.endDateTime||a.date||"").slice(0,10);    if(!day)return;    if(!dashboardAuctionGroups.has(day))dashboardAuctionGroups.set(day,[]);    dashboardAuctionGroups.get(day).push(a);  });  const dashboardAuctionDays=[...dashboardAuctionGroups.entries()].slice(0,4).map(([day,rows])=>{    const highCount=rows.filter(a=>(a.priority||"Medium")==="High").length;    const timed=rows.filter(a=>a.endDateTime).slice().sort((a,b)=>String(a.endDateTime).localeCompare(String(b.endDateTime)));    let conflictCount=0;    for(let i=0;i<timed.length;i++){      for(let j=i+1;j<timed.length;j++){        const first=new Date(timed[i].endDateTime).getTime();        const second=new Date(timed[j].endDateTime).getTime();        if(!Number.isFinite(first)||!Number.isFinite(second))continue;        const difference=second-first;        if(difference>15*60*1000)break;        if(difference>=0)conflictCount++;      }    }    return {day,rows,highCount,conflictCount};  });

  view.innerHTML=`
      <section class="dashboard-capture-bar">
        <div class="dashboard-capture-copy">
          <strong>Quick capture</strong>
          <small>Start an inventory item from a photo or add it manually.</small>
        </div>
        <div class="dashboard-capture-actions">
          <button class="btn small" id="homeCamera" type="button">📷 Capture</button>
          <button class="btn secondary small" id="homeGallery" type="button">🖼 Photos</button>
          <button class="btn ghost small" id="homeManual" type="button">＋ Manual</button>
        </div>
      </section>

    <div class="section-head"><div><h2>Needs attention</h2><p>The app remembers what still needs to be finished.</p></div></div>
    <section class="attention-grid">
${attentionCard("Finish Cataloging",needsFinish,"Incomplete item records","📋","Finish Cataloging")}
${attentionCard("Needs Work",needsWork,"Cleaning, repair or setup","🛠","Needs Work")}
${attentionCard("Needs Pricing",needsPricing,"No asking price yet","🏷","Needs Pricing")}
${attentionCard("Needs Photos",needsPhotos,"No item photo stored","📷","Needs Photos")}
${attentionCard("Auction Follow-Up",needsAuctionFollowUp,"Ended auctions with unresolved Watch Lots","◆","Auction Follow-Up","auctions")}
    </section>

    <div class="section-head"><div><h2>Business snapshot</h2><p>Live totals from records stored on this device.</p></div></div>
    <section class="stats">
      ${snapshotStat("In Stock",unsold.length,"items not marked sold","","stock")}
      ${snapshotStat("Invested",money(invested),"landed cost in unsold inventory","","invested")}
      ${snapshotStat("Combined Asking Prices",money(asking),"sum of asking prices for all unsold inventory","","asking")}
      ${snapshotStat("Estimated Net",money(profit),"sales minus sold cost and expenses",profit>=0?"kpi-positive":"kpi-negative","net")}
    </section>

    <div class="section-head"><div><h2>Quick access</h2></div></div>
    <section class="quick-grid">
      ${quick("▦","Inventory","inventory")}
      ${quick("▣","Calendar","calendar")}
      ${quick("◆","Auctions","auctions")}
      ${quick("$","Money","money")}
    </section>

    <div class="section-head"><div><h2>Coming up</h2><p>Events and sourcing opportunities.</p></div></div>
    <section class="grid-2">
      <div class="panel"><h3>Upcoming events</h3><div class="list">${upcoming.length?upcoming.map(eventListItem).join(""):empty("No upcoming events yet.")}</div></div>
<div class="panel"><h3>Upcoming auctions</h3><div class="list">${dashboardAuctionDays.length?dashboardAuctionDays.map(group=>{        const dayLabel=new Date(`${group.day}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"});        const details=[];        if(group.highCount)details.push(`${group.highCount} high priority`);        if(group.conflictCount)details.push(`${group.conflictCount} time conflict${group.conflictCount===1?"":"s"}`);        if(!details.length)details.push("No priority conflicts");        return `<button class="list-card clickable-list-card dashboard-auction-day" data-jump="auctions" type="button"><div><h4>${esc(dayLabel)} — ${group.rows.length} auction${group.rows.length===1?"":"s"}</h4><p>${esc(details.join(" · "))}</p></div><span class="dashboard-auction-day-arrow">View →</span></button>`;      }).join(""):empty("No auctions being tracked yet.")}</div></div>
    </section>
  `;

  $("#homeCamera").onclick=()=>startCameraCapture();
  $("#homeGallery").onclick=()=>$("#globalGalleryInput").click();
  $("#homeManual").onclick=()=>openItemModal();
  $$("[data-snapshot]").forEach(card=>card.onclick=()=>{
    const action=card.dataset.snapshot;
    if(action==="stock"){
      state.inventorySearch="";
      state.inventoryStatus="active";
      state.inventoryCategory="all";
      state.inventorySource="all";
      state.inventoryLocation="all";
      state.inventorySort="updated";
      state.inventoryAttention="";
      navigate("inventory");
      return;
    }
    if(action==="invested"){
      const rows=unsold.slice().sort((a,b)=>itemCost(b)-itemCost(a));
      openSnapshotBreakdown("Invested Inventory","Landed cost currently tied up in unsold inventory.",rows,item=>itemCost(item),invested);
      return;
    }
    if(action==="asking"){
      const rows=unsold.slice().sort((a,b)=>num(b.askingPrice)-num(a.askingPrice));
      openSnapshotBreakdown("Combined Asking Prices","Sum of asking prices for all unsold inventory.",rows,item=>num(item.askingPrice),asking);
      return;
    }
    if(action==="net"){
      state.moneyTab="overview";
      navigate("money");
    }
  });
$$("[data-jump]").forEach(b=>b.onclick=()=>{if(b.dataset.attention){if(b.dataset.jump==="inventory")state.inventoryAttention=b.dataset.attention;if(b.dataset.jump==="auctions")state.auctionAttention=b.dataset.attention;}navigate(b.dataset.jump);});
  $$("[data-event-id]").forEach(el=>el.onclick=()=>openEventModal(events.find(e=>e.id===el.dataset.eventId)));
  $$("[data-auction-detail-id]").forEach(el=>el.onclick=()=>openAuctionDetail(el.dataset.auctionDetailId));
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
  const inventorySearchMatches=i=>{
    const hay=`${i.sku||""} ${i.upc||""} ${i.manufacturerPartNumber||""} ${i.otherIdentifier||""} ${i.name||""} ${i.brand||""} ${i.model||""} ${i.serialNumber||""} ${i.category||""} ${i.notes||""} ${i.sourcePlatform||""} ${i.sourceType||""} ${i.purchaseSource||""} ${i.storageLocation||""}`.toLowerCase();
    return hay.includes(state.inventorySearch.toLowerCase());
  };
  let displayed=filtered.filter(inventorySearchMatches);


  view.innerHTML=`
    <div class="section-head">
      <div><h2>Inventory</h2><p>${displayed.length===items.length?`${items.length} total item${items.length===1?"":"s"} stored locally.`:`${displayed.length} matching item${displayed.length===1?"":"s"} · ${items.length} total`}</p></div>
      <div class="inventory-head-actions">
        <button class="btn camera-btn small" id="inventoryCamera">📷 Capture</button>
          <button class="btn secondary small" id="printInventoryLabels">🏷 Print Labels</button>
          <button class="btn secondary small" id="scanInventoryCode">▦ Scan Code</button>
        <button class="btn secondary small" id="addItemTop">＋ Manual</button>
      </div>
    </div>
  <div class="inventory-organize-bar">
    <div class="inventory-organize-copy">
      <strong>Organize Inventory</strong>
      <small>Categories and storage locations belong here so they are easy to find.</small>
    </div>
    <div class="inventory-organize-actions">
      <button class="btn secondary small" id="inventoryManageCategories" type="button">🏷 Manage Categories</button>
      <button class="btn secondary small" id="inventoryManageLocations" type="button">📦 Manage Locations</button>
      <button class="btn secondary small" id="inventorySummary" type="button">▦ Inventory Summary</button>
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
        ${displayed.length?displayed.map(i=>itemCard(i,primary.get(i.id))).join(""):empty("No matching inventory items. Tap + to add your first item.")}
    </section>
  `;

  $("#inventoryCamera").onclick=()=>startCameraCapture();
  $("#addItemTop").onclick=()=>openItemModal();
  $("#printInventoryLabels").onclick=()=>openLabelSheetPrinter(displayed);
  $("#scanInventoryCode").onclick=()=>openInventoryCodeScanner();
  $("#inventoryManageCategories").onclick=()=>openItemCategoriesModal();
  $("#inventoryManageLocations").onclick=()=>openStorageLocationsModal();
  $("#inventorySummary").onclick=()=>openInventorySummary(displayed);
$("#inventorySearch").oninput=e=>{
  state.inventorySearch=e.target.value;
  displayed=filtered.filter(inventorySearchMatches);
  const summary=view.querySelector(".section-head p");
  if(summary)summary.textContent=displayed.length===items.length?`${items.length} total item${items.length===1?"":"s"} stored locally.`:`${displayed.length} matching item${displayed.length===1?"":"s"} · ${items.length} total`;
  const grid=view.querySelector(".inventory-grid");
  if(grid)grid.innerHTML=displayed.length?displayed.map(i=>itemCard(i,primary.get(i.id))).join(""):empty("No matching inventory items. Tap + to add your first item.");
  $("#printInventoryLabels").onclick=()=>openLabelSheetPrinter(displayed);
  $("#inventorySummary").onclick=()=>openInventorySummary(displayed);
  $$(".item-card[data-id]").forEach(card=>card.onclick=()=>openItemDetail(card.dataset.id));
  hydrateBlobImages();
};
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

async function openItemModal(item,seed,onSaved){
  const editing=!!item, now=new Date().toISOString();
  const [events,auctions,itemCategories,storageLocations,itemSales]=await Promise.all([
    DB.getAll("events"),
    DB.getAll("auctions"),
    getItemCategories(),
    getStorageLocations(),
      editing?DB.getByIndex("sales","itemId",item.id):Promise.resolve([])
  ]);

const generatedSku=(item&&item.sku)||(seed&&seed.sku)||await nextSku();
  const base={
id:DB.uid("item"),sku:generatedSku,upc:"",manufacturerPartNumber:"",otherIdentifier:"",name:"",category:"",brand:"",model:"",serialNumber:"",year:"",condition:"",
status:"Available",color:"#45b7ff",storageLocation:"",purchaseDate:today(),purchaseSource:"",
    sourceType:"",sourcePlatform:"",sourceSeller:"",sourceLocation:"",listingTitle:"",listingUrl:"",
    lotNumber:"",auctionEndDateTime:"",auctionId:"",shippingStatus:"Not Applicable",
    purchasePrice:"",buyerPremium:"",salesTaxRate:"",salesTax:"",shippingCost:"",handlingCost:"",otherAcquisitionCosts:"",taxableAcquisitionFields:["purchasePrice","buyerPremium"],customAcquisitionCosts:[],
acquisitionCosts:"",totalLandedCost:"",askingPrice:"",minimumPrice:"",soldPrice:"",saleDate:"",
soldEventId:"",salePlatform:"",buyerName:"",sellingFees:"",paymentFees:"",shippingCharged:"",outboundShippingCost:"",
buyerNotes:"",description:"",conditionNotes:"",workNeeded:"",repairNotes:"",
    estimatedRepairCost:"",notes:"",createdAt:now,updatedAt:now
  };
  const draft=Object.assign({},base,item||{},seed||{});
  const activeSale=itemSales.find(s=>s.status!=="Voided" && (!draft.saleTransactionId || s.transactionId===draft.saleTransactionId))
    || itemSales.find(s=>s.status!=="Voided")
    || null;
  if(editing && draft.status==="Sold" && activeSale){
    draft.soldPrice=activeSale.soldPrice;
    draft.saleDate=activeSale.date||draft.saleDate;
  }
  const catalogStatuses=STATUSES.filter(status=>status!=="Sold");const taxableAcquisitionFields=Array.isArray(draft.taxableAcquisitionFields)?draft.taxableAcquisitionFields:["purchasePrice","buyerPremium"];const stagedCustomAcquisitionCosts=Array.isArray(draft.customAcquisitionCosts)?draft.customAcquisitionCosts.map(row=>({id:row.id||DB.uid("acqCost"),name:String(row.name||""),amount:row.amount??"",taxable:!!row.taxable})):[];

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
            <div class="field"><label>Sales tax percentage</label><input class="input" name="salesTaxRate" id="inventorySalesTaxRate" type="number" min="0" step="0.01" value="${esc(draft.salesTaxRate??"")}" placeholder="Example: 6"></div><div class="field"><label>Calculated tax</label><output class="input" id="inventorySalesTaxAmount" style="display:flex;align-items:center">${money(draft.salesTax)}</output></div>
            ${field("Shipping","shippingCost",draft.shippingCost,false,"number","0.01")}
            ${field("Handling","handlingCost",draft.handlingCost,false,"number","0.01")}
            ${field("Other acquisition cost","otherAcquisitionCosts",draft.otherAcquisitionCosts,false,"number","0.01")}<div class="field full"><label>Tax applies to</label><div style="display:flex;gap:12px;flex-wrap:wrap"><label><input type="checkbox" data-taxable-acquisition value="purchasePrice" ${taxableAcquisitionFields.includes("purchasePrice")?"checked":""}> Purchase / winning bid</label><label><input type="checkbox" data-taxable-acquisition value="buyerPremium" ${taxableAcquisitionFields.includes("buyerPremium")?"checked":""}> Buyer premium</label><label><input type="checkbox" data-taxable-acquisition value="shippingCost" ${taxableAcquisitionFields.includes("shippingCost")?"checked":""}> Shipping</label><label><input type="checkbox" data-taxable-acquisition value="handlingCost" ${taxableAcquisitionFields.includes("handlingCost")?"checked":""}> Handling</label><label><input type="checkbox" data-taxable-acquisition value="otherAcquisitionCosts" ${taxableAcquisitionFields.includes("otherAcquisitionCosts")?"checked":""}> Other acquisition cost</label></div></div><div class="field full"><div class="section-head" style="margin-bottom:8px"><div><label style="margin:0">Additional charges</label><small style="display:block;color:var(--muted);margin-top:4px">Add platform-specific fees and mark each one taxable when applicable.</small></div><button class="btn secondary small" id="addCustomAcquisitionCost" type="button">+ Add charge</button></div><div id="customAcquisitionCosts"></div></div>
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
        ${!editing&&!draft.__sourceLotId?`<button class="btn secondary" type="button" id="saveDraftBtn">Save Draft</button>`:""}
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
        await openItemModal(editing?draft:null,Object.assign({},draft,{__photos:staged.map(p=>p.blob).filter(Boolean).concat(blobs)}),onSaved);
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

  const form=$("#itemForm");const renderCustomAcquisitionCosts=()=>{const holder=$("#customAcquisitionCosts");holder.innerHTML=stagedCustomAcquisitionCosts.length?stagedCustomAcquisitionCosts.map((row,index)=>`<div class="panel" data-custom-acq-card="${index}" style="margin:10px 0;padding:12px"><div class="form-grid"><div class="field"><label>Charge name</label><input class="input" data-custom-acq-field="name" value="${esc(row.name||"")}" placeholder="Example: Service fee"></div><div class="field"><label>Amount</label><input class="input" data-custom-acq-field="amount" type="number" min="0" step="0.01" value="${esc(row.amount??"")}"></div><div class="field"><label><input type="checkbox" data-custom-acq-field="taxable" ${row.taxable?"checked":""}> Taxable</label></div><div class="field" style="display:flex;align-items:end"><button class="btn secondary small" type="button" data-remove-custom-acq="${index}">Remove</button></div></div></div>`).join(""):`<div class="muted">No additional charges.</div>`;$$("[data-custom-acq-card]",holder).forEach(card=>{const index=Number(card.dataset.customAcqCard);$$("[data-custom-acq-field]",card).forEach(input=>{const sync=()=>{stagedCustomAcquisitionCosts[index][input.dataset.customAcqField]=input.dataset.customAcqField==="taxable"?input.checked:input.value;recalc();};input.oninput=sync;input.onchange=sync;});});$$("[data-remove-custom-acq]",holder).forEach(button=>{button.onclick=()=>{stagedCustomAcquisitionCosts.splice(Number(button.dataset.removeCustomAcq),1);renderCustomAcquisitionCosts();recalc();};});};
  const recalc=()=>{const data=Object.fromEntries(new FormData(form).entries());const taxableFields=$$("[data-taxable-acquisition]",form).filter(input=>input.checked).map(input=>input.value);const customTotal=stagedCustomAcquisitionCosts.reduce((total,row)=>total+Math.max(0,num(row.amount)),0);const customTaxable=stagedCustomAcquisitionCosts.filter(row=>row.taxable).reduce((total,row)=>total+Math.max(0,num(row.amount)),0);const taxableSubtotal=taxableFields.reduce((total,name)=>total+num(data[name]),0)+customTaxable;const rate=Math.max(0,num(data.salesTaxRate));const tax=String(data.salesTaxRate||"").trim()!==""?Math.round((taxableSubtotal*rate/100+Number.EPSILON)*100)/100:num(draft.salesTax);const acquisition=num(data.buyerPremium)+tax+num(data.shippingCost)+num(data.handlingCost)+num(data.otherAcquisitionCosts)+customTotal;$("#inventorySalesTaxAmount").textContent=money(tax);$("#landedCostOutput").textContent=money(num(data.purchasePrice)+acquisition+num(data.estimatedRepairCost));};



  ["purchasePrice","buyerPremium","salesTaxRate","shippingCost","handlingCost","otherAcquisitionCosts","estimatedRepairCost"].forEach(n=>{
    if(form.elements[n])form.elements[n].addEventListener("input",recalc);
  });$$("[data-taxable-acquisition]",form).forEach(input=>input.addEventListener("change",recalc));$("#addCustomAcquisitionCost").onclick=()=>{stagedCustomAcquisitionCosts.push({id:DB.uid("acqCost"),name:"",amount:"",taxable:false});renderCustomAcquisitionCosts();recalc();};renderCustomAcquisitionCosts();recalc();

  const saveRecord=async(forceDraft)=>{
    const data=Object.fromEntries(new FormData(form).entries());data.taxableAcquisitionFields=$$("[data-taxable-acquisition]",form).filter(input=>input.checked).map(input=>input.value);data.customAcquisitionCosts=stagedCustomAcquisitionCosts.map(row=>({id:row.id||DB.uid("acqCost"),name:String(row.name||"").trim(),amount:Math.max(0,num(row.amount)),taxable:!!row.taxable})).filter(row=>row.name||row.amount>0);data.salesTaxRate=String(data.salesTaxRate||"").trim();if(data.salesTaxRate!==""){const customTaxable=data.customAcquisitionCosts.filter(row=>row.taxable).reduce((total,row)=>total+num(row.amount),0);const taxableSubtotal=data.taxableAcquisitionFields.reduce((total,name)=>total+num(data[name]),0)+customTaxable;data.salesTax=Math.round((taxableSubtotal*Math.max(0,num(data.salesTaxRate))/100+Number.EPSILON)*100)/100;}else{data.salesTax=draft.salesTax??"";}
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
    data.acquisitionCosts=num(data.buyerPremium)+num(data.salesTax)+num(data.shippingCost)+num(data.handlingCost)+num(data.otherAcquisitionCosts)+(data.customAcquisitionCosts||[]).reduce((total,row)=>total+num(row.amount),0);
    data.totalLandedCost=num(data.purchasePrice)+data.acquisitionCosts;

    const saved=Object.assign({},draft,data,{
      createdAt:draft.createdAt||now,
      updatedAt:new Date().toISOString()
    });
      delete saved.__photos;
      delete saved.__sourceLotId;

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

      if(onSaved)await onSaved(saved,{forceDraft});
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
      <div class="photo-strip">${photos.length?photos.map(p=>`<div class="photo-thumb" style="width:150px;height:118px"><img data-blob-id="${p.id}" data-view-item-photo="${p.id}" alt="Product photo" title="View product photo"></div>`).join(""):empty("No photos yet.")}</div>
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
  $$("[data-view-item-photo]",modalRoot).forEach(image=>{
    image.onclick=()=>{
      const photo=photos.find(p=>p.id===image.dataset.viewItemPhoto);
      if(!photo||!photo.blob)return;

      const url=URL.createObjectURL(photo.blob);
      const viewer=document.createElement("div");
      viewer.className="receipt-viewer";

      const panel=document.createElement("div");
      panel.className="receipt-viewer-panel";

      const closeButton=document.createElement("button");
      closeButton.type="button";
      closeButton.className="receipt-viewer-close";
      closeButton.setAttribute("aria-label","Close product photo viewer");
      closeButton.textContent="×";

      const fullImage=document.createElement("img");
      fullImage.src=url;
      fullImage.alt="Product photo";

      const closeViewer=()=>{
        URL.revokeObjectURL(url);
        viewer.remove();
      };

      closeButton.onclick=closeViewer;
      viewer.onclick=event=>{
        if(event.target===viewer)closeViewer();
      };

      panel.appendChild(closeButton);
      panel.appendChild(fullImage);
      viewer.appendChild(panel);
      modalRoot.appendChild(viewer);
    };
  });
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
  const [events,auctions]=await Promise.all([DB.getAll("events"),DB.getAll("auctions")]);
  const d=state.calendarDate,year=d.getFullYear(),month=d.getMonth();
  const first=new Date(year,month,1),start=new Date(year,month,1-first.getDay());
  const days=Array.from({length:42},(_,i)=>new Date(start.getFullYear(),start.getMonth(),start.getDate()+i));
  const upcoming=[...events.map(event=>({kind:"event",when:event.startDate,record:event})),...auctions.map(auction=>({kind:"auction",when:auction.endDateTime||auction.date,record:auction}))].filter(entry=>String(entry.when||"").slice(0,10)>=today()).sort((a,b)=>String(a.when).localeCompare(String(b.when))).slice(0,8);

  view.innerHTML=`
    <div class="section-head"><div><h2>Calendar</h2><p>Keep fairs, festivals, pickups, auctions and appointments together.</p></div><div class="calendar-head-actions"><button class="btn secondary small" id="exportCalendarTop" type="button">↗ Export Calendar</button><button class="btn small" id="addEventTop" type="button">＋ Event</button></div></div>
    <section class="calendar-wrap">
      <div class="calendar">
        <div class="cal-head"><button class="btn ghost small" id="prevMonth">←</button><strong>${first.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</strong><button class="btn ghost small" id="nextMonth">→</button></div>
        <div class="cal-grid">
          ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=>`<div class="cal-dow">${x}</div>`).join("")}
          ${days.map(day=>calendarDay(day,month,events,auctions)).join("")}
        </div>
      </div>
      <div class="panel"><h3>Upcoming</h3><div class="list">${upcoming.length?upcoming.map(entry=>entry.kind==="auction"?calendarAuctionListItem(entry.record):eventListItem(entry.record)).join(""):empty("No upcoming events or auctions yet.")}</div></div>
    </section>
  `;
  $("#addEventTop").onclick=()=>openEventModal();
  $("#exportCalendarTop").onclick=()=>openCalendarExportModal(events,auctions);
  $("#prevMonth").onclick=()=>{state.calendarDate=new Date(year,month-1,1);renderCalendar();};
  $("#nextMonth").onclick=()=>{state.calendarDate=new Date(year,month+1,1);renderCalendar();};
  $$("[data-event-id]").forEach(el=>el.onclick=()=>openEventModal(events.find(e=>e.id===el.dataset.eventId)));
  $$("[data-calendar-auction-id]").forEach(el=>el.onclick=()=>openAuctionDetail(el.dataset.calendarAuctionId));
}

function calendarAuctionListItem(a){
  const when=a.endDateTime?prettyDateTime(a.endDateTime):prettyDate(a.date);
  return `<div class="list-card" data-calendar-auction-id="${a.id}"><div><div class="badge"><span class="dot" style="background:${safeColor(a.color||"#f7c75d")}"></span>${esc(a.platform||"Auction")}</div><h4>${esc(a.name)}</h4><p>${when}${a.location?` · ${esc(a.location)}`:""}${a.status?` · ${esc(a.status)}`:""} · ${esc(a.priority||"Medium")} priority</p></div></div>`;
}

function calendarDay(day,currentMonth,events,auctions){
  const key=ymd(day);
  const dayEvents=events.filter(e=>String(e.startDate||"").slice(0,10)===key);
  const dayAuctions=auctions.filter(a=>String(a.endDateTime||a.date||"").slice(0,10)===key);
  const markers=[
    ...dayEvents.map(e=>`<button class="cal-event" title="${esc(e.title)}" data-event-id="${e.id}" style="background:${safeColor(e.color)}"></button>`),
    ...dayAuctions.map(a=>`<button class="cal-event" title="Auction: ${esc(a.name)}" data-calendar-auction-id="${a.id}" style="background:${safeColor(a.color||"#f7c75d")}"></button>`)
  ];
  let cls="cal-day";if(day.getMonth()!==currentMonth)cls+=" muted";if(key===today())cls+=" today";
  return `<div class="${cls}"><div class="cal-num">${day.getDate()}</div><div class="cal-events">${markers.slice(0,5).join("")}</div></div>`;
}

function icsText(value){
  const slash=String.fromCharCode(92);
  return String(value??"")
    .split(slash).join(slash+slash)
    .split(String.fromCharCode(13)).join("")
    .split(String.fromCharCode(10)).join(slash+"n")
    .split(",").join(slash+",")
    .split(";").join(slash+";");
}

function icsDateOnly(value){
  return String(value||"").slice(0,10).replaceAll("-","");
}

function icsLocalDateTime(value){
  const raw=String(value||"");
  if(raw.length<16)return "";
  return raw.slice(0,10).replaceAll("-","")+"T"+raw.slice(11,16).replaceAll(":","")+"00";
}

function icsDateTimeFromDate(date){
  const pad=value=>String(value).padStart(2,"0");
  return String(date.getFullYear())+pad(date.getMonth()+1)+pad(date.getDate())+"T"+pad(date.getHours())+pad(date.getMinutes())+pad(date.getSeconds());
}

function icsUtcStamp(){
  const date=new Date();
  const pad=value=>String(value).padStart(2,"0");
  return String(date.getUTCFullYear())+pad(date.getUTCMonth()+1)+pad(date.getUTCDate())+"T"+pad(date.getUTCHours())+pad(date.getUTCMinutes())+pad(date.getUTCSeconds())+"Z";
}

function icsEndOneHourAfter(value){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return icsLocalDateTime(value);
  date.setHours(date.getHours()+1);
  return icsDateTimeFromDate(date);
}

function icsNextDate(value){
  const date=new Date(String(value||"").slice(0,10)+"T12:00:00");
  if(!Number.isFinite(date.getTime()))return icsDateOnly(value);
  date.setDate(date.getDate()+1);
  return ymd(date).replaceAll("-","");
}

function calendarExportRows(events,auctions,include,from,to){
  const rows=[];
  if(include!=="auctions"){
    events.forEach(record=>{
      const date=String(record.startDate||"").slice(0,10);
      if(date)rows.push({kind:"event",date,record});
    });
  }
  if(include!=="events"){
    auctions.forEach(record=>{
      const date=String(record.endDateTime||record.date||"").slice(0,10);
      if(date)rows.push({kind:"auction",date,record});
    });
  }
  return rows
    .filter(row=>(!from||row.date>=from)&&(!to||row.date<=to))
    .sort((a,b)=>a.date.localeCompare(b.date));
}

function icsFoldLine(line){
  const encoder=new TextEncoder();
  const crlf=String.fromCharCode(13,10);
  const parts=[];
  let current="";
  let limit=75;
  for(const char of String(line)){
    const candidate=current+char;
    if(current&&encoder.encode(candidate).length>limit){
      parts.push(current);
      current=char;
      limit=74;
    }else{
      current=candidate;
    }
  }
  parts.push(current);
  return parts.join(crlf+" ");
}

function buildCalendarIcs(rows){
  const crlf=String.fromCharCode(13,10);
  const lines=[
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Moonskai Labs L.L.C.//Moonskai Business Organizer//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Moonskai Business Organizer"
  ];
  const stamp=icsUtcStamp();
  rows.forEach(entry=>{
    if(entry.kind==="event"){
      const event=entry.record;
      const start=icsLocalDateTime(event.startDate);
      if(!start)return;
      const end=event.endDate?icsLocalDateTime(event.endDate):icsEndOneHourAfter(event.startDate);
      const location=[event.location,event.address].map(value=>String(value||"").trim()).filter(Boolean).join(" - ");
      const details=[
        event.type?"Type: "+event.type:"",
        event.contact?"Contact: "+event.contact:"",
        event.boothNumber?"Booth: "+event.boothNumber:"",
        event.website?"Website: "+event.website:"",
        event.notes||""
      ].filter(Boolean).join(" | ");
      lines.push(
        "BEGIN:VEVENT",
        "UID:mbo-event-"+icsText(event.id||entry.date)+"@moonskai.local",
        "DTSTAMP:"+stamp,
        "DTSTART:"+start,
        "DTEND:"+end,
        "SUMMARY:"+icsText(event.title||"Business Event")
      );
      if(location)lines.push("LOCATION:"+icsText(location));
      if(details)lines.push("DESCRIPTION:"+icsText(details));
      if(event.website)lines.push("URL:"+String(event.website));
      lines.push("END:VEVENT");
    }else{
      const auction=entry.record;
      const details=[
        auction.platform?"Platform: "+auction.platform:"",
        auction.company?"Company: "+auction.company:"",
        auction.priority?"Priority: "+auction.priority:"",
        auction.status?"Status: "+auction.status:"",
        auction.website?"Website: "+auction.website:"",
        auction.notes||""
      ].filter(Boolean).join(" | ");
      lines.push(
        "BEGIN:VEVENT",
        "UID:mbo-auction-"+icsText(auction.id||entry.date)+"@moonskai.local",
        "DTSTAMP:"+stamp
      );
      if(auction.endDateTime){
        lines.push("DTSTART:"+icsLocalDateTime(auction.endDateTime));
        lines.push("DTEND:"+icsEndOneHourAfter(auction.endDateTime));
      }else{
        lines.push("DTSTART;VALUE=DATE:"+icsDateOnly(auction.date));
        lines.push("DTEND;VALUE=DATE:"+icsNextDate(auction.date));
      }
      lines.push("SUMMARY:"+icsText("Auction: "+(auction.name||"Tracked Auction")));
      if(auction.location)lines.push("LOCATION:"+icsText(auction.location));
      if(details)lines.push("DESCRIPTION:"+icsText(details));
      if(auction.website)lines.push("URL:"+String(auction.website));
      lines.push("END:VEVENT");
    }
  });
  lines.push("END:VCALENDAR");
  return lines.map(icsFoldLine).join(crlf)+crlf;
}

function openCalendarExportModal(events,auctions){
  const viewedMonth=state.calendarDate;
  const monthLabel=viewedMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  openModal(`
    <div class="modal-head">
      <div><div class="eyebrow">CALENDAR</div><h2>Export Calendar</h2></div>
      <button class="close-btn" data-close type="button">×</button>
    </div>
    <div class="modal-body">
      <div class="calendar-export-intro">
        <strong>Send many Organizer dates to Google Calendar at once</strong>
        <p>This creates one standard calendar file. Download it here, then import that file into Google Calendar.</p>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>What dates?</label>
          <select class="select" id="calendarExportRange">
            <option value="all">Everything</option>
            <option value="month">This calendar month - ${esc(monthLabel)}</option>
            <option value="custom">Choose date range</option>
          </select>
        </div>
        <div class="field">
          <label>Include</label>
          <select class="select" id="calendarExportInclude">
            <option value="both">Events and Auctions</option>
            <option value="events">Events only</option>
            <option value="auctions">Auctions only</option>
          </select>
        </div>
      </div>
      <div class="calendar-export-range" id="calendarExportCustom" hidden>
        <div class="field"><label>From</label><input class="input" id="calendarExportFrom" type="date"></div>
        <div class="field"><label>Through</label><input class="input" id="calendarExportTo" type="date"></div>
      </div>
      <div class="calendar-export-count">
        <span>Items that will be exported</span>
        <strong id="calendarExportCount">0</strong>
      </div>
      <div class="calendar-export-help">
        <strong>How to put the file in Google Calendar</strong>
        <p>1. Download the calendar file below.</p>
        <p>2. In Google Calendar, open Settings, then Import & export.</p>
        <p>3. Choose the downloaded .ics file and select the Google calendar where these dates should be added.</p>
        <p>This is a one-way export. Later changes made in the Organizer do not automatically change copies already imported into Google Calendar.</p>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" id="openGoogleCalendarImport" type="button">Open Google Calendar Import</button>
      <button class="btn ghost" data-close type="button">Cancel</button>
      <button class="btn" id="downloadCalendarExport" type="button">Download Calendar File</button>
    </div>
  `);
  const range=$("#calendarExportRange");
  const include=$("#calendarExportInclude");
  const custom=$("#calendarExportCustom");
  const from=$("#calendarExportFrom");
  const to=$("#calendarExportTo");
  const count=$("#calendarExportCount");
  const bounds=()=>{
    if(range.value==="all")return ["",""];
    if(range.value==="custom")return [from.value,to.value];
    const year=viewedMonth.getFullYear();
    const month=viewedMonth.getMonth();
    const first=ymd(new Date(year,month,1));
    const last=ymd(new Date(year,month+1,0));
    return [first,last];
  };
  const matching=()=>{
    const [start,end]=bounds();
    return calendarExportRows(events,auctions,include.value,start,end);
  };
  const refresh=()=>{
    custom.hidden=range.value!=="custom";
    count.textContent=String(matching().length);
  };
  range.onchange=refresh;
  include.onchange=refresh;
  from.onchange=refresh;
  to.onchange=refresh;
  $("#downloadCalendarExport").onclick=()=>{
    const [start,end]=bounds();
    if(range.value==="custom"&&(!start||!end)){alert("Choose both the From and Through dates.");return;}
    if(start&&end&&start>end){alert("The From date must be on or before the Through date.");return;}
    const rows=matching();
    if(!rows.length){alert("There are no matching calendar items to export.");return;}
    const content=buildCalendarIcs(rows);
    downloadFile("moonskai-calendar-"+today()+".ics",content,"text/calendar;charset=utf-8");
    toast(rows.length+" calendar item"+(rows.length===1?"":"s")+" exported.");
  };
  $("#openGoogleCalendarImport").onclick=()=>openExternalUrl("https://calendar.google.com/calendar/u/0/r/settings/export","Google Calendar import");
  refresh();
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
  </div></div><div class="modal-actions">${edit?`<button class="btn danger" id="deleteEvent" type="button">Delete</button>`:""}${edit&&e.website?`<button class="btn secondary" id="openEventWebsite" type="button">Open Website</button>`:""}<button class="btn secondary" id="googleCalendarBtn" type="button">Add to Google Calendar</button><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Event</button></div></form>
  `);
  const openEventWebsite=$("#openEventWebsite");
  if(openEventWebsite)openEventWebsite.onclick=()=>openExternalUrl(e.website,"event website");
$("#googleCalendarBtn").onclick=()=>{
  const data=Object.fromEntries(new FormData($("#eventForm")).entries());
  openGoogleCalendarEvent(Object.assign({},e,data));
};
  const eventTypeSelect=$("#eventForm").elements.type;
  const openAuctionFromEventDraft=()=>{
    const data=Object.fromEntries(new FormData($("#eventForm")).entries());
    const startDate=String(data.startDate||"");
    closeModal();
    openAuctionModal(null,{
      name:data.title||"",
      date:startDate.slice(0,10)||today(),
      endDateTime:data.endDate||"",
      location:data.location||"",
      website:data.website||"",
      color:data.color||"#f7c75d",
      notes:data.notes||""
    });
  };
  eventTypeSelect.onchange=()=>{
    if(eventTypeSelect.value==="Auction")openAuctionFromEventDraft();
  };

  $("#eventForm").onsubmit=async x=>{x.preventDefault();const data=Object.fromEntries(new FormData(x.currentTarget).entries());if(data.type==="Auction"){openAuctionFromEventDraft();return;}await DB.put("events",Object.assign({},e,data));closeModal();toast("Event saved.");renderCalendar();};
  if(edit)$("#deleteEvent").onclick=async()=>{if(confirm("Delete this event?")){await DB.remove("events",e.id);closeModal();renderCalendar();}};
}

async function renderMoney(){
const [expenses,mileage,sales,items,transactions,attachments]=await Promise.all([DB.getAll("expenses"),DB.getAll("mileage"),DB.getAll("sales"),DB.getAll("items"),DB.getAll("transactions"),DB.getAll("attachments")]);
const activeSales=sales.filter(s=>s.status!=="Voided");
const expTotal=sum(expenses.filter(e=>!isCapitalizedAcquisitionExpense(e)).map(e=>num(e.amount))),miles=sum(mileage.map(m=>num(m.miles))),revenue=sum(activeSales.map(s=>num(s.soldPrice)+num(s.shippingCharged))),cost=sum(activeSales.map(s=>num(s.costBasis))),saleCostsTotal=sum(activeSales.map(s=>saleCosts(s))),profit=revenue-cost-saleCostsTotal-expTotal;
  view.innerHTML=`
    <div class="section-head"><div><h2>Money</h2><p>Sales, expenses and business mileage.</p></div><button class="btn small" id="addExpenseTop">＋ Expense</button></div>
    <section class="stats">${stat("Sales",money(revenue),"gross revenue")}${stat("Expenses",money(expTotal),"recorded business expenses")}${stat("Mileage",miles.toFixed(1)+" mi","business travel")}${stat("Estimated Net",money(profit),"before taxes",profit>=0?"kpi-positive":"kpi-negative")}</section>
<div class="money-tabs">${["overview","expenses","mileage","sales","register"].map(t=>`<button class="tab-btn ${state.moneyTab===t?"active":""}" data-money-tab="${t}">${t==="overview"?"Overview":t==="register"?"Register":cap(t)}</button>`).join("")}${state.moneyTab==="register"?`<button class="btn small" id="recordSaleTop">＋ Record Sale</button>`:""}</div>
    <div id="moneyContent"></div>
  `;
  $("#addExpenseTop").onclick=()=>openExpenseModal();
  $$("[data-money-tab]").forEach(b=>b.onclick=()=>{state.moneyTab=b.dataset.moneyTab;renderMoney();});

  if(state.moneyTab==="overview"){
    $("#moneyContent").innerHTML=`
      <div class="section-head"><div><h3>Business Summary</h3><p>How Estimated Net is calculated from the records currently stored in the Organizer.</p></div></div>
      <div class="panel money-net-breakdown">
        <div class="money-breakdown-row"><span>Sales revenue</span><strong>${money(revenue)}</strong></div>
        <div class="money-breakdown-row"><span>Sold inventory cost</span><strong>− ${money(cost)}</strong></div>
        <div class="money-breakdown-row"><span>Selling costs</span><strong>− ${money(saleCostsTotal)}</strong></div>
        <div class="money-breakdown-row"><span>General business expenses</span><strong>− ${money(expTotal)}</strong></div>
        <div class="money-breakdown-row money-breakdown-total"><span>Estimated Net</span><strong class="${profit>=0?"kpi-positive":"kpi-negative"}">${money(profit)}</strong></div>
      </div>
      <div class="panel money-overview-note"><p>Estimated Net is a business operating estimate before taxes. Capitalized inventory acquisition expenses are excluded from general expenses because they are already included in item cost basis.</p></div>
    `;
  }else if(state.moneyTab==="expenses"){
    expenses.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const expenseReportHeaderSetting=await DB.getOne("settings","expenseReportHeader");
    const savedExpenseReportHeader=String(expenseReportHeaderSetting?.value||"");

    const receiptCounts=new Map();
    attachments.filter(a=>a.ownerType==="expense").forEach(a=>{
      receiptCounts.set(a.ownerId,(receiptCounts.get(a.ownerId)||0)+1);
    });

    const expenseCategories=await getExpenseCategories(expenses);
    const categoryOptions=expenseCategories.map(category=>`
      <label class="expense-category-option">
        <input type="checkbox" data-expense-category="${esc(category)}">
        <span>${esc(category)}</span>
      </label>`).join("");

    const expenseRows=expenses.map(e=>{
      const receiptCount=receiptCounts.get(e.id)||0;
      return [
        prettyDate(e.date),
        esc(e.category),
        esc(e.vendor||""),
        esc(e.description||""),
        money(e.amount),
        receiptCount?`🧾 ${receiptCount}`:"—",
        `<button class="btn secondary small" data-expense-id="${e.id}">Edit</button>`
      ];
    });

      const expensePurchaseEntriesAll=expensePurchaseEntries(expenses);const expensePurchaseRows=buildExpensePurchaseIntelligence(expenses);const expensePurchaseCategories=[...new Set(expensePurchaseEntriesAll.map(row=>row.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));const expensePurchaseCategoryTotals=expensePurchaseCategories.map(category=>{const rows=expensePurchaseEntriesAll.filter(row=>row.category===category);return{category,total:sum(rows.map(row=>row.total)),quantity:sum(rows.map(row=>row.quantity))}});
    $("#moneyContent").innerHTML=`
        <div class="section-head"><div><h3>Expenses</h3></div><button class="btn secondary small" id="expenseQuickCalculatorBtn" type="button">Calculator</button></div>

      <div class="panel expense-calculator" id="expenseCalculator">
        <div class="section-head">
          <div>
            <h3>Expense Calculator</h3>
            <p>Check exactly the categories you want to total, then choose the time period.</p>
              <div class="field expense-report-header-field">
                <label>Report Header</label>
                <input class="input" id="expenseReportHeader" type="text" value="${esc(savedExpenseReportHeader)}" placeholder="Example: Moonstone Music">
              </div>
          </div>
          <div class="expense-calc-actions">
            <button class="btn secondary small" id="expenseSelectAll" type="button">Select All</button>
            <button class="btn ghost small" id="expenseClearAll" type="button">Clear</button>
            <button class="btn secondary small" id="expenseExportReport" type="button">Export Report CSV</button>
            <button class="btn secondary small" id="expensePrintReport" type="button">Print</button>
              <button class="btn secondary small" id="expenseSavePdf" type="button">Save PDF</button>
          </div>
        </div>

        <div class="expense-category-grid">${categoryOptions}</div>

        <div class="expense-calc-controls">
          <div class="field">
            <label>Time period</label>
            <select class="input" id="expenseDateMode">
              <option value="all">All Time</option>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div class="field expense-date-control" id="expenseDayControl" hidden>
            <label>Day</label>
            <input class="input" id="expenseDay" type="date" value="${today()}">
          </div>

          <div class="field expense-date-control" id="expenseWeekControl" hidden>
            <label>Week</label>
            <input class="input" id="expenseWeek" type="week">
          </div>

          <div class="field expense-date-control" id="expenseMonthControl" hidden>
            <label>Month</label>
            <input class="input" id="expenseMonth" type="month" value="${today().slice(0,7)}">
          </div>

          <div class="expense-custom-range expense-date-control" id="expenseCustomControl" hidden>
            <div class="field">
              <label>From</label>
              <input class="input" id="expenseFrom" type="date">
            </div>
            <div class="field">
              <label>Through</label>
              <input class="input" id="expenseTo" type="date">
            </div>
          </div>
        </div>

        <div class="expense-calc-result">
          <div>
            <span class="expense-calc-label">Matching Expenses</span>
            <strong id="expenseMatchCount">0</strong>
          </div>
          <div>
            <span class="expense-calc-label">Selected Total</span>
            <strong id="expenseSelectedTotal">${money(0)}</strong>
          </div>
        </div>
      </div>

        <div class="panel" id="expensePurchasingIntelligence" style="margin:0 0 18px"><div class="section-head"><div><h3>Purchasing Intelligence</h3><p style="margin:4px 0 0;color:var(--muted);line-height:1.45">Itemized spending, purchase history and estimated reorder timing.</p></div><div class="field" style="margin:0;min-width:180px"><label>Item category</label><select class="select" id="expensePurchaseCategoryFilter"><option value="all">All categories</option>${expensePurchaseCategories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join("")}</select></div></div><section class="stats" style="margin:12px 0">${stat("Tracked Item Spend",money(sum(expensePurchaseEntriesAll.map(row=>row.total))),"business items before calculated tax")}${stat("Tracked Products",String(expensePurchaseRows.length),"repeat items grouped together")}${stat("Reorder Due",String(expensePurchaseRows.filter(row=>row.due).length),"history or manual interval")}</section><div class="section-head" style="margin-top:18px"><div><h4>Category Totals</h4></div></div><div class="expense-category-grid" style="margin-top:10px">${expensePurchaseCategoryTotals.length?expensePurchaseCategoryTotals.map(group=>`<div class="expense-category-option" style="display:block;cursor:default"><strong>${esc(group.category)}</strong><small style="display:block;color:var(--muted);margin-top:4px">${money(group.total)} - Qty ${group.quantity}</small></div>`).join(""):`<div class="muted">Add itemized purchases to build category totals.</div>`}</div><div class="section-head" style="margin-top:18px"><div><h4>Item Purchase History</h4><p id="expensePurchaseMatchSummary" style="margin:4px 0 0;color:var(--muted)"></p></div></div><div class="list">${expensePurchaseRows.length?expensePurchaseRows.map(row=>`<div class="list-card" data-expense-purchase-row data-expense-purchase-category="${esc(row.category)}"><div><h4>${esc(row.name)}</h4><p>${row.identifier?`ID: ${esc(row.identifier)} - `:""}${esc(row.category)}${row.vendor?` - ${esc(row.vendor)}`:""}<br>${row.purchaseCount} purchase${row.purchaseCount===1?"":"s"} - Qty ${row.totalQty} - Total ${money(row.totalSpend)}<br>Average unit ${money(row.averageUnitCost)} - Latest ${money(row.latestUnitCost)}${row.lastPurchase?` - Last ${esc(prettyDate(row.lastPurchase))}`:""}${row.averageInterval?` - Average ${row.averageInterval} days between purchases`:""}${row.manualReorder?` - Manual reorder ${row.manualReorder} days`:""}${row.nextPurchase?`<br><strong class="${row.due?"kpi-negative":""}">${row.due?"Reorder due":"Estimated next purchase"}: ${esc(prettyDate(row.nextPurchase))}</strong>`:""}</p></div></div>`).join(""):`<div class="muted">No itemized purchase history yet.</div>`}</div></div>
      <div class="section-head expense-records-head"><div><h3>Expense Records</h3></div></div>
      ${table(["Date","Category","Vendor","Description","Amount","Receipts",""],expenseRows)}
    `;

      $("#expenseQuickCalculatorBtn").onclick=openExpenseQuickCalculator;const expensePurchaseCategoryFilter=$("#expensePurchaseCategoryFilter");const updateExpensePurchaseFilter=()=>{const selected=expensePurchaseCategoryFilter.value;let visible=0;$$("[data-expense-purchase-row]",$("#expensePurchasingIntelligence")).forEach(row=>{const show=selected==="all"||row.dataset.expensePurchaseCategory===selected;row.hidden=!show;if(show)visible++});$("#expensePurchaseMatchSummary").textContent=`${visible} of ${expensePurchaseRows.length} tracked item${expensePurchaseRows.length===1?"":"s"}`};expensePurchaseCategoryFilter.onchange=updateExpensePurchaseFilter;
    const calculator=$("#expenseCalculator");
    const reportHeaderInput=$("#expenseReportHeader");
    const categoryChecks=$$("[data-expense-category]",calculator);
    const dateMode=$("#expenseDateMode");
    let currentExpenseMatches=[];

    reportHeaderInput.onchange=async()=>{
      await DB.put("settings",{
        key:"expenseReportHeader",
        value:String(reportHeaderInput.value||"").trim(),
        updatedAt:new Date().toISOString()
      });
    };

    const weekBounds=value=>{
      const match=String(value||"").match(/^(\d{4})-W(\d{2})$/);
      if(!match)return null;
      const year=Number(match[1]);
      const week=Number(match[2]);
      const jan4=new Date(year,0,4);
      const jan4Day=jan4.getDay()||7;
      const monday=new Date(year,0,4-jan4Day+1+(week-1)*7);
      const sunday=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+6);
      return [ymd(monday),ymd(sunday)];
    };

    const expenseDateMatches=(expenseDate,mode)=>{
      const value=String(expenseDate||"").slice(0,10);
      if(!value)return false;
      if(mode==="all")return true;
      if(mode==="day")return value===$("#expenseDay").value;
      if(mode==="month"){
        const month=$("#expenseMonth").value;
        return !!month && value.slice(0,7)===month;
      }
      if(mode==="week"){
        const bounds=weekBounds($("#expenseWeek").value);
        return !!bounds && value>=bounds[0] && value<=bounds[1];
      }
      if(mode==="custom"){
        const from=$("#expenseFrom").value;
        const to=$("#expenseTo").value;
        if(from && value<from)return false;
        if(to && value>to)return false;
        return !!(from||to);
      }
      return false;
    };

    const updateExpenseDateControls=()=>{
      $$(".expense-date-control",calculator).forEach(el=>el.hidden=true);
      if(dateMode.value==="day")$("#expenseDayControl").hidden=false;
      if(dateMode.value==="week")$("#expenseWeekControl").hidden=false;
      if(dateMode.value==="month")$("#expenseMonthControl").hidden=false;
      if(dateMode.value==="custom")$("#expenseCustomControl").hidden=false;
    };

    const updateExpenseCalculator=()=>{
      const selected=new Set(categoryChecks.filter(input=>input.checked).map(input=>input.dataset.expenseCategory));
      currentExpenseMatches=expenses.filter(e=>selected.has(String(e.category||"")) && expenseDateMatches(e.date,dateMode.value));
      $("#expenseMatchCount").textContent=String(currentExpenseMatches.length);
      $("#expenseSelectedTotal").textContent=money(sum(currentExpenseMatches.map(e=>num(e.amount))));
    };

    const expenseReportPeriodLabel=()=>{
      const mode=dateMode.value;
      if(mode==="all")return "All Time";
      if(mode==="day"){
        const day=$("#expenseDay").value;
        return day?prettyDate(day):"Day not selected";
      }
      if(mode==="week"){
        const bounds=weekBounds($("#expenseWeek").value);
        return bounds?`${prettyDate(bounds[0])} through ${prettyDate(bounds[1])}`:"Week not selected";
      }
      if(mode==="month"){
        const month=$("#expenseMonth").value;
        if(!month)return "Month not selected";
        return new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined,{month:"long",year:"numeric"});
      }
      if(mode==="custom"){
        const from=$("#expenseFrom").value;
        const to=$("#expenseTo").value;
        if(from&&to)return `${prettyDate(from)} through ${prettyDate(to)}`;
        if(from)return `From ${prettyDate(from)}`;
        if(to)return `Through ${prettyDate(to)}`;
        return "Custom range not selected";
      }
      return "All Time";
    };

    const buildExpenseReport=()=>{
      const categories=categoryChecks
        .filter(input=>input.checked)
        .map(input=>input.dataset.expenseCategory);
      const rows=currentExpenseMatches
        .slice()
        .sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
      return {
        header:String(reportHeaderInput.value||"").trim(),
        categories,
        period:expenseReportPeriodLabel(),
        rows,
        total:sum(rows.map(e=>num(e.amount)))
      };
    };

    $("#expenseExportReport").onclick=()=>{
      const report=buildExpenseReport();
      if(!report.categories.length){
        alert("Select at least one expense category.");
        return;
      }
      if(!report.rows.length){
        alert("There are no matching expenses to export.");
        return;
      }

      const headers=["Date","Category","Vendor","Description","Amount","Receipts","Payment Method","Notes"];
      const rows=report.rows.map(e=>[
        e.date||"",
        e.category||"",
        e.vendor||"",
        e.description||"",
        num(e.amount),
        receiptCounts.get(e.id)||0,
        e.paymentMethod||"",
        e.notes||""
      ]);

      const csv=[
        headers,
        ...rows,
        ["","","","Grand Total",report.total.toFixed(2),"","",""]
      ].map(row=>row.map(csvCell).join(",")).join("\n");

      downloadFile(`expense-report-${today()}.csv`,csv,"text/csv");
      toast("Expense report CSV exported.");
    };

    const saveExpenseReportPdf=report=>{
      const jsPDFClass=window.jspdf&&window.jspdf.jsPDF;
      if(!jsPDFClass){
        alert("The PDF generator did not load. Refresh the app and try again.");
        return;
      }
      const doc=new jsPDFClass({orientation:"landscape",unit:"mm",format:"a4"});
      if(typeof doc.autoTable!=="function"){
        alert("The PDF table generator did not load. Refresh the app and try again.");
        return;
      }
      const pageWidth=doc.internal.pageSize.getWidth();
      const margin=12;
      const contentWidth=pageWidth-(margin*2);
      const clean=value=>String(value??"").replace(/[^ -~]/g,"?");
      const categoryText=clean(report.categories.join(", "));
      const summary=[
        ["Period",clean(report.period)],
        ["Categories",categoryText],
        ["Matching Expenses",String(report.rows.length)],
        ["Grand Total",money(report.total)]
      ];
      if(report.header){
        doc.setFont("helvetica","bold");
        doc.setFontSize(18);
        doc.text(clean(report.header),margin,14);
      }
      doc.setFont("helvetica","normal");
      doc.setFontSize(12);
      doc.text("Expense Report",margin,report.header?21:14);
      const summaryY=report.header?27:20;
      const gap=3;
      const boxWidth=(contentWidth-(gap*3))/4;
      const boxHeight=22;
      summary.forEach((entry,index)=>{
        const x=margin+(index*(boxWidth+gap));
        doc.setDrawColor(185);
        doc.setFillColor(247,247,247);
        doc.roundedRect(x,summaryY,boxWidth,boxHeight,2,2,"FD");
        doc.setFont("helvetica","bold");
        doc.setFontSize(7);
        doc.setTextColor(95);
        doc.text(entry[0].toUpperCase(),x+3,summaryY+5);
        doc.setFontSize(index===1?8:10);
        doc.setTextColor(20);
        const valueLines=doc.splitTextToSize(clean(entry[1]),boxWidth-6).slice(0,3);
        doc.text(valueLines,x+3,summaryY+11);
      });
      const body=report.rows.map(e=>[
        prettyDate(e.date),
        clean(e.category||""),
        clean(e.vendor||""),
        clean(e.description||""),
        money(e.amount),
        String(receiptCounts.get(e.id)||0),
        clean(e.paymentMethod||""),
        clean(e.notes||"")
      ]);
      doc.autoTable({
        startY:summaryY+boxHeight+7,
        margin:{left:margin,right:margin,bottom:16},
        head:[["Date","Category","Vendor","Description","Amount","Receipts","Payment Method","Notes"]],
        body,
        foot:[["","","","Grand Total",money(report.total),"","",""]],
        theme:"grid",
        styles:{
          font:"helvetica",
          fontSize:7.5,
          cellPadding:2.2,
          textColor:[25,25,25],
          lineColor:[185,185,185],
          lineWidth:0.15,
          valign:"top",
          overflow:"linebreak"
        },
        headStyles:{
          fillColor:[235,235,235],
          textColor:[20,20,20],
          fontStyle:"bold",
          lineColor:[165,165,165],
          lineWidth:0.2
        },
        footStyles:{
          fillColor:[245,245,245],
          textColor:[20,20,20],
          fontStyle:"bold",
          lineColor:[165,165,165],
          lineWidth:0.2
        },
        columnStyles:{
          0:{cellWidth:22},
          1:{cellWidth:31},
          2:{cellWidth:31},
          3:{cellWidth:50},
          4:{cellWidth:24,halign:"right"},
          5:{cellWidth:19,halign:"center"},
          6:{cellWidth:31},
          7:{cellWidth:58}
        },
        didDrawPage:()=>{
          const pageNumber=doc.internal.getCurrentPageInfo().pageNumber;
          const pageHeight=doc.internal.pageSize.getHeight();
          doc.setFont("helvetica","normal");
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text("Generated "+new Date().toLocaleString(),margin,pageHeight-6);
          doc.text("Page "+pageNumber,pageWidth-margin,pageHeight-6,{align:"right"});
        }
      });
      doc.save("expense-report-"+today()+".pdf");
      toast("Expense report PDF saved.");
    };


    const openExpenseReport=mode=>{
      const report=buildExpenseReport();
      if(!report.categories.length){
        alert("Select at least one expense category.");
        return;
      }
      if(!report.rows.length){
        alert("There are no matching expenses in this report.");
        return;
      }

      if(mode==="pdf"){saveExpenseReportPdf(report);return;}
      const w=window.open("","_blank","width=1000,height=800");
      if(!w){
        alert("Allow pop-ups to open the expense report.");
        return;
      }

      const rowsHtml=report.rows.map(e=>`
        <tr>
          <td>${esc(prettyDate(e.date))}</td>
          <td>${esc(e.category||"")}</td>
          <td>${esc(e.vendor||"")}</td>
          <td>${esc(e.description||"")}</td>
          <td class="money">${esc(money(e.amount))}</td>
          <td>${receiptCounts.get(e.id)||0}</td>
          <td>${esc(e.paymentMethod||"")}</td>
          <td>${esc(e.notes||"")}</td>
        </tr>`).join("");

      w.document.write(`
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Expense Report - ${esc(today())}</title>
          <style>
            *{box-sizing:border-box}
            body{font-family:Arial,sans-serif;color:#111;background:#fff;margin:0;padding:28px}
            h1{font-size:24px;margin:0 0 4px}
            h2{font-size:16px;margin:0 0 22px;font-weight:500;color:#444}
            .summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 22px}
            .summary div{border:1px solid #bbb;border-radius:8px;padding:10px 12px}
            .summary span{display:block;font-size:11px;text-transform:uppercase;color:#666;margin-bottom:4px}
            .summary strong{font-size:16px}
            table{width:100%;border-collapse:collapse;font-size:12px}
            th,td{border:1px solid #bbb;padding:7px;text-align:left;vertical-align:top}
            th{background:#eee}
            td.money{text-align:right;white-space:nowrap}
            tfoot td{font-weight:700;background:#f5f5f5}
            .generated{margin-top:14px;font-size:10px;color:#666}
            .report-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 22px;padding:12px;border:1px solid #ccc;border-radius:8px;background:#f7f7f7}
            .report-toolbar .hint{flex:1 1 320px;font-size:12px;color:#444;line-height:1.4}
            .report-toolbar button{border:1px solid #999;border-radius:7px;background:#fff;color:#111;padding:8px 12px;font-weight:700;cursor:pointer}
            @media print{.report-toolbar{display:none!important}}
            @media print{
              body{padding:0}
              .summary div{break-inside:avoid}
              table{font-size:10px}
              thead{display:table-header-group}
              tr{break-inside:avoid}
            }
          </style>
        </head>
        <body>
          <div class="report-toolbar">
            <div class="hint"><strong>Expense Report</strong><br>Print opens the browser print dialog. Save as PDF downloads a PDF file directly.</div>
            <button id="reportPrint" type="button">Print</button>
            <button id="reportSavePdf" type="button">Save as PDF</button>
            <button id="closeReport" type="button">Close</button>
          </div>
          ${report.header?`<h1>${esc(report.header)}</h1>`:""}
          <h2>Expense Report</h2>

          <div class="summary">
            <div><span>Period</span><strong>${esc(report.period)}</strong></div>
            <div><span>Categories</span><strong>${esc(report.categories.join(", "))}</strong></div>
            <div><span>Matching Expenses</span><strong>${report.rows.length}</strong></div>
            <div><span>Grand Total</span><strong>${esc(money(report.total))}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Vendor</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Receipts</th>
                <th>Payment Method</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="4">Grand Total</td>
                <td class="money">${esc(money(report.total))}</td>
                <td colspan="3"></td>
              </tr>
            </tfoot>
          </table>

          <div class="generated">Generated ${esc(new Date().toLocaleString())}</div>
        </body>
        </html>
      `);

      w.document.close();
      w.focus();
      const reportPrint=w.document.getElementById("reportPrint");
      const reportSavePdf=w.document.getElementById("reportSavePdf");
      const closeReport=w.document.getElementById("closeReport");
      if(reportPrint)reportPrint.onclick=()=>w.print();
      if(reportSavePdf)reportSavePdf.onclick=()=>saveExpenseReportPdf(report);
      if(closeReport)closeReport.onclick=()=>w.close();
      if(mode==="print")setTimeout(()=>w.print(),250);
    };

    $("#expensePrintReport").onclick=()=>openExpenseReport("print");
    $("#expenseSavePdf").onclick=()=>openExpenseReport("pdf");

    $("#expenseSelectAll").onclick=()=>{
      categoryChecks.forEach(input=>input.checked=true);
      updateExpenseCalculator();
    };

    $("#expenseClearAll").onclick=()=>{
      categoryChecks.forEach(input=>input.checked=false);
      updateExpenseCalculator();
    };

    categoryChecks.forEach(input=>input.onchange=updateExpenseCalculator);

    dateMode.onchange=()=>{
      updateExpenseDateControls();
      updateExpenseCalculator();
    };

    ["expenseDay","expenseWeek","expenseMonth","expenseFrom","expenseTo"].forEach(id=>{
      const input=$("#"+id);
      if(input)input.onchange=updateExpenseCalculator;
    });

    updateExpenseDateControls();
      updateExpenseCalculator();updateExpensePurchaseFilter();

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

function expenseLineItems(expense){return Array.isArray(expense&&expense.lineItems)?expense.lineItems:[]}function expenseLineQty(row){const raw=row&&row.quantity;if(raw===""||raw===null||raw===undefined)return 1;return Math.max(0,num(raw))}function expenseLineTotal(row){return expenseLineQty(row)*Math.max(0,num(row&&row.unitCost))}function expenseSubtotal(expense){return sum(expenseLineItems(expense).map(expenseLineTotal))}function expensePurchaseEntries(expenses){return expenses.flatMap(expense=>expenseLineItems(expense).map(row=>({expenseId:expense.id,date:String(expense.date||"").slice(0,10),vendor:String(expense.vendor||"").trim(),name:String(row.name||"").trim(),identifier:String(row.identifier||"").trim(),category:String(row.category||expense.category||"Other").trim()||"Other",quantity:expenseLineQty(row),unitCost:Math.max(0,num(row.unitCost)),total:expenseLineTotal(row),reorderDays:Math.max(0,num(row.reorderDays))}))).filter(row=>row.name||row.identifier)}function buildExpensePurchaseIntelligence(expenses){const rows=expensePurchaseEntries(expenses);const groups=new Map();rows.forEach(row=>{const key=row.identifier?"id:"+row.identifier.toLowerCase():"name:"+row.name.toLowerCase()+"|"+row.category.toLowerCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)});return [...groups.values()].map(group=>{const sorted=group.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));const latest=sorted[sorted.length-1];const totalSpend=sum(sorted.map(row=>row.total));const totalQty=sum(sorted.map(row=>row.quantity));const purchaseCount=new Set(sorted.map(row=>row.expenseId)).size;const dates=[...new Set(sorted.map(row=>row.date).filter(Boolean))].sort();const intervals=[];for(let index=1;index<dates.length;index++){const previous=new Date(dates[index-1]+"T12:00:00");const current=new Date(dates[index]+"T12:00:00");const days=Math.round((current-previous)/86400000);if(Number.isFinite(days)&&days>=0)intervals.push(days)}const averageInterval=intervals.length?Math.round(sum(intervals)/intervals.length):0;const manualRow=sorted.slice().reverse().find(row=>row.reorderDays>0);const manualReorder=manualRow?manualRow.reorderDays:0;const interval=manualReorder||averageInterval;let nextPurchase="";if(latest.date&&interval){const next=new Date(latest.date+"T12:00:00");next.setDate(next.getDate()+interval);nextPurchase=ymd(next)}return{name:latest.name||latest.identifier||"Unnamed item",identifier:latest.identifier,category:latest.category,vendor:latest.vendor,totalSpend,totalQty,purchaseCount,averageUnitCost:totalQty?totalSpend/totalQty:0,latestUnitCost:latest.unitCost,lastPurchase:latest.date,averageInterval,manualReorder,nextPurchase,due:!!nextPurchase&&nextPurchase<=today()}}).sort((a,b)=>{if(a.due!==b.due)return a.due?-1:1;if(a.nextPurchase&&b.nextPurchase)return a.nextPurchase.localeCompare(b.nextPurchase);if(a.nextPurchase)return -1;if(b.nextPurchase)return 1;return b.totalSpend-a.totalSpend})}
async function openExpenseModal(exp,receiptSeed){
  const [items,events,auctions,expenseCategories]=await Promise.all([DB.getAll("items"),DB.getAll("events"),DB.getAll("auctions"),getExpenseCategories()]);
  const e=exp||{id:DB.uid("expense"),date:today(),category:"Fuel",amount:"",vendor:"",description:"",itemId:"",eventId:"",auctionId:"",paymentMethod:"",notes:"",taxRate:"",taxAmount:0,lineItems:[]};
  openModal(`
      <div class="modal-head"><h2>${exp?"Edit Expense":"Add Expense"}</h2><div style="display:flex;gap:8px;align-items:center"><button class="btn secondary small" id="expenseModalCalculator" type="button">Calculator</button><button class="close-btn" data-close type="button">X</button></div></div>
    <form id="expenseForm"><div class="modal-body"><div class="form-grid">
      ${field("Date","date",e.date,true,"date")}${selectField("Category","category",expenseCategories,e.category)}${field("Amount","amount",e.amount,true,"number","0.01")}${field("Vendor","vendor",e.vendor)}${field("Description","description",e.description)}${field("Payment method","paymentMethod",e.paymentMethod)}
      ${relationField("Related item","itemId",items.map(x=>[x.id,x.name]),e.itemId)}${relationField("Related event","eventId",events.map(x=>[x.id,x.title]),e.eventId)}${relationField("Related auction","auctionId",auctions.map(x=>[x.id,x.name]),e.auctionId)}${textareaField("Notes","notes",e.notes)}
      </div>
      <div class="record-section"><div class="record-section-title"><span>ITEM</span><div><strong>Itemized Purchase</strong><small>Add only the business items from a mixed receipt. Quantity x unit cost is totaled automatically.</small></div></div><div id="expenseLineItems"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button class="btn secondary small" id="addExpenseLineItem" type="button">+ Add Item</button></div><div class="form-grid"><div class="field"><label>Sales tax percentage</label><input class="input" id="expenseTaxRate" type="number" min="0" step="0.01" value="${esc(e.taxRate??"")}" placeholder="Example: 6"></div><div class="field"><label>Calculated tax</label><output class="input" id="expenseTaxAmount" style="display:flex;align-items:center">${money(e.taxAmount)}</output></div></div><div class="panel" style="margin-top:12px"><p style="margin:0"><strong>Business-item subtotal:</strong> <span id="expenseSubtotalOutput">${money(0)}</span><br><strong>Calculated tax:</strong> <span id="expenseTaxOutput">${money(0)}</span><br><strong>Expense total:</strong> <span id="expenseCalculatedTotal">${money(e.amount)}</span></p></div></div>
      <div class="record-section">
        <div class="record-section-title"><span>🧾</span><div><strong>Receipts / Attachments</strong><small>Keep receipt photos with this expense record.</small></div></div>
        <div class="photo-actions">
          <button class="photo-action camera-action" id="takeReceiptPhotoBtn" type="button"><span class="photo-action-icon">📷</span><span><strong>Take Receipt Photo</strong><small>Use the phone camera</small></span></button>
          <button class="photo-action" id="chooseReceiptPhotoBtn" type="button"><span class="photo-action-icon">🖼</span><span><strong>Add From Gallery</strong><small>Select one or more receipt pictures</small></span></button>
        </div>
        <input id="receiptCameraInput" type="file" accept="image/*" capture="environment" hidden>
        <input id="receiptGalleryInput" type="file" accept="image/*" multiple hidden>
        <div class="photo-strip" id="receiptPreview"><div class="muted">No receipts attached yet.</div></div>
      </div>
    </div><div class="modal-actions">${exp?`<button class="btn danger" id="deleteExpense" type="button">Delete</button>`:""}<button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Expense</button></div></form>
  `);
    const expenseForm=$("#expenseForm");const expenseAmount=expenseForm.elements.amount;const expenseTaxRate=$("#expenseTaxRate");let simpleExpenseAmount=String(e.amount??"");const stagedLineItems=expenseLineItems(e).map(row=>Object.assign({id:DB.uid("expenseLine"),name:"",quantity:1,unitCost:"",identifier:"",category:e.category||"Other",reorderDays:"",notes:""},row));
    const stagedReceipts=Array.isArray(receiptSeed) ? receiptSeed : exp
      ? (await DB.getByIndex("attachments","ownerId",e.id)).filter(a=>a.ownerType==="expense")
      : [];

    const expenseCalculatedTotals=()=>{const subtotal=sum(stagedLineItems.map(expenseLineTotal));const rate=Math.max(0,num(expenseTaxRate.value));const tax=stagedLineItems.length?Math.round((subtotal*rate/100+Number.EPSILON)*100)/100:0;const total=Math.round((subtotal+tax+Number.EPSILON)*100)/100;return{subtotal,rate,tax,total};};const updateExpenseCalculatedTotals=()=>{const totals=expenseCalculatedTotals();$("#expenseSubtotalOutput").textContent=money(totals.subtotal);$("#expenseTaxAmount").textContent=money(totals.tax);$("#expenseTaxOutput").textContent=money(totals.tax);$("#expenseCalculatedTotal").textContent=money(stagedLineItems.length?totals.total:expenseAmount.value);expenseAmount.readOnly=stagedLineItems.length>0;if(stagedLineItems.length){expenseAmount.value=totals.total.toFixed(2);}$$("[data-expense-line-total]",$("#expenseLineItems")).forEach(output=>{const index=Number(output.dataset.expenseLineTotal);output.textContent=money(expenseLineTotal(stagedLineItems[index]||{}));});};const renderExpenseLineItems=()=>{const holder=$("#expenseLineItems");holder.innerHTML=stagedLineItems.length?stagedLineItems.map((row,index)=>`<div class="panel" data-expense-line-card="${index}" style="margin:10px 0;padding:12px"><div class="section-head" style="margin-bottom:10px"><div><strong>Item ${index+1}</strong><small style="display:block;color:var(--muted);margin-top:3px">Line total: <span data-expense-line-total="${index}">${money(expenseLineTotal(row))}</span></small></div><button class="btn danger small" type="button" data-remove-expense-line="${index}">Remove</button></div><div class="form-grid"><div class="field"><label>Item / description</label><input class="input" data-expense-line-field="name" value="${esc(row.name||"")}" placeholder="Example: Packing tape"></div><div class="field"><label>SKU / UPC / part number / identifier</label><input class="input" data-expense-line-field="identifier" value="${esc(row.identifier||"")}"></div><div class="field"><label>Quantity</label><input class="input" data-expense-line-field="quantity" type="number" min="0" step="1" value="${esc(row.quantity??1)}"></div><div class="field"><label>Unit cost</label><input class="input" data-expense-line-field="unitCost" type="number" min="0" step="0.01" value="${esc(row.unitCost??"")}"></div><div class="field"><label>Category</label><select class="select" data-expense-line-field="category">${expenseCategories.map(category=>`<option value="${esc(category)}" ${String(category)===String(row.category||e.category)?"selected":""}>${esc(category)}</option>`).join("")}</select></div><div class="field"><label>Reorder after days</label><input class="input" data-expense-line-field="reorderDays" type="number" min="0" step="1" value="${esc(row.reorderDays??"")}" placeholder="Optional"></div><div class="field full"><label>Item notes</label><input class="input" data-expense-line-field="notes" value="${esc(row.notes||"")}"></div></div></div>`).join(""):`<div class="muted">No itemized products. Use the normal Amount field for a simple expense, or add only the business items from a mixed receipt.</div>`;$$("[data-expense-line-card]",holder).forEach(card=>{const index=Number(card.dataset.expenseLineCard);$$("[data-expense-line-field]",card).forEach(input=>{const sync=()=>{stagedLineItems[index][input.dataset.expenseLineField]=input.value;updateExpenseCalculatedTotals();};input.oninput=sync;input.onchange=sync;});});$$("[data-remove-expense-line]",holder).forEach(button=>{button.onclick=()=>{stagedLineItems.splice(Number(button.dataset.removeExpenseLine),1);if(!stagedLineItems.length){expenseAmount.readOnly=false;expenseAmount.value=simpleExpenseAmount;}renderExpenseLineItems();};});updateExpenseCalculatedTotals();};
    const renderReceiptPreview=()=>{
      const strip=$("#receiptPreview");
      if(!strip)return;

      strip.innerHTML=stagedReceipts.length
        ? stagedReceipts.map((receipt,index)=>`<div class="photo-thumb" data-receipt-index="${index}"><img alt="Receipt preview" data-view-receipt="${index}" title="View receipt"><button type="button" data-remove-receipt="${index}" aria-label="Remove receipt">×</button></div>`).join("")
        : `<div class="muted">No receipts attached yet.</div>`;

      stagedReceipts.forEach((receipt,index)=>{
        const holder=strip.querySelector(`[data-receipt-index="${index}"]`);
        const img=holder&&holder.querySelector("img");
        if(img&&receipt.blob){
          const url=URL.createObjectURL(receipt.blob);
          img.src=url;
          img.onload=()=>URL.revokeObjectURL(url);
        }
      });

      $$("[data-remove-receipt]").forEach(button=>{
        button.onclick=()=>{
          stagedReceipts.splice(Number(button.dataset.removeReceipt),1);
          renderReceiptPreview();
        };
      });

    $$("[data-view-receipt]",strip).forEach(image=>{
      image.onclick=()=>{
        const receipt=stagedReceipts[Number(image.dataset.viewReceipt)];
        if(!receipt||!receipt.blob)return;

        const url=URL.createObjectURL(receipt.blob);
        const viewer=document.createElement("div");
        viewer.className="receipt-viewer";

        const panel=document.createElement("div");
        panel.className="receipt-viewer-panel";

        const closeButton=document.createElement("button");
        closeButton.type="button";
        closeButton.className="receipt-viewer-close";
        closeButton.setAttribute("aria-label","Close receipt viewer");
        closeButton.textContent="×";

        const fullImage=document.createElement("img");
        fullImage.src=url;
        fullImage.alt="Receipt";

        const closeViewer=()=>{
          URL.revokeObjectURL(url);
          viewer.remove();
        };

        closeButton.onclick=closeViewer;
        viewer.onclick=event=>{
          if(event.target===viewer)closeViewer();
        };

        panel.appendChild(closeButton);
        panel.appendChild(fullImage);
        viewer.appendChild(panel);
        modalRoot.appendChild(viewer);
      };
    });

    };

    const stageReceiptFiles=async files=>{
      for(const file of Array.from(files||[])){
        if(!String(file.type||"").startsWith("image/"))continue;
        stagedReceipts.push({
          id:DB.uid("attachment"),
          ownerType:"expense",
          ownerId:e.id,
          name:file.name||"Receipt photo",
          type:"receipt",
          mimeType:"image/jpeg",
          blob:await compressImage(file),
          createdAt:new Date().toISOString()
        });
      }
      renderReceiptPreview();
    };

    $("#addExpenseLineItem").onclick=()=>{if(!stagedLineItems.length){simpleExpenseAmount=String(expenseAmount.value||"");}stagedLineItems.push({id:DB.uid("expenseLine"),name:"",quantity:1,unitCost:"",identifier:"",category:expenseForm.elements.category.value||"Other",reorderDays:"",notes:""});renderExpenseLineItems();};expenseTaxRate.oninput=updateExpenseCalculatedTotals;expenseAmount.oninput=()=>{if(!stagedLineItems.length){simpleExpenseAmount=expenseAmount.value;}updateExpenseCalculatedTotals();};$("#expenseModalCalculator").onclick=openExpenseQuickCalculator;
    $("#takeReceiptPhotoBtn").onclick=async()=>{
      const draftTotals=expenseCalculatedTotals();const expenseDraft=Object.assign({},e,Object.fromEntries(new FormData($("#expenseForm")).entries()),{lineItems:stagedLineItems.map(row=>Object.assign({},row)),taxRate:expenseTaxRate.value,taxAmount:stagedLineItems.length?draftTotals.tax:0,amount:stagedLineItems.length?draftTotals.total.toFixed(2):expenseAmount.value});
      const preservedReceipts=stagedReceipts.slice();
      closeModal();
      await startCameraCapture(async blobs=>{
        const capturedReceipts=blobs.map(blob=>({
          id:DB.uid("attachment"),
          ownerType:"expense",
          ownerId:e.id,
          name:"Receipt photo",
          type:"receipt",
          mimeType:blob.type||"image/jpeg",
          blob,
          createdAt:new Date().toISOString()
        }));
        await openExpenseModal(expenseDraft,preservedReceipts.concat(capturedReceipts));
      },async()=>{
        await openExpenseModal(expenseDraft,preservedReceipts);
      });
    };
    $("#chooseReceiptPhotoBtn").onclick=()=>$("#receiptGalleryInput").click();

    $("#receiptCameraInput").onchange=async event=>{
      await stageReceiptFiles(event.target.files);
      event.target.value="";
    };

    $("#receiptGalleryInput").onchange=async event=>{
      await stageReceiptFiles(event.target.files);
      event.target.value="";
    };

    renderExpenseLineItems();renderReceiptPreview();

  $("#expenseForm").onsubmit=async x=>{
      x.preventDefault();
      const data=Object.fromEntries(new FormData(x.currentTarget).entries());const cleanLineItems=stagedLineItems.map(row=>({id:row.id||DB.uid("expenseLine"),name:String(row.name||"").trim(),quantity:expenseLineQty(row),unitCost:Math.max(0,num(row.unitCost)),identifier:String(row.identifier||"").trim(),category:String(row.category||data.category||"Other").trim()||"Other",reorderDays:Math.max(0,Math.round(num(row.reorderDays))),notes:String(row.notes||"").trim()})).filter(row=>row.name||row.identifier||row.unitCost>0);data.lineItems=cleanLineItems;data.taxRate=String(expenseTaxRate.value||"").trim();if(cleanLineItems.length){const subtotal=sum(cleanLineItems.map(expenseLineTotal));const tax=Math.round((subtotal*Math.max(0,num(data.taxRate))/100+Number.EPSILON)*100)/100;data.taxAmount=tax;data.amount=(Math.round((subtotal+tax+Number.EPSILON)*100)/100).toFixed(2);}else{data.taxAmount=0;}await DB.put("expenses",Object.assign({},e,data));

      const existingReceiptAttachments=(await DB.getByIndex("attachments","ownerId",e.id))
        .filter(a=>a.ownerType==="expense");
      const keepReceiptIds=new Set(stagedReceipts.map(a=>a.id));

      for(const attachment of existingReceiptAttachments){
        if(!keepReceiptIds.has(attachment.id)){
          await DB.remove("attachments",attachment.id);
        }
      }

      for(const attachment of stagedReceipts){
        await DB.put("attachments",attachment);
      }

      closeModal();
      toast("Expense saved.");
      renderMoney();
    };
  if(exp)$("#deleteExpense").onclick=async()=>{
      if(confirm("Delete this expense and its attached receipts?")){
        const receiptAttachments=(await DB.getByIndex("attachments","ownerId",e.id))
          .filter(a=>a.ownerType==="expense");
        for(const attachment of receiptAttachments){
          await DB.remove("attachments",attachment.id);
        }
        await DB.remove("expenses",e.id);
        closeModal();
        renderMoney();
      }
    };
}

let expenseQuickCalcMemory=0;function openExpenseQuickCalculator(){const existing=document.getElementById("expenseQuickCalculator");if(existing){existing.remove();return;}const overlay=document.createElement("div");overlay.id="expenseQuickCalculator";overlay.style.cssText="position:fixed;inset:0;z-index:12000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px";overlay.innerHTML=`<div style="width:min(390px,96vw);background:#0c1624;border:1px solid var(--line);border-radius:20px;padding:16px;box-shadow:0 24px 70px rgba(0,0,0,.55)"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px"><div><div class="eyebrow">EXPENSES</div><h2 style="margin:0">Quick Calculator</h2></div><button class="close-btn" type="button" data-ec="close">X</button></div><div id="expenseCalcMemoryStatus" style="min-height:18px;color:var(--muted);font-size:12px;text-align:right;margin-bottom:5px"></div><div id="expenseCalcExpression" style="min-height:26px;background:#06111f;border:1px solid var(--line);border-bottom:0;border-radius:14px 14px 0 0;padding:10px 15px 4px;text-align:right;color:var(--muted);font-size:15px;overflow-wrap:anywhere">0</div><div id="expenseCalcDisplay" style="background:#06111f;border:1px solid var(--line);border-top:0;border-radius:0 0 14px 14px;padding:6px 15px 15px;text-align:right;font-size:30px;font-weight:800;overflow:hidden;margin-bottom:12px">0</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px"><button class="btn ghost" type="button" data-ec="MC">MC</button><button class="btn ghost" type="button" data-ec="MR">MR</button><button class="btn ghost" type="button" data-ec="M+">M+</button><button class="btn ghost" type="button" data-ec="M-">M-</button></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"><button class="btn secondary" type="button" data-ec="C">C</button><button class="btn secondary" type="button" data-ec="DEL">DEL</button><button class="btn secondary" type="button" data-ec="%">%</button><button class="btn secondary" type="button" data-ec="/">/</button><button class="btn secondary" type="button" data-ec="7">7</button><button class="btn secondary" type="button" data-ec="8">8</button><button class="btn secondary" type="button" data-ec="9">9</button><button class="btn secondary" type="button" data-ec="*">x</button><button class="btn secondary" type="button" data-ec="4">4</button><button class="btn secondary" type="button" data-ec="5">5</button><button class="btn secondary" type="button" data-ec="6">6</button><button class="btn secondary" type="button" data-ec="-">-</button><button class="btn secondary" type="button" data-ec="1">1</button><button class="btn secondary" type="button" data-ec="2">2</button><button class="btn secondary" type="button" data-ec="3">3</button><button class="btn secondary" type="button" data-ec="+">+</button><button class="btn secondary" type="button" data-ec="0">0</button><button class="btn secondary" type="button" data-ec=".">.</button><button class="btn" type="button" data-ec="=" style="grid-column:span 2">=</button></div></div>`;document.body.appendChild(overlay);const display=overlay.querySelector("#expenseCalcDisplay");const expressionDisplay=overlay.querySelector("#expenseCalcExpression");const memoryStatus=overlay.querySelector("#expenseCalcMemoryStatus");let current="0";let accumulator=null;let operator="";let waiting=false;let expressionPrefix="";let completedExpression="";let justFinished=false;const format=value=>{const number=Number(value);return String(Number.isFinite(number)?Math.round((number+Number.EPSILON)*100000000)/100000000:0)};const operatorLabel=op=>op==="*"?"x":op;const expressionText=()=>{if(completedExpression)return completedExpression;if(operator&&accumulator!==null)return expressionPrefix+(waiting?"":current);return current;};const render=()=>{display.textContent=current;expressionDisplay.textContent=expressionText();memoryStatus.textContent=expenseQuickCalcMemory!==0?`Memory: ${expenseQuickCalcMemory}`:"Memory empty";};const setCurrent=value=>{current=format(value);};const calculate=(left,right,op)=>{if(op==="+")return left+right;if(op==="-")return left-right;if(op==="*")return left*right;if(op==="/")return right===0?0:left/right;return right;};const resetCalculation=()=>{current="0";accumulator=null;operator="";waiting=false;expressionPrefix="";completedExpression="";justFinished=false;};overlay.onclick=event=>{if(event.target===overlay){overlay.remove();return;}const button=event.target.closest("[data-ec]");if(!button)return;const key=button.dataset.ec;if(key==="close"){overlay.remove();return;}if("0123456789".includes(key)){if(justFinished){resetCalculation();current=key;}else if(waiting||current==="0"){current=key;waiting=false;}else{current+=key;}completedExpression="";render();return;}if(key==="."){if(justFinished){resetCalculation();current="0.";}else if(waiting){current="0.";waiting=false;}else if(!current.includes(".")){current+=".";}completedExpression="";render();return;}if(["+","-","*","/"].includes(key)){const value=num(current);if(justFinished){accumulator=value;operator=key;expressionPrefix=`${current} ${operatorLabel(key)} `;completedExpression="";waiting=true;justFinished=false;render();return;}if(accumulator===null){accumulator=value;operator=key;expressionPrefix=`${current} ${operatorLabel(key)} `;}else if(waiting){operator=key;expressionPrefix=`${accumulator} ${operatorLabel(key)} `;}else{accumulator=calculate(accumulator,value,operator);expressionPrefix+=`${current} ${operatorLabel(key)} `;current=format(accumulator);operator=key;}waiting=true;completedExpression="";render();return;}if(key==="="){if(accumulator!==null&&operator&&!waiting){const right=current;const result=calculate(accumulator,num(right),operator);completedExpression=`${expressionPrefix}${right} =`;current=format(result);accumulator=null;operator="";waiting=true;justFinished=true;render();}return;}if(key==="%"){let value=num(current);if(accumulator!==null&&(operator==="+"||operator==="-")){value=accumulator*value/100;}else{value=value/100;}current=format(value);waiting=false;completedExpression="";justFinished=false;render();return;}if(key==="C"){resetCalculation();render();return;}if(key==="DEL"){if(justFinished){resetCalculation();render();return;}if(waiting)return;current=current.length>1?current.slice(0,-1):"0";if(current==="-"||current==="")current="0";render();return;}if(key==="MC"){expenseQuickCalcMemory=0;render();return;}if(key==="MR"){if(justFinished){resetCalculation();}current=format(expenseQuickCalcMemory);waiting=false;completedExpression="";justFinished=false;render();return;}if(key==="M+"){expenseQuickCalcMemory=Math.round((expenseQuickCalcMemory+num(current)+Number.EPSILON)*100)/100;render();return;}if(key==="M-"){expenseQuickCalcMemory=Math.round((expenseQuickCalcMemory-num(current)+Number.EPSILON)*100)/100;render();return;}};render();}
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
  if(initialItemId){const initialItem=available.find(i=>i.id===initialItemId);if(initialItem)lookup.value=initialItem.sku||"";}
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
          <p><strong>Dashboard:</strong> Business totals, central Needs Attention shortcuts, Auction Follow-Up and upcoming activity.</p>
        <p><strong>Inventory:</strong> Add, organize, search, group, label and manage everything owned, cataloged, listed or sold.</p>
        <p><strong>Calendar:</strong> Fairs, festivals, pickups, sales and other events.</p>
        <p><strong>Money:</strong> Business overview, expenses, mileage, item sales and the Sales Register.</p>
        <p><strong>Auctions:</strong> Auction sourcing, watch lots, bidding plans and winning-item intake.</p>
          <p><strong>More:</strong> Backups, CSV exports, payment methods, custom expense categories, Archived Auctions, Receipt Archive, persistent storage and this User Guide.</p>
      </div>
    </section>
      <div class="section-head"><div><h3>Dashboard</h3><p>See the business at a glance and jump directly into the records behind the totals.</p></div></div>

      <section class="grid-2">
        <div class="panel">
          <h3>Business Snapshot</h3>
          <p>In Stock shows unsold inventory count. Invested shows landed cost tied up in unsold inventory. Combined Asking Prices is the sum of asking prices for unsold inventory. Estimated Net uses sales, sold inventory cost, selling costs and general business expenses.</p>
          <p>The Snapshot cards are clickable. In Stock opens Inventory, Invested and Combined Asking Prices open item breakdowns, and Estimated Net opens Money → Overview.</p>
        </div>
        <div class="panel">
          <h3>Needs Attention</h3>
          <p>The Dashboard keeps one central Needs attention area for unfinished business work. Inventory cards cover Finish Cataloging, Needs Work, Needs Pricing and Needs Photos.</p>
          <p>Auction Follow-Up counts ended auctions that still contain unresolved Watch Lots. Auction Follow-Up opens Auctions filtered to those records so outcomes can be updated or won items can be cataloged without searching for them manually.</p>
        </div>
        <div class="panel">
          <h3>Upcoming Auctions</h3>
          <p>Upcoming auctions are grouped by day so busy sourcing days are obvious. High-priority auction counts and close-time conflicts are called out, and View opens the main Auctions section.</p>
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
        <p>Use Inventory → Manage Categories to add custom categories. The category filter updates automatically when categories are added. A custom category that is still assigned to inventory cannot be removed until those items are changed to another category.</p>
      </div>

      <div class="panel">
        <h3>Storage Locations</h3>
        <p>Use Inventory → Manage Locations to create physical inventory locations such as Garage Shelf A, Booth Inventory or Storage Bin 3.</p>
        <p>When editing an item, choose its location from the Physical location dropdown. The Inventory location filter can then show only items stored in that location.</p>
        <p>A storage location that is currently assigned to inventory cannot be removed until those items are moved to another location.</p>
      </div>

      <div class="panel">
        <h3>Sources</h3>
        <p>Use Source type for the general acquisition method, such as Online Auction, Estate Sale or Facebook Marketplace.</p>
        <p>Use Online platform for the auction or marketplace website used for the purchase.</p>
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
          <p>The search box checks item names, SKU and other identifiers, brand, model, category, notes, source information and storage location. When a search or filter is active, Inventory shows how many items match out of the total inventory.</p>
          <p>Choose Inventory Summary to see the item count, combined item cost and combined asking prices for the items currently showing. The same results can be grouped by Category, Brand, Model or Storage Location.</p>
      </div>

      <div class="panel">
        <h3>Photos and Item History</h3>
        <p>Add photos from the camera or gallery. Useful photos include front, back, serial number, damage, repairs and identifying details. From the item detail screen, click a product photo to open the full-size image viewer.</p>
        <p>Item notes can be added to the history from the item detail screen so important changes remain attached to that item.</p>
      </div>
        <div class="panel">
          <h3>Repair Costs and Item Cost</h3>
          <p>Estimated repair or parts cost is included in the item cost used by inventory and profit calculations. Keep the repair/restoration log with the item so work performed stays attached to the record.</p>
        </div>

        <div class="panel">
          <h3>Scanning Inventory</h3>
          <p>Use Inventory → Scan Code to scan a Code 128 barcode or QR code containing an internal ML SKU. The scanner can use available device cameras, and a manual SKU field is available when camera scanning cannot be used.</p>
        </div>

      <div class="panel">
        <h3>Deleting Inventory</h3>
        <p>An ordinary unsold item with no sales history can be deleted from its item detail screen.</p>
        <p>An item connected to sales or register history is protected from deletion. This prevents accounting history from being accidentally destroyed.</p>
      </div>

      <div class="panel">
        <h3>Price Tags & Avery Label Sheets</h3>
        <p>For a quick one-item tag, open an inventory item and use Print Label. The tag contains the item name, asking price and internal SKU.</p>
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
          <p>Open an available item and choose Sell Item. The Sales Register opens with that item already added to the sale, and SKU / Identifier is filled automatically with that item's SKU because the item is already known.</p>
        <p>The asking price is used as the starting sale price, but the actual sale price can be changed before completing the transaction when a different price is negotiated.</p>
      </div>

      <div class="panel">
        <h3>Recording a Sale</h3>
        <p>The register can contain one or more inventory items. Confirm the sale date, prices, payment method, buyer information and optional reference information before completing the sale.</p>
          <p>When Record Sale is opened directly from Money → Register or from Quick Action, SKU / Identifier starts blank so the item can be identified by SKU, UPC/barcode, serial number, manufacturer part number or other identifier.</p>
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
          <p>Money → Sales lists individual item sales. The SKU is clickable so the connected inventory record can be opened directly. Sales can also be exported from More → CSV exports.</p>
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
        <p>For one event, open the Organizer event and choose Add to Google Calendar.</p><p>For many dates at once, open Calendar and choose Export Calendar. Export Everything, the calendar month currently being viewed, or a custom From/Through date range. You can include Events, Auctions or both.</p><p>The bulk export downloads one standard .ics calendar file. In Google Calendar, open Settings → Import &amp; export, choose that file and select the Google calendar where the dates should be added.</p>
        <p>The Organizer remains the main business calendar. Individual and bulk Google Calendar exports are one-way; changes made later in either place do not automatically synchronize.</p>
      </div>
    </section>

    <div class="section-head"><div><h3>Money</h3><p>Track the money connected to the business.</p></div></div>

    <section class="grid-2">
      <div class="panel">
        <h3>Expenses</h3>
        <p>Record operating expenses such as repairs, parts, booth fees, fuel, parking, shipping, packaging and advertising. Use More → Expense categories to add custom categories used by the business. Built-in categories remain available, and a custom category that is still assigned to an expense cannot be removed until those expenses are changed.</p>
        <p>Inventory Purchase and Auction Premium costs attached to an item are treated as acquisition costs so they are not counted a second time as general expenses.</p>
          <p>Receipt photos can be attached from the camera or gallery. Attached receipts stay with the expense record, can be opened in the receipt viewer and are included in full Organizer backups. Use More → Receipt Archive to browse saved receipts by From and To dates and expense category. Click a receipt card to open read-only Expense Details, click the receipt image for the full-size viewer, or choose Edit Expense when the record needs to be changed. Closing Expense Details returns to the Receipt Archive.</p>
          <p>The Expense Calculator filters by category and date range and shows the matching count and total. Use the report header when a business or accountant heading is needed.</p>
          <p>Print opens the formatted report and browser print dialog. Save PDF creates and downloads a real PDF directly, with the report header, summary, expense table and grand total. Expense reports can also be exported as CSV.</p>
      </div>

      <div class="panel">
        <h3>Mileage</h3>
        <p>Use the Mileage area to record business travel. Enter the date, miles and useful notes so the trip can be identified later.</p>
      </div>

      <div class="panel">
        <h3>Profit Information</h3>
        <p>The Organizer uses sale proceeds, item cost basis, selling costs and general expenses to calculate business totals shown on the Dashboard and Money screens.</p>
          <p>Money → Overview shows the calculation directly: Sales revenue minus Sold inventory cost minus Selling costs minus General business expenses equals Estimated Net. Inventory acquisition costs already included in item cost are not counted again as general expenses.</p>
      </div>
    </section>

    <div class="section-head"><div><h3>Auctions and Sourcing</h3><p>Keep sourcing opportunities organized.</p></div></div>

    <section class="grid-2">
      <div class="panel">
        <h3>Tracking Auctions</h3>
          <p>Auctions is a main navigation section. Save online or in-person auctions with the auction name, platform, date/end time, website, location, notes and High, Medium or Low priority.</p>
          <p>Auctions are grouped by closing day. Auctions that close within 15 minutes of one another are marked as Time Conflict so Priority can help decide which needs attention first.</p>
          <p>Future and active auctions stay in the normal Auctions view. When an auction has ended, unresolved Watch Lots keep it visible as Auction Over · Needs Attention until their outcomes are completed.</p>
      </div>

        <div class="panel">
          <h3>Watch Lots</h3>
          <p>Each auction can contain Watch Lots for individual items being considered. A Watch Lot stores its Item / lot URL, lot number, closing time, High/Medium/Low priority, outcome, expected resale, maximum bid, advertised condition and notes.</p>
          <p>Watch Lots appear directly on the main Auction cards with basic information including outcome, lot number, closing time, expected resale and maximum bid. Click the lot card for full Lot Details. Open Listing opens the exact item listing. When an auction has more Watch Lots than the preview shows, the + more watched lots link opens the full auction record.</p>
          <p>The next action appears where the work is happening: Update Outcome for Watching, Catalog Item for a Won lot, or View Inventory Item after cataloging.</p>
        </div>
        <div class="panel">
          <h3>Watch Lot Outcomes</h3>
          <p>Use Watching while the result is unresolved. After the auction closes, change the lot to Won or Not Won. Cataloged is derived automatically after a Won lot is saved into Inventory; it is not an outcome selected manually.</p>
          <p>An ended auction remains in Auctions with Auction Over · Needs Attention while any Watch Lot is still Watching or is Won but has not yet been cataloged.</p>
          <p>The Dashboard Auction Follow-Up card opens Auctions filtered to those unresolved ended auctions so the remaining work can be completed directly.</p>
        </div>
        <div class="panel">
          <h3>Archived Auctions</h3>
          <p>After every Watch Lot in an ended auction is resolved as Not Won or Cataloged, the auction leaves the active Auctions screen automatically. An ended auction with no Watch Lots also archives automatically.</p>
          <p>Use More → Archived Auctions to review retained auction history, Watch Lot outcomes, listing links, bids and connected Inventory items. Filter the archive with optional From and To dates, Auction type and Platform / site. Leaving both dates blank shows all dates; using the same From and To date shows one day. Open an archived auction for its read-only history; closing that detail view returns to Archived Auctions. Archiving keeps the business record; it does not delete it.</p>
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
        <p><strong>1.</strong> Create real storage locations with Inventory → Manage Locations.</p>
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
          <h3>Auction to Inventory</h3>
          <p><strong>1.</strong> Track the auction and add the individual items you are considering as Watch Lots.</p>
          <p><strong>2.</strong> Set each Watch Lot priority, closing time, expected resale and maximum bid before bidding.</p>
          <p><strong>3.</strong> After the lot closes, use Update Outcome and choose Won or Not Won.</p>
          <p><strong>4.</strong> For a Won lot, choose Catalog Item. Enter the final winning price and other acquisition costs in the Inventory intake record.</p>
          <p><strong>5.</strong> Saving the Inventory item links it back to the Watch Lot. The lot becomes Cataloged and View Inventory Item opens the connected living inventory record.</p>
          <p><strong>6.</strong> When every Watch Lot in an ended auction is Not Won or Cataloged, the auction moves automatically to More → Archived Auctions.</p>
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


async function openArchivedAuctionDetail(id,returnToArchivedAuctions=false){
  const auction=await DB.getOne("auctions",id);if(!auction)return;
  const allLots=await DB.getAll("auctionLots");
  const lots=allLots.filter(l=>l.auctionId===id).sort((a,b)=>String(a.endDateTime||"9999-12-31T23:59").localeCompare(String(b.endDateTime||"9999-12-31T23:59")));
  openModal(`
    <div class="modal-head"><div><div class="badge">Archived Auction</div><h2 style="margin-top:8px">${esc(auction.name||"Auction")}</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <div class="modal-body">
      <div class="panel">
        <p><strong>Ended:</strong> ${esc(auction.endDateTime?prettyDateTime(auction.endDateTime):prettyDate(auction.date))}</p>
        <p><strong>Platform / site:</strong> ${esc(auction.platform||"—")}</p>
        <p><strong>Company / seller:</strong> ${esc(auction.company||"—")}</p>
        <p><strong>Location:</strong> ${esc(auction.location||"—")}</p>
        <p><strong>Priority:</strong> ${esc(auction.priority||"Medium")}</p>
      </div>
      ${auction.notes?`<div class="panel"><h3>Notes</h3><p>${nl2br(auction.notes)}</p></div>`:""}
      <div class="section-head"><div><h3>Watch list history</h3></div></div>
      <div class="list">${lots.length?lots.map(l=>{const outcome=lotOutcome(l);return `<div class="list-card archived-lot-card"><div><div class="auction-card-topline"><span class="lot-outcome lot-outcome-${outcome.toLowerCase().replaceAll(" ","-")}">${esc(outcome)}</span><span class="auction-priority auction-priority-small priority-${String(l.priority||"Medium").toLowerCase()}">${esc(l.priority||"Medium")} Priority</span></div><h4>${esc(l.name||"Untitled lot")}</h4><p>Lot ${esc(l.lotNumber||"—")} · Max ${money(l.maxBid)}${num(l.winningBid)>0?` · Winning price ${money(l.winningBid)}`:""}</p></div><div class="watch-lot-actions">${l.listingUrl?`<button class="btn ghost small" type="button" data-archived-lot-listing="${l.id}">Open Listing</button>`:""}${l.inventoryItemId?`<button class="btn small" type="button" data-archived-inventory="${l.id}">View Inventory Item</button>`:""}</div></div>`;}).join(""):empty("No watched lots were recorded.")}</div>
    </div>
    <div class="modal-actions">${auction.website?`<button class="btn secondary" id="archivedAuctionWebsite" type="button">Open Auction Page</button>`:""}<button class="btn" data-close type="button">Done</button></div>`);
  if(returnToArchivedAuctions){
    $$("[data-close]",modalRoot).forEach(button=>{
      button.onclick=()=>{
        closeModal();
        openArchivedAuctions();
      };
    });
  }

  const website=$("#archivedAuctionWebsite");
  if(website)website.onclick=()=>openExternalUrl(auction.website,"auction page");
  $$("[data-archived-lot-listing]",modalRoot).forEach(b=>b.onclick=()=>{const lot=lots.find(l=>l.id===b.dataset.archivedLotListing);if(lot&&lot.listingUrl)openExternalUrl(lot.listingUrl,"lot listing");});
  $$("[data-archived-inventory]",modalRoot).forEach(b=>b.onclick=()=>{const lot=lots.find(l=>l.id===b.dataset.archivedInventory);if(lot&&lot.inventoryItemId){closeModal();openItemDetail(lot.inventoryItemId);}});
}

async function openArchivedAuctions(){
  const [auctions,lots]=await Promise.all([DB.getAll("auctions"),DB.getAll("auctionLots")]);
  const archived=auctions.filter(a=>isAuctionEnded(a)&&!auctionNeedsAttention(a,lots)).sort((a,b)=>auctionEndTimestamp(b)-auctionEndTimestamp(a));
  const archivedPlatforms=[...new Set(archived.map(a=>String(a.platform||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  openModal(`
    <div class="modal-head"><div><div class="eyebrow">HISTORY</div><h2>Archived Auctions</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <div class="modal-body">
      <p style="color:var(--muted);line-height:1.55">Ended auctions move here automatically after their Watch Lots are resolved. Historical records are retained.</p>
<div class="archive-filter-panel">          <div class="archive-filter-grid archive-filter-grid-4">            <div class="field"><label>From</label><input class="input" id="archivedAuctionFrom" type="date"></div>            <div class="field"><label>To</label><input class="input" id="archivedAuctionTo" type="date"></div>            <div class="field"><label>Auction type</label><select class="input" id="archivedAuctionType"><option value="all">All Types</option><option value="Online">Online</option><option value="In Person">In Person</option></select></div>            <div class="field"><label>Platform / site</label><select class="input" id="archivedAuctionPlatform"><option value="all">All Platforms</option>${archivedPlatforms.map(platform=>`<option value="${esc(platform)}">${esc(platform)}</option>`).join("")}</select></div>          </div>          <div class="archive-filter-summary" id="archivedAuctionMatchCount"></div>        </div>
      <div class="list">${archived.length?archived.map(a=>{const rows=lots.filter(l=>l.auctionId===a.id);return `<div class="list-card archived-auction-card" data-archived-auction="${a.id}"><div><div class="badge">Auction Over</div><h4>${esc(a.name||"Auction")}</h4><p>${esc(a.endDateTime?prettyDateTime(a.endDateTime):prettyDate(a.date))}${a.platform?` · ${esc(a.platform)}`:""} · ${rows.length} watched lot${rows.length===1?"":"s"}</p></div><button class="btn secondary small" type="button">View</button></div>`;}).join(""):empty("No archived auctions yet.")}</div>
    </div>
    <div class="modal-actions"><button class="btn" data-close type="button">Done</button></div>`);
const archivedAuctionDateMatches=value=>{    const from=$("#archivedAuctionFrom").value;    const to=$("#archivedAuctionTo").value;    if(!from&&!to)return true;    const dateValue=String(value||"").slice(0,10);    if(!dateValue)return false;    if(from&&dateValue<from)return false;    if(to&&dateValue>to)return false;    return true;  };  const updateArchivedAuctionFilters=()=>{    const type=$("#archivedAuctionType").value;    const platform=$("#archivedAuctionPlatform").value;    let matches=0;    $$("[data-archived-auction]",modalRoot).forEach(row=>{      const auction=archived.find(a=>a.id===row.dataset.archivedAuction);      const dateValue=auction?.endDateTime||auction?.date||"";      const typeMatch=type==="all"||String(auction?.auctionMode||"Online")===type;      const platformValue=String(auction?.platform||"").trim();      const platformMatch=platform==="all"||platformValue===platform;      const visible=!!auction&&typeMatch&&platformMatch&&archivedAuctionDateMatches(dateValue);      row.hidden=!visible;      if(visible)matches++;    });    $("#archivedAuctionMatchCount").textContent=`${matches} of ${archived.length} archived auction${archived.length===1?"":"s"}`;  };  ["archivedAuctionFrom","archivedAuctionTo","archivedAuctionType","archivedAuctionPlatform"].forEach(id=>{    const control=$("#"+id);    if(control)control.onchange=updateArchivedAuctionFilters;  });  updateArchivedAuctionFilters();

  $$("[data-archived-auction]",modalRoot).forEach(row=>row.onclick=()=>openArchivedAuctionDetail(row.dataset.archivedAuction,true));
}

async function openExpenseDetail(id,returnToReceiptArchive=false){
  const expense=await DB.getOne("expenses",id);
  if(!expense)return;

  const [items,events,auctions,attachments]=await Promise.all([
    DB.getAll("items"),
    DB.getAll("events"),
    DB.getAll("auctions"),
    DB.getByIndex("attachments","ownerId",id)
  ]);

  const receipts=attachments.filter(attachment=>attachment.ownerType==="expense"&&attachment.blob);
  const item=items.find(row=>row.id===expense.itemId);
  const event=events.find(row=>row.id===expense.eventId);
  const auction=auctions.find(row=>row.id===expense.auctionId);

  openModal(`
    <div class="modal-head">
      <div><div class="eyebrow">EXPENSE</div><h2>${esc(expense.vendor||expense.description||"Expense Details")}</h2></div>
      <button class="close-btn" data-close type="button">×</button>
    </div>
    <div class="modal-body">
      <section class="stats" style="grid-template-columns:repeat(2,1fr);margin:0 0 14px">
        ${stat("Amount",money(expense.amount),"")}
        ${stat("Date",prettyDate(expense.date),"")}
      </section>
      <div class="grid-2">
        <div class="panel">
          <h3>Expense Details</h3>
          ${kv("Category",expense.category)}
          ${kv("Vendor",expense.vendor)}
          ${kv("Description",expense.description)}
          ${kv("Payment method",expense.paymentMethod)}
        </div>
        <div class="panel">
          <h3>Connections</h3>
          ${kv("Related item",item?.name)}
          ${kv("Related event",event?.title)}
          ${kv("Related auction",auction?.name)}
        </div>
      </div>
        ${expenseLineItems(expense).length?`<div class="panel"><h3>Itemized Purchase</h3><p><strong>Business-item subtotal:</strong> ${money(expenseSubtotal(expense))} - <strong>Tax rate:</strong> ${esc(expense.taxRate||0)}% - <strong>Calculated tax:</strong> ${money(expense.taxAmount)}</p><div class="list">${expenseLineItems(expense).map(row=>`<div class="list-card"><div><h4>${esc(row.name||row.identifier||"Item")}</h4><p>${row.identifier?`ID: ${esc(row.identifier)} - `:""}${esc(row.category||expense.category||"Other")} - Qty ${expenseLineQty(row)} x ${money(row.unitCost)}${row.reorderDays?` - Reorder ${esc(row.reorderDays)} days`:""}${row.notes?`<br>${esc(row.notes)}`:""}</p></div><strong>${money(expenseLineTotal(row))}</strong></div>`).join("")}</div></div>`:""}
      ${expense.notes?`<div class="panel"><h3>Notes</h3><p>${nl2br(expense.notes)}</p></div>`:""}
      <div class="record-section">
        <div class="record-section-title"><span>🧾</span><div><strong>Receipts</strong><small>${receipts.length} attached receipt${receipts.length===1?"":"s"}</small></div></div>
        <div class="photo-strip">${receipts.length?receipts.map(receipt=>`<div class="photo-thumb"><img data-expense-detail-receipt="${esc(receipt.id)}" alt="Receipt" title="View receipt"></div>`).join(""):empty("No receipts attached.")}</div>
      </div>
    </div>
    <div class="modal-actions"><button class="btn secondary" id="editExpenseDetail" type="button">Edit Expense</button><button class="btn" data-close type="button">Done</button></div>
  `);

  receipts.forEach(receipt=>{
    const image=modalRoot.querySelector(`[data-expense-detail-receipt="${receipt.id}"]`);
    if(image&&receipt.blob){
      const url=URL.createObjectURL(receipt.blob);
      image.src=url;
      image.onload=()=>URL.revokeObjectURL(url);
    }
  });

  $$("[data-expense-detail-receipt]",modalRoot).forEach(image=>{
    image.onclick=()=>{
      const receipt=receipts.find(row=>row.id===image.dataset.expenseDetailReceipt);
      if(!receipt||!receipt.blob)return;

      const url=URL.createObjectURL(receipt.blob);
      const viewer=document.createElement("div");
      viewer.className="receipt-viewer";

      const panel=document.createElement("div");
      panel.className="receipt-viewer-panel";

      const closeButton=document.createElement("button");
      closeButton.type="button";
      closeButton.className="receipt-viewer-close";
      closeButton.setAttribute("aria-label","Close receipt viewer");
      closeButton.textContent="×";

      const fullImage=document.createElement("img");
      fullImage.src=url;
      fullImage.alt="Receipt";

      const closeViewer=()=>{
        URL.revokeObjectURL(url);
        viewer.remove();
      };

      closeButton.onclick=closeViewer;
      viewer.onclick=event=>{
        if(event.target===viewer)closeViewer();
      };

      panel.appendChild(closeButton);
      panel.appendChild(fullImage);
      viewer.appendChild(panel);
      modalRoot.appendChild(viewer);
    };
  });

  if(returnToReceiptArchive){
    $$("[data-close]",modalRoot).forEach(button=>{
      button.onclick=()=>{
        closeModal();
        openReceiptArchive();
      };
    });
  }

  $("#editExpenseDetail").onclick=()=>{
    closeModal();
    openExpenseModal(expense);
  };
}

async function openReceiptArchive(){
  const [expenses,attachments]=await Promise.all([DB.getAll("expenses"),DB.getAll("attachments")]);
  const expenseMap=new Map(expenses.map(expense=>[expense.id,expense]));
  const receipts=attachments
    .filter(attachment=>attachment.ownerType==="expense" && attachment.blob && expenseMap.has(attachment.ownerId))
    .sort((a,b)=>{
      const expenseA=expenseMap.get(a.ownerId);
      const expenseB=expenseMap.get(b.ownerId);
      return String(expenseB?.date||b.createdAt||"").localeCompare(String(expenseA?.date||a.createdAt||""));
    });

  const receiptCategories=[...new Set(receipts.map(receipt=>String(expenseMap.get(receipt.ownerId)?.category||"Uncategorized")))].sort((a,b)=>a.localeCompare(b));
  openModal(`
    <div class="modal-head">
      <div><div class="eyebrow">EXPENSE HISTORY</div><h2>Receipt Archive</h2></div>
      <button class="close-btn" data-close type="button">×</button>
    </div>
    <div class="modal-body">
      <p style="color:var(--muted);line-height:1.55">Browse receipt photos saved with expense records. Open the connected Expense to edit the record or manage its attachments.</p>
<div class="archive-filter-panel">        <div class="archive-filter-grid">          <div class="field"><label>From</label><input class="input" id="receiptArchiveFrom" type="date"></div>          <div class="field"><label>To</label><input class="input" id="receiptArchiveTo" type="date"></div>          <div class="field"><label>Expense category</label><select class="input" id="receiptArchiveCategory"><option value="all">All Categories</option>${receiptCategories.map(category=>`<option value="${esc(category)}">${esc(category)}</option>`).join("")}</select></div>        </div>        <div class="archive-filter-summary" id="receiptArchiveMatchCount"></div>      </div>
      <div class="receipt-archive-grid">
        ${receipts.length?receipts.map(receipt=>{
          const expense=expenseMap.get(receipt.ownerId);
          return `<div class="receipt-archive-card" data-receipt-archive-card="${esc(receipt.id)}">
            <button class="receipt-archive-photo" type="button" data-archive-receipt="${esc(receipt.id)}" aria-label="View receipt">
              <img data-archive-receipt-image="${esc(receipt.id)}" alt="Receipt">
            </button>
            <div class="receipt-archive-info">
              <div class="receipt-archive-topline"><strong>${esc(expense?.vendor||expense?.description||"Expense")}</strong><strong>${money(expense?.amount)}</strong></div>
              <p>${esc(prettyDate(expense?.date)||"No date")} · ${esc(expense?.category||"Uncategorized")}</p>
              ${expense?.description?`<p>${esc(expense.description)}</p>`:""}
              <button class="btn secondary small" type="button" data-receipt-expense-id="${esc(expense.id)}">Edit Expense</button>
            </div>
          </div>`;
        }).join(""):empty("No saved expense receipts yet.")}
      </div>
    </div>
    <div class="modal-actions"><button class="btn" data-close type="button">Done</button></div>
  `);

const receiptArchiveDateMatches=value=>{    const from=$("#receiptArchiveFrom").value;    const to=$("#receiptArchiveTo").value;    if(!from&&!to)return true;    const dateValue=String(value||"").slice(0,10);    if(!dateValue)return false;    if(from&&dateValue<from)return false;    if(to&&dateValue>to)return false;    return true;  };  const updateReceiptArchiveFilters=()=>{    const category=$("#receiptArchiveCategory").value;    let matches=0;    $$("[data-receipt-archive-card]",modalRoot).forEach(card=>{      const receipt=receipts.find(row=>row.id===card.dataset.receiptArchiveCard);      const expense=receipt?expenseMap.get(receipt.ownerId):null;      const categoryValue=String(expense?.category||"Uncategorized");      const categoryMatch=category==="all"||categoryValue===category;      const visible=!!receipt&&!!expense&&categoryMatch&&receiptArchiveDateMatches(expense.date);      card.hidden=!visible;      if(visible)matches++;    });    $("#receiptArchiveMatchCount").textContent=`${matches} of ${receipts.length} receipt${receipts.length===1?"":"s"}`;  };  ["receiptArchiveFrom","receiptArchiveTo","receiptArchiveCategory"].forEach(id=>{    const control=$("#"+id);    if(control)control.onchange=updateReceiptArchiveFilters;  });  updateReceiptArchiveFilters();

  receipts.forEach(receipt=>{
    const image=modalRoot.querySelector(`[data-archive-receipt-image="${receipt.id}"]`);
    if(image&&receipt.blob){
      const url=URL.createObjectURL(receipt.blob);
      image.src=url;
      image.onload=()=>URL.revokeObjectURL(url);
    }
  });

  $$("[data-archive-receipt]",modalRoot).forEach(button=>{
button.onclick=event=>{      event.stopPropagation();
      const receipt=receipts.find(row=>row.id===button.dataset.archiveReceipt);
      if(!receipt||!receipt.blob)return;

      const url=URL.createObjectURL(receipt.blob);
      const viewer=document.createElement("div");
      viewer.className="receipt-viewer";

      const panel=document.createElement("div");
      panel.className="receipt-viewer-panel";

      const closeButton=document.createElement("button");
      closeButton.type="button";
      closeButton.className="receipt-viewer-close";
      closeButton.setAttribute("aria-label","Close receipt viewer");
      closeButton.textContent="×";

      const fullImage=document.createElement("img");
      fullImage.src=url;
      fullImage.alt="Receipt";

      const closeViewer=()=>{
        URL.revokeObjectURL(url);
        viewer.remove();
      };

      closeButton.onclick=closeViewer;
      viewer.onclick=event=>{
        if(event.target===viewer)closeViewer();
      };

      panel.appendChild(closeButton);
      panel.appendChild(fullImage);
      viewer.appendChild(panel);
      modalRoot.appendChild(viewer);
    };
  });

  $$("[data-receipt-archive-card]",modalRoot).forEach(card=>{
    card.onclick=()=>{
      const receipt=receipts.find(row=>row.id===card.dataset.receiptArchiveCard);
      const expense=receipt?expenseMap.get(receipt.ownerId):null;
      if(expense)openExpenseDetail(expense.id,true);
    };
  });

  $$("[data-receipt-expense-id]",modalRoot).forEach(button=>{
button.onclick=event=>{      event.stopPropagation();
      const expense=expenseMap.get(button.dataset.receiptExpenseId);
      if(!expense)return;
      closeModal();
      openExpenseModal(expense);
    };
  });
}

async function getExpenseCategories(expensesSeed){
  const row=await DB.getOne("settings","expenseCategories");
  const expenses=Array.isArray(expensesSeed)?expensesSeed:await DB.getAll("expenses");

  const custom=Array.isArray(row?.value)
    ? row.value.map(value=>String(value||"").trim()).filter(Boolean)
    : [];

    const used=expenses.flatMap(expense=>[
      String(expense.category||"").trim(),...expenseLineItems(expense).map(row=>String(row.category||"").trim())
    ]).filter(Boolean);

  const additional=[...custom,...used]
    .filter(value=>!EXPENSE_CATEGORIES.some(category=>category.toLowerCase()===value.toLowerCase()))
    .filter((value,index,array)=>array.findIndex(other=>other.toLowerCase()===value.toLowerCase())===index)
    .sort((a,b)=>a.localeCompare(b));

  return [...EXPENSE_CATEGORIES,...additional];
}

async function openExpenseCategoriesModal(){
  const [row,expenses]=await Promise.all([
    DB.getOne("settings","expenseCategories"),
    DB.getAll("expenses")
  ]);

  let custom=Array.isArray(row?.value)
    ? row.value.map(value=>String(value||"").trim()).filter(Boolean)
    : [];

  openModal(`
    <div class="modal-head">
      <div>
        <div class="eyebrow">EXPENSES</div>
        <h2>Expense Categories</h2>
      </div>
      <button class="close-btn" data-close type="button">×</button>
    </div>

    <div class="modal-body">
      <div class="panel">
        <h3>Built-in categories</h3>
        <p style="color:var(--muted);line-height:1.55">${EXPENSE_CATEGORIES.map(esc).join(" · ")}</p>
      </div>

      <div class="record-section">
        <div class="record-section-title">
          <span>🧾</span>
          <div>
            <strong>Custom expense categories</strong>
            <small>Add categories used by this business. Categories currently assigned to expenses cannot be removed.</small>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label>New expense category</label>
            <input class="input" id="newExpenseCategory" autocomplete="off" placeholder="Example: Equipment Rental">
          </div>
          <div class="field">
            <label>&nbsp;</label>
            <button class="btn" id="addExpenseCategory" type="button">Add Category</button>
          </div>
        </div>

        <div class="list" id="customExpenseCategoryList"></div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn" data-close type="button">Done</button>
    </div>
  `);

  const input=$("#newExpenseCategory");
  const list=$("#customExpenseCategoryList");

  const save=()=>DB.put("settings",{
    key:"expenseCategories",
    value:custom,
    updatedAt:new Date().toISOString()
  });

    const usageCount=name=>expenses.reduce((count,expense)=>{
      const target=String(name||"").trim().toLowerCase();const main=String(expense.category||"").trim().toLowerCase()===target?1:0;const lines=expenseLineItems(expense).filter(row=>String(row.category||"").trim().toLowerCase()===target).length;return count+main+lines;
    },0);

  const renderList=()=>{
    list.innerHTML=custom.length
      ? custom.map((name,index)=>{
          const count=usageCount(name);
          return `
            <div class="list-card">
              <div>
                <strong>${esc(name)}</strong>
                <p>${count} usage${count===1?"":"s"} across expenses and itemized purchases</p>
              </div>
              <button class="btn danger small" type="button" data-remove-expense-category="${index}">Remove</button>
            </div>
          `;
        }).join("")
      : empty("No custom expense categories yet.");

    $$("[data-remove-expense-category]",list).forEach(button=>{
      button.onclick=async()=>{
        const index=Number(button.dataset.removeExpenseCategory);
        const name=custom[index];

        if(usageCount(name)>0){
          alert("That expense category is currently used by an expense or itemized purchase. Change those records before removing it.");
          return;
        }

        custom.splice(index,1);
        await save();
        renderList();
        toast("Expense category removed.");
      };
    });
  };

  const addCategory=async()=>{
    const name=String(input.value||"").trim();
    if(!name)return;

      const used=expenses.flatMap(expense=>[
        String(expense.category||"").trim(),...expenseLineItems(expense).map(row=>String(row.category||"").trim())
      ]).filter(Boolean);

    const known=[...EXPENSE_CATEGORIES,...custom,...used];

    if(known.some(value=>value.toLowerCase()===name.toLowerCase())){
      alert("That expense category already exists.");
      input.select();
      return;
    }

    custom.push(name);
    custom=custom.sort((a,b)=>a.localeCompare(b));
    await save();
    input.value="";
    renderList();
    input.focus();
    toast("Expense category added.");
  };

  $("#addExpenseCategory").onclick=addCategory;

  input.onkeydown=event=>{
    if(event.key==="Enter"){
      event.preventDefault();
      addCategory();
    }
  };

  renderList();
}

async function renderMore(){
  view.innerHTML=`
    <div class="section-head"><div><h2>More</h2><p>Backups, exports and business tools.</p></div></div>
    <section class="grid-2">
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
    <h3>Expense categories</h3>
    <p style="color:var(--muted);line-height:1.55">Manage custom categories available when recording and filtering business expenses.</p>
    <button class="btn secondary" id="manageExpenseCategories">Manage Expense Categories</button>
  </div>
<div class="panel">
  <h3>Payment methods</h3>
  <p style="color:var(--muted);line-height:1.55">Manage the payment methods available in the Sales Register dropdown.</p>
  <button class="btn secondary" id="managePaymentMethods">Manage Payment Methods</button>
</div>
    <div class="panel">
      <h3>Archived Auctions</h3>
      <p style="color:var(--muted);line-height:1.55">Review ended auctions after their Watch Lots are resolved.</p>
      <button class="btn secondary" id="openArchivedAuctions">Open Archived Auctions</button>
    </div>
      <div class="panel">
        <h3>Receipt Archive</h3>
        <p style="color:var(--muted);line-height:1.55">Browse saved expense receipts and open the connected expense record.</p>
        <button class="btn secondary" id="openReceiptArchive">Open Receipt Archive</button>
      </div>
    <div class="panel">
      <h3>User Guide</h3>
      <p style="color:var(--muted);line-height:1.55">Instructions for inventory, sales, calendar, money, backups and everyday business workflows.</p>
      <button class="btn secondary" id="openUserGuide">Open User Guide</button>
    </div>
    <div class="panel">
      <h3>Open Source Licenses</h3>
      <p style="color:var(--muted);line-height:1.55">Licenses and attribution notices for third-party software included with the Organizer.</p>
      <button class="btn secondary" id="openSourceLicenses" type="button">Open Source Licenses</button>
    </div>
    </section>
  `;
  $("#exportBackup").onclick=exportBackup;
  $("#importBackup").onchange=importBackupFile;
  $$("[data-csv]").forEach(b=>b.onclick=()=>exportCSV(b.dataset.csv));
  $("#manageExpenseCategories").onclick=()=>openExpenseCategoriesModal();
  $("#managePaymentMethods").onclick=()=>openPaymentMethodsModal();
  $("#openArchivedAuctions").onclick=()=>openArchivedAuctions();
  $("#openReceiptArchive").onclick=()=>openReceiptArchive();
  $("#openUserGuide").onclick=()=>navigate("guide");
  $("#openSourceLicenses").onclick=openOpenSourceLicenses;
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

function openInventorySummary(items){
  const rows=Array.isArray(items)?items:[];
  const totalCost=sum(rows.map(item=>itemCost(item)));
  const totalAsking=sum(rows.map(item=>num(item.askingPrice)));
  openModal(`
    <div class="modal-head">
      <div><div class="eyebrow">INVENTORY</div><h2>Inventory Summary</h2></div>
      <button class="close-btn" data-close type="button">×</button>
    </div>
    <div class="modal-body">
      <section class="inventory-summary-stats">
        <div><span>Items shown</span><strong>${rows.length}</strong></div>
        <div><span>Combined item cost</span><strong>${money(totalCost)}</strong></div>
        <div><span>Combined asking prices</span><strong>${money(totalAsking)}</strong></div>
      </section>
      <div class="inventory-summary-controls">
        <div>
          <strong>Group these results</strong>
          <small>Use the current search and filters, then group what is showing.</small>
        </div>
        <select class="select" id="inventorySummaryGroup">
          <option value="category">Category</option>
          <option value="brand">Brand</option>
          <option value="model">Model</option>
          <option value="storageLocation">Storage Location</option>
        </select>
      </div>
      <div class="list" id="inventorySummaryGroups"></div>
    </div>
    <div class="modal-actions"><button class="btn" data-close type="button">Done</button></div>
  `);
  const selector=$("#inventorySummaryGroup");
  const list=$("#inventorySummaryGroups");
  const renderGroups=()=>{
    const key=selector.value;
    const groups=new Map();
    rows.forEach(item=>{
      const label=String(item[key]||"Unspecified").trim()||"Unspecified";
      if(!groups.has(label))groups.set(label,[]);
      groups.get(label).push(item);
    });
    const ordered=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]));
    list.innerHTML=ordered.length?ordered.map(([label,group])=>{
      const cost=sum(group.map(item=>itemCost(item)));
      const asking=sum(group.map(item=>num(item.askingPrice)));
      return `<div class="list-card inventory-summary-group"><div><h4>${esc(label)}</h4><p>${group.length} item${group.length===1?"":"s"} · Cost ${money(cost)} · Asking ${money(asking)}</p></div></div>`;
    }).join(""):empty("No matching inventory items.");
  };
  selector.onchange=renderGroups;
  renderGroups();
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
function auctionEndTimestamp(auction){
  const raw=auction&&(auction.endDateTime||auction.date);
  if(!raw)return NaN;
  const value=String(raw);
  return new Date(value.length>10?value:`${value}T23:59:59`).getTime();
}

function isAuctionEnded(auction){
  const endedAt=auctionEndTimestamp(auction);
  return Number.isFinite(endedAt)&&endedAt<Date.now();
}

function auctionNeedsAttention(auction,lots){
  if(!isAuctionEnded(auction))return false;
  return lots.filter(l=>l.auctionId===auction.id).some(l=>{
    const outcome=lotOutcome(l);
    return outcome==="Watching"||outcome==="Won";
  });
}

async function renderAuctionManager(){
  const [allAuctions,lots]=await Promise.all([DB.getAll("auctions"),DB.getAll("auctionLots")]);
  let auctions=allAuctions.filter(a=>!isAuctionEnded(a)||auctionNeedsAttention(a,lots));
  if(state.auctionAttention==="Auction Follow-Up")auctions=auctions.filter(a=>auctionNeedsAttention(a,lots));
  const priorityRank={High:0,Medium:1,Low:2};
  const normalizedPriority=a=>["High","Medium","Low"].includes(a.priority)?a.priority:"Medium";
  const auctionDay=a=>String(a.endDateTime||a.date||"").slice(0,10)||"Unscheduled";
  const auctionSortValue=a=>a.endDateTime||`${a.date||"9999-12-31"}T23:59`;

  auctions.sort((a,b)=>
    auctionSortValue(a).localeCompare(auctionSortValue(b)) ||
    priorityRank[normalizedPriority(a)]-priorityRank[normalizedPriority(b)] ||
    String(a.name||"").localeCompare(String(b.name||""))
  );

  const timedAuctions=auctions
    .filter(a=>a.endDateTime)
    .slice()
    .sort((a,b)=>String(a.endDateTime).localeCompare(String(b.endDateTime)));

  const conflictIds=new Set();
  const conflictWindowMs=15*60*1000;

  for(let i=0;i<timedAuctions.length;i++){
    for(let j=i+1;j<timedAuctions.length;j++){
      if(auctionDay(timedAuctions[i])!==auctionDay(timedAuctions[j]))break;
      const firstTime=new Date(timedAuctions[i].endDateTime).getTime();
      const secondTime=new Date(timedAuctions[j].endDateTime).getTime();
      if(!Number.isFinite(firstTime)||!Number.isFinite(secondTime))continue;
      const difference=secondTime-firstTime;
      if(difference>conflictWindowMs)break;
      if(difference>=0){
        conflictIds.add(timedAuctions[i].id);
        conflictIds.add(timedAuctions[j].id);
      }
    }
  }

  const timedLots=lots.filter(l=>l.endDateTime).slice().sort((a,b)=>String(a.endDateTime).localeCompare(String(b.endDateTime)));
  const lotConflictIds=new Set();
  for(let i=0;i<timedLots.length;i++){
    for(let j=i+1;j<timedLots.length;j++){
      const firstTime=new Date(timedLots[i].endDateTime).getTime();
      const secondTime=new Date(timedLots[j].endDateTime).getTime();
      if(!Number.isFinite(firstTime)||!Number.isFinite(secondTime))continue;
      const difference=secondTime-firstTime;
      if(difference>15*60*1000)break;
      if(difference>=0){lotConflictIds.add(timedLots[i].id);lotConflictIds.add(timedLots[j].id);}
    }
  }

  const groups=new Map();
  auctions.forEach(a=>{
    const day=auctionDay(a);
    if(!groups.has(day))groups.set(day,[]);
    groups.get(day).push(a);
  });

  const groupedHtml=[...groups.entries()].map(([day,rows])=>{
    const dayLabel=day==="Unscheduled"
      ?"Unscheduled"
      :new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"});
    const highCount=rows.filter(a=>normalizedPriority(a)==="High").length;

    return `<section class="auction-day-group">
      <div class="auction-day-head">
        <div>
          <h3>${esc(dayLabel)}</h3>
          <p>${rows.length} auction${rows.length===1?"":"s"}${highCount?` · ${highCount} high priority`:""}</p>
        </div>
      </div>
      <div class="list">
        ${rows.map(a=>{
          const priority=normalizedPriority(a);
          const timeLabel=a.endDateTime
            ?new Date(a.endDateTime).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})
            :"Time not set";
          const auctionLots=lots.filter(l=>l.auctionId===a.id).sort((x,y)=>String(x.endDateTime||"9999-12-31T23:59").localeCompare(String(y.endDateTime||"9999-12-31T23:59")));
          const watchedLots=auctionLots.length;
          const previewLots=auctionLots.slice(0,3);
          const conflict=conflictIds.has(a.id);
          return `<div class="list-card auction-manager-card ${conflict?"auction-time-conflict":""}">
            <div>
              <div class="auction-card-topline">
                <span class="auction-priority auction-priority-small priority-${priority.toLowerCase()}">${esc(priority)} Priority</span>
                <span class="badge"><span class="dot" style="background:${safeColor(a.color||"#f7c75d")}"></span>${isAuctionEnded(a)?"Auction Over":esc(a.status||"Planned")}</span>
              </div>
              <h4>${esc(a.name)}</h4>
              <p><strong>${esc(timeLabel)}</strong>${a.platform?` · ${esc(a.platform)}`:""}${a.location?` · ${esc(a.location)}`:""} · ${watchedLots} watched lot${watchedLots===1?"":"s"}</p>
              ${conflict?`<div class="auction-conflict-note">⚠ Time Conflict — another tracked auction closes within 15 minutes. Use Priority to decide which needs attention first.</div>`:""}
              ${isAuctionEnded(a)&&auctionNeedsAttention(a,lots)?`<div class="auction-needs-attention">Auction Over · Needs Attention — finish the outcome or catalog any won lots before this auction moves to Archived Auctions.</div>`:""}
              ${previewLots.length?`<div class="auction-lot-preview">${previewLots.map(l=>{const lotPriority=["High","Medium","Low"].includes(l.priority)?l.priority:"Medium";const lotTime=l.endDateTime?new Date(l.endDateTime).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}):"Time not set";const lotConflict=lotConflictIds.has(l.id);const outcome=lotOutcome(l);return `<div data-lot-preview-detail="${l.id}" class="auction-lot-preview-row ${lotConflict?"lot-time-conflict":""}"><div><span class="auction-priority auction-priority-small priority-${lotPriority.toLowerCase()}">${esc(lotPriority)}</span><span class="lot-outcome lot-outcome-${outcome.toLowerCase().replaceAll(" ","-")}">${esc(outcome)}</span><strong>${esc(l.name||"Untitled lot")}</strong><small>Lot ${esc(l.lotNumber||"—")} · ${esc(lotTime)}${lotConflict?" · Time Conflict":""}<br>Expected ${money(l.expectedResale)} · Max ${money(l.maxBid)}${num(l.winningBid)>0?` · Winning price ${money(l.winningBid)}`:""}</small></div><div class="auction-lot-preview-actions">${l.listingUrl?`<button class="btn ghost small" type="button" data-lot-listing="${l.id}">Open Listing</button>`:`<span class="auction-lot-missing">URL missing</span>`}${outcome==="Watching"?`<button class="btn secondary small" type="button" data-lot-update="${l.id}">Update Outcome</button>`:""}${outcome==="Won"&&!l.inventoryItemId?`<button class="btn small" type="button" data-lot-catalog="${l.id}">Catalog Item</button>`:""}${l.inventoryItemId?`<button class="btn small" type="button" data-lot-inventory="${l.id}">View Inventory Item</button>`:""}</div></div>`;}).join("")}${auctionLots.length>3?`<button class="auction-lot-more" type="button" data-auction-id="${a.id}">+ ${auctionLots.length-3} more watched lot${auctionLots.length-3===1?"":"s"}</button>`:""}</div>`:""}
            </div>
            <button class="btn secondary small" data-auction-id="${a.id}">Open</button>
          </div>`;
        }).join("")}
      </div>
    </section>`;
  }).join("");

  view.innerHTML=`
    <div class="section-head">
      <div>
        <h2>Auctions & sourcing</h2>
        <p>Upcoming opportunities grouped by day, closing time and priority.</p>
      </div>
      <div class="hero-actions">${state.auctionAttention?`<button class="btn secondary small" id="clearAuctionAttention" type="button">Clear ${esc(state.auctionAttention)}</button>`:""}<button class="btn small" id="addAuction">＋ Auction</button></div>
    </div>
    <div class="auction-day-groups">${auctions.length?groupedHtml:empty("No active auctions. Ended auctions with completed outcomes are available under More → Archived Auctions.")}</div>
  `;

  $("#addAuction").onclick=()=>openAuctionModal();
  const clearAuctionAttention=$("#clearAuctionAttention");if(clearAuctionAttention)clearAuctionAttention.onclick=()=>{state.auctionAttention="";renderAuctionManager();};
  $$("[data-auction-id]").forEach(b=>b.onclick=()=>openAuctionDetail(b.dataset.auctionId));
  $$("[data-lot-listing]",view).forEach(b=>b.onclick=e=>{e.stopPropagation();const lot=lots.find(row=>row.id===b.dataset.lotListing);if(lot&&lot.listingUrl)openExternalUrl(lot.listingUrl,"lot listing");});
  $$("[data-lot-preview-detail]",view).forEach(row=>row.onclick=()=>{const lot=lots.find(l=>l.id===row.dataset.lotPreviewDetail);const auction=lot?auctions.find(a=>a.id===lot.auctionId):null;if(auction&&lot)openLotDetail(auction,lot);});
  $$("[data-lot-update]",view).forEach(b=>b.onclick=e=>{e.stopPropagation();const lot=lots.find(l=>l.id===b.dataset.lotUpdate);const auction=lot?allAuctions.find(a=>a.id===lot.auctionId):null;if(auction&&lot)openLotModal(auction,lot);});
  $$("[data-lot-catalog]",view).forEach(b=>b.onclick=e=>{e.stopPropagation();const lot=lots.find(l=>l.id===b.dataset.lotCatalog);const auction=lot?allAuctions.find(a=>a.id===lot.auctionId):null;if(auction&&lot)catalogLotToInventory(auction,lot);});
  $$("[data-lot-inventory]",view).forEach(b=>b.onclick=e=>{e.stopPropagation();const lot=lots.find(l=>l.id===b.dataset.lotInventory);if(lot&&lot.inventoryItemId)openItemDetail(lot.inventoryItemId);});
}


async function openAuctionModal(auction,seed){
  const existingAuctions=await DB.getAll("auctions");
  const platformSuggestions=[...new Set(existingAuctions.map(row=>String(row.platform||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const a=Object.assign({
    id:DB.uid("auction"),name:"",auctionMode:"Online",platform:"",date:today(),startTime:"",
    endDateTime:"",location:"",company:"",website:"",previewDate:"",priority:"Medium",status:"Watching",
    shippingStatus:"Watching",color:"#f7c75d",notes:""
  },seed||{},auction||{});
  openModal(`
    <div class="modal-head"><div><div class="eyebrow">SOURCING</div><h2>${auction?"Edit Auction":"Track Auction"}</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <form id="auctionForm"><div class="modal-body">
      <div class="record-section"><div class="record-section-title"><span>🌐</span><div><strong>Auction</strong><small>Track any online or in-person auction source.</small></div></div>
      <div class="form-grid">
        ${field("Auction / saved search name","name",a.name,true)}
        ${selectField("Auction type","auctionMode",["Online","In Person"],a.auctionMode||"Online")}
        <div class="field"><label>Platform / auction site</label><input class="input" name="platform" value="${esc(a.platform||"")}" list="auctionPlatformSuggestions" autocomplete="off" placeholder="Example: Online auction site"><datalist id="auctionPlatformSuggestions">${platformSuggestions.map(name=>`<option value="${esc(name)}"></option>`).join("")}</datalist></div>
        ${field("Auction company / seller","company",a.company)}
        ${field("Listing / auction URL","website",a.website)}
        ${field("Location","location",a.location)}
        ${field("Auction date / time","endDateTime",a.endDateTime,false,"datetime-local")}
        ${selectField("Priority","priority",["High","Medium","Low"],a.priority||"Medium")}
        ${field("Preview / pickup date","previewDate",a.previewDate,false,"date")}
        <div class="field"><label>Color</label><input class="input" style="padding:5px" type="color" name="color" value="${safeColor(a.color)}"></div>
        ${textareaField("Notes","notes",a.notes)}
      </div></div>
    </div><div class="modal-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Auction</button></div></form>
  `);
  $("#auctionForm").onsubmit=async e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(e.currentTarget).entries());
    if(data.endDateTime)data.date=String(data.endDateTime).slice(0,10);
    else data.date=a.date||today();
    await DB.put("auctions",Object.assign({},a,data));
    closeModal();toast("Auction saved.");navigate("auctions");
  };
}

function lotOutcome(lot){
  if(lot&&lot.inventoryItemId)return "Cataloged";
  if(lot&&["Watching","Won","Not Won"].includes(lot.outcome))return lot.outcome;
  if(lot&&num(lot.winningBid)>0)return "Won";
  return "Watching";
}

async function openAuctionDetail(id){
  const auction=await DB.getOne("auctions",id);if(!auction)return;
  const allLots=await DB.getAll("auctionLots");
  const lots=allLots.filter(l=>l.auctionId===id).sort((a,b)=>String(a.endDateTime||"9999-12-31T23:59").localeCompare(String(b.endDateTime||"9999-12-31T23:59")));
  const timedLots=allLots.filter(l=>l.endDateTime).slice().sort((a,b)=>String(a.endDateTime).localeCompare(String(b.endDateTime)));
  const lotConflictIds=new Set();
  for(let i=0;i<timedLots.length;i++){
    for(let j=i+1;j<timedLots.length;j++){
      const firstTime=new Date(timedLots[i].endDateTime).getTime();
      const secondTime=new Date(timedLots[j].endDateTime).getTime();
      if(!Number.isFinite(firstTime)||!Number.isFinite(secondTime))continue;
      const difference=secondTime-firstTime;
      if(difference>15*60*1000)break;
      if(difference>=0){lotConflictIds.add(timedLots[i].id);lotConflictIds.add(timedLots[j].id);}
    }
  }
  openModal(`
    <div class="modal-head"><div><div class="badge"><span class="dot" style="background:${safeColor(auction.color)}"></span>${esc(auction.status)}</div><h2 style="margin-top:8px">${esc(auction.name)}</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <div class="modal-body">
      <p style="color:var(--muted)">${auction.endDateTime?prettyDateTime(auction.endDateTime):prettyDate(auction.date)}${auction.platform?` · ${esc(auction.platform)}`:""}${auction.company?` · ${esc(auction.company)}`:""}${auction.location?` · ${esc(auction.location)}`:""}</p>
      <div class="auction-priority priority-${String(auction.priority||"Medium").toLowerCase()}">${esc(auction.priority||"Medium")} Priority</div>
      ${auction.notes?`<div class="panel"><p>${nl2br(auction.notes)}</p></div>`:""}
      <div class="section-head"><div><h3>Watch list</h3></div><button class="btn small" id="addLot">＋ Lot</button></div>
      <div class="list">${lots.length?lots.map(l=>{const priority=["High","Medium","Low"].includes(l.priority)?l.priority:"Medium";const lotTime=l.endDateTime?prettyDateTime(l.endDateTime):"Time not set";const lotConflict=lotConflictIds.has(l.id);const outcome=lotOutcome(l);return `<div class="list-card watch-lot-card ${lotConflict?"lot-time-conflict":""}" data-lot-detail="${l.id}"><div><div class="auction-card-topline"><span class="auction-priority auction-priority-small priority-${priority.toLowerCase()}">${esc(priority)} Priority</span><span class="lot-outcome lot-outcome-${outcome.toLowerCase().replaceAll(" ","-")}">${esc(outcome)}</span>${lotConflict?`<span class="watch-lot-conflict-label">⚠ Time Conflict</span>`:""}</div><h4>${esc(l.name)}</h4><p>Lot ${esc(l.lotNumber||"—")} · ${esc(lotTime)} · Expected ${money(l.expectedResale)} · Max ${money(l.maxBid)}${num(l.winningBid)>0?` · Winning price ${money(l.winningBid)}`:""}</p></div><div class="watch-lot-actions">${l.listingUrl?`<button class="btn ghost small" type="button" data-lot-listing="${l.id}">Open Listing</button>`:""}${outcome==="Won"&&!l.inventoryItemId?`<button class="btn small" type="button" data-catalog-lot="${l.id}">Catalog Item</button>`:""}${l.inventoryItemId?`<button class="btn small" type="button" data-view-inventory="${l.id}">View Inventory Item</button>`:""}<button class="btn secondary small" type="button" data-lot-detail-button="${l.id}">Details</button></div></div>`;}).join(""):empty("No watched lots yet.")}</div>
    </div>
    <div class="modal-actions"><button class="btn danger" id="deleteAuction" type="button">Delete</button>${auction.website?`<button class="btn secondary" id="openAuctionWebsite" type="button">Open Auction Page</button>`:""}<button class="btn secondary" id="editAuction" type="button">Edit Auction</button><button class="btn" data-close type="button">Done</button></div>
  `);
  $("#addLot").onclick=()=>openLotModal(auction);
  const openAuctionWebsite=$("#openAuctionWebsite");
  if(openAuctionWebsite)openAuctionWebsite.onclick=()=>openExternalUrl(auction.website,"auction page");
  $("#editAuction").onclick=()=>{closeModal();openAuctionModal(auction);};
  $("#deleteAuction").onclick=async()=>{if(confirm("Delete this auction and its watch-list lots?")){for(const l of lots)await DB.remove("auctionLots",l.id);await DB.remove("auctions",id);closeModal();renderAuctionManager();}};
  $$("[data-lot-detail]",modalRoot).forEach(row=>row.onclick=()=>{const lot=lots.find(l=>l.id===row.dataset.lotDetail);if(lot)openLotDetail(auction,lot);});
  $$("[data-lot-detail-button]",modalRoot).forEach(b=>b.onclick=e=>{e.stopPropagation();const lot=lots.find(l=>l.id===b.dataset.lotDetailButton);if(lot)openLotDetail(auction,lot);});
  $$("[data-lot-listing]",modalRoot).forEach(b=>b.onclick=e=>{e.stopPropagation();const lot=lots.find(l=>l.id===b.dataset.lotListing);if(lot&&lot.listingUrl)openExternalUrl(lot.listingUrl,"lot listing");});
  $$("[data-catalog-lot]",modalRoot).forEach(b=>b.onclick=e=>{e.stopPropagation();const lot=lots.find(l=>l.id===b.dataset.catalogLot);if(lot)catalogLotToInventory(auction,lot);});
  $$("[data-view-inventory]",modalRoot).forEach(b=>b.onclick=e=>{e.stopPropagation();const lot=lots.find(l=>l.id===b.dataset.viewInventory);if(lot&&lot.inventoryItemId){closeModal();openItemDetail(lot.inventoryItemId);}});
}

async function openLotDetail(auction,lot){
  if(!auction||!lot)return;
  const outcome=lotOutcome(lot);
  openModal(`
    <div class="modal-head"><div><div class="auction-card-topline"><span class="lot-outcome lot-outcome-${outcome.toLowerCase().replaceAll(" ","-")}">${esc(outcome)}</span><span class="auction-priority auction-priority-small priority-${String(lot.priority||"Medium").toLowerCase()}">${esc(lot.priority||"Medium")} Priority</span></div><h2 style="margin-top:8px">${esc(lot.name||"Watch Lot")}</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <div class="modal-body">
      <div class="grid-2">
        <div class="panel"><h3>Lot Details</h3><p><strong>Auction:</strong> ${esc(auction.name||"—")}</p><p><strong>Lot / item number:</strong> ${esc(lot.lotNumber||"—")}</p><p><strong>Closing time:</strong> ${esc(lot.endDateTime?prettyDateTime(lot.endDateTime):"Not set")}</p><p><strong>Outcome:</strong> ${esc(outcome)}</p><p><strong>Priority:</strong> ${esc(lot.priority||"Medium")}</p><p><strong>Expected resale:</strong> ${money(lot.expectedResale)}</p><p><strong>Maximum bid:</strong> ${money(lot.maxBid)}</p></div>
        <div class="panel"><h3>Catalog Connection</h3><p><strong>Winning price:</strong> ${num(lot.winningBid)>0?money(lot.winningBid):"Not entered yet"}</p><p><strong>Inventory status:</strong> ${lot.inventoryItemId?"Cataloged":"Not cataloged"}</p></div>
      </div>
      ${lot.conditionAdvertised?`<div class="panel"><h3>Advertised Condition</h3><p>${nl2br(lot.conditionAdvertised)}</p></div>`:""}
      ${lot.notes?`<div class="panel"><h3>Notes</h3><p>${nl2br(lot.notes)}</p></div>`:""}
    </div>
    <div class="modal-actions">${lot.listingUrl?`<button class="btn secondary" id="lotDetailListing" type="button">Open Listing</button>`:""}${outcome==="Won"&&!lot.inventoryItemId?`<button class="btn" id="lotDetailCatalog" type="button">Catalog Item</button>`:""}${lot.inventoryItemId?`<button class="btn" id="lotDetailInventory" type="button">View Inventory Item</button>`:""}<button class="btn secondary" id="lotDetailEdit" type="button">Edit</button><button class="btn" data-close type="button">Done</button></div>
  `);
  const listing=$("#lotDetailListing");if(listing)listing.onclick=()=>openExternalUrl(lot.listingUrl,"lot listing");
  const catalog=$("#lotDetailCatalog");if(catalog)catalog.onclick=()=>catalogLotToInventory(auction,lot);
  const inventory=$("#lotDetailInventory");if(inventory)inventory.onclick=()=>{closeModal();openItemDetail(lot.inventoryItemId);};
  $("#lotDetailEdit").onclick=()=>{closeModal();openLotModal(auction,lot);};
}

async function catalogLotToInventory(auction,lot){
  const seed={
    __sourceLotId:lot.id,
    name:lot.name||"",
    color:auction.color||"#f7c75d",
    purchaseDate:auction.date||today(),
    sourceType:auction.auctionMode==="In Person"?"In-Person Auction":"Online Auction",
    sourcePlatform:auction.platform||"",
    purchaseSource:auction.name,
    sourceSeller:auction.company||"",
    sourceLocation:auction.location||"",
    listingTitle:lot.name,
    listingUrl:lot.listingUrl||"",
    lotNumber:lot.lotNumber||"",
    auctionEndDateTime:lot.endDateTime||auction.endDateTime||"",
    auctionId:auction.id,
    shippingStatus:auction.shippingStatus||"Won - Awaiting Payment",
    purchasePrice:"",
    buyerPremium:"",
    salesTaxRate:"",salesTax:"",
    shippingCost:"",
    handlingCost:"",
    askingPrice:lot.expectedResale,
    conditionNotes:lot.conditionAdvertised||"",
    notes:`Imported from tracked auction lot ${lot.lotNumber||""}. ${lot.notes||""}`.trim()
  };
  closeModal();
  await openItemModal(null,seed,async saved=>{
    lot.outcome="Won";
    lot.winningBid=saved.purchasePrice||"";
    lot.buyerPremium=saved.buyerPremium||"";
    lot.tax=saved.salesTax||"";
    lot.shippingCost=saved.shippingCost||"";
    lot.handlingCost=saved.handlingCost||"";
    lot.inventoryItemId=saved.id;
    await DB.put("auctionLots",lot);
    await DB.put("itemLogs",{id:DB.uid("log"),itemId:saved.id,text:`Won from ${auction.name} for ${money(saved.purchasePrice)}. Landed cost currently ${money(saved.totalLandedCost)}.`,createdAt:new Date().toISOString()});
  });
}

async function openLotModal(auction,lot){
  const l=lot||{id:DB.uid("lot"),auctionId:auction.id,name:"",lotNumber:"",listingUrl:"",endDateTime:"",priority:"Medium",outcome:"Watching",expectedResale:"",maxBid:"",winningBid:"",buyerPremium:"",tax:"",shippingCost:"",handlingCost:"",conditionAdvertised:"",notes:"",inventoryItemId:""};
  const currentOutcome=lotOutcome(l)==="Cataloged"?"Won":lotOutcome(l);
  openModal(`
    <div class="modal-head"><h2>${lot?"Edit Watch Lot":"Add Watch Lot"}</h2><button class="close-btn" data-close type="button">×</button></div>
    <form id="lotForm"><div class="modal-body"><div class="record-section">
      <div class="record-section-title"><span>👀</span><div><strong>Watch item</strong><small>Set the bidding ceiling now. Record the result when the auction ends.</small></div></div>
      <div class="form-grid">
        ${field("Item / lot name","name",l.name,true)}
        ${field("Lot / item number","lotNumber",l.lotNumber)}
        ${field("Item / lot URL","listingUrl",l.listingUrl,true)}
        ${field("Lot end date/time","endDateTime",l.endDateTime,false,"datetime-local")}
        ${selectField("Priority","priority",["High","Medium","Low"],l.priority||"Medium")}
        ${selectField("Outcome","outcome",["Watching","Won","Not Won"],currentOutcome)}
        ${field("Expected resale","expectedResale",l.expectedResale,false,"number","0.01")}
        ${field("Maximum bid","maxBid",l.maxBid,false,"number","0.01")}
        ${textareaField("Advertised condition","conditionAdvertised",l.conditionAdvertised)}
        ${textareaField("Notes","notes",l.notes)}
      </div></div></div>
      <div class="modal-actions">${lot?`<button class="btn danger" id="deleteLot" type="button">Delete</button>`:""}${lot&&l.listingUrl?`<button class="btn secondary" id="openLotWebsite" type="button">Open Listing</button>`:""}<button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save Lot</button></div>
    </form>
  `);
  const openLotWebsite=$("#openLotWebsite");
  if(openLotWebsite)openLotWebsite.onclick=()=>openExternalUrl(l.listingUrl,"lot listing");
  $("#lotForm").onsubmit=async e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(e.currentTarget).entries());
    data.listingUrl=String(data.listingUrl||"").trim();
    if(!data.listingUrl){alert("Add the Item / lot URL before saving this Watch Lot.");return;}
    if(!["High","Medium","Low"].includes(data.priority))data.priority="Medium";
    if(!["Watching","Won","Not Won"].includes(data.outcome))data.outcome="Watching";
    await DB.put("auctionLots",Object.assign({},l,data));
    closeModal();
      await renderAuctionManager();
    openAuctionDetail(auction.id);
  };
  if(lot)$("#deleteLot").onclick=async()=>{await DB.remove("auctionLots",l.id);closeModal();openAuctionDetail(auction.id);};
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
        <button class="action-sheet-btn" id="qaAuction"><span>🌐</span><div><strong>Auction</strong><small>Track an online or in-person auction</small></div></button>
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

async function startCameraCapture(onCaptured,onCancelled,preferredDeviceId=""){const fallbackCapture=()=>{if(!onCaptured){$("#globalCameraInput").click();return;}const input=document.createElement("input");input.type="file";input.accept="image/*";input.setAttribute("capture","environment");input.onchange=async event=>{const files=Array.from(event.target.files||[]);if(!files.length){if(onCancelled)await onCancelled();return;}const blobs=[];for(const file of files)blobs.push(await compressImage(file));await onCaptured(blobs);};input.click();};if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.isSecureContext){let stream=null;let cameraTrack=null;let cameraCapabilities={};let torchOn=false;let finished=false;try{const videoConstraints=preferredDeviceId?{deviceId:{exact:preferredDeviceId},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30}}:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30}};stream=await navigator.mediaDevices.getUserMedia({video:videoConstraints,audio:false});openModal(`<div class="modal-head"><div><div class="eyebrow">CAMERA</div><h2>Take Photo</h2></div><button class="close-btn" id="cameraClose" type="button">X</button></div><div class="field" id="cameraCameraPicker" style="display:none;margin:0 14px 10px"><label>Camera</label><select class="select" id="cameraCameraSelect"></select><small style="color:var(--muted)">If one rear lens looks blurry, try another camera here.</small></div><div class="field" id="cameraZoomWrap" style="display:none;margin:0 14px 10px"><label>Zoom</label><input class="input" id="cameraZoom" type="range"><small style="color:var(--muted)">Zoom changes only the camera image; the shutter controls stay fixed.</small></div><div class="camera-stage" style="position:relative"><video id="liveCamera" autoplay playsinline muted></video><div style="position:absolute;left:10px;right:10px;bottom:42px;z-index:20;display:flex;justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn secondary small" id="cameraTorchOverlay" type="button" disabled style="background:rgba(18,24,32,.92)">Light On</button><button class="btn secondary small" id="cameraRefocusOverlay" type="button" disabled style="background:rgba(18,24,32,.92)">Refocus</button></div><div class="camera-help" id="cameraStatus">Fill the frame and take a clear photo.</div></div><div class="camera-controls"><button class="btn secondary" id="cameraCancel" type="button">Cancel</button><button class="shutter" id="cameraShutter" type="button" aria-label="Take photo"><span></span></button><button class="btn ghost" id="cameraFallback" type="button">Phone Camera</button></div>`);const video=$("#liveCamera");const cameraPicker=$("#cameraCameraPicker");const cameraSelect=$("#cameraCameraSelect");const status=$("#cameraStatus");const cameraZoomWrap=$("#cameraZoomWrap");const cameraZoom=$("#cameraZoom");video.srcObject=stream;cameraTrack=stream.getVideoTracks&&stream.getVideoTracks()[0]?stream.getVideoTracks()[0]:null;const stop=()=>{if(cameraTrack&&torchOn){try{cameraTrack.applyConstraints({advanced:[{torch:false}]});}catch(err){}}torchOn=false;cameraTrack=null;cameraCapabilities={};if(stream){try{stream.getTracks().forEach(track=>track.stop());}catch(err){}stream=null;}if(video)video.srcObject=null;};const cancel=async()=>{if(finished)return;finished=true;stop();closeModal();if(onCancelled)await onCancelled();};const updateTorchButton=()=>{const button=$("#cameraTorchOverlay");if(!button)return;button.textContent=torchOn?"Light Off":"Light On";};const toggleTorch=async()=>{if(!cameraTrack||!cameraCapabilities.torch)return;try{torchOn=!torchOn;await cameraTrack.applyConstraints({advanced:[{torch:torchOn}]});updateTorchButton();status.textContent=torchOn?"Camera light is on. Hold the camera steady and avoid glare.":"Camera light is off. Hold the camera steady for a clear photo.";}catch(err){torchOn=false;updateTorchButton();console.warn("Camera torch control unavailable",err);status.textContent="This camera could not change the light setting.";}};const refocusCamera=async()=>{if(!cameraTrack)return;try{const modes=Array.isArray(cameraCapabilities.focusMode)?cameraCapabilities.focusMode:[];if(modes.includes("single-shot")){await cameraTrack.applyConstraints({advanced:[{focusMode:"single-shot"}]});status.textContent="Refocusing camera...";setTimeout(async()=>{try{if(cameraTrack&&modes.includes("continuous"))await cameraTrack.applyConstraints({advanced:[{focusMode:"continuous"}]});if(!finished)status.textContent="Camera refocused. Hold steady for a clear photo.";}catch(err){}},700);}else if(modes.includes("continuous")){await cameraTrack.applyConstraints({advanced:[{focusMode:"continuous"}]});status.textContent="Autofocus refreshed. Hold steady for a clear photo.";}else{status.textContent="This camera does not expose manual focus control.";}}catch(err){console.warn("Camera refocus unavailable",err);status.textContent="The camera could not be refocused manually.";}};$("#cameraClose").onclick=cancel;$("#cameraCancel").onclick=cancel;$("#cameraTorchOverlay").onclick=toggleTorch;$("#cameraRefocusOverlay").onclick=refocusCamera;$("#cameraFallback").onclick=()=>{if(finished)return;finished=true;stop();closeModal();fallbackCapture();};if(cameraTrack){try{const capabilities=typeof cameraTrack.getCapabilities==="function"?cameraTrack.getCapabilities():{};cameraCapabilities=capabilities;if(cameraZoomWrap){if(cameraZoom){const zoomCaps=capabilities.zoom;if(zoomCaps){if(Number.isFinite(zoomCaps.min)){if(Number.isFinite(zoomCaps.max)){if(zoomCaps.max>zoomCaps.min){cameraZoom.min=String(zoomCaps.min);cameraZoom.max=String(zoomCaps.max);cameraZoom.step=String(zoomCaps.step||0.1);const currentZoom=typeof cameraTrack.getSettings==="function"?cameraTrack.getSettings().zoom:null;cameraZoom.value=String(Number.isFinite(currentZoom)?currentZoom:zoomCaps.min);cameraZoomWrap.style.display="block";cameraZoom.oninput=async()=>{if(!cameraTrack)return;try{await cameraTrack.applyConstraints({advanced:[{zoom:Number(cameraZoom.value)}]});}catch(err){console.warn("Camera zoom unavailable",err);status.textContent="This camera could not change the zoom setting.";}};}}}}}}const torchButton=$("#cameraTorchOverlay");const refocusButton=$("#cameraRefocusOverlay");if(torchButton){torchButton.disabled=!capabilities.torch;torchButton.title=capabilities.torch?"Turn the rear camera light on or off":"Camera light control is not available on this device";}if(refocusButton){const modes=Array.isArray(capabilities.focusMode)?capabilities.focusMode:[];refocusButton.disabled=!(modes.includes("continuous")||modes.includes("single-shot"));}if(Array.isArray(capabilities.focusMode)&&capabilities.focusMode.includes("continuous"))await cameraTrack.applyConstraints({advanced:[{focusMode:"continuous"}]});const settings=typeof cameraTrack.getSettings==="function"?cameraTrack.getSettings():{};try{if(navigator.mediaDevices&&navigator.mediaDevices.enumerateDevices){const devices=(await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==="videoinput");if(devices.length>1&&cameraPicker&&cameraSelect){const activeDeviceId=String(settings.deviceId||"");if(!preferredDeviceId){if(devices.length){if(devices[0].deviceId){if(devices[0].deviceId!==activeDeviceId){finished=true;stop();closeModal();startCameraCapture(onCaptured,onCancelled,devices[0].deviceId);return;}}}}cameraSelect.innerHTML="";devices.forEach((device,index)=>{const option=document.createElement("option");option.value=device.deviceId;option.textContent=device.label||`Camera ${index}`;cameraSelect.appendChild(option);});if(activeDeviceId&&devices.some(device=>device.deviceId===activeDeviceId))cameraSelect.value=activeDeviceId;cameraPicker.style.display="block";cameraSelect.onchange=()=>{const nextDeviceId=String(cameraSelect.value||"");if(!nextDeviceId||nextDeviceId===activeDeviceId)return;finished=true;stop();closeModal();startCameraCapture(onCaptured,onCancelled,nextDeviceId);};}}}catch(err){console.warn("Camera enumeration unavailable",err);}if(settings.width&&settings.height)status.textContent=`Camera ready: ${settings.width} x ${settings.height}${settings.focusMode?` - Focus: ${settings.focusMode}`:""}.`;}catch(err){console.warn("Camera focus enhancement unavailable",err);}}$("#cameraShutter").onclick=async()=>{if(finished)return;if(!video.videoWidth){toast("Camera is still starting.");return;}const canvas=document.createElement("canvas");const maxDim=1800;const scale=Math.min(1,maxDim/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext("2d").drawImage(video,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.86));finished=true;stop();closeModal();if(blob){if(onCaptured)await onCaptured([blob]);else await quickCaptureFromBlobs([blob]);}};return;}catch(err){if(stream)stream.getTracks().forEach(track=>track.stop());}}fallbackCapture();}

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
    sourcePlatform:"",
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

function openOpenSourceLicenses(){
  openModal(`
    <div class="modal-head">
      <div>
        <div class="eyebrow">LEGAL</div>
        <h2>Open Source Licenses</h2>
      </div>
      <button class="close-btn" data-close type="button">×</button>
    </div>

    <div class="modal-body">
      <p style="margin-top:0;color:var(--muted);line-height:1.6">
        Moonskai Business Organizer includes the following third-party open-source software.
        These licenses apply to the listed third-party components only.
      </p>

      <div class="record-section">
        <h3>bwip-js</h3>
        <p><strong>License:</strong> MIT License</p>
        <p>Copyright © 2011–2026 Mark Warren.</p>
        <p>Includes Barcode Writer in Pure PostScript, Copyright © 2004–2024 Terry Burton.</p>
      </div>

      <div class="record-section">
        <h3>jsPDF</h3>
        <p><strong>License:</strong> MIT License</p>
        <p>Copyright © 2010–2025 James Hall, yWorks GmbH, Lukas Holländer, and other contributors identified in the bundled jsPDF license header.</p>
      </div>

      <div class="record-section">
        <h3>jsPDF-AutoTable</h3>
        <p><strong>License:</strong> MIT License</p>
        <p>Copyright © 2026 Simon Bengtsson.</p>
      </div>

      <div class="record-section">
        <h3>@zxing/browser</h3>
        <p><strong>License:</strong> MIT License</p>
      </div>

      <div class="record-section">
        <h3>@zxing/library</h3>
        <p><strong>License:</strong> Apache License 2.0</p>
        <p><a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener">View the Apache License 2.0 full text</a></p>
      </div>

      <details class="record-section">
        <summary><strong>MIT License text</strong></summary>
        <p style="white-space:pre-wrap;line-height:1.55">Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.</p>
      </details>
    </div>

    <div class="modal-actions">
      <button class="btn" data-close type="button">Done</button>
    </div>
  `);
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
function attentionCard(label,value,sub,icon,filter,route="inventory"){return `<button class="attention-card" data-jump="${esc(route)}" data-attention="${esc(filter)}"><span class="attention-icon">${icon}</span><span class="attention-number">${value}</span><strong>${label}</strong><small>${sub}</small></button>`;}
function itemCost(i){
  const repair=num(i.estimatedRepairCost);
  const explicit=num(i.totalLandedCost);
  if(explicit>0)return explicit+repair;
  const detailed=num(i.purchasePrice)+num(i.buyerPremium)+num(i.salesTax)+num(i.shippingCost)+num(i.handlingCost)+num(i.otherAcquisitionCosts)+(Array.isArray(i.customAcquisitionCosts)?i.customAcquisitionCosts:[]).reduce((total,row)=>total+num(row.amount),0);
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
function snapshotStat(label,value,sub="",cls="",action=""){return `<button class="stat snapshot-stat" data-snapshot="${esc(action)}" type="button"><div class="stat-label">${esc(label)}</div><div class="stat-value ${cls}">${value}</div>${sub?`<div class="stat-sub">${esc(sub)}</div>`:""}<div class="snapshot-stat-hint">View details →</div></button>`;}
function openSnapshotBreakdown(title,description,items,valueFn,total){
  openModal(`
    <div class="modal-head"><div><div class="eyebrow">BUSINESS SNAPSHOT</div><h2>${esc(title)}</h2></div><button class="close-btn" data-close type="button">×</button></div>
    <div class="modal-body">
      <div class="snapshot-breakdown-total"><span>Total</span><strong>${money(total)}</strong></div>
      <p class="snapshot-breakdown-copy">${esc(description)}</p>
      <div class="list">${items.length?items.map(item=>`<button class="list-card clickable-list-card snapshot-breakdown-row" data-snapshot-item="${esc(item.id)}" type="button"><div><h4>${esc(item.name||"Untitled Item")}</h4><p>${esc(item.sku||"No SKU")}${item.status?` · ${esc(item.status)}`:""}</p></div><strong>${money(valueFn(item))}</strong></button>`).join(""):empty("No matching inventory items.")}</div>
    </div>
    <div class="modal-actions"><button class="btn" data-close type="button">Done</button></div>
  `);
  $$("[data-snapshot-item]").forEach(row=>row.onclick=()=>{const id=row.dataset.snapshotItem;closeModal();openItemDetail(id);});
}
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
function auctionListItem(a){const when=a.endDateTime?prettyDateTime(a.endDateTime):prettyDate(a.date);return `<div class="list-card clickable-list-card" data-auction-detail-id="${a.id}"><div><div class="badge"><span class="dot" style="background:${safeColor(a.color||"#f7c75d")}"></span>${esc(a.platform||"Auction")}</div><h4>${esc(a.name)}</h4><p>${when}${a.location?` · ${esc(a.location)}`:""}${a.status?` · ${esc(a.status)}`:""} · ${esc(a.priority||"Medium")} priority</p></div></div>`;}
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
function openExternalUrl(value,label="website"){
  let raw=String(value||"").trim();
  if(!raw){alert(`No ${label} URL has been saved.`);return;}
  if(!/^[a-z][a-z0-9+.-]*:/i.test(raw))raw="https://"+raw;
  try{
    const url=new URL(raw);
    if(url.protocol!=="http:" && url.protocol!=="https:")throw new Error("Unsupported URL");
    window.open(url.href,"_blank","noopener");
  }catch(err){
    alert(`The saved ${label} URL is not valid.`);
  }
}

function csvCell(v){return `"${String(v??"").replace(/"/g,'""')}"`;}
function downloadFile(name,content,type){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
})();
