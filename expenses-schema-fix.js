// Compatibility layer for older Supabase expenses schemas.
(function(){
  function missingColumnFromError(error){
    const message=String(error?.message||"");
    const match=message.match(/Could not find the '([^']+)' column/i);
    return match?match[1]:null;
  }

  async function adaptiveExpenseWrite(mode,id,fullPayload){
    const payload={...fullPayload};
    let attempts=0;
    while(attempts<10){
      attempts++;
      const result=mode==="update"
        ?await db.from("expenses").update(payload).eq("id",id).select()
        :await db.from("expenses").insert([payload]).select();
      if(!result.error)return result;
      const missing=missingColumnFromError(result.error);
      if(!missing||!(missing in payload))return result;
      delete payload[missing];
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
