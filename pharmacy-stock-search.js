// Live search and stock-status monitoring for Pharmacy Stock.
(function(){
  const originalRender=window.renderPharmacyStock;
  if(typeof originalRender!=="function")return;

  function startOfToday(){
    const d=new Date();
    d.setHours(0,0,0,0);
    return d;
  }

  function parseExpiry(value){
    const raw=String(value||"").trim();
    if(!raw)return null;
    const d=new Date(raw.length===10?`${raw}T00:00:00`:raw);
    return Number.isNaN(d.getTime())?null:d;
  }

  function daysUntilExpiry(value){
    const expiry=parseExpiry(value);
    if(!expiry)return null;
    expiry.setHours(0,0,0,0);
    return Math.floor((expiry-startOfToday())/86400000);
  }

  function rowDetails(row){
    const qtyCell=row.children[6]||row.children[4];
    const expiryCell=row.children[3];
    return {
      qty:parseFloat(String(qtyCell?.textContent||"0").replace(/[^0-9.-]/g,""))||0,
      days:daysUntilExpiry(expiryCell?.textContent||"")
    };
  }

  function addStatusCards(view){
    const cards=view.querySelector(".grid.cards");
    if(!cards||document.getElementById("nearExpiryCount"))return;
    cards.insertAdjacentHTML("beforeend",`
      <div class="card stock-status-card" data-stock-filter="zero" style="cursor:pointer"><span>Out of Stock</span><strong id="outOfStockCount">0</strong></div>
      <div class="card stock-status-card" data-stock-filter="near90" style="cursor:pointer"><span>Near Expiry</span><strong id="nearExpiryCount">0</strong><small>Next 90 days</small></div>
      <div class="card stock-status-card" data-stock-filter="expired" style="cursor:pointer"><span>Expired</span><strong id="expiredStockCount">0</strong></div>`);
  }

  window.renderPharmacyStock=async function(){
    await originalRender();
    const view=document.getElementById("pharmacyStockView");
    const tablePanel=view?.querySelector(".table-wrap");
    if(!view||!tablePanel)return;

    addStatusCards(view);

    if(!document.getElementById("pharmacyStockSearch")){
      const searchPanel=document.createElement("div");
      searchPanel.className="panel";
      searchPanel.innerHTML=`
        <div class="grid" style="grid-template-columns:2fr 1fr auto;align-items:end">
          <div>
            <label>Search Stock</label>
            <input id="pharmacyStockSearch" placeholder="Search item name, batch, type or expiry">
          </div>
          <div>
            <label>Stock Status</label>
            <select id="pharmacyStockStatusFilter">
              <option value="all">All Stock</option>
              <option value="available">Available Stock</option>
              <option value="low">Low Stock (10 or less)</option>
              <option value="zero">Out of Stock</option>
              <option value="near30">Near Expiry — 30 days</option>
              <option value="near60">Near Expiry — 60 days</option>
              <option value="near90">Near Expiry — 90 days</option>
              <option value="near180">Near Expiry — 6 months</option>
              <option value="near365">Near Expiry — 1 year</option>
              <option value="expired">Expired Stock</option>
            </select>
          </div>
          <button type="button" id="clearPharmacyStockSearch" class="secondary">Clear</button>
        </div>
        <p id="pharmacyStockSearchCount" style="margin-bottom:0"></p>`;
      tablePanel.parentNode.insertBefore(searchPanel,tablePanel);
    }

    const applyFilter=()=>{
      const query=document.getElementById("pharmacyStockSearch").value.trim().toLowerCase();
      const status=document.getElementById("pharmacyStockStatusFilter").value;
      const rows=[...document.querySelectorAll("#stockRows tr")];
      let visible=0,near90=0,expired=0,zero=0;

      rows.forEach(row=>{
        if(row.children.length<2){row.style.display="";return;}
        const text=row.textContent.toLowerCase();
        const {qty,days}=rowDetails(row);
        if(qty<=0)zero++;
        if(days!==null&&days<0)expired++;
        if(days!==null&&days>=0&&days<=90)near90++;

        const nearLimit=status.startsWith("near")?Number(status.replace("near","")):null;
        const matchesText=!query||text.includes(query);
        const matchesStatus=status==="all"||
          (status==="available"&&qty>0)||
          (status==="low"&&qty>0&&qty<=10)||
          (status==="zero"&&qty<=0)||
          (status==="expired"&&days!==null&&days<0)||
          (nearLimit!==null&&days!==null&&days>=0&&days<=nearLimit);

        const show=matchesText&&matchesStatus;
        row.style.display=show?"":"none";
        row.style.background=(days!==null&&days<0)?"#fee2e2":(days!==null&&days<=30)?"#ffedd5":(days!==null&&days<=90)?"#fef9c3":"";
        if(show)visible++;
      });

      document.getElementById("pharmacyStockSearchCount").textContent=`${visible} stock record${visible===1?"":"s"} shown.`;
      const nearEl=document.getElementById("nearExpiryCount");
      const expiredEl=document.getElementById("expiredStockCount");
      const zeroEl=document.getElementById("outOfStockCount");
      if(nearEl)nearEl.textContent=near90;
      if(expiredEl)expiredEl.textContent=expired;
      if(zeroEl)zeroEl.textContent=zero;
    };

    document.getElementById("pharmacyStockSearch").oninput=applyFilter;
    document.getElementById("pharmacyStockStatusFilter").onchange=applyFilter;
    document.getElementById("clearPharmacyStockSearch").onclick=()=>{
      document.getElementById("pharmacyStockSearch").value="";
      document.getElementById("pharmacyStockStatusFilter").value="all";
      applyFilter();
      document.getElementById("pharmacyStockSearch").focus();
    };

    view.querySelectorAll(".stock-status-card").forEach(card=>{
      card.onclick=()=>{
        document.getElementById("pharmacyStockStatusFilter").value=card.dataset.stockFilter;
        applyFilter();
        tablePanel.scrollIntoView({behavior:"smooth",block:"start"});
      };
    });

    applyFilter();
  };
})();