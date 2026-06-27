async function renderCashReport(){
  document.getElementById("cashReportView").innerHTML=`<div class="panel"><h2>Daily Cash Report</h2><div class="form-row"><div><label>Date</label><input id="cashDate" type="date" value="${todayISO()}"></div><button id="loadCashBtn">Load</button></div></div><div id="cashOutput"></div>`;
  document.getElementById("loadCashBtn").onclick=loadCashReport;
  await loadCashReport();
}

async function loadCashReport(){
  const d=document.getElementById("cashDate").value,out=document.getElementById("cashOutput");
  out.innerHTML="<div class='panel'>Loading...</div>";
  try{
    const[opd,ipd,bills,sales,expenses]=await Promise.all([fetchAll("patient"),fetchAll("ipd_admission"),fetchAll("ipd_billing"),fetchAll("pharmacy_sales"),fetchAll("expenses")]);
    const rows=[];
    opd.filter(r=>rowDate(r)===d).forEach(r=>rows.push(["OPD",rowDate(r),r.patient_name,r.payment_mode,Number(r.amount||0),0]));
    ipd.filter(r=>rowDate(r)===d).forEach(r=>rows.push(["IPD Advance",rowDate(r),r.patient_name,r.payment_mode,Number(r.advance||0),0]));
    bills.filter(r=>(r.billing_date||rowDate(r))===d).forEach(r=>rows.push(["IPD Billing",r.billing_date||rowDate(r),r.patient_name,r.payment_mode||"",Number(r.amount_paid||0),0]));
    sales.filter(r=>(r.bill_date||rowDate(r))===d).forEach(r=>rows.push(["Pharmacy",r.bill_date||rowDate(r),r.patient_name,r.payment_mode,Number(r.amount_paid||0),0]));
    expenses.filter(r=>(r.expense_date||rowDate(r))===d).forEach(r=>rows.push(["Expense",r.expense_date||rowDate(r),r.category,r.payment_mode,0,Number(r.amount||0)]));
    const inc=rows.reduce((s,r)=>s+r[4],0),exp=rows.reduce((s,r)=>s+r[5],0);
    out.innerHTML=`<div class="grid cards"><div class="card"><span>Total Income</span><strong>${money(inc)}</strong></div><div class="card"><span>Total Expenses</span><strong>${money(exp)}</strong></div><div class="card"><span>Net Balance</span><strong>${money(inc-exp)}</strong></div><div class="card"><span>Transactions</span><strong>${rows.length}</strong></div></div><div class="panel table-wrap"><table><thead><tr><th>Type</th><th>Date</th><th>Patient/Category</th><th>Mode</th><th>Income</th><th>Expense</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]||""}</td><td>${r[3]||""}</td><td>${money(r[4])}</td><td>${money(r[5])}</td></tr>`).join(""):"<tr><td colspan='6'>No entries found.</td></tr>"}</tbody></table></div>`;
  }catch(e){out.innerHTML=`<div class='panel error'>Cash report error: ${e.message}</div>`}
}
