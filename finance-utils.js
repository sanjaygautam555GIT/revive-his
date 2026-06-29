function safeNumber(v){return Number(v||0)||0}
function dateInRange(r,field,from,to){const d=(r[field]||rowDate(r)||"").slice(0,10);return d>=from && d<=to}
function sumField(rows,field){return rows.reduce((s,r)=>s+safeNumber(r[field]),0)}
function paymentModeSum(rows,field,mode){return rows.filter(r=>(r.payment_mode||"").toLowerCase()===mode).reduce((s,r)=>s+safeNumber(r[field]),0)}
function bankModeSum(rows,field){return rows.filter(r=>(r.payment_mode||"").toLowerCase().includes("bank")).reduce((s,r)=>s+safeNumber(r[field]),0)}
function parseSaleItems(row){try{return JSON.parse(row.items_json||"[]")}catch(e){return []}}
function pharmacySalesCost(rows){return rows.reduce((s,row)=>s+parseSaleItems(row).reduce((x,item)=>x+(safeNumber(item.purchase_price)*safeNumber(item.quantity)),0),0)}
function pharmacySalesMRP(rows){return rows.reduce((s,row)=>s+safeNumber(row.amount_paid||row.bill_amount),0)}
function depositAmount(row){return safeNumber(row.deposit_amount||row.advance)}
function depositModeSum(rows,mode){return rows.filter(r=>(r.payment_mode||"").toLowerCase()===mode).reduce((s,r)=>s+depositAmount(r),0)}
function depositBankSum(rows){return rows.filter(r=>(r.payment_mode||"").toLowerCase().includes("bank")).reduce((s,r)=>s+depositAmount(r),0)}
function stockValuation(stock){
  const cleaned=stock.filter(r=>safeNumber(r.quantity)>0 && safeNumber(r.purchase_price)>=0 && safeNumber(r.sale_price)>=0);
  const purchaseValue=cleaned.reduce((s,r)=>s+(safeNumber(r.purchase_price)*safeNumber(r.quantity)),0);
  const saleValue=cleaned.reduce((s,r)=>s+(safeNumber(r.sale_price)*safeNumber(r.quantity)),0);
  const highValueRows=cleaned.filter(r=>(safeNumber(r.purchase_price)*safeNumber(r.quantity))>1000000);
  return {purchaseValue,saleValue,rows:cleaned,highValueRows};
}
function buildFinancialSummary({patients=[],opdVisits=[],ipdAdmissions=[],ipdBills=[],expenses=[],pharmacySales=[],pharmacyPurchases=[],stock=[]},from,to){
  const opdSource=(opdVisits&&opdVisits.length)?opdVisits:patients;
  const opdDateField=(opdVisits&&opdVisits.length)?"visit_date":"created_at";
  const opd=opdSource.filter(r=>dateInRange(r,opdDateField,from,to));
  const admissions=ipdAdmissions.filter(r=>dateInRange(r,"deposit_date",from,to)||dateInRange(r,"admission_date",from,to));
  const bills=ipdBills.filter(r=>dateInRange(r,"billing_date",from,to));
  const exp=expenses.filter(r=>dateInRange(r,"expense_date",from,to));
  const sales=pharmacySales.filter(r=>dateInRange(r,"bill_date",from,to));
  const purchases=pharmacyPurchases.filter(r=>dateInRange(r,"invoice_date",from,to));
  const opdRevenue=sumField(opd,"amount");
  const ipdRevenue=sumField(bills,"total");
  const pharmacyRevenue=pharmacySalesMRP(sales);
  const revenue=opdRevenue+ipdRevenue+pharmacyRevenue;
  const ipdAdvanceReceived=admissions.reduce((s,r)=>s+depositAmount(r),0);
  const operatingExpenses=sumField(exp,"amount");
  const pharmacyCost=pharmacySalesCost(sales);
  const grossProfit=revenue-operatingExpenses-pharmacyCost;
  const cashOutflow=operatingExpenses+sumField(purchases,"total_amount");
  const earnedCashCollection=paymentModeSum(opd,"amount","cash")+paymentModeSum(sales,"amount_paid","cash");
  const earnedUpiCollection=paymentModeSum(opd,"amount","upi")+paymentModeSum(sales,"amount_paid","upi");
  const earnedBankCollection=bankModeSum(opd,"amount")+bankModeSum(sales,"amount_paid");
  const ipdAdvanceCash=depositModeSum(admissions,"cash");
  const ipdAdvanceUpi=depositModeSum(admissions,"upi");
  const ipdAdvanceBank=depositBankSum(admissions);
  const cashCollection=earnedCashCollection+ipdAdvanceCash;
  const upiCollection=earnedUpiCollection+ipdAdvanceUpi;
  const bankCollection=earnedBankCollection+ipdAdvanceBank;
  const totalCollection=cashCollection+upiCollection+bankCollection;
  const earnedCollection=earnedCashCollection+earnedUpiCollection+earnedBankCollection;
  const stockValue=stockValuation(stock);
  return {opd,admissions,bills,exp,sales,purchases,opdRevenue,ipdRevenue,pharmacyRevenue,revenue,ipdAdvanceReceived,ipdDepositCollection:ipdAdvanceReceived,operatingExpenses,pharmacyCost,grossProfit,cashOutflow,earnedCashCollection,earnedUpiCollection,earnedBankCollection,earnedCollection,ipdAdvanceCash,ipdAdvanceUpi,ipdAdvanceBank,cashCollection,upiCollection,bankCollection,totalCollection,stockValue,margin:revenue>0?(grossProfit/revenue)*100:0};
}
