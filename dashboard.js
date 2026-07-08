async function loadDashboard(){
  const el=document.getElementById("dashboardView");
  el.innerHTML="<div class='panel'>Loading dashboard...</div>";
  try{
    const [patients,opdVisits,admissions,ipdBills,diagnosticBills,stock,pharmacySales,purchases,expenses]=await Promise.all([
      fetchAll("patient"),fetchAll("opd_visits"),fetchAll("ipd_admission"),fetchAll("ipd_billing"),fetchAll("diagnostic_bills"),fetchAll("pharmacy_stock"),fetchAll("pharmacy_sales"),fetchAll("pharmacy_purchases"),fetchAll("expenses")
    ]);
    const today=todayISO();
    const monthStart=today.slice(0,7)+"-01";
    const now=new Date();
    const in30=new Date();in30.setDate(in30.getDate()+30);
    const opdToday=filterByDate(opdVisits,"visit_date",today,today);
    const opdMonth=filterByDate(opdVisits,"visit_date",monthStart,today);
    const ipdFinalToday=filterByDate(ipdBills,"billing_date",today,today);
    const ipdFinalMonth=filterByDate(ipdBills,"billing_date",monthStart,today);
    const diagToday=filterByDate(diagnosticBills,"billing_date",today,today);
    const diagMonth=filterByDate(diagnosticBills,"billing_date",monthStart,today);
    const pharmToday=filterByDate(pharmacySales,"bill_date",today,today);
    const pharmMonth=filterByDate(pharmacySales,"bill_date",monthStart,today);
    const expToday=filterByDate(expenses,"expense_date",today,today);
    const expMonth=filterByDate(expenses,"expense_date",monthStart,today);
    const ipdAdmissionToday=filterByDate(admissions,"admission_date",today,today).filter(isActiveIPDAdmission);
    const ipdAdmissionMonth=filterByDate(admissions,"admission_date",monthStart,today);
    const activeIpd=admissions.filter(isActiveIPDAdmission);
    const dischargedToday=filterByDate(admissions,"discharge_date",today,today);
    const dischargedMonth=filterByDate(admissions,"discharge_date",monthStart,today);
    const daily={
      opdRevenue:sumField(opdToday,"amount"),ipdRevenue:sumField(ipdFinalToday,"total"),diagRevenue:sumField(diagToday,"total_amount"),pharmRevenue:sumField(pharmToday,"bill_amount"),expense:sumField(expToday,"amount"),
      opdCount:opdToday.length,ipdNew:ipdAdmissionToday.length,ipdActive:activeIpd.length,diagCount:diagToday.length,pharmCount:pharmToday.length,discharged:dischargedToday.length,
      ipdAdvance:ipdAdmissionToday.reduce((s,r)=>s+depositAmount(r),0),cash:collectionByMode({opd:opdToday,diag:diagToday,pharm:pharmToday,adm:ipdAdmissionToday},"cash"),upi:collectionByMode({opd:opdToday,diag:diagToday,pharm:pharmToday,adm:ipdAdmissionToday},"upi"),bank:collectionByMode({opd:opdToday,diag:diagToday,pharm:pharmToday,adm:ipdAdmissionToday},"bank")
    };
    daily.totalRevenue=daily.opdRevenue+daily.ipdRevenue+daily.diagRevenue+daily.pharmRevenue;
    daily.netAfterExpense=daily.totalRevenue-daily.expense;
    daily.totalCollection=daily.cash+daily.upi+daily.bank;
    const monthly={
      opdRevenue:sumField(opdMonth,"amount"),ipdRevenue:sumField(ipdFinalMonth,"total"),diagRevenue:sumField(diagMonth,"total_amount"),pharmRevenue:sumField(pharmMonth,"bill_amount"),expense:sumField(expMonth,"amount"),
      opdCount:opdMonth.length,admissions:ipdAdmissionMonth.length,discharges:dischargedMonth.length,diagCount:diagMonth.length,pharmCount:pharmMonth.length,
      ipdAdvance:ipdAdmissionMonth.reduce((s,r)=>s+depositAmount(r),0),cash:collectionByMode({opd:opdMonth,diag:diagMonth,pharm:pharmMonth,adm:ipdAdmissionMonth},"cash"),upi:collectionByMode({opd:opdMonth,diag:diagMonth,pharm:pharmMonth,adm:ipdAdmissionMonth},"upi"),bank:collectionByMode({opd:opdMonth,diag:diagMonth,pharm:pharmMonth,adm:ipdAdmissionMonth},"bank")
    };
    monthly.totalRevenue=monthly.opdRevenue+monthly.ipdRevenue+monthly.diagRevenue+monthly.pharmRevenue;
    monthly.netAfterExpense=monthly.totalRevenue-monthly.expense;
    monthly.totalCollection=monthly.cash+monthly.upi+monthly.bank;
    const stockValue=stockValuation(stock).purchaseValue;
    const lowStock=stock.filter(r=>safeNumber(r.quantity)<=10);
    const expiringSoon=stock.filter(r=>r.expiry_date&&new Date(r.expiry_date)>=now&&new Date(r.expiry_date)<=in30);
    const expired=stock.filter(r=>r.expiry_date&&new Date(r.expiry_date)<now);
    const trend=lastNDaysSimple({opdVisits,ipdBills,diagnosticBills,pharmacySales,expenses},7,today);
    el.innerHTML=`
      <div class="dash-head"><div><h2>Revive Hospital Dashboard</h2><p>Daily and monthly overview · ${new Date().toLocaleDateString()} · Updated ${new Date().toLocaleTimeString()}</p></div></div>
      <div class="panel"><h2>Daily Data</h2><p>Today's revenue, collection, expenses and patient activity.</p></div>
      <div class="dashboard-secondary-grid">
        ${summaryTable("Revenue Today",[["OPD",money(daily.opdRevenue)],["IPD Final Bills",money(daily.ipdRevenue)],["Diagnostics",money(daily.diagRevenue)],["Pharmacy",money(daily.pharmRevenue)],["Total Revenue",money(daily.totalRevenue)]])}
        ${summaryTable("Collection Today",[["Cash",money(daily.cash)],["UPI",money(daily.upi)],["Bank",money(daily.bank)],["IPD Advance Included",money(daily.ipdAdvance)],["Total Collection",money(daily.totalCollection)]])}
        ${summaryTable("Expense Today",[["Expense Entries",expToday.length],["Total Expense",money(daily.expense)],["Revenue - Expense",money(daily.netAfterExpense)]])}
        ${summaryTable("Activity Today",[["OPD Patients",daily.opdCount],["New IPD Admissions",daily.ipdNew],["Active IPD Patients",daily.ipdActive],["Diagnostics Bills",daily.diagCount],["Pharmacy Bills",daily.pharmCount],["Discharges",daily.discharged]])}
      </div>
      <div class="panel"><h2>Monthly Data</h2><p>Current month performance from ${monthStart} to ${today}.</p></div>
      <div class="dashboard-secondary-grid">
        ${summaryTable("Revenue This Month",[["OPD",money(monthly.opdRevenue)],["IPD Final Bills",money(monthly.ipdRevenue)],["Diagnostics",money(monthly.diagRevenue)],["Pharmacy",money(monthly.pharmRevenue)],["Total Revenue",money(monthly.totalRevenue)]])}
        ${summaryTable("Collection This Month",[["Cash",money(monthly.cash)],["UPI",money(monthly.upi)],["Bank",money(monthly.bank)],["IPD Advance Included",money(monthly.ipdAdvance)],["Total Collection",money(monthly.totalCollection)]])}
        ${summaryTable("Expense This Month",[["Expense Entries",expMonth.length],["Total Expense",money(monthly.expense)],["Revenue - Expense",money(monthly.netAfterExpense)]])}
        ${summaryTable("Monthly Statistics",[["Total OPD",monthly.opdCount],["Total Admissions",monthly.admissions],["Active IPD",activeIpd.length],["Total Discharges",monthly.discharges],["Diagnostics Bills",monthly.diagCount],["Pharmacy Bills",monthly.pharmCount]])}
      </div>
      <div class="panel"><h2>Pharmacy Stock</h2><p>Stock is shown separately from hospital revenue.</p></div>
      <div class="kpi-grid compact">
        ${kpiCard("Current Stock Value",money(stockValue),`${stock.length} stock rows`,"analytics")}
        ${kpiCard("Today Pharmacy Sales",money(daily.pharmRevenue),`${daily.pharmCount} bills`,"success")}
        ${kpiCard("Monthly Pharmacy Sales",money(monthly.pharmRevenue),`${monthly.pharmCount} bills`,"success")}
        ${kpiCard("Low Stock",lowStock.length,"Qty ≤ 10",lowStock.length?"warning":"success")}
        ${kpiCard("Expiring Soon",expiringSoon.length,"within 30 days",expiringSoon.length?"warning":"success")}
        ${kpiCard("Expired",expired.length,"needs removal",expired.length?"danger":"success")}
      </div>
      <div class="dashboard-main-grid">
        <div class="panel"><h3>Revenue Trend – Last 7 Days</h3>${miniBarChart(trend.map(r=>r.revenue),trend.map(r=>r.day.slice(5)),"Revenue")}</div>
        <div class="panel"><h3>Expense Trend – Last 7 Days</h3>${miniBarChart(trend.map(r=>r.expense),trend.map(r=>r.day.slice(5)),"Expense")}</div>
      </div>
      <div class="panel table-wrap"><h3>Important Alerts</h3><table><tbody>
        ${alertRow(expiringSoon.length?"warning":"good",`${expiringSoon.length} medicines expiring within 30 days`,expiringSoon.slice(0,2).map(r=>r.medicine_name).join(", ")||"-")}
        ${alertRow(lowStock.length?"warning":"good",`${lowStock.length} low stock medicines`,lowStock.slice(0,2).map(r=>r.medicine_name).join(", ")||"-")}
        ${alertRow(activeIpd.length?"info":"good",`${activeIpd.length} active IPD patients`,"Current inpatient load")}
      </tbody></table></div>`;
  }catch(e){el.innerHTML=`<div class='panel error'>Dashboard error: ${e.message}</div>`;}
}
function isActiveIPDAdmission(r){return !["discharged","final billed","cancelled","closed"].includes(String(r.status||"Admitted").trim().toLowerCase())}
function filterByDate(rows,field,from,to){return (rows||[]).filter(r=>dateInRange(r,field,from,to))}
function paymentOfRows(rows,field,mode){return rows.filter(r=>String(r.payment_mode||"").toLowerCase().includes(mode)).reduce((s,r)=>s+safeNumber(r[field]),0)}
function collectionByMode(set,mode){return paymentOfRows(set.opd,"amount",mode)+paymentOfRows(set.diag,"total_amount",mode)+paymentOfRows(set.pharm,"amount_paid",mode)+set.adm.filter(r=>String(r.payment_mode||"").toLowerCase().includes(mode)).reduce((s,r)=>s+depositAmount(r),0)}
function lastNDaysSimple(all,n,today){const arr=[];const end=new Date(today);for(let i=n-1;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);const iso=d.toISOString().slice(0,10);const opd=filterByDate(all.opdVisits,"visit_date",iso,iso);const ipd=filterByDate(all.ipdBills,"billing_date",iso,iso);const diag=filterByDate(all.diagnosticBills,"billing_date",iso,iso);const pharm=filterByDate(all.pharmacySales,"bill_date",iso,iso);const exp=filterByDate(all.expenses,"expense_date",iso,iso);const revenue=sumField(opd,"amount")+sumField(ipd,"total")+sumField(diag,"total_amount")+sumField(pharm,"bill_amount");const expense=sumField(exp,"amount");const collection=sumField(opd,"amount")+sumField(diag,"total_amount")+sumField(pharm,"amount_paid");arr.push({day:iso,revenue,expense,collection});}return arr;}
function kpiCard(title,value,sub,type){return `<div class="kpi-card ${type||"info"}"><span>${title}</span><strong>${value}</strong><p>${sub||""}</p></div>`}
function alertIcon(type){return type==="critical"?"🔴":type==="warning"?"🟠":type==="info"?"🔵":"🟢"}
function alertRow(type,text,value){return `<tr><td>${alertIcon(type)}</td><td>${text}</td><td>${value}</td></tr>`}
function miniBarChart(values,labels,title){const max=Math.max(...values.map(v=>Math.abs(safeNumber(v))),1);return `<div class="mini-chart">${values.map((v,i)=>{const h=Math.max(4,Math.round(Math.abs(safeNumber(v))/max*100));return `<div class="bar-col" title="${labels[i]} ${title}: ${money(v)}"><div class="bar" style="height:${h}%"></div><small>${labels[i]}</small></div>`}).join("")}</div>`;}
function summaryTable(title,rows){return `<div class="panel table-wrap"><h3>${title}</h3><table><tbody>${rows.map((r,i)=>`<tr><td>${i===rows.length-1?"<b>"+r[0]+"</b>":r[0]}</td><td style="text-align:right">${i===rows.length-1?"<b>"+r[1]+"</b>":r[1]}</td></tr>`).join("")}</tbody></table></div>`}
function groupSum(rows,keyField,amountField){const map={};rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+safeNumber(r[amountField])});return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value)}
function groupCount(rows,keyField){const map={};rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+1});return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value)}