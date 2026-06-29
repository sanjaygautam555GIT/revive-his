async function loadDashboard(){
  const el=document.getElementById("dashboardView");
  el.innerHTML="<div class='panel'>Loading Dashboard V4.2...</div>";
  try{
    const [patients,opdVisits,admissions,ipdBills,expenses,stock,pharmacySales,purchases]=await Promise.all([fetchAll("patient"),fetchAll("opd_visits"),fetchAll("ipd_admission"),fetchAll("ipd_billing"),fetchAll("expenses"),fetchAll("pharmacy_stock"),fetchAll("pharmacy_sales"),fetchAll("pharmacy_purchases")]);
    const today=todayISO();
    const monthStart=today.slice(0,7)+"-01";
    const all={patients,opdVisits,ipdAdmissions:admissions,ipdBills,expenses,pharmacySales,pharmacyPurchases:purchases,stock};
    const monthSummary=buildFinancialSummary(all,monthStart,today);
    const todaySummary=buildFinancialSummary(all,today,today);
    const yesterday=new Date(today);yesterday.setDate(yesterday.getDate()-1);
    const yesterdaySummary=buildFinancialSummary(all,yesterday.toISOString().slice(0,10),yesterday.toISOString().slice(0,10));
    const now=new Date();const in30=new Date();in30.setDate(in30.getDate()+30);
    const opdToday=todaySummary.opd;
    const ipdToday=admissions.filter(r=>dateInRange(r,"created_at",today,today));
    const expToday=todaySummary.exp;
    const pharmToday=todaySummary.sales;
    const purchaseToday=todaySummary.purchases;
    const lowStock=stock.filter(r=>safeNumber(r.quantity)<=10);
    const expired=stock.filter(r=>r.expiry_date&&new Date(r.expiry_date)<now);
    const expiringSoon=stock.filter(r=>r.expiry_date&&new Date(r.expiry_date)>=now&&new Date(r.expiry_date)<=in30);
    const totalPatientsToday=opdToday.length+ipdToday.length;
    const pharmacyMargin=todaySummary.pharmacyRevenue>0?((todaySummary.pharmacyRevenue-todaySummary.pharmacyCost)/todaySummary.pharmacyRevenue)*100:0;
    const revenueChange=yesterdaySummary.revenue>0?((todaySummary.revenue-yesterdaySummary.revenue)/yesterdaySummary.revenue)*100:null;
    const alerts=[];
    if(todaySummary.grossProfit<0)alerts.push(["critical","Net loss today",money(todaySummary.grossProfit)]);
    if(expired.length)alerts.push(["critical",`${expired.length} expired medicine rows`,expired.slice(0,2).map(r=>r.medicine_name).join(", ")]);
    if(expiringSoon.length)alerts.push(["warning",`${expiringSoon.length} medicines expiring within 30 days`,expiringSoon.slice(0,2).map(r=>r.medicine_name).join(", ")]);
    if(lowStock.length)alerts.push(["warning",`${lowStock.length} low stock medicines`,lowStock.slice(0,2).map(r=>r.medicine_name).join(", ")]);
    if(revenueChange!==null)alerts.push([revenueChange>=0?"good":"warning",`Revenue ${revenueChange>=0?"up":"down"} vs yesterday`,`${revenueChange.toFixed(1)}%`]);
    if(!alerts.length)alerts.push(["good","No major alerts","Hospital financial status stable"]);
    const expenseByCategory=groupSum(expenses,"category","amount").slice(0,5);
    const opdByDepartment=groupCount(opdVisits,"department").slice(0,5);
    const topSold={};pharmToday.forEach(s=>parseSaleItems(s).forEach(i=>{const k=i.medicine_name||"Unknown";topSold[k]=(topSold[k]||0)+safeNumber(i.quantity)}));
    const topSoldRows=Object.entries(topSold).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value).slice(0,5);
    const score=performanceScore(todaySummary,lowStock,expired,expiringSoon,totalPatientsToday);
    const scoreLabel=score>=80?"Strong":score>=60?"Moderate":"Needs attention";
    const trend=lastNDaysTrend(all,30,today);
    el.innerHTML=`
      <div class="dash-head"><div><h2>Dashboard V4.2 – Executive Command Center</h2><p>Revive Hospital · ${new Date().toLocaleDateString()} · Updated ${new Date().toLocaleTimeString()}</p></div><div class="score-box"><span>Performance</span><strong>${score}/100</strong><small>${scoreLabel}</small></div></div>
      <div class="kpi-grid compact">
        ${kpiCard("Revenue Earned",money(todaySummary.revenue),revenueChange!==null?`${revenueChange.toFixed(1)}% vs yesterday`:"OPD + IPD bills + pharmacy","success")}
        ${kpiCard("Collections Today",money(todaySummary.totalCollection),"cash received incl. IPD advance","analytics")}
        ${kpiCard("Net Profit",money(todaySummary.grossProfit),`Margin ${todaySummary.margin.toFixed(1)}%`,todaySummary.grossProfit>=0?"success":"danger")}
        ${kpiCard("Patients",totalPatientsToday,`OPD ${opdToday.length} · IPD ${ipdToday.length}`,"info")}
        ${kpiCard("Cash Collection",money(todaySummary.cashCollection),`earned ${money(todaySummary.earnedCashCollection)}`,"success")}
        ${kpiCard("UPI Collection",money(todaySummary.upiCollection),`earned ${money(todaySummary.earnedUpiCollection)}`,"info")}
        ${kpiCard("Bank Collection",money(todaySummary.bankCollection),`earned ${money(todaySummary.earnedBankCollection)}`,"info")}
        ${kpiCard("IPD Advance",money(todaySummary.ipdAdvanceReceived),"not counted as revenue","warning")}
        ${kpiCard("Pharmacy",money(todaySummary.pharmacyRevenue),`${pharmToday.length} bills`,"analytics")}
        ${kpiCard("Stock",money(todaySummary.stockValue.purchaseValue),`${stock.length} rows`,"analytics")}
        ${kpiCard("Low Stock",lowStock.length,"Qty ≤ 10",lowStock.length?"warning":"success")}
        ${kpiCard("Expiry",expiringSoon.length,"next 30 days",expiringSoon.length?"warning":"success")}
      </div>
      <div class="dashboard-main-grid">
        <div class="panel"><h3>Revenue Trend – 30 Days</h3>${miniBarChart(trend.map(r=>r.revenue),trend.map(r=>r.day.slice(5)),"Revenue")}</div>
        <div class="panel"><h3>Profit Trend – 30 Days</h3>${miniBarChart(trend.map(r=>r.profit),trend.map(r=>r.day.slice(5)),"Profit")}</div>
        <div class="panel table-wrap"><h3>Smart Alerts</h3><table><tbody>${alerts.slice(0,5).map(a=>`<tr><td>${alertIcon(a[0])}</td><td>${a[1]}</td><td>${a[2]}</td></tr>`).join("")}</tbody></table></div>
        <div class="panel"><h3>Owner Insights</h3>${ownerInsights(todaySummary,monthSummary,revenueChange,pharmacyMargin,expiringSoon,lowStock).slice(0,6).map(x=>`<p>${x}</p>`).join("")}</div>
      </div>
      <div class="dashboard-secondary-grid">
        ${compactList("Revenue Mix",[["OPD",money(todaySummary.opdRevenue)],["IPD final bills",money(todaySummary.ipdRevenue)],["Pharmacy",money(todaySummary.pharmacyRevenue)]])}
        ${compactList("Collection Mix",[["Earned collection",money(todaySummary.earnedCollection)],["IPD advance",money(todaySummary.ipdAdvanceReceived)],["Total collection",money(todaySummary.totalCollection)]])}
        ${compactList("Hospital Status",[["OPD",opdToday.length],["IPD admissions",ipdToday.length],["Pharmacy bills",pharmToday.length],["Purchases",purchaseToday.length]])}
        ${compactList("Monthly Snapshot",[["Revenue",money(monthSummary.revenue)],["Collections",money(monthSummary.totalCollection)],["IPD advances",money(monthSummary.ipdAdvanceReceived)],["Net",money(monthSummary.grossProfit)]])}
      </div>
      <details class="panel"><summary><b>More details</b></summary><div class="grid" style="grid-template-columns:repeat(2,1fr);gap:16px;margin-top:16px">${dashboardList("Top Expense Categories",expenseByCategory.map(r=>[r.key,money(r.value),""]))}${dashboardList("OPD by Department",opdByDepartment.map(r=>[r.key,r.value,"records"]))}</div></details>`;
  }catch(e){el.innerHTML=`<div class='panel error'>Dashboard error: ${e.message}</div>`;}
}
function lastNDaysTrend(all,n,today){const arr=[];const end=new Date(today);for(let i=n-1;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);const iso=d.toISOString().slice(0,10);const s=buildFinancialSummary(all,iso,iso);arr.push({day:iso,revenue:s.revenue,profit:s.grossProfit,expense:s.operatingExpenses});}return arr;}
function kpiCard(title,value,sub,type){return `<div class="kpi-card ${type||"info"}"><span>${title}</span><strong>${value}</strong><p>${sub||""}</p></div>`}
function alertIcon(type){return type==="critical"?"🔴":type==="warning"?"🟠":"🟢"}
function miniBarChart(values,labels,title){const max=Math.max(...values.map(v=>Math.abs(safeNumber(v))),1);return `<div class="mini-chart">${values.map((v,i)=>{const h=Math.max(4,Math.round(Math.abs(safeNumber(v))/max*100));return `<div class="bar-col" title="${labels[i]} ${title}: ${money(v)}"><div class="bar ${v<0?"neg":""}" style="height:${h}%"></div><small>${i%5===0?labels[i]:""}</small></div>`}).join("")}</div>`;}
function compactList(title,rows){return `<div class="panel compact-list"><h3>${title}</h3>${rows.map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join("")}</div>`}
function performanceScore(summary,lowStock,expired,expiring,totalPatients){let s=70;if(summary.grossProfit>0)s+=10;else if(summary.revenue>0)s-=15;if(summary.revenue>0)s+=10;else s-=5;if(totalPatients>0)s+=5;if(lowStock.length)s-=5;if(expiring.length)s-=5;if(expired.length)s-=10;return Math.max(0,Math.min(100,Math.round(s)));}
function ownerInsights(today,month,revenueChange,pharmacyMargin,expiring,lowStock){const out=[];out.push(`• Revenue earned today <b>${money(today.revenue)}</b>; net result <b>${money(today.grossProfit)}</b>.`);out.push(`• Total collection today is <b>${money(today.totalCollection)}</b>, including IPD advance <b>${money(today.ipdAdvanceReceived)}</b>.`);if(revenueChange!==null)out.push(`• Revenue is <b>${Math.abs(revenueChange).toFixed(1)}%</b> ${revenueChange>=0?"higher":"lower"} than yesterday.`);out.push(`• Pharmacy contributed <b>${today.revenue?((today.pharmacyRevenue/today.revenue)*100).toFixed(1):0}%</b> of earned revenue.`);out.push(`• Pharmacy margin today is <b>${pharmacyMargin.toFixed(1)}%</b>.`);if(expiring.length)out.push(`• <b>${expiring.length}</b> medicine rows are expiring within 30 days.`);if(lowStock.length)out.push(`• <b>${lowStock.length}</b> medicine rows are low stock.`);out.push(`• Monthly revenue <b>${money(month.revenue)}</b>; monthly collections <b>${money(month.totalCollection)}</b>.`);return out;}
function groupSum(rows,keyField,amountField){const map={};rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+safeNumber(r[amountField])});return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value)}
function groupCount(rows,keyField){const map={};rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+1});return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value)}
function dashboardList(title,rows){return `<div class="panel table-wrap"><h3>${title}</h3><table><tbody>${rows.length?rows.map(r=>`<tr><td>${r[0]||""}</td><td>${r[1]||""}</td><td>${r[2]||""}</td></tr>`).join(""):"<tr><td>No records</td></tr>"}</tbody></table></div>`}
