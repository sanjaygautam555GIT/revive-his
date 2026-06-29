async function loadDashboard(){
  const el=document.getElementById("dashboardView");
  el.innerHTML="<div class='panel'>Loading Dashboard V4...</div>";

  try{
    const [patients, admissions, ipdBills, expenses, stock, pharmacySales, purchases] = await Promise.all([
      fetchAll("patient"), fetchAll("ipd_admission"), fetchAll("ipd_billing"),
      fetchAll("expenses"), fetchAll("pharmacy_stock"), fetchAll("pharmacy_sales"), fetchAll("pharmacy_purchases")
    ]);

    const today=todayISO();
    const monthStart=today.slice(0,7)+"-01";
    const monthSummary=buildFinancialSummary({patients,ipdBills,expenses,pharmacySales,pharmacyPurchases:purchases,stock},monthStart,today);
    const todaySummary=buildFinancialSummary({patients,ipdBills,expenses,pharmacySales,pharmacyPurchases:purchases,stock},today,today);
    const yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
    const yISO=yesterday.toISOString().slice(0,10);
    const yesterdaySummary=buildFinancialSummary({patients,ipdBills,expenses,pharmacySales,pharmacyPurchases:purchases,stock},yISO,yISO);

    const now=new Date();
    const in30=new Date();in30.setDate(in30.getDate()+30);
    const opdToday=todaySummary.opd;
    const ipdToday=admissions.filter(r=>dateInRange(r,"created_at",today,today));
    const ipdBillsToday=todaySummary.bills;
    const pharmToday=todaySummary.sales;
    const purchaseToday=todaySummary.purchases;
    const expToday=todaySummary.exp;
    const lowStock=stock.filter(r=>safeNumber(r.quantity)<=10);
    const expired=stock.filter(r=>r.expiry_date && new Date(r.expiry_date)<now);
    const expiringSoon=stock.filter(r=>r.expiry_date && new Date(r.expiry_date)>=now && new Date(r.expiry_date)<=in30);
    const totalPatientsToday=opdToday.length+ipdToday.length;
    const pharmacyMargin=todaySummary.pharmacyRevenue>0?((todaySummary.pharmacyRevenue-todaySummary.pharmacyCost)/todaySummary.pharmacyRevenue)*100:0;
    const revenueChange=yesterdaySummary.revenue>0?((todaySummary.revenue-yesterdaySummary.revenue)/yesterdaySummary.revenue)*100:null;
    const alerts=[];
    if(todaySummary.grossProfit<0)alerts.push(["🔴","Net loss today",money(todaySummary.grossProfit)]);
    if(expiringSoon.length)alerts.push(["🟠",`${expiringSoon.length} medicines expiring within 30 days`,expiringSoon.slice(0,2).map(r=>r.medicine_name).join(", ")]);
    if(expired.length)alerts.push(["🔴",`${expired.length} expired medicine rows`,expired.slice(0,2).map(r=>r.medicine_name).join(", ")]);
    if(lowStock.length)alerts.push(["🟠",`${lowStock.length} low stock medicines`,lowStock.slice(0,2).map(r=>r.medicine_name).join(", ")]);
    if(revenueChange!==null)alerts.push([revenueChange>=0?"🟢":"🟠",`Revenue ${revenueChange>=0?"up":"down"} vs yesterday`,`${revenueChange.toFixed(1)}%`]);
    if(!alerts.length)alerts.push(["🟢","No major alerts","Hospital financial status stable"]);

    const expenseByCategory=groupSum(expenses,"category","amount").slice(0,5);
    const opdByDepartment=groupCount(patients,"department").slice(0,5);
    const recentExpenses=expenses.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
    const recentPharmacyBills=pharmacySales.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
    const topSold={};
    pharmToday.forEach(s=>parseSaleItems(s).forEach(i=>{const k=i.medicine_name||"Unknown";topSold[k]=(topSold[k]||0)+safeNumber(i.quantity)}));
    const topSoldRows=Object.entries(topSold).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value).slice(0,5);

    const score=performanceScore(todaySummary,lowStock,expired,expiringSoon,totalPatientsToday);
    const scoreLabel=score>=80?"Strong":score>=60?"Moderate":"Needs attention";

    el.innerHTML=`
      <div class="panel hero-panel">
        <div>
          <h2>Dashboard V4 – Executive Command Center</h2>
          <p>Revive Hospital · ${new Date().toLocaleDateString()} · Last updated ${new Date().toLocaleTimeString()}</p>
        </div>
        <div class="score-box"><span>Performance Score</span><strong>${score}/100</strong><small>${scoreLabel}</small></div>
      </div>

      <div class="grid cards">
        ${kpiCard("💰 Revenue Today",money(todaySummary.revenue),revenueChange!==null?`${revenueChange.toFixed(1)}% vs yesterday`:"No yesterday data")}
        ${kpiCard("📉 Expenses Today",money(todaySummary.operatingExpenses),`${expToday.length} entries`)}
        ${kpiCard("📈 Net Profit Today",money(todaySummary.grossProfit),`Margin ${todaySummary.margin.toFixed(1)}%`)}
        ${kpiCard("👥 Patients Today",totalPatientsToday,`OPD ${opdToday.length} · IPD ${ipdToday.length}`)}
        ${kpiCard("💵 Cash",money(todaySummary.cashCollection),"Today")}
        ${kpiCard("📱 UPI",money(todaySummary.upiCollection),"Today")}
        ${kpiCard("🏦 Bank",money(todaySummary.bankCollection),"Today")}
        ${kpiCard("💊 Pharmacy Sales",money(todaySummary.pharmacyRevenue),`${pharmToday.length} bills`)}
        ${kpiCard("📦 Stock Cost Value",money(todaySummary.stockValue.purchaseValue),`${stock.length} rows`)}
        ${kpiCard("⚠ Low Stock",lowStock.length,"Qty ≤ 10")}
        ${kpiCard("⏰ Expiring 30 Days",expiringSoon.length,"medicine rows")}
        ${kpiCard("🏥 IPD Billing Today",money(todaySummary.ipdRevenue),`${ipdBillsToday.length} bills`)}
      </div>

      <div class="grid" style="grid-template-columns:1.2fr .8fr;gap:16px;margin-top:16px">
        <div class="panel table-wrap"><h3>Smart Alerts</h3><table><tbody>${alerts.map(a=>`<tr><td>${a[0]}</td><td>${a[1]}</td><td>${a[2]}</td></tr>`).join("")}</tbody></table></div>
        <div class="panel"><h3>Financial Snapshot</h3><p><b>Monthly Revenue:</b> ${money(monthSummary.revenue)}</p><p><b>Monthly Expenses:</b> ${money(monthSummary.operatingExpenses)}</p><p><b>Monthly Net:</b> ${money(monthSummary.grossProfit)}</p><p><b>Purchase Today:</b> ${money(sumField(purchaseToday,"total_amount"))}</p></div>
      </div>

      <div class="grid" style="grid-template-columns:repeat(2,1fr);gap:16px;margin-top:16px">
        ${dashboardList("Revenue Today",[["OPD",money(todaySummary.opdRevenue),opdToday.length+" records"],["IPD Billing",money(todaySummary.ipdRevenue),ipdBillsToday.length+" bills"],["Pharmacy",money(todaySummary.pharmacyRevenue),pharmToday.length+" bills"],["Total",money(todaySummary.revenue),""]])}
        ${dashboardList("Hospital Activity",[["OPD Patients",opdToday.length,"today"],["IPD Admissions",ipdToday.length,"today"],["Pharmacy Bills",pharmToday.length,"today"],["Purchases",purchaseToday.length,"rows"],["Expenses",expToday.length,"entries"]])}
        ${dashboardList("Pharmacy Intelligence",[["Gross Margin",money(todaySummary.pharmacyRevenue-todaySummary.pharmacyCost),pharmacyMargin.toFixed(1)+"%"],["Low Stock",lowStock.length,"rows"],["Expired / Expiring",expired.length+" / "+expiringSoon.length,"rows"],["Top Sold",topSoldRows[0]?.key||"No sales",topSoldRows[0]?.value||""]])}
        ${dashboardList("Quick Reports",[["Executive Report","Open Reports",""],["Pharmacy Analytics","Open Reports",""] ,["Trend Summary","Open Reports",""]])}
      </div>

      <div class="grid" style="grid-template-columns:repeat(2,1fr);gap:16px;margin-top:16px">
        ${dashboardList("Top Expense Categories",expenseByCategory.map(r=>[r.key,money(r.value),""]))}
        ${dashboardList("OPD by Department",opdByDepartment.map(r=>[r.key,r.value,"records"]))}
        ${dashboardList("Recent Expenses",recentExpenses.map(r=>[r.expense_date||rowDate(r),r.category,money(r.amount||0)]))}
        ${dashboardList("Recent Pharmacy Bills",recentPharmacyBills.map(r=>[r.bill_date||rowDate(r),r.patient_name,money(r.bill_amount||r.amount_paid||0)]))}
      </div>

      <div class="panel"><h3>Owner Insights</h3>${ownerInsights(todaySummary,monthSummary,revenueChange,pharmacyMargin,expiringSoon,lowStock).map(x=>`<p>${x}</p>`).join("")}</div>
    `;
  }catch(e){
    el.innerHTML=`<div class='panel error'>Dashboard error: ${e.message}</div>`;
  }
}

