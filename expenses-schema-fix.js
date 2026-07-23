// Compatibility layer for older Supabase expenses schemas.
(function(){
  function missingColumnFromError(error){
    const message=String(error?.message||"");
    const match=message.match(/Could not find the '([^']+)' column/i);
    return match?match[1]:null;
  }

  function mergeExpenseText(description,remarks){
    const d=String(description||"").trim();
    const r=String(remarks||"").trim();
    if(d&&r)return `Description: ${d} | Remarks: ${r}`;
    if(d)return `Description: ${d}`;
    return r||null;
  }

  async function adaptiveExpenseWrite(mode,id,fullPayload){
    const payload={...fullPayload};
    const description=payload.description;
    const remarks=payload.remarks;
    let attempts=0;

    while(attempts<10){
      attempts++;
      let query;
      if(mode==="update")query=db.from("expenses").update(payload).eq("id",id).select();
      else query=db.from("expenses").insert([payload]).select();
      const result=await query;
      if(!result.error)return result;

      const missing=missingColumnFromError(result.error);
      if(!missing||!(missing in payload))return result;

      delete payload[missing];
      if(missing==="description"&&("remarks" in payload))payload.remarks=mergeExpenseText(description,remarks);
      if(missing==="remarks"&&("description" in payload))payload.description=description||remarks||null;
    }
    return {data:null,error:{message:"Expense schema compatibility retry limit reached."}};
  }

  window.saveExpense=async function(e){
    e.preventDefault();
    const msg=document.getElementById("expenseMessage");
    if(currentUser?.role!=="accountant"){
      msg.innerHTML="<p class='error'>Only Accountant can add or modify expenses.</p>";
      return;
    }

    const amount=Number(document.getElementById("expenseAmount").value||0);
    const description=document.getElementById("expenseDescription").value.trim();
    if(amount<=0||!description){
      msg.innerHTML="<p class='error'>Description and a valid amount are required.</p>";
      return;
    }

    const payload={
      expense_date:document.getElementById("expenseDate").value,
      category:document.getElementById("expenseCategory").value,
      description,
      amount,
      payment_mode:document.getElementById("expensePaymentMode").value,
      paid_to:document.getElementById("expensePaidTo").value.trim()||null,
      reference_no:document.getElementById("expenseReference").value.trim()||null,
      remarks:document.getElementById("expenseRemarks").value.trim()||null
    };
    if(editingExpenseId===null)payload.created_at=new Date().toISOString();

    const result=await adaptiveExpenseWrite(editingExpenseId!==null?"update":"insert",editingExpenseId,payload);
    if(result.error){
      msg.innerHTML=`<p class='error'>Expense save failed: ${result.error.message}</p>`;
      return;
    }
    if(!result.data||!result.data.length){
      msg.innerHTML="<p class='error'>Expense was not saved. Check Supabase insert/update policy.</p>";
      return;
    }

    const wasEditing=editingExpenseId!==null;
    clearExpenseForm();
    document.getElementById("expenseMessage").innerHTML=`<p class='success'>Expense ${wasEditing?"updated":"saved"} successfully.</p>`;
    await loadExpenses();
  };

  const originalRender=window.renderExpenses;
  if(typeof originalRender==="function"){
    window.renderExpenses=async function(){
      await originalRender();
      const form=document.getElementById("expenseForm");
      if(form)form.onsubmit=window.saveExpense;
    };
  }
})();