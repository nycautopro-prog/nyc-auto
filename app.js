const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const VIN_RE=/^[A-HJ-NPR-Z0-9]{17}$/;
function cleanVin(v){return (v||"").trim().toUpperCase();}
function validVin(v){return VIN_RE.test(cleanVin(v));}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800);}
$("#menuBtn")?.addEventListener("click",()=>$("#nav").classList.toggle("open"));
$("#heroVinForm")?.addEventListener("submit",e=>{e.preventDefault();const v=cleanVin($("#heroVin").value);if(!validVin(v))return toast("Enter a valid 17-character VIN.");$("#recallVin").value=v;document.querySelector("#recalls").scrollIntoView({behavior:"smooth"});setTimeout(()=>$("#recallForm").requestSubmit(),350);});

async function decodeVin(vin){
  const url=`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const r=await fetch(url,{headers:{"Accept":"application/json"}});
  if(!r.ok) throw new Error("VIN decode service unavailable");
  const j=await r.json(); return j.Results?.[0]||{};
}
async function getRecalls(make,model,year){
  const url=`https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
  const r=await fetch(url,{headers:{"Accept":"application/json"}});
  if(!r.ok) throw new Error("Recall service unavailable");
  const j=await r.json(); return j.results||j.Results||[];
}
function safe(v){return v&&String(v).trim()?String(v):"Not available";}
function recallHtml(vin,d,recalls){
  const vehicle=`${safe(d.ModelYear)} ${safe(d.Make)} ${safe(d.Model)}`;
  let items="";
  if(recalls.length){
    items=recalls.slice(0,8).map(x=>`<div class="recall-item"><b>${safe(x.Component||x.NHTSAID||"Recall campaign")}</b><small>${safe(x.Summary||x.Consequence||"See official recall details.")}</small></div>`).join("");
  } else items=`<div class="recall-item" style="border-left-color:#0aa84f"><b>No matching recall campaigns returned</b><small>This does not prove the VIN has no open recalls. Confirm VIN-specific status with NHTSA or the manufacturer.</small></div>`;
  return `<div class="vehicle-result"><h3>${vehicle}</h3><div class="result-grid"><div><b>VIN</b><br>${vin}</div><div><b>Body</b><br>${safe(d.BodyClass)}</div><div><b>Engine</b><br>${safe(d.DisplacementL)} L / ${safe(d.EngineCylinders)} cyl</div><div><b>Drive</b><br>${safe(d.DriveType)}</div></div><div class="recall-list"><h4>Recall campaigns returned: ${recalls.length}</h4>${items}</div><p style="font-size:11px;color:#637589">Source: public NHTSA/vPIC data. Results are based on the decoded vehicle configuration and may not show whether a specific VIN's repair is still open. Always verify VIN-specific recall status with NHTSA/manufacturer.</p><a class="secondary" target="_blank" rel="noopener noreferrer" href="https://www.nhtsa.gov/recalls">Verify at NHTSA.gov →</a></div>`;
}
$("#recallForm")?.addEventListener("submit",async e=>{
  e.preventDefault(); const vin=cleanVin($("#recallVin").value), out=$("#recallResult");
  if(!validVin(vin)) return toast("Enter a valid 17-character VIN.");
  out.innerHTML=`<div class="empty-state"><div class="big-icon">⏳</div><b>Checking public NHTSA data…</b></div>`;
  try{
    const d=await decodeVin(vin);
    if(!d.Make||!d.Model||!d.ModelYear) throw new Error("VIN could not be fully decoded");
    const recalls=await getRecalls(d.Make,d.Model,d.ModelYear);
    out.innerHTML=recallHtml(vin,d,recalls);
  }catch(err){
    out.innerHTML=`<div class="empty-state"><div class="big-icon">⚠️</div><b>Live lookup could not load</b><p>${err.message}. You can still verify the VIN directly on NHTSA.gov.</p><a class="secondary" target="_blank" rel="noopener noreferrer" href="https://www.nhtsa.gov/recalls">Open NHTSA Recall Search →</a></div>`;
  }
});
$("#photoForm")?.addEventListener("submit",e=>{
  e.preventDefault(); const q=$("#photoQuery").value.trim(); if(!q)return toast("Enter a VIN or vehicle description.");
  const url=`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q+" vehicle auction listing")}`;
  window.open(url,"_blank","noopener,noreferrer");
});
$$(".order-btn").forEach(b=>b.addEventListener("click",()=>{$("#orderPlan").value=b.dataset.plan;document.querySelector("#order").scrollIntoView({behavior:"smooth"});}));
$("#orderForm")?.addEventListener("submit",e=>{
  e.preventDefault(); const vin=cleanVin($("#orderVin").value);
  if(!validVin(vin))return toast("Enter a valid 17-character VIN.");
  if(!$("#agree").checked)return toast("Please accept the legal terms before continuing.");
  $("#orderMsg").textContent="Demo only: payment checkout is not connected yet. No charge was made.";
  toast("Order demo validated — no payment was processed.");
});
function answer(q){
  const s=q.toLowerCase();
  if(s.includes("recall"))return "A recall is a manufacturer safety campaign. Check the VIN with NHTSA/manufacturer and confirm whether the repair is still open. Recall campaign data alone does not prove a specific VIN still needs the repair.";
  if(s.includes("inspect")||s.includes("inspection"))return "Check cold start, warning lights, fluid leaks, tires, brakes, suspension, electronics, body gaps, paint differences and underbody damage. Always get an independent pre-purchase inspection.";
  if(s.includes("title")||s.includes("lien"))return "Match the seller's ID to the title, verify the VIN on the title and vehicle, check title brands and liens through appropriate official/licensed sources, and do not pay until ownership is clear.";
  if(s.includes("price")||s.includes("negot"))return "Compare similar vehicles by year, trim, mileage and condition. Use documented repairs, tire/brake needs, missing maintenance and market comparables as negotiation points.";
  if(s.includes("seller")||s.includes("question"))return "Ask why they are selling, how long they owned it, whether it had collision repairs, where it was serviced, whether they have records, whether there are liens, and whether you can get an independent inspection.";
  if(s.includes("red flag")||s.includes("avoid"))return "Red flags include VIN/title mismatch, seller name not on title, pressure to pay quickly, refusal of inspection, unexplained warning lights, fresh paint over damage, inconsistent mileage and missing ownership documents.";
  return "I can help explain recall information, inspection steps, seller questions, title checks, negotiation and report sections. For mechanical, legal, title or financial decisions, verify with qualified professionals and official sources.";
}
function addMsg(txt,who="bot"){const d=document.createElement("div");d.className=who==="user"?"user-msg":"bot-msg";d.textContent=txt;$("#messages").appendChild(d);$("#messages").scrollTop=$("#messages").scrollHeight;}
function ask(q){addMsg(q,"user");setTimeout(()=>addMsg(answer(q)),250);}
$$(".ask-ai").forEach(b=>b.addEventListener("click",()=>{document.querySelector(".assistant-section").scrollIntoView({behavior:"smooth"});setTimeout(()=>ask(b.dataset.question),350);}));
$("#chatForm")?.addEventListener("submit",e=>{e.preventDefault();const q=$("#chatInput").value.trim();if(!q)return;$("#chatInput").value="";ask(q);});
$("#floatingHelp")?.addEventListener("click",()=>document.querySelector(".assistant-section").scrollIntoView({behavior:"smooth"}));