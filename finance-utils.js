function safeNumber(v){return Number(v||0)||0}
function dateInRange(r,field,from,to){const d=(r[field]||rowDate(r)||"").slice(0,10);return d>=from && d<=to}
function sumField(rows,field){return rows.reduce((s,r)=>s+safeNumber(r[field]),0)}
function paymentModeSum(rows,field,mode){return rows.filter(r=>(r.payment_mode||"").toLowerCase()===mode).reduce((s,r)=>s+safeNumber(r[field]),0)}
function bankModeSum(rows,field){return rows.filter(r=>(r.payment_mode||"").toLowerCase().includes("bank")).reduce((s,r)=>s+safeNumber(r[field]),0)}
function parseSaleItems(row){try{return JSON.parse(row.items_json||"[]")}catch(e){return []}}
function pharmacySalesCost(rows){return rows.reduce((s,row)=>s+parseSaleItems(row).reduce((x,item)=>x+(safeNumber(item.purchase_price)*safeNumber(item.quantity)),0),0)}
function pharmacySalesMRP(rows){return rows.reduce((s,row)=>s+safeNumber(row.amount_paid||row.bill_amount),0)}
function stockValuation(stock){
  const cleaned=stock.filter(r=>safeNumber(r.quantity)>0 && safeNumber(r.purchase_price)>=0 && safeNumber(r.sale_price)>=0);
  const purchaseValue=cleaned.reduce((s,r)=>s+(safeNumber(r.purchase_price)*safeNumber(r.quantity)),0);
  const saleValue=cleaned.reduce((s,r)=>s+(safeNumber(r.sale_price)*safeNumber(r.quantity)),0);
  const highValueRows=cleaned.filter(r=>(safeNumber(r.purchase_price)*safeNumber(r.quantity))>1000000);
  return {purchaseValue,saleValue,rows:cleaned,highValueRows};
}
function buildFinancialSummary({patients=[],ipdBills=[],expenses=[],pharmacySales=[],pharmacyPurchases=[],stock=[]},from,to){
  const opd=patients.filter(r=>dateInRange(r,"created_at",from,to));
  const bills=ipdBills.filter(r=>dateInRange(r,"billing_date",from,to));
  const exp=expenses.filter(r=>dateInRange(r,"expense_date",from,to));
  const sales=pharmacySales.filter(r=>dateInRange(r,"bill_date",from,to));
  const purchases=pharmacyPurchases.filter(r=>dateInRange(r,"invoice_date",from,to));
  const opdRevenue=sumField(opd,"amount");
  const ipdRevenue=sumField(bills,"total");
  const pharmacyRevenue=pharmacySalesMRP(sales);
  const revenue=opdRevenue+ipdRevenue+pharmacyRevenue;
  const operatingExpenses=sumField(exp,"amount");
  const pharmacyCost=pharmacySalesCost(sales);
  const grossProfit=revenue-operatingExpenses-pharmacyCost;
  const cashOutflow=operatingExpenses+sumField(purchases,"total_amount");
  const cashCollection=paymentModeSum(opd,"amount","cash")+paymentModeSum(sales,"amount_paid","cash");
  const upiCollection=paymentModeSum(opd,"amount","upi")+paymentModeSum(sales,"amount_paid","upi");
  const bankCollection=bankModeSum(opd,"amount")+bankModeSum(sales,"amount_paid");
  const stockValue=stockValuation(stock);
  return {opd,bills,exp,sales,purchases,opdRevenue,ipdRevenue,pharmacyRevenue,revenue,operatingExpenses,pharmacyCost,grossProfit,cashOutflow,cashCollection,upiCollection,bankCollection,stockValue,margin:revenue>0?(grossProfit/revenue)*100:0};
}
