// Live search for Pharmacy Stock.
(function(){
  const originalRender=window.renderPharmacyStock;
  if(typeof originalRender!=="function")return;

  window.renderPharmacyStock=async function(){
    await originalRender();
    const view=document.getElementById("pharmacyStockView");
    const tablePanel=view?.querySelector(".table-wrap");
    if(!view||!tablePanel||document.getElementById("pharmacyStockSearch"))return;

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
          </select>
        </div>
        <button type="button" id="clearPharmacyStockSearch" class="secondary">Clear</button>
      </div>
      <p id="pharmacyStockSearchCount" style="margin-bottom:0"></p>`;
    tablePanel.parentNode.insertBefore(searchPanel,tablePanel);

    const applyFilter=()=>{
      const query=document.getElementById("pharmacyStockSearch").value.trim().toLowerCase();
      const status=document.getElementById("pharmacyStockStatusFilter").value;
      const rows=[...document.querySelectorAll("#stockRows tr")];
      let visible=0;

      rows.forEach(row=>{
        if(row.children.length<2){row.style.display="";return;}
        const text=row.textContent.toLowerCase();
        const qtyCell=row.children[6]||row.children[4];
        const qty=parseFloat(String(qtyCell?.textContent||"0").replace(/[^0-9.-]/g,""))||0;
        const matchesText=!query||text.includes(query);
        const matchesStatus=status==="all"||
          (status==="available"&&qty>0)||
          (status==="low"&&qty>0&&qty<=10)||
          (status==="zero"&&qty<=0);
        const show=matchesText&&matchesStatus;
        row.style.display=show?"":"none";
        if(show)visible++;
      });

      document.getElementById("pharmacyStockSearchCount").textContent=`${visible} stock record${visible===1?"":"s"} shown.`;
    };

    document.getElementById("pharmacyStockSearch").addEventListener("input",applyFilter);
    document.getElementById("pharmacyStockStatusFilter").addEventListener("change",applyFilter);
    document.getElementById("clearPharmacyStockSearch").onclick=()=>{
      document.getElementById("pharmacyStockSearch").value="";
      document.getElementById("pharmacyStockStatusFilter").value="all";
      applyFilter();
      document.getElementById("pharmacyStockSearch").focus();
    };
    applyFilter();
  };
})();