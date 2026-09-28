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
  if(!VIN.test(v)) return toast(currentLang==='es'?'Ingresa un VIN válido de 17 caracteres.':'Enter a valid 17-character VIN.');
  syncVin(v);
  document.querySelector('#free-check').scrollIntoView({behavior:'smooth'});
  setTimeout(()=>runFreeCheck(v),300);
});

$('#freeVinForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  const v=clean($('#freeVin').value);
  if(!VIN.test(v)) return setFreeStatus(currentLang==='es'?'Ingresa un VIN válido de 17 caracteres. Los VIN no usan I, O ni Q.':'Enter a valid 17-character VIN. VINs do not use I, O or Q.','error');
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
  setFreeStatus(currentLang==='es'?'Decodificando VIN con NHTSA vPIC…':'Decoding VIN with NHTSA vPIC…','loading');
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
    setFreeStatus(currentLang==='es'?'VIN decodificado. Revisando campañas de recall NHTSA…':'VIN decoded. Checking matching NHTSA recall campaigns…','loading');

    const year=safe(d.ModelYear), make=safe(d.Make), model=safe(d.Model);
    if(!year||!make||!model){
      renderRecalls([],d,true);
      setFreeStatus('VIN decoded, but there was not enough year/make/model data to query recalls.','success');
      return;
    }

    const recallUrl='https://api.nhtsa.gov/recalls/recallsByVehicle?make='+encodeURIComponent(make)+'&model='+encodeURIComponent(model)+'&modelYear='+encodeURIComponent(year);
    const recalls=await fetchJson(recallUrl);
    renderRecalls(Array.isArray(recalls?.results)?recalls.results:[],d,false);
    setFreeStatus(currentLang==='es'?'VIN decode y revisión de recall completados.':'Free VIN decode and recall-campaign research completed.','success');
  }catch(err){
    console.error(err);
    setFreeStatus(currentLang==='es'?'El servicio público de NHTSA no respondió. Intenta nuevamente o verifica directamente en NHTSA.':'The public NHTSA service did not respond. Try again shortly or verify directly at NHTSA.','error');
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


/* English / Spanish interface toggle */
let currentLang=localStorage.getItem('nycap-lang')||'en';
function setText(sel,en,es,html=false){const el=$(sel);if(!el)return;const val=currentLang==='es'?es:en;if(html)el.innerHTML=val;else el.textContent=val}
function applyLanguage(lang){
  currentLang=lang==='es'?'es':'en';
  localStorage.setItem('nycap-lang',currentLang);
  document.documentElement.lang=currentLang;
  const toggle=$('#langToggle');if(toggle)toggle.textContent=currentLang==='es'?'EN':'ES';

  setText('#mainNav a[href="#home"]','Home','Inicio');
  setText('#mainNav a[href="#free-check"]','Free VIN & Recall','VIN y Recall Gratis');
  setText('#mainNav a[href="#report"]','Sample Report','Reporte de Muestra');
  setText('#mainNav a[href="#pricing"]','Pricing','Precios');
  setText('#mainNav a[href="#buyer-help"]','Buying Help','Ayuda al Comprar');
  setText('#mainNav a[href="#sources"]','Data Sources','Fuentes de Datos');
  setText('.topcta','Get Your Report','Obtener Reporte');
  setText('.hero .eyebrow','VEHICLE HISTORY • SAFETY • BUYER INTELLIGENCE','HISTORIAL • SEGURIDAD • INTELIGENCIA DE COMPRA');
  setText('.hero-copy>p','Decode the VIN free, research matching recall campaigns, preview professional vehicle data, and upgrade when you need deeper history, photos, market guidance and buyer analysis.','Decodifica el VIN gratis, revisa campañas de recall y obtén un reporte más completo cuando necesites historial, fotos, mercado y análisis de compra.');
  if($('#vin')) $('#vin').placeholder=currentLang==='es'?'Ingresa VIN de 17 caracteres':'Enter 17-character VIN';
  setText('#vinForm button','Check VIN Free','Revisar VIN Gratis');
  setText('.secure','✓ Free VIN decode & recall-campaign research • No credit card required','✓ VIN decode y recall gratis • No requiere tarjeta');

  setText('#free-check .free-copy h2','Free VIN Decode & Recall Check','VIN Decode y Recall Gratis');
  setText('#free-check .free-copy>p','Use official NHTSA public data to identify basic vehicle specifications and recall campaigns that match the decoded year, make and model.','Usa datos públicos oficiales de NHTSA para identificar especificaciones básicas y campañas de recall por año, marca y modelo.');
  setText('#freeVinForm label','Enter VIN','Ingresa VIN');
  if($('#freeVin')) $('#freeVin').placeholder=currentLang==='es'?'VIN de 17 caracteres':'17-character VIN';
  setText('#freeVinForm button','Decode & Check Recalls','Decodificar y Revisar Recall');

  setText('#how-it-works .title span','HOW IT WORKS','CÓMO FUNCIONA');
  setText('#how-it-works .title h2','From VIN to Better Buying Decision','Del VIN a una Mejor Decisión de Compra');
  setText('#how-it-works .title p','Start free, then unlock deeper research only when you need it.','Empieza gratis y desbloquea investigación más profunda solo cuando la necesites.');
  const steps=$$('#how-it-works .steps-grid article');
  if(steps[0]){steps[0].querySelector('h3').textContent=currentLang==='es'?'Ingresa el VIN':'Enter the VIN';steps[0].querySelector('p').textContent=currentLang==='es'?'Decodifica datos básicos y revisa campañas NHTSA gratis.':'Decode basic vehicle information and research matching NHTSA recall campaigns for free.'}
  if(steps[1]){steps[1].querySelector('h3').textContent=currentLang==='es'?'Elige tu Reporte':'Choose Your Report';steps[1].querySelector('p').textContent=currentLang==='es'?'Escoge Basic, Smart o Complete según el nivel de historial y ayuda que necesites.':'Select Basic, Smart or Complete depending on how much history and buyer guidance you need.'}
  if(steps[2]){steps[2].querySelector('h3').textContent=currentLang==='es'?'Revisa Antes de Comprar':'Review Before You Buy';steps[2].querySelector('p').textContent=currentLang==='es'?'Usa el reporte, preguntas al vendedor y guía de inspección antes de comprar.':'Use the report, seller questions and inspection guidance before making a purchase decision.'}

  setText('#red-flags .redflag-head span','RED FLAG CENTER','CENTRO DE ALERTAS');
  setText('#red-flags .redflag-head h2','Know What Could Change the Deal','Detecta Lo Que Puede Cambiar el Negocio');
  setText('#red-flags .redflag-head p','Premium reports are designed to check important risk categories when authorized data is available.','Los reportes premium revisan categorías importantes de riesgo cuando hay datos autorizados disponibles.');
  setText('#red-flags .redflag-head .btn','Unlock Premium Checks →','Desbloquear Revisiones Premium →');

  setText('#what-we-check .title span','WHAT WE CHECK','LO QUE REVISAMOS');
  setText('#what-we-check .title h2','One Report, Multiple Research Areas','Un Reporte, Múltiples Áreas de Investigación');
  setText('#what-we-check .title p','NYC Auto Pro separates free public safety information from deeper commercial history research.','NYC Auto Pro separa la información pública gratuita de seguridad del historial comercial más profundo.');

  setText('#pricing .darktitle h2','Choose Your Report','Elige Tu Reporte');
  setText('#pricing .darktitle p','No vehicle-specific information is shown before purchase.','La información premium específica del vehículo se muestra después de la compra.');
  setText('.compare-title span','COMPARE REPORTS','COMPARAR REPORTES');
  setText('.compare-title h3','Choose the Level of Research You Need','Elige el Nivel de Investigación que Necesitas');

  setText('.final-cta span','BUY WITH MORE INFORMATION','COMPRA CON MÁS INFORMACIÓN');
  setText('.final-cta h2','Don’t Buy Blind.','No Compres a Ciegas.');
  setText('.final-cta p','Start with the free VIN and recall tools, then unlock deeper history research when the vehicle is worth a closer look.','Empieza con VIN y recall gratis y desbloquea historial más profundo cuando el vehículo valga una revisión completa.');
  const ctaBtns=$$('.final-cta .btn');if(ctaBtns[0])ctaBtns[0].textContent=currentLang==='es'?'Revisar VIN Gratis':'Check VIN Free';if(ctaBtns[1])ctaBtns[1].textContent=currentLang==='es'?'Obtener Reporte Completo':'Get Full Report';
}
$('#langToggle')?.addEventListener('click',()=>applyLanguage(currentLang==='en'?'es':'en'));
applyLanguage(currentLang);
