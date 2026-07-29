async function dashboardFetch(table,timeoutMs=8000){
  try{
    return await Promise.race([
      fetchAll(table),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${table} request timed out`)),timeoutMs))
    ]);
  }catch(error){
    console.warn(`Dashboard data unavailable: ${table}`,error);
    return [];
  }
}

async function loadDashboard(){
  const el=document.getElementById("dashboardView");
  el.innerHTML="<div class='panel'>Loading dashboard...</div>";
  try{
    const [patients,opdVisits,admissions,ipdBills,diagnosticBills,stock,pharmacySales,purchases,expenses]=await Promise.all([
      dashboardFetch("patient"),dashboardFetch("opd_visits"),dashboardFetch("ipd_admission"),dashboardFetch("ipd_billing"),dashboardFetch("diagnostic_bills"),dashboardFetch("pharmacy_stock"),dashboardFetch("pharmacy_sales"),dashboardFetch("pharmacy_purchases"),dashboardFetch("expenses")
    ]);
    const today=todayISO();
    const monthStart=today.slice(0,7)+"-01";
    const now=new Date();
    const in90=new Date();in90.setDate(in90.getDate()+90);
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
    const stockRows=(stock||[]).filter(r=>safeNumber(r.quantity)>0);
    const lowStock=stockRows.filter(r=>safeNumber(r.quantity)<=10);
    const expiringSoon=stockRows.filter(r=>r.expiry_date&&new Date(r.expiry_date)>=now&&new Date(r.expiry_date)<=in90);
    const expired=stockRows.filter(r=>r.expiry_date&&new Date(r.expiry_date)<now);
    const trend=lastNDaysSimple({opdVisits,ipdBills,diagnosticBills,pharmacySales,expenses},7,today);
    const occupiedBeds=activeIpd.length;
    const totalBeds=Math.max(20,occupiedBeds);
    const availableBeds=Math.max(0,totalBeds-occupiedBeds);
    el.innerHTML=`
      <div class="dashboard-kpis">
        ${modernKpi("Today's OPD",daily.opdCount,"Patients","👥","green")}
        ${modernKpi("Today's IPD",daily.ipdNew,"Admissions","🛏","blue")}
        ${modernKpi("Occupied Beds",occupiedBeds,"Beds","🛌","purple")}
        ${modernKpi("Available Beds",availableBeds,"Beds","🏥","green")}
        ${modernKpi("Revenue Today",money(daily.totalRevenue),"Total","₹","amber")}
        ${modernKpi("Cash Collection",money(daily.totalCollection),"Today","💳","teal")}
        ${modernKpi("Pharmacy Sales",money(daily.pharmRevenue),"Today","🛒","blue")}
        ${modernKpi("Expenses Today",money(daily.expense),"Total","₹","orange")}
      </div>
      <div class="dashboard-alert-grid">
        <div class="dashboard-alert-card warning" onclick="navigate('pharmacyStock')"><div class="alert-symbol">⚠</div><div><span>Low Stock Items</span><strong>${lowStock.length}</strong><small>View details →</small></div></div>
        <div class="dashboard-alert-card expiry" onclick="navigate('pharmacyStock')"><div class="alert-symbol">◷</div><div><span>Near Expiry Items</span><strong>${expiringSoon.length}</strong><small>Within 90 days →</small></div></div>
      </div>
      <div class="dashboard-chart-grid">
        <div class="panel dashboard-chart-panel"><div class="panel-title-row"><h3>Revenue Trend</h3><span>Last 7 days</span></div>${miniBarChart(trend.map(r=>r.revenue),trend.map(r=>r.day.slice(5)),"Revenue")}</div>
        <div class="panel dashboard-chart-panel"><div class="panel-title-row"><h3>Monthly Overview</h3><span>${today.slice(0,7)}</span></div>
          <div class="overview-list">
            <div><span>OPD Revenue</span><strong>${money(monthly.opdRevenue)}</strong></div>
            <div><span>IPD Revenue</span><strong>${money(monthly.ipdRevenue)}</strong></div>
            <div><span>Diagnostics</span><strong>${money(monthly.diagRevenue)}</strong></div>
            <div><span>Pharmacy</span><strong>${money(monthly.pharmRevenue)}</strong></div>
          </div>
        </div>
      </div>
      <div class="panel table-wrap recent-activity-panel"><div class="panel-title-row"><h3>Important Alerts</h3><span>Live hospital status</span></div><table><thead><tr><th>Status</th><th>Module</th><th>Details</th></tr></thead><tbody>
        ${alertRow(expired.length?"critical":"good",expired.length?`${expired.length} expired medicines`:"No expired medicines",expired.slice(0,2).map(r=>r.medicine_name).join(", ")||"Stock clear")}
        ${alertRow(expiringSoon.length?"warning":"good",`${expiringSoon.length} near-expiry medicines`,expiringSoon.slice(0,2).map(r=>r.medicine_name).join(", ")||"No near-expiry stock")}
        ${alertRow(lowStock.length?"warning":"good",`${lowStock.length} low-stock medicines`,lowStock.slice(0,2).map(r=>r.medicine_name).join(", ")||"Stock levels normal")}
        ${alertRow(activeIpd.length?"info":"good",`${activeIpd.length} active IPD patients`,"Current inpatient load")}
      </tbody></table></div>`;
  }catch(e){el.innerHTML=`<div class='panel error'>Dashboard error: ${e.message}</div>`;}
}
function isActiveIPDAdmission(r){return !["discharged","final billed","cancelled","closed"].includes(String(r.status||"Admitted").trim().toLowerCase())}
function filterByDate(rows,field,from,to){return (rows||[]).filter(r=>dateInRange(r,field,from,to))}
function paymentOfRows(rows,field,mode){return rows.filter(r=>String(r.payment_mode||"").toLowerCase().includes(mode)).reduce((s,r)=>s+safeNumber(r[field]),0)}
function collectionByMode(set,mode){return paymentOfRows(set.opd,"amount",mode)+paymentOfRows(set.diag,"total_amount",mode)+paymentOfRows(set.pharm,"amount_paid",mode)+set.adm.filter(r=>String(r.payment_mode||"").toLowerCase().includes(mode)).reduce((s,r)=>s+depositAmount(r),0)}
function lastNDaysSimple(all,n,today){const arr=[];const end=new Date(today);for(let i=n-1;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);const iso=d.toISOString().slice(0,10);const opd=filterByDate(all.opdVisits,"visit_date",iso,iso);const ipd=filterByDate(all.ipdBills,"billing_date",iso,iso);const diag=filterByDate(all.diagnosticBills,"billing_date",iso,iso);const pharm=filterByDate(all.pharmacySales,"bill_date",iso,iso);const exp=filterByDate(all.expenses,"expense_date",iso,iso);const revenue=sumField(opd,"amount")+sumField(ipd,"total")+sumField(diag,"total_amount")+sumField(pharm,"bill_amount");const expense=sumField(exp,"amount");const collection=sumField(opd,"amount")+sumField(diag,"total_amount")+sumField(pharm,"amount_paid");arr.push({day:iso,revenue,expense,collection});}return arr;}
function modernKpi(title,value,sub,icon,type){return `<div class="modern-kpi ${type}"><div class="modern-kpi-icon">${icon}</div><div><span>${title}</span><strong>${value}</strong><small>${sub}</small></div></div>`}
function kpiCard(title,value,sub,type){return `<div class="kpi-card ${type||"info"}"><span>${title}</span><strong>${value}</strong><p>${sub||""}</p></div>`}
function alertIcon(type){return type==="critical"?"🔴":type==="warning"?"🟠":type==="info"?"🔵":"🟢"}
function alertRow(type,text,value){return `<tr><td>${alertIcon(type)}</td><td>${text}</td><td>${value}</td></tr>`}
function miniBarChart(values,labels,title){const max=Math.max(...values.map(v=>Math.abs(safeNumber(v))),1);return `<div class="mini-chart">${values.map((v,i)=>{const h=Math.max(4,Math.round(Math.abs(safeNumber(v))/max*100));return `<div class="bar-col" title="${labels[i]} ${title}: ${money(v)}"><div class="bar" style="height:${h}%"></div><small>${labels[i]}</small></div>`}).join("")}</div>`;}
function summaryTable(title,rows){return `<div class="panel table-wrap"><h3>${title}</h3><table><tbody>${rows.map((r,i)=>`<tr><td>${i===rows.length-1?"<b>"+r[0]+"</b>":r[0]}</td><td style="text-align:right">${i===rows.length-1?"<b>"+r[1]+"</b>":r[1]}</td></tr>`).join("")}</tbody></table></div>`}
function groupSum(rows,keyField,amountField){const map={};rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+safeNumber(r[amountField])});return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value)}
function groupCount(rows,keyField){const map={};rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+1});return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value)}