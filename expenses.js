let expenseRows=[];
let editingExpenseId=null;

const EXPENSE_CATEGORIES=[
  "Salary","Electricity","Rent","Maintenance","Consumables","OT Expense",
  "Lab Expense","Pharmacy Expense","Food / Kitchen","Transport","Professional Fees",
  "Equipment Purchase","Housekeeping","Internet / Telephone","Miscellaneous"
];

function expenseStoredDetails(r){
  const raw=String(r.remarks||r.notes||"");
  const paidMatch=raw.match(/(?:^|\|)\s*Paid To:\s*([^|]+)/i);
  const refMatch=raw.match(/(?:^|\|)\s*Reference:\s*([^|]+)/i);
  const cleanRemarks=raw
    .replace(/(?:^|\|)\s*Paid To:\s*[^|]+/ig,"")
    .replace(/(?:^|\|)\s*Reference:\s*[^|]+/ig,"")
    .replace(/^\s*\|\s*|\s*\|\s*$/g,"")
    .trim();
  return {
    paidTo:r.paid_to||r.vendor||r.vendor_name||r.payee||r.party_name||(paidMatch?paidMatch[1].trim():""),
    reference:r.reference_no||r.voucher_no||r.reference||(refMatch?refMatch[1].trim():""),
    remarks:cleanRemarks
  };
}

async function renderExpenses(){
  const el=document.getElementById("expensesView");
  el.innerHTML=`
    <div class="panel">
      <h2>Expenses</h2>
      <p>Record hospital operating expenses. Saved expenses are automatically included in Dashboard profit and financial reports.</p>
      <form id="expenseForm">
        <input type="hidden" id="expenseId">
        <div class="grid" style="grid-template-columns:repeat(4,1fr)">
          <div><label>Expense Date</label><input id="expenseDate" type="date" value="${todayISO()}" required></div>
          <div><label>Category</label><select id="expenseCategory">${EXPENSE_CATEGORIES.map(x=>`<option>${x}</option>`).join("")}</select></div>
          <div><label>Amount</label><input id="expenseAmount" type="number" min="0.01" step="0.01" required></div>
          <div><label>Payment Mode</label><select id="expensePaymentMode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Credit</option></select></div>
          <div><label>Paid To / Vendor</label><input id="expensePaidTo" placeholder="Person or supplier (optional)"></div>
          <div><label>Reference / Voucher No.</label><input id="expenseReference" placeholder="Optional"></div>
          <div><label>Remarks</label><input id="expenseRemarks" placeholder="Optional"></div>
        </div><br>
        <button type="submit" id="saveExpenseBtn">Save Expense</button>
        <button type="button" id="cancelExpenseEditBtn" class="secondary hidden">Cancel Edit</button>
        <div id="expenseMessage"></div>
      </form>
    </div>

    <div class="grid cards" style="margin-top:16px">
      <div class="card"><span>Today</span><strong id="expenseToday">₹0</strong></div>
      <div class="card"><span>This Month</span><strong id="expenseMonth">₹0</strong></div>
      <div class="card"><span>Total Records</span><strong id="expenseCount">0</strong></div>
    </div>

    <div class="panel">
      <h3>Filter Expenses</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><label>From</label><input id="expenseFrom" type="date" value="${todayISO().slice(0,7)}-01"></div>
        <div><label>To</label><input id="expenseTo" type="date" value="${todayISO()}"></div>
        <div><label>Category</label><select id="expenseFilterCategory"><option value="">All Categories</option>${EXPENSE_CATEGORIES.map(x=>`<option>${x}</option>`).join("")}</select></div>
        <div><label>&nbsp;</label><button type="button" id="expenseFilterBtn">Apply Filter</button></div>
      </div>
    </div>

    <div class="panel table-wrap">
      <h3>Expense Register</h3>
      <table>
        <thead><tr><th>Date</th><th>Category</th><th>Paid To</th><th>Mode</th><th>Amount</th><th>Reference</th><th>Remarks</th><th>Action</th></tr></thead>
        <tbody id="expenseRows"></tbody>
      </table>
    </div>`;

  document.getElementById("expenseForm").onsubmit=saveExpense;
  document.getElementById("cancelExpenseEditBtn").onclick=clearExpenseForm;
  document.getElementById("expenseFilterBtn").onclick=loadExpenses;
  await loadExpenses();
}

function clearExpenseForm(){
  editingExpenseId=null;
  document.getElementById("expenseForm").reset();
  document.getElementById("expenseDate").value=todayISO();
  document.getElementById("expenseCategory").value=EXPENSE_CATEGORIES[0];
  document.getElementById("expenseId").value="";
  document.getElementById("saveExpenseBtn").textContent="Save Expense";
  document.getElementById("cancelExpenseEditBtn").classList.add("hidden");
  document.getElementById("expenseMessage").innerHTML="";
}

