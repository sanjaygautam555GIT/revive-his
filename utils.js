function money(n){return "₹"+Number(n||0).toLocaleString("en-IN")}
function todayISO(){return new Date().toISOString().slice(0,10)}
function rowDate(r,f="created_at"){return(r[f]||"").slice(0,10)}
async function fetchAll(t){const{data,error}=await db.from(t).select("*");if(error)throw error;return data||[]}
function placeholder(id,text){document.getElementById(id).innerHTML=`<div class="panel">${text}</div>`}
