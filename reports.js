async function renderReportsCenter(){
  const el=document.getElementById("reportsView");
  const today=todayISO();
  const monthStart=today.slice(0,7)+"-01";
  el.innerHTML=`
    <div class="panel">
      <h2>Reports & Analytics Center</h2>
      <p>Financial calculations now separate operating profit, pharmacy COGS, cash flow, and current stock value.</p>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>From Date</label><input id="reportFrom" type="date" value="${monthStart}"></div>
        <div><label>To Date</label><input id="reportTo" type="date" value="${today}"></div>
        <div><label>Report Type</label><select id="reportType"><option value="executive">Executive Report</option><option value="revenue">Revenue Report</option><option value="expense">Expense & Cash Flow Report</option></select></div>
        <div><label>&nbsp;</label><button id="runReportBtn" type="button">Run Report</button></div>
      </div>
    </div>
    <div id="reportOutput"></div>
  `;
  document.getElementById("runReportBtn").onclick=runSelectedReport;
  await runSelectedReport();
}

async function getReportData(from,to){
  const [patients, admissions, ipdBills, expenses, pharmacySales, purchases, stock]=await Promise.all([
    fetchAll("patient"),fetchAll("ipd_admission"),fetchAll("ipd_billing"),fetchAll("expenses"),fetchAll("pharmacy_sales"),fetchAll("pharmacy_purchases"),fetchAll("pharmacy_stock")
  ]);
  const summary=buildFinancialSummary({patients,ipdBills,expenses,pharmacySales,pharmacyPurchases:purchases,stock},from,to);
  const ipd=admissions.filter(r=>dateInRange(r,"created_at",from,to));
  const groupSum=(rows,keyField,amountField)=>{
    const map={};
    rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+safeNumber(r[amountField])});
    return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
  };
  return {...summary,from,to,ipd,stock,expenseByCategory:groupSum(summary.exp,"category","amount"),opdByDepartment:groupSum(summary.opd,"department","amount"),purchaseBySupplier:groupSum(summary.purchases,"supplier","total_amount")};
}

async function runSelectedReport(){
  const from=document.getElementById("reportFrom").value;
  const to=document.getElementById("reportTo").value;
  const type=document.getElementById("reportType").value;
  const out=document.getElementById("reportOutput");
  out.innerHTML="<div class='panel'>Loading report...</div>";
  try{
    const d=await getReportData(from,to);
    if(type==="executive") renderExecutiveReport(out,d);
    if(type==="revenue") renderRevenueReport(out,d);
    if(type==="expense") renderExpenseReport(out,d);
  }catch(e){out.innerHTML=`<div class='panel error'>Report error: ${e.message}</div>`;}
}

function renderExecutiveReport(out,d){
  out.innerHTML=`
    <div class="panel"><h2>Executive Report</h2><p>${d.from} to ${d.to}</p></div>
    <div class="grid cards">
      <div class="card"><span>Total Revenue</span><strong>${money(d.revenue)}</strong></div>
      <div class="card"><span>Operating Expenses</span><strong>${money(d.operatingExpenses)}</strong></div>
      <div class="card"><span>Pharmacy COGS</span><strong>${money(d.pharmacyCost)}</strong></div>
      <div class="card"><span>Net Profit / Loss</span><strong>${money(d.grossProfit)}</strong></div>
      <div class="card"><span>Profit Margin</span><strong>${d.margin.toFixed(1)}%</strong></div>
      <div class="card"><span>Cash</span><strong>${money(d.cashCollection)}</strong></div>
      <div class="card"><span>UPI</span><strong>${money(d.upiCollection)}</strong></div>
      <div class="card"><span>Bank</span><strong>${money(d.bankCollection)}</strong></div>
      <div class="card"><span>Cash Outflow</span><strong>${money(d.cashOutflow)}</strong></div>
      <div class="card"><span>Current Stock Cost Value</span><strong>${money(d.stockValue.purchaseValue)}</strong></div>
      <div class="card"><span>Current Stock Sale Value</span><strong>${money(d.stockValue.saleValue)}</strong></div>
      <div class="card"><span>High-value Stock Rows</span><strong>${d.stockValue.highValueRows.length}</strong></div>
    </div>
    ${d.stockValue.highValueRows.length?`<div class="panel alert-box"><b>Check stock values</b><br>${d.stockValue.highValueRows.slice(0,5).map(r=>`${r.medicine_name}: qty ${r.quantity}, purchase ${money(r.purchase_price)}, value ${money(safeNumber(r.purchase_price)*safeNumber(r.quantity))}`).join("<br>")}</div>`:""}
    <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
      ${reportTable("Revenue Summary",[["OPD",money(d.opdRevenue),d.opd.length+" records"],["IPD",money(d.ipdRevenue),d.bills.length+" bills"],["Pharmacy",money(d.pharmacyRevenue),d.sales.length+" bills"]])}
      ${reportTable("Activity Summary",[["OPD Patients",d.opd.length,""],["IPD Admissions",d.ipd.length,""],["Pharmacy Bills",d.sales.length,""],["Purchase Rows",d.purchases.length,""]])}
    </div>`;
}

