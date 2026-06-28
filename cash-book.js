async function renderCashBook(){
  const el=document.getElementById("cashBookView");
  el.innerHTML=`
    <div class="panel">
      <h2>Daily Financial Summary</h2>
      <p>Owner-level daily summary of hospital income, expenses, payment modes, profit, and activity.</p>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Summary Date</label><input id="closingDate" type="date" value="${todayISO()}"></div>
        <div><label>Remarks</label><input id="closingRemarks" placeholder="Optional note"></div>
      </div>
      <br>
      <button id="loadClosingBtn" type="button">Load Daily Summary</button>
      <button id="saveClosingBtn" type="button">Save Summary</button>
      <div id="closingMessage"></div>
    </div>
    <div id="cashBookOutput"></div>
    <div class="panel table-wrap"><h3>Recent Saved Summaries</h3><table><thead><tr><th>Date</th><th>Total Income</th><th>Total Expenses</th><th>Profit</th><th>Cash</th><th>UPI</th><th>Bank</th></tr></thead><tbody id="closingRows"></tbody></table></div>
  `;
  document.getElementById("loadClosingBtn").onclick=loadCashBookDay;
  document.getElementById("saveClosingBtn").onclick=saveDailyClosing;
  document.getElementById("closingDate").onchange=loadCashBookDay;
  await loadCashBookDay();
  await loadRecentClosings();
}

async function getCashBookNumbers(date){
  const [opd,ipdBills,admissions,sales,expenses,purchases]=await Promise.all([
    fetchAll("patient"),fetchAll("ipd_billing"),fetchAll("ipd_admission"),fetchAll("pharmacy_sales"),fetchAll("expenses"),fetchAll("pharmacy_purchases")
  ]);
  const byDate=(r,field)=>(r[field]||rowDate(r)||"").slice(0,10)===date;
  const opdToday=opd.filter(r=>byDate(r,"created_at"));
  const ipdToday=ipdBills.filter(r=>byDate(r,"billing_date"));
  const admissionsToday=admissions.filter(r=>byDate(r,"created_at"));
  const salesToday=sales.filter(r=>byDate(r,"bill_date"));
  const expToday=expenses.filter(r=>byDate(r,"expense_date"));
  const purchasesToday=purchases.filter(r=>byDate(r,"invoice_date"));
  const sum=(rows,field)=>rows.reduce((s,r)=>s+Number(r[field]||0),0);
  const modeSum=(rows,field,mode)=>rows.filter(r=>(r.payment_mode||"").toLowerCase()===mode).reduce((s,r)=>s+Number(r[field]||0),0);
  const bankModeSum=(rows,field)=>rows.filter(r=>(r.payment_mode||"").toLowerCase().includes("bank")).reduce((s,r)=>s+Number(r[field]||0),0);

  const opdTotal=sum(opdToday,"amount");
  const ipdTotal=sum(ipdToday,"total");
  const pharmacyTotal=sum(salesToday,"amount_paid");
  const expenseTotal=sum(expToday,"amount");
  const purchaseTotal=sum(purchasesToday,"total_amount");

  const opdCash=modeSum(opdToday,"amount","cash");
  const opdUpi=modeSum(opdToday,"amount","upi");
  const opdBank=bankModeSum(opdToday,"amount");
  const pharmCash=modeSum(salesToday,"amount_paid","cash");
  const pharmUpi=modeSum(salesToday,"amount_paid","upi");
  const pharmBank=bankModeSum(salesToday,"amount_paid");
  const expCash=modeSum(expToday,"amount","cash");
  const expUpi=modeSum(expToday,"amount","upi");
  const expBank=bankModeSum(expToday,"amount");

  const cashCollection=opdCash+pharmCash;
  const upiCollection=opdUpi+pharmUpi;
  const bankCollection=opdBank+pharmBank;
  const totalIncome=opdTotal+ipdTotal+pharmacyTotal;
  const totalExpenses=expenseTotal;
  const profit=totalIncome-totalExpenses;
  const profitMargin=totalIncome>0?(profit/totalIncome)*100:0;

  return {date,opdToday,ipdToday,admissionsToday,salesToday,expToday,purchasesToday,opdTotal,ipdTotal,pharmacyTotal,expenseTotal,purchaseTotal,totalIncome,totalExpenses,profit,profitMargin,opdCash,opdUpi,opdBank,pharmCash,pharmUpi,pharmBank,expCash,expUpi,expBank,cashCollection,upiCollection,bankCollection};
}