function kpiCard(title,value,sub){return `<div class="card"><span>${title}</span><strong>${value}</strong><p>${sub||""}</p></div>`}

function performanceScore(summary,lowStock,expired,expiring,totalPatients){
  let s=70;
  if(summary.grossProfit>0)s+=10;else s-=15;
  if(summary.revenue>0)s+=10;else s-=10;
  if(totalPatients>0)s+=5;
  if(lowStock.length)s-=5;
  if(expiring.length)s-=5;
  if(expired.length)s-=10;
  return Math.max(0,Math.min(100,Math.round(s)));
}

function ownerInsights(today,month,revenueChange,pharmacyMargin,expiring,lowStock){
  const out=[];
  out.push(`• Today's revenue is <b>${money(today.revenue)}</b> with net result <b>${money(today.grossProfit)}</b>.`);
  if(revenueChange!==null)out.push(`• Revenue is <b>${Math.abs(revenueChange).toFixed(1)}%</b> ${revenueChange>=0?"higher":"lower"} than yesterday.`);
  out.push(`• Pharmacy contributed <b>${today.revenue?((today.pharmacyRevenue/today.revenue)*100).toFixed(1):0}%</b> of today's revenue.`);
  out.push(`• Pharmacy gross margin today is <b>${pharmacyMargin.toFixed(1)}%</b>.`);
  if(expiring.length)out.push(`• <b>${expiring.length}</b> medicine rows are expiring within 30 days.`);
  if(lowStock.length)out.push(`• <b>${lowStock.length}</b> medicine rows are below low-stock threshold.`);
  out.push(`• Monthly revenue is <b>${money(month.revenue)}</b> and monthly net result is <b>${money(month.grossProfit)}</b>.`);
  return out;
}

function groupSum(rows,keyField,amountField){
  const map={};
  rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+safeNumber(r[amountField])});
  return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
}

function groupCount(rows,keyField){
  const map={};
  rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+1});
  return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
}

function dashboardList(title,rows){
  return `<div class="panel table-wrap"><h3>${title}</h3><table><tbody>${rows.length?rows.map(r=>`<tr><td>${r[0]||""}</td><td>${r[1]||""}</td><td>${r[2]||""}</td></tr>`).join(""):"<tr><td>No records</td></tr>"}</tbody></table></div>`;
}