function renderRevenueReport(out,d){
  out.innerHTML=`
    <div class="panel"><h2>Revenue Report</h2><p>${d.from} to ${d.to}</p></div>
    <div class="grid cards">
      <div class="card"><span>OPD Revenue</span><strong>${money(d.opdRevenue)}</strong></div>
      <div class="card"><span>IPD Revenue</span><strong>${money(d.ipdRevenue)}</strong></div>
      <div class="card"><span>Pharmacy Revenue</span><strong>${money(d.pharmacyRevenue)}</strong></div>
      <div class="card"><span>Total Revenue</span><strong>${money(d.revenue)}</strong></div>
      <div class="card"><span>Pharmacy COGS</span><strong>${money(d.pharmacyCost)}</strong></div>
      <div class="card"><span>Pharmacy Gross Margin</span><strong>${money(d.pharmacyRevenue-d.pharmacyCost)}</strong></div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
      ${reportTable("Department-wise OPD Revenue",d.opdByDepartment.map(r=>[r.key,money(r.value),""]))}
      ${reportTable("Payment Mode",[["Cash",money(d.cashCollection),""],["UPI",money(d.upiCollection),""],["Bank",money(d.bankCollection),""]])}
    </div>`;
}

function renderExpenseReport(out,d){
  const purchaseTotal=sumField(d.purchases,"total_amount");
  out.innerHTML=`
    <div class="panel"><h2>Expense & Cash Flow Report</h2><p>${d.from} to ${d.to}</p></div>
    <div class="grid cards">
      <div class="card"><span>Operating Expenses</span><strong>${money(d.operatingExpenses)}</strong></div>
      <div class="card"><span>Pharmacy Purchases</span><strong>${money(purchaseTotal)}</strong></div>
      <div class="card"><span>Total Cash Outflow</span><strong>${money(d.cashOutflow)}</strong></div>
      <div class="card"><span>Expense Entries</span><strong>${d.exp.length}</strong></div>
    </div>
    <div class="panel"><p><b>Note:</b> Pharmacy purchase is shown as cash outflow/inventory purchase. Profit uses pharmacy COGS from medicines actually sold.</p></div>
    <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
      ${reportTable("Operating Expenses by Category",d.expenseByCategory.map(r=>[r.key,money(r.value),""]))}
      ${reportTable("Purchases by Supplier",d.purchaseBySupplier.map(r=>[r.key,money(r.value),""]))}
    </div>`;
}

function reportTable(title,rows){
  return `<div class="panel table-wrap"><h3>${title}</h3><table><tbody>${rows.length?rows.map(r=>`<tr><td>${r[0]||""}</td><td>${r[1]||""}</td><td>${r[2]||""}</td></tr>`).join(""):"<tr><td>No records</td></tr>"}</tbody></table></div>`;
}
