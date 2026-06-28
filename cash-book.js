async function renderCashBook(){
  const el=document.getElementById("cashBookView");
  el.innerHTML=`
    <div class="panel">
      <h2>Cash Book / Daily Closing</h2>
      <p>Daily closing calculates expected cash from opening cash, cash collections, and cash expenses. The accountant must enter the actual counted cash.</p>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>Closing Date</label><input id="closingDate" type="date" value="${todayISO()}"></div>
        <div><label>Opening Cash</label><input id="openingCash" type="number" value="0" step="0.01"></div>
        <div><label>Actual Cash Counted</label><input id="actualCash" type="number" value="0" step="0.01"></div>
        <div><label>Remarks</label><input id="closingRemarks" placeholder="Optional note"></div>
      </div>
      <br>
      <button id="usePrevClosingBtn" type="button" class="secondary">Use Previous Closing as Opening</button>
      <button id="loadClosingBtn" type="button">Load Day Summary</button>
      <button id="saveClosingBtn" type="button">Save Daily Closing</button>
      <div id="closingMessage"></div>
    </div>
    <div id="cashBookOutput"></div>
    <div class="panel table-wrap"><h3>Recent Daily Closings</h3><table><thead><tr><th>Date</th><th>Opening</th><th>Cash Collection</th><th>Cash Expense</th><th>Expected Closing</th><th>Actual</th><th>Difference</th></tr></thead><tbody id="closingRows"></tbody></table></div>
  `;
  document.getElementById("loadClosingBtn").onclick=loadCashBookDay;
  document.getElementById("saveClosingBtn").onclick=saveDailyClosing;
  document.getElementById("usePrevClosingBtn").onclick=usePreviousClosingAsOpening;
  document.getElementById("openingCash").oninput=loadCashBookDay;
  document.getElementById("actualCash").oninput=updateCashDifferencePreview;
  await usePreviousClosingAsOpening(false);
  await loadCashBookDay();
  await loadRecentClosings();
}

async function usePreviousClosingAsOpening(showMessage=true){
  const {data,error}=await db.from("daily_closing").select("*").order("closing_date",{ascending:false}).limit(1);
  const msg=document.getElementById("closingMessage");
  if(error){if(showMessage)msg.innerHTML=`<p class='error'>Previous closing load failed: ${error.message}</p>`;return;}
  const prev=(data||[])[0];
  if(prev){
    document.getElementById("openingCash").value=Number(prev.actual_cash||prev.expected_closing_cash||0).toFixed(2);
    if(showMessage)msg.innerHTML=`<p class='success'>Opening cash loaded from previous closing date ${prev.closing_date}.</p>`;
    await loadCashBookDay(false);
  }else if(showMessage){
    msg.innerHTML="<p class='error'>No previous closing found. Enter opening cash manually.</p>";
  }
}

async function getCashBookNumbers(date){
  const [opd,ipdBills,sales,expenses]=await Promise.all([
    fetchAll("patient"),fetchAll("ipd_billing"),fetchAll("pharmacy_sales"),fetchAll("expenses")
  ]);
  const byDate=(r,field)=>(r[field]||rowDate(r)||"").slice(0,10)===date;
  const opdToday=opd.filter(r=>byDate(r,"created_at"));
  const ipdToday=ipdBills.filter(r=>byDate(r,"billing_date"));
  const salesToday=sales.filter(r=>byDate(r,"bill_date"));
  const expToday=expenses.filter(r=>byDate(r,"expense_date"));
  const sum=(rows,field)=>rows.reduce((s,r)=>s+Number(r[field]||0),0);
  const modeSum=(rows,field,mode)=>rows.filter(r=>(r.payment_mode||"").toLowerCase()===mode).reduce((s,r)=>s+Number(r[field]||0),0);
  const opdCash=modeSum(opdToday,"amount","cash");
  const opdUpi=modeSum(opdToday,"amount","upi");
  const pharmCash=modeSum(salesToday,"amount_paid","cash");
  const pharmUpi=modeSum(salesToday,"amount_paid","upi");
  const pharmBank=modeSum(salesToday,"amount_paid","bank");
  const expCash=modeSum(expToday,"amount","cash");
  const expUpi=modeSum(expToday,"amount","upi");
  const expBank=expToday.filter(r=>(r.payment_mode||"").toLowerCase().includes("bank")).reduce((s,r)=>s+Number(r.amount||0),0);
  const ipdTotal=sum(ipdToday,"total");
  const opdTotal=sum(opdToday,"amount");
  const pharmacyTotal=sum(salesToday,"amount_paid");
  const expenseTotal=sum(expToday,"amount");
  const cashCollection=opdCash+pharmCash;
  const upiCollection=opdUpi+pharmUpi;
  const bankCollection=pharmBank;
  const totalIncome=opdTotal+ipdTotal+pharmacyTotal;
  const totalExpenses=expenseTotal;
  return {date,opdToday,ipdToday,salesToday,expToday,opdTotal,ipdTotal,pharmacyTotal,expenseTotal,totalIncome,totalExpenses,opdCash,opdUpi,pharmCash,pharmUpi,pharmBank,expCash,expUpi,expBank,cashCollection,upiCollection,bankCollection};
}