async function loadCashBookDay(){
  const date=document.getElementById("closingDate").value||todayISO();
  const output=document.getElementById("cashBookOutput");
  output.innerHTML="<div class='panel'>Loading daily financial summary...</div>";
  try{
    const n=await getCashBookNumbers(date);
    output.innerHTML=`
      <div class="grid cards">
        <div class="card"><span>Total Income</span><strong>${money(n.totalIncome)}</strong></div>
        <div class="card"><span>Total Expenses</span><strong>${money(n.totalExpenses)}</strong></div>
        <div class="card"><span>Profit / Loss</span><strong>${money(n.profit)}</strong></div>
        <div class="card"><span>Profit Margin</span><strong>${n.profitMargin.toFixed(1)}%</strong></div>
        <div class="card"><span>Cash Collection</span><strong>${money(n.cashCollection)}</strong></div>
        <div class="card"><span>UPI Collection</span><strong>${money(n.upiCollection)}</strong></div>
        <div class="card"><span>Bank Collection</span><strong>${money(n.bankCollection)}</strong></div>
        <div class="card"><span>Cash Expenses</span><strong>${money(n.expCash)}</strong></div>
      </div>

      <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
        <div class="panel table-wrap"><h3>Revenue</h3><table><tbody>
          <tr><td>OPD Collection</td><td>${money(n.opdTotal)}</td><td>${n.opdToday.length} records</td></tr>
          <tr><td>IPD Billing</td><td>${money(n.ipdTotal)}</td><td>${n.ipdToday.length} bills</td></tr>
          <tr><td>Pharmacy Collection</td><td>${money(n.pharmacyTotal)}</td><td>${n.salesToday.length} bills</td></tr>
          <tr><th>Total Income</th><th>${money(n.totalIncome)}</th><th></th></tr>
        </tbody></table></div>

        <div class="panel table-wrap"><h3>Expenses</h3><table><tbody>
          <tr><td>General Expenses</td><td>${money(n.expenseTotal)}</td><td>${n.expToday.length} entries</td></tr>
          <tr><td>Pharmacy Purchases</td><td>${money(n.purchaseTotal)}</td><td>${n.purchasesToday.length} purchase rows</td></tr>
          <tr><th>Total Recorded Expenses</th><th>${money(n.totalExpenses)}</th><th></th></tr>
        </tbody></table></div>
      </div>

      <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
        <div class="panel table-wrap"><h3>Payment Mode Split</h3><table><tbody>
          <tr><td>Cash Collection</td><td>${money(n.cashCollection)}</td><td>Cash expenses: ${money(n.expCash)}</td></tr>
          <tr><td>UPI Collection</td><td>${money(n.upiCollection)}</td><td>UPI expenses: ${money(n.expUpi)}</td></tr>
          <tr><td>Bank Collection</td><td>${money(n.bankCollection)}</td><td>Bank expenses: ${money(n.expBank)}</td></tr>
        </tbody></table></div>

        <div class="panel table-wrap"><h3>Hospital Activity</h3><table><tbody>
          <tr><td>OPD Patients</td><td>${n.opdToday.length}</td><td></td></tr>
          <tr><td>IPD Admissions</td><td>${n.admissionsToday.length}</td><td></td></tr>
          <tr><td>IPD Bills</td><td>${n.ipdToday.length}</td><td></td></tr>
          <tr><td>Pharmacy Bills</td><td>${n.salesToday.length}</td><td></td></tr>
          <tr><td>Purchase Rows</td><td>${n.purchasesToday.length}</td><td></td></tr>
          <tr><td>Expense Entries</td><td>${n.expToday.length}</td><td></td></tr>
        </tbody></table></div>
      </div>

      <div class="panel"><h3>Today's Financial Health</h3>
        <p><b>Income:</b> ${money(n.totalIncome)} &nbsp; | &nbsp; <b>Expenses:</b> ${money(n.totalExpenses)} &nbsp; | &nbsp; <b>Profit/Loss:</b> ${money(n.profit)} &nbsp; | &nbsp; <b>Margin:</b> ${n.profitMargin.toFixed(1)}%</p>
      </div>`;
  }catch(e){output.innerHTML=`<div class='panel error'>Daily summary error: ${e.message}</div>`;}
}

async function saveDailyClosing(){
  if(currentUser.role!=="accountant"){
    alert("Only Accountant can save daily summary. Owner can observe reports only.");
    return;
  }
  const date=document.getElementById("closingDate").value||todayISO();
  const n=await getCashBookNumbers(date);
  const payload={
    closing_date:date,
    opening_cash:0,
    cash_collection:n.cashCollection,
    upi_collection:n.upiCollection,
    bank_collection:n.bankCollection,
    cash_expense:n.expCash,
    total_income:n.totalIncome,
    total_expenses:n.totalExpenses,
    expected_closing_cash:0,
    actual_cash:0,
    cash_difference:0,
    remarks:document.getElementById("closingRemarks").value.trim()||null,
    created_at:new Date().toISOString()
  };
  const msg=document.getElementById("closingMessage");
  const {error}=await db.from("daily_closing").insert([payload]);
  if(error){msg.innerHTML=`<p class='error'>Daily summary save failed: ${error.message}</p>`;return;}
  msg.innerHTML="<p class='success'>Daily financial summary saved.</p>";
  await loadRecentClosings();
}

async function loadRecentClosings(){
  const body=document.getElementById("closingRows");
  const {data,error}=await db.from("daily_closing").select("*").order("closing_date",{ascending:false}).limit(20);
  if(error){body.innerHTML=`<tr><td colspan='7' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];
  body.innerHTML=rows.length?rows.map(r=>`<tr><td>${r.closing_date||""}</td><td>${money(r.total_income||0)}</td><td>${money(r.total_expenses||0)}</td><td>${money((Number(r.total_income||0)-Number(r.total_expenses||0)))}</td><td>${money(r.cash_collection||0)}</td><td>${money(r.upi_collection||0)}</td><td>${money(r.bank_collection||0)}</td></tr>`).join(""):"<tr><td colspan='7'>No saved daily summaries yet.</td></tr>";
}
