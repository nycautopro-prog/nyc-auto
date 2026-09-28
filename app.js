const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const VIN_RE=/^[A-HJ-NPR-Z0-9]{17}$/;
function cleanVin(v){return (v||"").trim().toUpperCase();}
function validVin(v){return VIN_RE.test(cleanVin(v));}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800);}
$("#menuBtn")?.addEventListener("click",()=>$("#nav").classList.toggle("open"));

$("#heroVinForm")?.addEventListener("submit",e=>{
  e.preventDefault();
  const v=cleanVin($("#heroVin").value);
  if(!validVin(v)) return toast("Enter a valid 17-character VIN.");
  $("#orderVin").value=v;
  document.querySelector("#pricing").scrollIntoView({behavior:"smooth"});
  toast("VIN accepted. Choose a paid report to unlock vehicle-specific information.");
});

$$(".order-btn").forEach(b=>b.addEventListener("click",()=>{
  $("#orderPlan").value=b.dataset.plan;
  document.querySelector("#order").scrollIntoView({behavior:"smooth"});
}));

$("#orderForm")?.addEventListener("submit",e=>{
  e.preventDefault();
  const vin=cleanVin($("#orderVin").value);
  if(!validVin(vin)) return toast("Enter a valid 17-character VIN.");
  if(!$("#agree").checked) return toast("Please accept the legal terms before continuing.");
  $("#orderMsg").textContent="Checkout demo only. No vehicle-specific data was released and no payment was processed.";
  toast("Ready for checkout connection.");
});

function answer(q){
  const s=q.toLowerCase();
  if(/[A-HJ-NPR-Z0-9]{17}/i.test(q)) return "Vehicle-specific VIN results are available only inside a purchased report. Choose a report and complete checkout to unlock them.";
  if(s.includes("recall")) return "Recall findings are included inside paid reports. For general safety information, you can also verify recalls directly with NHTSA or the manufacturer.";
  if(s.includes("inspect")||s.includes("inspection")) return "A pre-purchase inspection should cover warning lights, leaks, tires, brakes, suspension, electronics, body repairs and underbody condition. Vehicle-specific inspection guidance is included in Smart and Complete reports.";
  if(s.includes("title")||s.includes("lien")) return "Before paying, verify that the seller's name matches the title, confirm the VIN, check for title brands and liens, and use official or licensed sources.";
  if(s.includes("price")||s.includes("negot")) return "Compare similar vehicles by year, trim, mileage, condition and history. Market-specific guidance is included in Smart and Complete reports.";
  if(s.includes("seller")||s.includes("question")) return "General seller questions include ownership, maintenance, collision repairs, title status, liens and whether an independent inspection is allowed.";
  return "I can explain how NYC Auto Pro works and give general used-car buying guidance. Vehicle-specific findings are unlocked only after purchase.";
}
function addMsg(txt,who="bot"){const d=document.createElement("div");d.className=who==="user"?"user-msg":"bot-msg";d.textContent=txt;$("#messages").appendChild(d);$("#messages").scrollTop=$("#messages").scrollHeight;}
function ask(q){addMsg(q,"user");setTimeout(()=>addMsg(answer(q)),220);}
$$(".ask-ai").forEach(b=>b.addEventListener("click",()=>{document.querySelector(".assistant-section").scrollIntoView({behavior:"smooth"});setTimeout(()=>ask(b.dataset.question),300);}));
$("#chatForm")?.addEventListener("submit",e=>{e.preventDefault();const q=$("#chatInput").value.trim();if(!q)return;$("#chatInput").value="";ask(q);});
$("#floatingHelp")?.addEventListener("click",()=>document.querySelector(".assistant-section").scrollIntoView({behavior:"smooth"}));