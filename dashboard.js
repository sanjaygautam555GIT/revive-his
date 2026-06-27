async function loadDashboard(){
  const el=document.getElementById("dashboardView");
  el.innerHTML="<div class='panel'>Loading Dashboard v2.1...</div>";

  try{
    const [patients, admissions, ipdBills, expenses, stock, pharmacySales] = await Promise.all([
      fetchAll("patient"),
      fetchAll("ipd_admission"),
      fetchAll("ipd_billing"),
      fetchAll("expenses"),
      fetchAll("pharmacy_stock"),
      fetchAll("pharmacy_sales")
    ]);

    const today = todayISO();
    const currentMonth = today.slice(0,7);
    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate()+30);

    const getDate = (r, primary) => (r[primary] || rowDate(r) || "").slice(0,10);
    const isToday = (r, primary) => getDate(r, primary) === today;
    const isThisMonth = (r, primary) => getDate(r, primary).slice(0,7) === currentMonth;

    const opdToday = patients.filter(r => isToday(r,"created_at"));
    const admissionsToday = admissions.filter(r => isToday(r,"created_at"));
    const ipdBillsToday = ipdBills.filter(r => isToday(r,"billing_date"));
    const expensesToday = expenses.filter(r => isToday(r,"expense_date"));
    const pharmacySalesToday = pharmacySales.filter(r => isToday(r,"bill_date"));

    const opdMonth = patients.filter(r => isThisMonth(r,"created_at"));
    const ipdBillsMonth = ipdBills.filter(r => isThisMonth(r,"billing_date"));
    const expensesMonth = expenses.filter(r => isThisMonth(r,"expense_date"));
    const pharmacySalesMonth = pharmacySales.filter(r => isThisMonth(r,"bill_date"));

    const opdCollection = opdToday.reduce((s,r)=>s+Number(r.amount||0),0);
    const ipdBillingTotal = ipdBillsToday.reduce((s,r)=>s+Number(r.total||0),0);
    const pharmacyCollection = pharmacySalesToday.reduce((s,r)=>s+Number(r.amount_paid||0),0);
    const expenseTotal = expensesToday.reduce((s,r)=>s+Number(r.amount||0),0);
    const totalIncome = opdCollection + ipdBillingTotal + pharmacyCollection;
    const netBalance = totalIncome - expenseTotal;

    const monthlyOpdIncome = opdMonth.reduce((s,r)=>s+Number(r.amount||0),0);
    const monthlyIpdIncome = ipdBillsMonth.reduce((s,r)=>s+Number(r.total||0),0);
    const monthlyPharmacyIncome = pharmacySalesMonth.reduce((s,r)=>s+Number(r.amount_paid||0),0);
    const monthlyIncome = monthlyOpdIncome + monthlyIpdIncome + monthlyPharmacyIncome;
    const monthlyExpenses = expensesMonth.reduce((s,r)=>s+Number(r.amount||0),0);
    const monthlyNet = monthlyIncome - monthlyExpenses;

    const overallOpdIncome = patients.reduce((s,r)=>s+Number(r.amount||0),0);
    const overallIpdIncome = ipdBills.reduce((s,r)=>s+Number(r.total||0),0);
    const overallPharmacyIncome = pharmacySales.reduce((s,r)=>s+Number(r.amount_paid||0),0);
    const overallIncome = overallOpdIncome + overallIpdIncome + overallPharmacyIncome;
    const overallExpenses = expenses.reduce((s,r)=>s+Number(r.amount||0),0);
    const overallNet = overallIncome - overallExpenses;

    const totalStockQty = stock.reduce((s,r)=>s+Number(r.quantity||0),0);
    const lowStock = stock.filter(r=>Number(r.quantity||0)<=10);
    const expired = stock.filter(r=>r.expiry_date && new Date(r.expiry_date)<now);
    const expiringSoon = stock.filter(r=>{
      if(!r.expiry_date) return false;
      const d = new Date(r.expiry_date);
      return d >= now && d <= in30;
    });

    const cashIncome = [opdToday, pharmacySalesToday].flat().filter(r=>(r.payment_mode||"").toLowerCase()==="cash").reduce((s,r)=>s+Number(r.amount||r.amount_paid||0),0);
    const upiIncome = [opdToday, pharmacySalesToday].flat().filter(r=>(r.payment_mode||"").toLowerCase()==="upi").reduce((s,r)=>s+Number(r.amount||r.amount_paid||0),0);

    const recentOpd = patients.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
    const recentIpd = admissions.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
    const recentExpenses = expenses.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
    const recentSales = pharmacySales.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);

    el.innerHTML = `
      <div class="panel"><h3>Today's Hospital Activity</h3></div>
      <div class="grid cards">
        <div class="card"><span>Today OPD</span><strong>${opdToday.length}</strong></div>
        <div class="card"><span>Today IPD Admissions</span><strong>${admissionsToday.length}</strong></div>
        <div class="card"><span>Today IPD Bills</span><strong>${ipdBillsToday.length}</strong></div>
        <div class="card"><span>Pharmacy Bills Today</span><strong>${pharmacySalesToday.length}</strong></div>

        <div class="card"><span>OPD Collection Today</span><strong>${money(opdCollection)}</strong></div>
        <div class="card"><span>IPD Billing Today</span><strong>${money(ipdBillingTotal)}</strong></div>
        <div class="card"><span>Pharmacy Collection Today</span><strong>${money(pharmacyCollection)}</strong></div>
        <div class="card"><span>Total Income Today</span><strong>${money(totalIncome)}</strong></div>

        <div class="card"><span>Expenses Today</span><strong>${money(expenseTotal)}</strong></div>
        <div class="card"><span>Net Balance Today</span><strong>${money(netBalance)}</strong></div>
        <div class="card"><span>Cash Income Today</span><strong>${money(cashIncome)}</strong></div>
        <div class="card"><span>UPI Income Today</span><strong>${money(upiIncome)}</strong></div>
      </div>

      <div class="panel"><h3>This Month</h3></div>
      <div class="grid cards">
        <div class="card"><span>Monthly OPD Income</span><strong>${money(monthlyOpdIncome)}</strong></div>
        <div class="card"><span>Monthly IPD Income</span><strong>${money(monthlyIpdIncome)}</strong></div>
        <div class="card"><span>Monthly Pharmacy Income</span><strong>${money(monthlyPharmacyIncome)}</strong></div>
        <div class="card"><span>Monthly Total Income</span><strong>${money(monthlyIncome)}</strong></div>
        <div class="card"><span>Monthly Expenses</span><strong>${money(monthlyExpenses)}</strong></div>
        <div class="card"><span>Monthly Net Balance</span><strong>${money(monthlyNet)}</strong></div>
      </div>

      <div class="panel"><h3>Overall Hospital Totals</h3></div>
      <div class="grid cards">
        <div class="card"><span>Total OPD Records</span><strong>${patients.length}</strong></div>
        <div class="card"><span>Total IPD Admissions</span><strong>${admissions.length}</strong></div>
        <div class="card"><span>Total IPD Bills</span><strong>${ipdBills.length}</strong></div>
        <div class="card"><span>Total Pharmacy Bills</span><strong>${pharmacySales.length}</strong></div>
        <div class="card"><span>Overall Income</span><strong>${money(overallIncome)}</strong></div>
        <div class="card"><span>Overall Expenses</span><strong>${money(overallExpenses)}</strong></div>
        <div class="card"><span>Overall Net Balance</span><strong>${money(overallNet)}</strong></div>
      </div>

      <div class="panel"><h3>Pharmacy Stock</h3></div>
      <div class="grid cards">
        <div class="card"><span>Total Medicines</span><strong>${stock.length}</strong></div>
        <div class="card"><span>Total Stock Qty</span><strong>${totalStockQty}</strong></div>
        <div class="card"><span>Low Stock</span><strong>${lowStock.length}</strong></div>
        <div class="card"><span>Expired / Expiring</span><strong>${expired.length} / ${expiringSoon.length}</strong></div>
      </div>

      <div class="panel alert-box ${lowStock.length || expired.length || expiringSoon.length ? "" : "hidden"}">
        <b>Pharmacy Alerts</b><br>
        ${lowStock.slice(0,5).map(r=>`🔴 Low stock: ${r.medicine_name} (${r.quantity||0})`).join("<br>")}
        ${expired.slice(0,5).map(r=>`<br>❌ Expired: ${r.medicine_name} (${r.expiry_date})`).join("")}
        ${expiringSoon.slice(0,5).map(r=>`<br>🟠 Expiring soon: ${r.medicine_name} (${r.expiry_date})`).join("")}
      </div>

      <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
        ${dashboardList("Recent OPD", recentOpd.map(r=>[rowDate(r), r.patient_name, money(r.amount||0)]))}
        ${dashboardList("Recent IPD Admissions", recentIpd.map(r=>[rowDate(r), r.patient_name, r.treatment_type||""]))}
        ${dashboardList("Recent Pharmacy Sales", recentSales.map(r=>[r.bill_date||rowDate(r), r.patient_name, money(r.amount_paid||0)]))}
        ${dashboardList("Recent Expenses", recentExpenses.map(r=>[r.expense_date||rowDate(r), r.category, money(r.amount||0)]))}
      </div>

      <div class="panel"><b>${ROLE_LABELS[currentUser.role]}</b><p class="success">Dashboard v2.1 shows today's, monthly, and overall values from Supabase.</p></div>
    `;
  }catch(e){
    el.innerHTML=`<div class='panel error'>Dashboard error: ${e.message}</div>`;
  }
}

function dashboardList(title, rows){
  return `<div class="panel table-wrap"><h3>${title}</h3><table><tbody>${rows.length?rows.map(r=>`<tr><td>${r[0]||""}</td><td>${r[1]||""}</td><td>${r[2]||""}</td></tr>`).join(""):"<tr><td>No records</td></tr>"}</tbody></table></div>`;
}