async function loadCashBookDay(){
  const date=document.getElementById("closingDate").value||todayISO();
  const output=document.getElementById("cashBookOutput");
  output.innerHTML="<div class='panel'>Loading daily summary...</div>";
  try{
    const n=await getCashBookNumbers(date);
    const opening=Number(document.getElementById("openingCash").value||0);
    const actual=Number(document.getElementById("actualCash").value||0);
    const expected=opening+n.cashCollection-n.expCash;
    const difference=actual-expected;
    output.innerHTML=`
      <div class="grid cards">
        <div class="card"><span>Opening Cash</span><strong>${money(opening)}</strong></div>
        <div class="card"><span>Cash Collection</span><strong>${money(n.cashCollection)}</strong></div>
        <div class="card"><span>Cash Expenses</span><strong>${money(n.expCash)}</strong></div>
        <div class="card"><span>Expected Closing Cash</span><strong>${money(expected)}</strong></div>
        <div class="card"><span>Actual Cash Counted</span><strong id="actualCashPreview">${money(actual)}</strong></div>
        <div class="card"><span>Cash Difference</span><strong id="cashDifferencePreview">${money(difference)}</strong></div>
        <div class="card"><span>UPI Collection</span><strong>${money(n.upiCollection)}</strong></div>
        <div class="card"><span>Bank Collection</span><strong>${money(n.bankCollection)}</strong></div>
        <div class="card"><span>Total Income</span><strong>${money(n.totalIncome)}</strong></div>
        <div class="card"><span>Total Expenses</span><strong>${money(n.totalExpenses)}</strong></div>
        <div class="card"><span>Net Profit/Loss</span><strong>${money(n.totalIncome-n.totalExpenses)}</strong></div>
      </div>
      <div class="panel table-wrap"><h3>Department-wise Daily Summary</h3><table><tbody>
        <tr><td>OPD Collection</td><td>${money(n.opdTotal)}</td><td>Records: ${n.opdToday.length}</td></tr>
        <tr><td>IPD Billing</td><td>${money(n.ipdTotal)}</td><td>Bills: ${n.ipdToday.length}</td></tr>
        <tr><td>Pharmacy Collection</td><td>${money(n.pharmacyTotal)}</td><td>Bills: ${n.salesToday.length}</td></tr>
        <tr><td>Expenses</td><td>${money(n.expenseTotal)}</td><td>Entries: ${n.expToday.length}</td></tr>
      </tbody></table></div>
      <div class="panel table-wrap"><h3>Mode-wise Split</h3><table><tbody>
        <tr><td>OPD Cash / UPI</td><td>${money(n.opdCash)}</td><td>${money(n.opdUpi)}</td></tr>
        <tr><td>Pharmacy Cash / UPI / Bank</td><td>${money(n.pharmCash)}</td><td>${money(n.pharmUpi)} / ${money(n.pharmBank)}</td></tr>
        <tr><td>Expense Cash / UPI / Bank</td><td>${money(n.expCash)}</td><td>${money(n.expUpi)} / ${money(n.expBank)}</td></tr>
      </tbody></table></div>`;
  }catch(e){output.innerHTML=`<div class='panel error'>Cash book error: ${e.message}</div>`;}
}

function updateCashDifferencePreview(){
  loadCashBookDay();
}

async function saveDailyClosing(){
  if(currentUser.role!=="accountant"){
    alert("Only Accountant can save daily closing. Owner can observe reports only.");
    return;
  }
  const date=document.getElementById("closingDate").value||todayISO();
  const n=await getCashBookNumbers(date);
  const opening=Number(document.getElementById("openingCash").value||0);
  const actual=Number(document.getElementById("actualCash").value||0);
  const expected=opening+n.cashCollection-n.expCash;
  const payload={
    closing_date:date,
    opening_cash:opening,
    cash_collection:n.cashCollection,
    upi_collection:n.upiCollection,
    bank_collection:n.bankCollection,
    cash_expense:n.expCash,
    total_income:n.totalIncome,
    total_expenses:n.totalExpenses,
    expected_closing_cash:expected,
    actual_cash:actual,
    cash_difference:actual-expected,
    remarks:document.getElementById("closingRemarks").value.trim()||null,
    created_at:new Date().toISOString()
  };
  const msg=document.getElementById("closingMessage");
  const {error}=await db.from("daily_closing").insert([payload]);
  if(error){msg.innerHTML=`<p class='error'>Daily closing save failed: ${error.message}</p>`;return;}
  msg.innerHTML="<p class='success'>Daily closing saved.</p>";
  await loadRecentClosings();
}

async function loadRecentClosings(){
  const body=document.getElementById("closingRows");
  const {data,error}=await db.from("daily_closing").select("*").order("closing_date",{ascending:false}).limit(20);
  if(error){body.innerHTML=`<tr><td colspan='7' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];
  body.innerHTML=rows.length?rows.map(r=>`<tr><td>${r.closing_date||""}</td><td>${money(r.opening_cash||0)}</td><td>${money(r.cash_collection||0)}</td><td>${money(r.cash_expense||0)}</td><td>${money(r.expected_closing_cash||0)}</td><td>${money(r.actual_cash||0)}</td><td>${money(r.cash_difference||0)}</td></tr>`).join(""):"<tr><td colspan='7'>No daily closing saved yet.</td></tr>";
}
