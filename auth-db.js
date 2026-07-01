async function databaseLogin(userName,loginCode){
  const key=(userName||"").trim().toLowerCase();
  const code=String(loginCode||"");
  try{
    const {data,error}=await db.from("app_users").select("*").eq("username",key).maybeSingle();
    if(error||!data)return null;
    if((data.status||"Active")!=="Active")return null;
    if(String(data.login_code||"")!==code)return null;
    return {username:key,role:data.role,name:data.display_name||data.username};
  }catch(e){return null;}
}
async function setUserLoginCode(userName,newCode){
  return await db.from("app_users").update({login_code:String(newCode),updated_at:new Date().toISOString()}).eq("username",String(userName||"").toLowerCase());
}