async function saveExpense(e){
  e.preventDefault();
  const msg=document.getElementById("expenseMessage");
  if(currentUser?.role!=="accountant"){
    msg.innerHTML="<p class='error'>Only Accountant can add or modify expenses.</p>";
    return;
  }
  const amount=Number(document.getElementById("expenseAmount").value||0);
  if(amount<=0){
    msg.innerHTML="<p class='error'>Please enter a valid amount.</p>";
    return;
  }
  const payload={
    expense_date:document.getElementById("expenseDate").value,
    category:document.getElementById("expenseCategory").value,
    amount,
    payment_mode:document.getElementById("expensePaymentMode").value,
    paid_to:document.getElementById("expensePaidTo").value.trim()||null,
    reference_no:document.getElementById("expenseReference").value.trim()||null,
    remarks:document.getElementById("expenseRemarks").value.trim()||null
  };
  let result;
  if(editingExpenseId!==null){
    result=await db.from("expenses").update(payload).eq("id",editingExpenseId).select();
  }else{
    payload.created_at=new Date().toISOString();
    result=await db.from("expenses").insert([payload]).select();
  }
  if(result.error){msg.innerHTML=`<p class='error'>Expense save failed: ${result.error.message}</p>`;return;}
  if(!result.data||!result.data.length){msg.innerHTML="<p class='error'>Expense was not saved. Check Supabase insert/update policy.</p>";return;}
  const wasEditing=editingExpenseId!==null;
  clearExpenseForm();
  document.getElementById("expenseMessage").innerHTML=`<p class='success'>Expense ${wasEditing?"updated":"saved"} successfully.</p>`;
  await loadExpenses();
}

async function loadExpenses(){
  const body=document.getElementById("expenseRows");
  if(!body)return;
  body.innerHTML="<tr><td colspan='8'>Loading expenses...</td></tr>";
  const {data,error}=await db.from("expenses").select("*").order("expense_date",{ascending:false}).order("created_at",{ascending:false});
  if(error){body.innerHTML=`<tr><td colspan='8' class='error'>Expense load failed: ${error.message}</td></tr>`;return;}
  expenseRows=data||[];
  const today=todayISO();
  const month=today.slice(0,7);
  document.getElementById("expenseToday").textContent=money(expenseRows.filter(r=>(r.expense_date||"").slice(0,10)===today).reduce((s,r)=>s+Number(r.amount||0),0));
  document.getElementById("expenseMonth").textContent=money(expenseRows.filter(r=>(r.expense_date||"").slice(0,7)===month).reduce((s,r)=>s+Number(r.amount||0),0));
  document.getElementById("expenseCount").textContent=expenseRows.length;
  const from=document.getElementById("expenseFrom")?.value||"0000-01-01";
  const to=document.getElementById("expenseTo")?.value||"9999-12-31";
  const category=document.getElementById("expenseFilterCategory")?.value||"";
  const filtered=expenseRows.filter(r=>{const d=(r.expense_date||rowDate(r)||"").slice(0,10);return d>=from&&d<=to&&(!category||r.category===category);});
  body.innerHTML=filtered.length?filtered.map(r=>{const x=expenseStoredDetails(r);return `<tr>
    <td>${r.expense_date||rowDate(r)}</td><td>${r.category||""}</td><td>${x.paidTo||"—"}</td>
    <td>${r.payment_mode||""}</td><td>${money(r.amount||0)}</td><td>${x.reference||""}</td><td>${x.remarks||""}</td>
    <td>${currentUser?.role==="accountant"?`<button class="secondary" onclick="editExpense('${r.id}')">Edit</button> <button class="secondary" onclick="deleteExpense('${r.id}')">Delete</button>`:"View only"}</td></tr>`;}).join(""):"<tr><td colspan='8'>No expenses found for selected filter.</td></tr>";
}

function editExpense(id){
  if(currentUser?.role!=="accountant"){alert("Only Accountant can edit expenses.");return;}
  const r=expenseRows.find(x=>String(x.id)===String(id));
  if(!r)return;
  const x=expenseStoredDetails(r);
  editingExpenseId=r.id;
  document.getElementById("expenseId").value=r.id;
  document.getElementById("expenseDate").value=r.expense_date||todayISO();
  document.getElementById("expenseCategory").value=r.category||EXPENSE_CATEGORIES[0];
  document.getElementById("expenseAmount").value=Number(r.amount||0);
  document.getElementById("expensePaymentMode").value=r.payment_mode||"Cash";
  document.getElementById("expensePaidTo").value=x.paidTo||"";
  document.getElementById("expenseReference").value=x.reference||"";
  document.getElementById("expenseRemarks").value=x.remarks||"";
  document.getElementById("saveExpenseBtn").textContent="Update Expense";
  document.getElementById("cancelExpenseEditBtn").classList.remove("hidden");
  document.getElementById("expenseForm").scrollIntoView({behavior:"smooth",block:"start"});
}

async function deleteExpense(id){
  if(currentUser?.role!=="accountant"){alert("Only Accountant can delete expenses.");return;}
  const r=expenseRows.find(x=>String(x.id)===String(id));
  if(!r||!confirm(`Delete ${r.category||"expense"} of ${money(r.amount||0)}?`))return;
  const {data,error}=await db.from("expenses").delete().eq("id",id).select();
  if(error){alert("Expense delete failed: "+error.message);return;}
  if(!data||!data.length){alert("Expense was not deleted. Check Supabase delete policy.");return;}
  await loadExpenses();
}