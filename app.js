const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const VIN=/^[A-HJ-NPR-Z0-9]{17}$/;
const clean=v=>(v||'').trim().toUpperCase();
function toast(t){const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2500)}
function safe(v){return (v??'').toString().trim()}
function esc(v){return safe(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function display(v){const s=safe(v);return s&&s!=='0'&&s!=='Not Applicable'&&s!=='NULL'?s:'—'}

$('#menuBtn')?.addEventListener('click',()=>$('#mainNav').classList.toggle('open'));

function syncVin(v){
  if($('#vin')) $('#vin').value=v;
  if($('#freeVin')) $('#freeVin').value=v;
  if($('#orderVin')) $('#orderVin').value=v;
}

$('#vinForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const v=clean($('#vin').value);
  if(!VIN.test(v)) return toast('Enter a valid 17-character VIN.');
  syncVin(v);
  document.querySelector('#free-check').scrollIntoView({behavior:'smooth'});
  setTimeout(()=>runFreeCheck(v),300);
});

$('#freeVinForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const v=clean($('#freeVin').value);
  if(!VIN.test(v)) return setFreeStatus('Enter a valid 17-character VIN. VINs do not use I, O or Q.','error');
  syncVin(v);
  runFreeCheck(v);
});

function setFreeStatus(msg,state=''){
  const el=$('#freeStatus'); if(!el)return;
  el.className='free-status '+state;
  el.textContent=msg;
}

