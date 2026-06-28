async function renderReportsCenter(){
  const el=document.getElementById("reportsView");
  const today=todayISO();
  const monthStart=today.slice(0,7)+"-01";
  el.innerHTML=`
    <div class="panel">
      <h2>Reports & Analytics Center</h2>
      <p>Stage 1: Executive, Revenue, and Expense reports with date filters.</p>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>From Date</label><input id="reportFrom" type="date" value="${monthStart}"></div>
        <div><label>To Date</label><input id="reportTo" type="date" value="${today}"></div>
        <div><label>Report Type</label><select id="reportType"><option value="executive">Executive Report</option><option value="revenue">Revenue Report</option><option value="expense">Expense Report</option></select></div>
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
  const inRange=(r,field)=>{const d=(r[field]||rowDate(r)||"").slice(0,10);return d>=from && d<=to};
  const sum=(rows,field)=>rows.reduce((s,r)=>s+Number(r[field]||0),0);
  const groupSum=(rows,keyField,amountField)=>{
    const map={};
    rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+Number(r[amountField]||0)});
    return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
  };
  const modeSum=(rows,field,mode)=>rows.filter(r=>(r.payment_mode||"").toLowerCase()===mode).reduce((s,r)=>s+Number(r[field]||0),0);
  const bankSum=(rows,field)=>rows.filter(r=>(r.payment_mode||"").toLowerCase().includes("bank")).reduce((s,r)=>s+Number(r[field]||0),0);
  const opd=patients.filter(r=>inRange(r,"created_at"));
  const ipd=admissions.filter(r=>inRange(r,"created_at"));
  const bills=ipdBills.filter(r=>inRange(r,"billing_date"));
  const exp=expenses.filter(r=>inRange(r,"expense_date"));
  const sales=pharmacySales.filter(r=>inRange(r,"bill_date"));
  const pur=purchases.filter(r=>inRange(r,"invoice_date"));
  const opdRevenue=sum(opd,"amount");
  const ipdRevenue=sum(bills,"total");
  const pharmacyRevenue=sum(sales,"amount_paid");
  const totalRevenue=opdRevenue+ipdRevenue+pharmacyRevenue;
  const totalExpenses=sum(exp,"amount");
  const profit=totalRevenue-totalExpenses;
  const cash=modeSum(opd,"amount","cash")+modeSum(sales,"amount_paid","cash");
  const upi=modeSum(opd,"amount","upi")+modeSum(sales,"amount_paid","upi");
  const bank=bankSum(opd,"amount")+bankSum(sales,"amount_paid");
  const stockPurchaseValue=stock.reduce((s,r)=>s+Number(r.purchase_price||0)*Number(r.quantity||0),0);
  const stockSaleValue=stock.reduce((s,r)=>s+Number(r.sale_price||0)*Number(r.quantity||0),0);
  return {from,to,opd,ipd,bills,exp,sales,pur,stock,opdRevenue,ipdRevenue,pharmacyRevenue,totalRevenue,totalExpenses,profit,cash,upi,bank,stockPurchaseValue,stockSaleValue,expenseByCategory:groupSum(exp,"category","amount"),opdByDepartment:groupSum(opd,"department","amount"),purchaseBySupplier:groupSum(pur,"supplier","total_amount")};
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
  const margin=d.totalRevenue>0?(d.profit/d.totalRevenue)*100:0;
  out.innerHTML=`
    <div class="panel"><h2>Executive Report</h2><p>${d.from} to ${d.to}</p></div>
    <div class="grid cards">
      <div class="card"><span>Total Revenue</span><strong>${money(d.totalRevenue)}</strong></div>
      <div class="card"><span>Total Expenses</span><strong>${money(d.totalExpenses)}</strong></div>
      <div class="card"><span>Profit / Loss</span><strong>${money(d.profit)}</strong></div>
      <div class="card"><span>Profit Margin</span><strong>${margin.toFixed(1)}%</strong></div>
      <div class="card"><span>Cash</span><strong>${money(d.cash)}</strong></div>
      <div class="card"><span>UPI</span><strong>${money(d.upi)}</strong></div>
      <div class="card"><span>Bank</span><strong>${money(d.bank)}</strong></div>
      <div class="card"><span>Stock Purchase Value</span><strong>${money(d.stockPurchaseValue)}</strong></div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
      ${reportTable("Revenue Summary",[["OPD",money(d.opdRevenue),d.opd.length+" records"],["IPD",money(d.ipdRevenue),d.bills.length+" bills"],["Pharmacy",money(d.pharmacyRevenue),d.sales.length+" bills"]])}
      ${reportTable("Activity Summary",[["OPD Patients",d.opd.length,""],["IPD Admissions",d.ipd.length,""],["Pharmacy Bills",d.sales.length,""],["Purchase Rows",d.pur.length,""]])}
    </div>`;
}

function renderRevenueReport(out,d){
  out.innerHTML=`
    <div class="panel"><h2>Revenue Report</h2><p>${d.from} to ${d.to}</p></div>
    <div class="grid cards">
      <div class="card"><span>OPD Revenue</span><strong>${money(d.opdRevenue)}</strong></div>
      <div class="card"><span>IPD Revenue</span><strong>${money(d.ipdRevenue)}</strong></div>
      <div class="card"><span>Pharmacy Revenue</span><strong>${money(d.pharmacyRevenue)}</strong></div>
      <div class="card"><span>Total Revenue</span><strong>${money(d.totalRevenue)}</strong></div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
      ${reportTable("Department-wise OPD Revenue",d.opdByDepartment.map(r=>[r.key,money(r.value),""]))}
      ${reportTable("Payment Mode",[["Cash",money(d.cash),""],["UPI",money(d.upi),""],["Bank",money(d.bank),""]])}
    </div>`;
}

function renderExpenseReport(out,d){
  out.innerHTML=`
    <div class="panel"><h2>Expense Report</h2><p>${d.from} to ${d.to}</p></div>
    <div class="grid cards">
      <div class="card"><span>Total Expenses</span><strong>${money(d.totalExpenses)}</strong></div>
      <div class="card"><span>Expense Entries</span><strong>${d.exp.length}</strong></div>
      <div class="card"><span>Purchase Rows</span><strong>${d.pur.length}</strong></div>
      <div class="card"><span>Supplier Purchase Value</span><strong>${money(d.pur.reduce((s,r)=>s+Number(r.total_amount||0),0))}</strong></div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
      ${reportTable("Expenses by Category",d.expenseByCategory.map(r=>[r.key,money(r.value),""]))}
      ${reportTable("Purchases by Supplier",d.purchaseBySupplier.map(r=>[r.key,money(r.value),""]))}
    </div>`;
}

function reportTable(title,rows){
  return `<div class="panel table-wrap"><h3>${title}</h3><table><tbody>${rows.length?rows.map(r=>`<tr><td>${r[0]||""}</td><td>${r[1]||""}</td><td>${r[2]||""}</td></tr>`).join(""):"<tr><td>No records</td></tr>"}</tbody></table></div>`;
}
