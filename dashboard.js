async function loadDashboard(){
  const el=document.getElementById("dashboardView");
  el.innerHTML="<div class='panel'>Loading Finance Command Center...</div>";

  try{
    const [patients, admissions, ipdBills, expenses, stock, pharmacySales] = await Promise.all([
      fetchAll("patient"), fetchAll("ipd_admission"), fetchAll("ipd_billing"),
      fetchAll("expenses"), fetchAll("pharmacy_stock"), fetchAll("pharmacy_sales")
    ]);

    const today = todayISO();
    const currentMonth = today.slice(0,7);
    const now = new Date();
    const in30 = new Date();
    in30.setDate(in30.getDate()+30);

    const getDate = (r, primary) => (r[primary] || rowDate(r) || "").slice(0,10);
    const isToday = (r, primary) => getDate(r, primary) === today;
    const isThisMonth = (r, primary) => getDate(r, primary).slice(0,7) === currentMonth;
    const sum = (rows, field) => rows.reduce((s,r)=>s+Number(r[field]||0),0);

    const opdToday = patients.filter(r => isToday(r,"created_at"));
    const ipdToday = admissions.filter(r => isToday(r,"created_at"));
    const ipdBillsToday = ipdBills.filter(r => isToday(r,"billing_date"));
    const expToday = expenses.filter(r => isToday(r,"expense_date"));
    const pharmToday = pharmacySales.filter(r => isToday(r,"bill_date"));

    const opdMonth = patients.filter(r => isThisMonth(r,"created_at"));
    const ipdBillsMonth = ipdBills.filter(r => isThisMonth(r,"billing_date"));
    const expMonth = expenses.filter(r => isThisMonth(r,"expense_date"));
    const pharmMonth = pharmacySales.filter(r => isThisMonth(r,"bill_date"));

    const todayIncome = sum(opdToday,"amount") + sum(ipdBillsToday,"total") + sum(pharmToday,"amount_paid");
    const todayExpenses = sum(expToday,"amount");
    const todayProfit = todayIncome - todayExpenses;

    const monthIncome = sum(opdMonth,"amount") + sum(ipdBillsMonth,"total") + sum(pharmMonth,"amount_paid");
    const monthExpenses = sum(expMonth,"amount");
    const monthProfit = monthIncome - monthExpenses;

    const overallIncome = sum(patients,"amount") + sum(ipdBills,"total") + sum(pharmacySales,"amount_paid");
    const overallExpenses = sum(expenses,"amount");
    const overallProfit = overallIncome - overallExpenses;

    const allIncomeRowsToday = [
      ...opdToday.map(r=>({mode:r.payment_mode, amount:r.amount})),
      ...pharmToday.map(r=>({mode:r.payment_mode, amount:r.amount_paid}))
    ];
    const cashToday = allIncomeRowsToday.filter(r=>(r.mode||"").toLowerCase()==="cash").reduce((s,r)=>s+Number(r.amount||0),0);
    const upiToday = allIncomeRowsToday.filter(r=>(r.mode||"").toLowerCase()==="upi").reduce((s,r)=>s+Number(r.amount||0),0);
    const bankExpenseToday = expToday.filter(r=>(r.payment_mode||"").toLowerCase().includes("bank")).reduce((s,r)=>s+Number(r.amount||0),0);

    const purchaseStockValue = stock.reduce((s,r)=>s+(Number(r.purchase_price||0)*Number(r.quantity||0)),0);
    const saleStockValue = stock.reduce((s,r)=>s+(Number(r.sale_price||0)*Number(r.quantity||0)),0);
    const totalStockQty = sum(stock,"quantity");
    const lowStock = stock.filter(r=>Number(r.quantity||0)<=10);
    const expired = stock.filter(r=>r.expiry_date && new Date(r.expiry_date)<now);
    const expiringSoon = stock.filter(r=>{
      if(!r.expiry_date) return false;
      const d = new Date(r.expiry_date);
      return d >= now && d <= in30;
    });

    const expenseByCategory = groupSum(expenses, "category", "amount").slice(0,5);
    const opdByDepartment = groupCount(patients, "department").slice(0,5);
    const recentExpenses = expenses.slice().sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,5);

    el.innerHTML = `
      <div class="panel"><h2>Hospital Finance & Operations Command Center</h2><p>Owner view: broad financial, expenditure, earning, and pharmacy status.</p></div>

      <div class="grid cards">
        <div class="card"><span>Income Today</span><strong>${money(todayIncome)}</strong></div>
        <div class="card"><span>Expenses Today</span><strong>${money(todayExpenses)}</strong></div>
        <div class="card"><span>Profit / Loss Today</span><strong>${money(todayProfit)}</strong></div>
        <div class="card"><span>Cash / UPI Today</span><strong>${money(cashToday)} / ${money(upiToday)}</strong></div>

        <div class="card"><span>Monthly Income</span><strong>${money(monthIncome)}</strong></div>
        <div class="card"><span>Monthly Expenses</span><strong>${money(monthExpenses)}</strong></div>
        <div class="card"><span>Monthly Profit / Loss</span><strong>${money(monthProfit)}</strong></div>
        <div class="card"><span>Bank Expenses Today</span><strong>${money(bankExpenseToday)}</strong></div>

        <div class="card"><span>Overall Income</span><strong>${money(overallIncome)}</strong></div>
        <div class="card"><span>Overall Expenses</span><strong>${money(overallExpenses)}</strong></div>
        <div class="card"><span>Overall Profit / Loss</span><strong>${money(overallProfit)}</strong></div>
        <div class="card"><span>Pharmacy Stock Sale Value</span><strong>${money(saleStockValue)}</strong></div>
      </div>

      <div class="panel"><h3>Hospital Activity Snapshot</h3></div>
      <div class="grid cards">
        <div class="card"><span>OPD Today / Total</span><strong>${opdToday.length} / ${patients.length}</strong></div>
        <div class="card"><span>IPD Today / Total</span><strong>${ipdToday.length} / ${admissions.length}</strong></div>
        <div class="card"><span>IPD Bills Today / Total</span><strong>${ipdBillsToday.length} / ${ipdBills.length}</strong></div>
        <div class="card"><span>Pharmacy Bills Today / Total</span><strong>${pharmToday.length} / ${pharmacySales.length}</strong></div>
      </div>

      <div class="panel"><h3>Pharmacy Business Status</h3></div>
      <div class="grid cards">
        <div class="card"><span>Total Medicines</span><strong>${stock.length}</strong></div>
        <div class="card"><span>Total Stock Quantity</span><strong>${totalStockQty}</strong></div>
        <div class="card"><span>Stock Purchase Value</span><strong>${money(purchaseStockValue)}</strong></div>
        <div class="card"><span>Stock Sale Value</span><strong>${money(saleStockValue)}</strong></div>
        <div class="card"><span>Low Stock</span><strong>${lowStock.length}</strong></div>
        <div class="card"><span>Expired / Expiring 30 Days</span><strong>${expired.length} / ${expiringSoon.length}</strong></div>
      </div>

      <div class="panel alert-box ${lowStock.length || expired.length || expiringSoon.length ? "" : "hidden"}">
        <b>Attention Needed</b><br>
        ${lowStock.slice(0,5).map(r=>`Low stock: ${r.medicine_name} (${r.quantity||0})`).join("<br>")}
        ${expired.slice(0,5).map(r=>`<br>Expired: ${r.medicine_name} (${r.expiry_date})`).join("")}
        ${expiringSoon.slice(0,5).map(r=>`<br>Expiring soon: ${r.medicine_name} (${r.expiry_date})`).join("")}
      </div>

      <div class="grid" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
        ${dashboardList("Top Expense Categories", expenseByCategory.map(r=>[r.key, money(r.value), ""]))}
        ${dashboardList("OPD by Department", opdByDepartment.map(r=>[r.key, r.value, "records"]))}
        ${dashboardList("Recent Expenses", recentExpenses.map(r=>[r.expense_date||rowDate(r), r.category, money(r.amount||0)]))}
        ${dashboardList("Financial Summary", [["Today Profit/Loss", money(todayProfit), ""],["Monthly Profit/Loss", money(monthProfit), ""],["Overall Profit/Loss", money(overallProfit), ""]])}
      </div>

      <div class="panel"><b>${ROLE_LABELS[currentUser.role]}</b><p class="success">Executive Dashboard v3 focuses on finance, expenses, earnings, pharmacy value, and broad hospital operations.</p></div>
    `;
  }catch(e){
    el.innerHTML=`<div class='panel error'>Dashboard error: ${e.message}</div>`;
  }
}

function groupSum(rows, keyField, amountField){
  const map = {};
  rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+Number(r[amountField]||0)});
  return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
}

function groupCount(rows, keyField){
  const map = {};
  rows.forEach(r=>{const k=r[keyField]||"Unspecified";map[k]=(map[k]||0)+1});
  return Object.entries(map).map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value);
}

function dashboardList(title, rows){
  return `<div class="panel table-wrap"><h3>${title}</h3><table><tbody>${rows.length?rows.map(r=>`<tr><td>${r[0]||""}</td><td>${r[1]||""}</td><td>${r[2]||""}</td></tr>`).join(""):"<tr><td>No records</td></tr>"}</tbody></table></div>`;
}
