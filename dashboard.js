async function loadDashboard(){
  const el=document.getElementById("dashboardView");
  el.innerHTML="<div class='panel'>Loading dashboard...</div>";
  try{
    const[patients,ipd,bills,expenses,stock,sales]=await Promise.all([
      fetchAll("patient"),fetchAll("ipd_admission"),fetchAll("ipd_billing"),fetchAll("expenses"),fetchAll("pharmacy_stock"),fetchAll("pharmacy_sales")
    ]);
    const t=todayISO();
    const opdToday=patients.filter(r=>rowDate(r)===t);
    const ipdToday=ipd.filter(r=>rowDate(r)===t);
    const billToday=bills.filter(r=>(r.billing_date||rowDate(r))===t);
    const expToday=expenses.filter(r=>(r.expense_date||rowDate(r))===t);
    const salesToday=sales.filter(r=>(r.bill_date||rowDate(r))===t);
    const opdAmt=opdToday.reduce((s,r)=>s+Number(r.amount||0),0);
    const ipdAdv=ipdToday.reduce((s,r)=>s+Number(r.advance||0),0);
    const ipdPaid=billToday.reduce((s,r)=>s+Number(r.amount_paid||0),0);
    const pharmPaid=salesToday.reduce((s,r)=>s+Number(r.amount_paid||0),0);
    const expAmt=expToday.reduce((s,r)=>s+Number(r.amount||0),0);
    const lowStock=stock.filter(r=>Number(r.quantity||0)<=10).length;
    const expired=stock.filter(r=>r.expiry_date && new Date(r.expiry_date)<new Date()).length;
    el.innerHTML=`<div class="grid cards">
      <div class="card"><span>Today OPD</span><strong>${opdToday.length}</strong></div>
      <div class="card"><span>Today IPD</span><strong>${ipdToday.length}</strong></div>
      <div class="card"><span>Today Income</span><strong>${money(opdAmt+ipdAdv+ipdPaid+pharmPaid)}</strong></div>
      <div class="card"><span>Today Expenses</span><strong>${money(expAmt)}</strong></div>
      <div class="card"><span>OPD Collection</span><strong>${money(opdAmt)}</strong></div>
      <div class="card"><span>IPD Revenue</span><strong>${money(ipdAdv+ipdPaid)}</strong></div>
      <div class="card"><span>Pharmacy</span><strong>${money(pharmPaid)}</strong></div>
      <div class="card"><span>Low Stock</span><strong>${lowStock}</strong></div>
      <div class="card"><span>Expired Medicines</span><strong>${expired}</strong></div>
    </div><div class="panel"><b>${ROLE_LABELS[currentUser.role]}</b><p class="success">Dashboard reads directly from Supabase. No localStorage overwrite.</p></div>`;
  }catch(e){el.innerHTML=`<div class='panel error'>Dashboard error: ${e.message}</div>`}
}
