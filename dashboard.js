async function loadDashboard(){
  const el=document.getElementById("dashboardView");
  el.innerHTML="<div class='panel'>Loading Dashboard v2...</div>";

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
    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate()+30);

    const opdToday = patients.filter(r => rowDate(r) === today);
    const admissionsToday = admissions.filter(r => rowDate(r) === today);
    const ipdBillsToday = ipdBills.filter(r => (r.billing_date || rowDate(r)) === today);
    const expensesToday = expenses.filter(r => (r.expense_date || rowDate(r)) === today);
    const pharmacySalesToday = pharmacySales.filter(r => (r.bill_date || rowDate(r)) === today);

    const opdCollection = opdToday.reduce((s,r)=>s+Number(r.amount||0),0);
    const ipdBillingTotal = ipdBillsToday.reduce((s,r)=>s+Number(r.total||0),0);
    const pharmacyCollection = pharmacySalesToday.reduce((s,r)=>s+Number(r.amount_paid||0),0);
    const expenseTotal = expensesToday.reduce((s,r)=>s+Number(r.amount||0),0);
    const totalIncome = opdCollection + ipdBillingTotal + pharmacyCollection;
    const netBalance = totalIncome - expenseTotal;

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
    const bankExpense = expensesToday.filter(r=>(r.payment_mode||"").toLowerCase().includes("bank")).reduce((s,r)=>s+Number(r.amount||0),0);

    const recentOpd = patients.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
    const recentIpd = admissions.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
    const recentExpenses = expenses.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);
    const recentSales = pharmacySales.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);

    el.innerHTML = `
      <div class="grid cards">
        <div class="card"><span>Today OPD</span><strong>${opdToday.length}</strong></div>
        <div class="card"><span>Today IPD Admissions</span><strong>${admissionsToday.length}</strong></div>
        <div class="card"><span>Today IPD Bills</span><strong>${ipdBillsToday.length}</strong></div>
        <div class="card"><span>Pharmacy Bills Today</span><strong>${pharmacySalesToday.length}</strong></div>

        <div class="card"><span>OPD Collection</span><strong>${money(opdCollection)}</strong></div>
        <div class="card"><span>IPD Billing Total</span><strong>${money(ipdBillingTotal)}</strong></div>
        <div class="card"><span>Pharmacy Collection</span><strong>${money(pharmacyCollection)}</strong></div>
        <div class="card"><span>Total Income</span><strong>${money(totalIncome)}</strong></div>

        <div class="card"><span>Today Expenses</span><strong>${money(expenseTotal)}</strong></div>
        <div class="card"><span>Net Balance</span><strong>${money(netBalance)}</strong></div>
        <div class="card"><span>Cash Income</span><strong>${money(cashIncome)}</strong></div>
        <div class="card"><span>UPI Income</span><strong>${money(upiIncome)}</strong></div>

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

      <div class="panel"><b>${ROLE_LABELS[currentUser.role]}</b><p class="success">Dashboard v2 is reading live data from Supabase using your actual table structure.</p></div>
    `;
  }catch(e){
    el.innerHTML=`<div class='panel error'>Dashboard error: ${e.message}</div>`;
  }
}

function dashboardList(title, rows){
  return `<div class="panel table-wrap"><h3>${title}</h3><table><tbody>${rows.length?rows.map(r=>`<tr><td>${r[0]||""}</td><td>${r[1]||""}</td><td>${r[2]||""}</td></tr>`).join(""):"<tr><td>No records</td></tr>"}</tbody></table></div>`;
}