async function fetchJson(url,timeout=12000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const r=await fetch(url,{method:'GET',headers:{'Accept':'application/json'},signal:controller.signal,cache:'no-store',referrerPolicy:'no-referrer'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function runFreeCheck(vin){
  if(!VIN.test(vin)) return setFreeStatus('Enter a valid 17-character VIN.','error');
  setFreeStatus('Decoding VIN with NHTSA vPIC…','loading');
  $('#freeResults')?.classList.add('hidden');

  try{
    const decodeUrl='https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/'+encodeURIComponent(vin)+'?format=json';
    const decode=await fetchJson(decodeUrl);
    const d=decode?.Results?.[0];
    if(!d) throw new Error('No decode result');

    const errCode=safe(d.ErrorCode);
    const seriousError=errCode && errCode.split(',').some(x=>!['0','1','6','10','11','14'].includes(x.trim()));
    if(seriousError && !d.Make && !d.Model && !d.ModelYear){
      setFreeStatus('NHTSA could not decode this VIN. Check the 17 characters and try again.','error');
      return;
    }

    renderDecode(d,vin);
    $('#freeResults')?.classList.remove('hidden');
    setFreeStatus('VIN decoded. Checking matching NHTSA recall campaigns…','loading');

    const year=safe(d.ModelYear), make=safe(d.Make), model=safe(d.Model);
    if(!year||!make||!model){
      renderRecalls([],d,true);
      setFreeStatus('VIN decoded, but there was not enough year/make/model data to query recalls.','success');
      return;
    }

    const recallUrl='https://api.nhtsa.gov/recalls/recallsByVehicle?make='+encodeURIComponent(make)+'&model='+encodeURIComponent(model)+'&modelYear='+encodeURIComponent(year);
    const recalls=await fetchJson(recallUrl);
    renderRecalls(Array.isArray(recalls?.results)?recalls.results:[],d,false);
    setFreeStatus('Free VIN decode and recall-campaign research completed.','success');
  }catch(err){
    console.error(err);
    setFreeStatus('The public NHTSA service did not respond. Try again shortly or verify directly at NHTSA.','error');
  }
}

function renderDecode(d,vin){
  const title=[display(d.ModelYear),display(d.Make),display(d.Model)].filter(x=>x!=='—').join(' ');
  $('#vehicleTitle').textContent=title||'Vehicle Information';
  const facts=[
    ['VIN',vin],
    ['Year',d.ModelYear],
    ['Make',d.Make],
    ['Model',d.Model],
    ['Trim',d.Trim],
    ['Body Style',d.BodyClass],
    ['Engine',engineText(d)],
    ['Drive Type',d.DriveType],
    ['Fuel Type',d.FuelTypePrimary],
    ['Transmission',transText(d)],
    ['Manufacturer',d.Manufacturer],
    ['Plant Country',d.PlantCountry]
  ];
  $('#vinFacts').innerHTML=facts.map(([k,v])=>'<div class="fact-row"><span>'+esc(k)+'</span><b>'+esc(display(v))+'</b></div>').join('');
}

function engineText(d){
  const pieces=[];
  if(safe(d.DisplacementL)) pieces.push(d.DisplacementL+'L');
  if(safe(d.EngineCylinders)) pieces.push(d.EngineCylinders+' cyl');
  if(safe(d.EngineModel)) pieces.push(d.EngineModel);
  return pieces.join(' • ');
}
function transText(d){
  const p=[];
  if(safe(d.TransmissionStyle)) p.push(d.TransmissionStyle);
  if(safe(d.TransmissionSpeeds)) p.push(d.TransmissionSpeeds+'-speed');
  return p.join(' • ');
}

function renderRecalls(items,d,insufficient){
  const summary=$('#recallSummary'), list=$('#recallList');
  if(insufficient){
    summary.innerHTML='<b>Recall query unavailable.</b> The VIN decode did not return enough year/make/model information.';
    list.innerHTML='';
    return;
  }
  const count=items.length;
  summary.innerHTML=count
    ? '<b>'+count+' matching NHTSA recall campaign'+(count===1?'':'s')+'</b> returned for '+esc(display(d.ModelYear))+' '+esc(display(d.Make))+' '+esc(display(d.Model))+'.'
    : '<b>No matching campaigns returned by this year/make/model search.</b> This does not prove the exact VIN has no open recall.';
  list.innerHTML=items.map(r=>{
    const campaign=display(r.NHTSACampaignNumber);
    const comp=display(r.Component);
    const summaryText=display(r.Summary);
    const remedy=display(r.Remedy);
    const notes=display(r.Notes);
    return '<article class="recall-item">'+
      '<div class="recall-item-top"><h4>'+esc(comp)+'</h4><span class="campaign">'+esc(campaign)+'</span></div>'+
      '<p>'+esc(summaryText)+'</p>'+
      '<details><summary>Remedy & details</summary><p><b>Remedy:</b> '+esc(remedy)+'</p>'+(notes!=='—'?'<p><b>Notes:</b> '+esc(notes)+'</p>':'')+'</details>'+
      '</article>';
  }).join('');
}

$$('.select-plan').forEach(b=>b.addEventListener('click',()=>{
  $('#plan').value=b.dataset.plan;
  document.querySelector('#order').scrollIntoView({behavior:'smooth'});
}));

$('#orderForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const v=clean($('#orderVin').value);
  if(!VIN.test(v))return toast('Enter a valid 17-character VIN.');
  if(!$('#agree').checked)return toast('Please accept the legal terms.');
  $('#orderMsg').textContent='Checkout demo only. No payment was processed. Free VIN/recall data remains available above.';
  toast('Ready for payment connection.');
});

function reply(q){
  const s=q.toLowerCase();
  const m=q.toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/);
  if(m) return 'Use the Free VIN & Recall section above to decode that VIN with NHTSA public data. Premium history, accident, ownership, auction and title research requires a paid report and authorized data sources.';
  if(s.includes('recall'))return 'Use the free recall tool for NHTSA campaigns matching a decoded year, make and model. Always verify the exact VIN with NHTSA or the manufacturer because campaign matching is not the same as VIN-specific open/closed recall status.';
  if(s.includes('inspect'))return 'A pre-purchase inspection should cover warning lights, leaks, tires, brakes, suspension, electronics, body repairs and underbody condition.';
  if(s.includes('title')||s.includes('lien'))return 'Verify the seller name, VIN, title brands and liens before payment using official or licensed sources.';
  if(s.includes('negoti')||s.includes('price'))return 'Compare similar vehicles by year, trim, mileage, condition and history, then use documented issues as negotiation points.';
  if(s.includes('seller'))return 'Ask about ownership, maintenance, collision repairs, title status, liens, warning lights and whether an independent inspection is allowed.';
  return 'I can explain how NYC Auto Pro works and give general used-car buying guidance. Free VIN decoding and recall-campaign research are available above.';
}
function add(t,w='bot'){const d=document.createElement('div');d.className=w;d.textContent=t;$('#msgs').appendChild(d);$('#msgs').scrollTop=$('#msgs').scrollHeight}
function ask(q){add(q,'user');setTimeout(()=>add(reply(q),'bot'),220)}
$$('.aiq').forEach(b=>b.addEventListener('click',()=>{document.querySelector('#ai').scrollIntoView({behavior:'smooth'});setTimeout(()=>ask(b.dataset.q),300)}));
$('#chatForm')?.addEventListener('submit',e=>{e.preventDefault();const q=$('#chatInput').value.trim();if(!q)return;$('#chatInput').value='';ask(q)});
$('#floatHelp')?.addEventListener('click',()=>document.querySelector('#ai').scrollIntoView({behavior:'smooth'}));
