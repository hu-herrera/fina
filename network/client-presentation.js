/* Client-facing presentation using the existing map, topology and ping engine. */
(function(root){
'use strict';
if(!root.C5App)return;
const $=id=>document.getElementById(id),story=root.ClientStory;
const state={active:false,index:0,generation:0,snapshot:null,lastReport:null,mapHome:null,cascadeStage:0,cascadePlayed:false};
const scene=()=>story.scenes[state.index];
const route=()=>story.demoRoute;
const esc=v=>escapeCLI(String(v));
const wanName=id=>({starlink:'Starlink',leo:'Leo',entel5g:'Entel 5G',wom4g:'WOM 4G'})[id]||'sin ruta';
let demoTimer,pausedAt=null,pausedDuration=0;
const demoNow=()=>(pausedAt??performance.now())-pausedDuration;
function scheduleDemo(action,delay){
 clearTimeout(demoTimer);
 const generation=state.generation,due=demoNow()+delay;
 function check(){
   if(!state.active||state.generation!==generation)return;
   const remaining=due-demoNow();
   if(pausedAt!==null||remaining>1){demoTimer=setTimeout(check,pausedAt!==null?100:remaining);return;}
   action();
 }
 demoTimer=setTimeout(check,delay);
}
function setPaused(value){
 if(value===(pausedAt!==null))return;
 if(value)pausedAt=performance.now();
 else{pausedDuration+=performance.now()-pausedAt;pausedAt=null;}
 const stage=$('presentation-overlay');
 stage.classList.toggle('demo-paused',value);
 for(const svg of stage.querySelectorAll('svg'))if(svg.tagName==='svg'&&!svg.ownerSVGElement){
   if(value)svg.pauseAnimations();else svg.unpauseAnimations();
 }
 $('stage-pause').textContent=value?'Reanudar (P)':'Pausar (P)';
 $('stage-pause').setAttribute('aria-pressed',String(value));
}
const futureCoordinates=[[-22.91,-68.20],[-30.60,-71.20],[-32.83,-70.60],[-37.47,-72.35],[-40.57,-73.13],[-42.48,-73.76]];
let stopClosingTraffic=()=>{};
function startClosingTraffic(){
 const map=$('chile-map'),ns=map.namespaceURI;
 const layer=document.createElementNS(ns,'g');
 layer.id='closing-traffic';layer.setAttribute('pointer-events','none');map.append(layer);
 const streams=[],active=new Set();
 const carriers=['starlink','leo','entel5g','wom4g'];
 const offices=SEDES.filter(s=>s.id!=='cm');
 const shuffled=offices.slice();
 for(let i=shuffled.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
 }
 shuffled.forEach((site,i)=>{
   const available=carriers.filter(id=>id==='starlink'||id==='leo'||ANTENAS.some(a=>a.sedeId===site.id&&a.tipo===(id==='entel5g'?'g5':'g4')));
   C5App.state(site.id).preferredWan=available[i%available.length];
 });
 // Keep the central access visible throughout the national closing view.
 C5App.state('cm').preferredWan='entel5g';
 _refresh();renderFlowLines();
 let frame=0;
 const futureBeams=new Map();
 const futureSites=futureCoordinates.map(([lat,lon],i)=>{
   const id='future-'+i,[x,y]=sedePos({lat,lon});
   const path=document.createElementNS(ns,'path');
   path.setAttribute('stroke',LK_COLOR.starlink);path.setAttribute('stroke-width','0.8');path.setAttribute('stroke-dasharray','3 4');path.setAttribute('vector-effect','non-scaling-stroke');path.setAttribute('opacity','.65');layer.append(path);
   const marker=document.createElementNS(ns,'circle');
   marker.setAttribute('cx',x);marker.setAttribute('cy',y);marker.setAttribute('r',4.5);
   marker.setAttribute('fill','#3cc878');marker.setAttribute('stroke','rgba(255,255,255,0.55)');marker.setAttribute('stroke-width',0.9);
   setScreenFixedMapMarker(marker,x,y);
   marker.setAttribute('aria-label',story.scope.future[i]);layer.append(marker);
   return {id,x,y,path,marker};
 });
 function updateFuture(){
   const satellites=SAT_POS.starlink.filter(p=>satelliteInMap(...p));
   for(const {id,x,y,path} of futureSites){
     const nearest=satellites.reduce((best,p)=>!best||Math.hypot(p[0]-x,p[1]-y)<Math.hypot(best[0]-x,best[1]-y)?p:best,null);
     if(nearest){path.setAttribute('d','M'+x+' '+y+' L'+nearest[0]+' '+nearest[1]);futureBeams.set(id,path);}
     else{path.removeAttribute('d');futureBeams.delete(id);}
   }
 }
 updateMapMarkerScale();updateFuture();
 const beam=id=>futureBeams.get(id)||$('flow-link-'+id);
 const branches=SEDES.filter(site=>site.id!=='cm').map(site=>site.id).concat(futureSites.map(site=>site.id));
 const visits=new Map(branches.map(id=>[id,0]));
 function assign(stream,start){
   active.delete(stream.site);
   const ready=branches.filter(id=>!active.has(id)&&beam(id)?.getAttribute('d'));
   const lowest=Math.min(...ready.map(id=>visits.get(id)));
   const choices=ready.filter(id=>visits.get(id)===lowest);
   const site=choices[Math.floor(Math.random()*choices.length)];
   stream.site=site;
   if(site){
     visits.set(site,visits.get(site)+1);
     active.add(site);
     stream.dot.dataset.site=site;
   }
   stream.start=start;stream.duration=site?3200+Math.random()*2100:350;
 }
 for(let i=0;i<10;i++){
   const dot=document.createElementNS(ns,'circle');
   dot.setAttribute('vector-effect','non-scaling-stroke');dot.setAttribute('stroke','#152531');dot.setAttribute('stroke-width','1');layer.append(dot);
   const backbone=document.createElementNS(ns,'path');
   backbone.setAttribute('fill','none');backbone.setAttribute('stroke','#80bed0');backbone.setAttribute('stroke-width','1.2');backbone.setAttribute('stroke-dasharray','4 4');backbone.setAttribute('vector-effect','non-scaling-stroke');
   layer.prepend(backbone);
   const stream={dot,backbone};assign(stream,demoNow()-Math.random()*2300);streams.push(stream);
 }
 function draw(){
   if(pausedAt!==null){frame=requestAnimationFrame(draw);return;}
   const now=demoNow();
   const matrix=map.getScreenCTM();
   const scale=matrix?Math.hypot(matrix.a,matrix.b):1;
   updateFuture();
   const radius=4/Math.max(scale,0.001);
   const central=beam('cm');
   for(const stream of streams){
     stream.dot.setAttribute('r',radius);
     if(now-stream.start>=stream.duration)assign(stream,now+Math.random()*900);
     const branch=stream.site&&beam(stream.site),t=(now-stream.start)/stream.duration;
     stream.dot.style.display=t<0||!branch||!central?'none':'';
     stream.backbone.style.display=stream.dot.style.display;
     if(t<0||!branch||!central)continue;
     const returning=t>=0.5, progress=(returning?1-t:t)*2;
     const onBeam=(path,u)=>path.getPointAtLength(path.getTotalLength()*u);
     const a=onBeam(branch,1),b=onBeam(central,1);
     stream.backbone.setAttribute('d','M'+a.x+' '+a.y+' L'+b.x+' '+b.y);
     const lengths=[branch.getTotalLength(),stream.backbone.getTotalLength(),central.getTotalLength()];
     const distance=progress*(lengths[0]+lengths[1]+lengths[2]);
     let point;
     if(distance<=lengths[0])point=branch.getPointAtLength(distance);
     else if(distance<=lengths[0]+lengths[1])point=stream.backbone.getPointAtLength(distance-lengths[0]);
     else point=central.getPointAtLength(Math.max(0,lengths[2]-(distance-lengths[0]-lengths[1])));
     stream.dot.setAttribute('cx',point.x);stream.dot.setAttribute('cy',point.y);
     stream.dot.setAttribute('fill',returning?'#6bffdc':'#ffcf68');
   }
   frame=requestAnimationFrame(draw);
 }
 frame=requestAnimationFrame(draw);
 stopClosingTraffic=()=>{cancelAnimationFrame(frame);layer.remove();stopClosingTraffic=()=>{};};
}
function afterCascadePing(){
 if(!story.wanCascade[state.cascadeStage+1]?.expectedBranchWan)return;
 if(PACKET_ANIMATION&&!PACKET_ANIMATION.done){scheduleDemo(afterCascadePing,400);return;}
 scheduleDemo(runCascadeAction,5000);
}
function install(){
 if($('presentation-launch'))return;
 const launch=document.createElement('button');launch.id='presentation-launch';launch.type='button';launch.textContent='Presentar';launch.onclick=start;$('topbar').append(launch);
 const notice=document.createElement('span');notice.id='presentation-launch-status';notice.setAttribute('role','status');$('topbar').append(notice);
 const stage=document.createElement('section');stage.id='presentation-overlay';stage.className='client-stage';stage.hidden=true;stage.setAttribute('role','dialog');stage.setAttribute('aria-modal','true');stage.setAttribute('aria-label','Presentación al cliente');
 stage.innerHTML=`<header class="client-head"><span class="presentation-brand"><img class="duoc-logo" width="180" height="44" src="assets/duoc-uc.png" alt="Duoc UC"></span><div><label>Alternativa <select id="story-variant" aria-label="Alternativa de presentación"><option value="A">A · Cisco / Palo Alto</option><option value="B">B · MikroTik / OPNsense</option></select></label><button id="stage-pause" type="button" aria-pressed="false">Pausar (P)</button><button id="story-fullscreen" type="button">Pantalla completa</button><button id="stage-close" type="button">Salir</button></div></header>
 <main class="client-body"><article class="client-copy"><p id="stage-kicker" class="client-section"></p><h1 id="stage-title"></h1><p id="stage-description" class="client-message"></p><p id="story-scope" class="client-scope"></p><ul id="stage-facts"></ul><p id="story-future" class="client-expansion" hidden></p><div class="client-actions"><button id="story-replay" type="button">Repetir demostración</button><button id="story-wan-next" type="button" hidden>Simular caída siguiente</button><button id="story-policy" type="button" hidden>Autorizar este diagnóstico</button><button id="story-acl" type="button" hidden>Explorar las ACL</button><button id="story-topology" type="button">Ver topología</button></div><p id="story-result" role="status" aria-live="polite"></p></article><div class="client-visual"><div id="story-map-slot"></div><div id="story-diagram" hidden></div><div id="story-budget" hidden></div><div id="story-security" hidden></div></div></main>
 <footer class="client-footer"><div><button id="stage-prev" type="button">Anterior</button><span id="stage-progress"></span><button id="stage-next" type="button">Siguiente diapositiva</button></div><p>Flechas: diapositivas · Esc: cerrar</p></footer>`;
 document.body.append(stage);
 $('stage-pause').onclick=()=>setPaused(pausedAt===null);
 $('stage-next').onclick=()=>go(state.index+1);$('stage-prev').onclick=()=>go(state.index-1);$('stage-close').onclick=close;
 $('story-replay').onclick=()=>{if(scene().id==='before-cut'){go(state.index);return;}if(scene().id==='before-ok'){traceLayout(true);runDemo(false);}else go(state.index);};$('story-policy').onclick=authorize;$('story-wan-next').onclick=runCascadeAction;

 const traceSlot=document.createElement('aside');traceSlot.id='story-trace-slot';traceSlot.hidden=true;document.querySelector('.client-visual').append(traceSlot);
 $('story-acl').onclick=()=>C5App.openSecurity(route().source);
 $('story-topology').onclick=()=>openSedeModal(scene().id==='firewall'?'cm':route().source);
 $('story-variant').onchange=e=>{C5App.setVariant(e.target.value);if(scene().visual==='topology'){clearTimeout(demoTimer);diagram(false);}else go(state.index);};
 $('story-fullscreen').onclick=async()=>{try{if(document.fullscreenElement===document.documentElement)await document.exitFullscreen();else if(!document.fullscreenElement)await document.documentElement.requestFullscreen();}catch(e){$('story-result').textContent='El navegador no permitió pantalla completa. La presentación continúa en esta ventana.';}};
 document.addEventListener('keydown',e=>{
  if(!state.active)return;
  if(e.key.toLowerCase()==='p'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();if(!e.repeat)setPaused(pausedAt===null);return;}
  if(e.key==='Tab'){
   const modal=$('dev-overlay').classList.contains('vis')?$('dev-overlay'):$('sm-overlay').classList.contains('vis')?$('sm-overlay'):$('presentation-overlay');
   const list=[...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length);
   const first=list[0],last=list.at(-1);
   if(!modal.contains(document.activeElement)||e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}return;
  }
  if(e.key==='Escape'){
   e.preventDefault();e.stopImmediatePropagation();
   if($('dev-overlay').classList.contains('vis')){closeDevModal();return;}
   if($('sm-overlay').classList.contains('vis')){closeSedeModal();return;}
   close();return;
  }
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||$('sm-overlay').classList.contains('vis')||$('dev-overlay').classList.contains('vis'))return;
  if(['ArrowRight','ArrowLeft','PageDown','PageUp'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();go(state.index+(['ArrowRight','PageDown'].includes(e.key)?1:-1));}
 },true);
 // Preserve integration hooks used by the site-modal close handler.
 root.PacketWorkbench=Object.freeze({openStage:start,closeStage:close,onSedeClosed(){},closeLab:closeSedeModal,get stage(){return state.index;}});
}
function start(){
 if(state.active)return;
 if(Object.values(ST.links).some(s=>Object.values(s).includes('recuperando'))){$('presentation-launch-status').textContent='Espera a que termine la recuperación de enlaces antes de presentar.';return;}
 $('presentation-launch-status').textContent='';
 const map=$('map-container');
 const snapshot={st:structuredClone(ST),legacy:LegacyBaseline.captureState(),zoom:{...ZOOM},rule:structuredClone(PING_DIAGNOSTIC_RULE),terminals:structuredClone([...PC_TERMINALS]),mapLast:MAP_PING_LAST,speed:root.PING_PLAYBACK_SPEED,expanded:map.classList.contains('expanded')};
 snapshot.c5=C5App.beginPresentationSession();state.snapshot=snapshot;state.active=true;
 state.mapHome={parent:map.parentNode,next:map.nextSibling};
 const trace=$('ping-trace-card');state.traceHome={parent:trace.parentNode,next:trace.nextSibling};$('story-trace-slot').append(trace);
 PC_CONSOLE_RETURN=null;closeDevModal();closeSedeModal();closeDashboardPing();closeModal();closeComp();cancelPingSelection();clearPacketSimulation();
 map.classList.remove('expanded');$('story-map-slot').append(map);document.body.classList.add('client-presenting');$('presentation-overlay').hidden=false;
 root.PING_PLAYBACK_SPEED=1;$('story-variant').value=C5App.variant();
 try{go(0);$('stage-next').focus();}catch(e){close();$('presentation-launch-status').textContent='No se pudo preparar la presentación: '+e.message;}
}
function updateCascadeButton(){const b=$('story-wan-next');if(!b)return;b.hidden=scene().id!=='wan-cascade';const next=story.wanCascade[state.cascadeStage+1];b.disabled=state.cascadePlayed&&state.cascadeStage>=story.wanCascade.length-1;b.textContent=!state.cascadePlayed?'Consultar el sistema':next?(next.expectedBranchWan?'Simular caída de '+wanName(next.failed):'Opcional: probar caída total'):'Sin más enlaces';}
function runCascadeAction(){if(!state.cascadePlayed){state.cascadePlayed=true;updateCascadeButton();traceLayout(true);runDemo(false);return;}if(state.cascadeStage<story.wanCascade.length-1){state.cascadeStage++;go(state.index,true);}}
function prepare(s){
 clearPacketSimulation();PC_CONSOLE_RETURN=null;closeDevModal();closeSedeModal();
 C5App.resetPresentationScene();LegacyBaseline.restoreState([]);
 if(ST.mode!==s.mode)toggleMode();
 C5App.resetPresentationScene();ST.failback={};ST.enlaceActual={};ST.selId=route().source;
 
 if(s.id==='wan-cascade'){const order=['starlink','leo','entel5g','wom4g'];for(let i=0;i<state.cascadeStage;i++)for(const id of [route().source,'cm'])C5App.fault(id,'upstream:'+order[i]);}
 if(s.demo==='router')C5App.fault(route().source,'r1');
 if(s.demo==='switch')C5App.fault(route().source,'sw1');
 if(s.demo==='firewall')C5App.fault('cm','fwA');
 _refresh();
}
function go(index,keepCascade=false){
 if(!state.active||index<0||index>=story.scenes.length)return;
 setPaused(false);stopClosingTraffic();clearTimeout(demoTimer);
 if(scene()?.id==='before-cut'){const replay=$('story-replay');replay.disabled=false;replay.onclick=()=>go(state.index);}state.index=index;state.lastReport=null;const generation=++state.generation,s=scene();if(s.id==='wan-cascade'&&!keepCascade){state.cascadeStage=0;state.cascadePlayed=false;}prepare(s);
 const map=$('map-container');
 document.getElementById('future-costs')?.remove();
 $('counter-screen')?.remove();
 if(['before-cut','wan-cascade'].includes(s.id)){
   const card=document.createElement('section');card.id='counter-screen';
   card.innerHTML='<small>ATENCIÓN EN SUCURSAL · ARICA</small><strong>Consulta al sistema</strong><output aria-live="polite">Pendiente de consulta</output>';
   document.querySelector('.client-actions').before(card);
 }
 document.getElementById('mobile-route-inset')?.remove();
 delete map.dataset.cellularDemo;
 if(s.id==='wan-cascade'){
   const carrier=activeLink(route().source);
   if(carrier==='g5'||carrier==='g4'){
     map.dataset.cellularDemo=carrier;
     const name=wanName(carrier==='g5'?'entel5g':'wom4g');
     const inset=document.createElement('aside');
     inset.id='mobile-route-inset';
     inset.style.setProperty('--carrier-color',carrier==='g5'?'#89eabe':'#dac3ff');
     inset.innerHTML='<strong>Respaldo activo · '+name+'</strong><svg viewBox="0 0 430 84" role="img" aria-label="De Arica a su antena, por la red móvil y desde la antena de Santiago a Casa Matriz"><defs><g id="radio-mast" fill="none" stroke="currentColor" stroke-width="2"><path d="m-8 10 8-22 8 22 m-12-6 h8 M-9 -16 q-8 6 -3 13 M9 -16 q8 6 3 13"/></g></defs><path d="M40 36 H390" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3"/><g stroke="currentColor" fill="#172a39" stroke-width="2"><rect x="26" y="23" width="28" height="23"/><rect x="376" y="23" width="28" height="23"/><rect x="172" y="20" width="86" height="31" rx="15"/></g><use href="#radio-mast" x="117" y="35"/><use href="#radio-mast" x="313" y="35"/><g text-anchor="middle" fill="white" font-size="13"><text x="40" y="73">Arica</text><text x="117" y="73">Antena</text><text x="215" y="40">'+name+'</text><text x="313" y="73">Antena</text><text x="390" y="73">Casa Matriz</text></g><circle id="mobile-route-packet" cx="40" cy="36" r="6" fill="#ffd166"/></svg>';
     document.querySelector('.client-copy').append(inset);
   }
 }
 document.querySelector('.client-copy').scrollTop=0;document.querySelector('.client-body').scrollTop=0;
 $('stage-kicker').textContent=s.section.toUpperCase()+' · '+(index+1)+' / '+story.scenes.length;
 $('stage-title').textContent=s.title;$('stage-description').textContent=s.message;
 $('stage-facts').innerHTML=s.points.map(p=>'<li>'+esc(p)+'</li>').join('');
 $('story-scope').hidden=index!==0;$('story-scope').textContent=story.scope.sites+' sedes · '+story.scope.workers+' trabajadores · '+story.scope.workstations+' PCs · '+story.scope.phones+' teléfonos';
 $('story-future').hidden=s.id!=='context';$('story-future').textContent=s.id==='context'?'Próximas aperturas · '+story.scope.future.join(' · '):'Seis sedes futuras · red A: CLP '+story.scope.futureNetworkA.toLocaleString('es-CL')+' (logística adicional aparte) · WAN: CLP '+story.scope.futureWanMonthly.toLocaleString('es-CL')+'/mes al abrirlas.';
 $('stage-progress').textContent=(index+1)+' / '+story.scenes.length;$('stage-prev').disabled=index===0;$('stage-next').disabled=index===story.scenes.length-1;
 $('story-replay').hidden=!s.demo;$('story-replay').textContent=s.id==='before-ok'?'Ver ruta en operación normal':s.id==='before-cut'?'Volver a ver la escena':'Repetir demostración';$('story-wan-next').hidden=s.id!=='wan-cascade';updateCascadeButton();$('story-policy').hidden=s.id!=='security';$('story-policy').disabled=false;$('story-acl').hidden=s.id!=='security';
 $('story-topology').hidden=s.id!=='proposal';$('story-topology').textContent='Explorar topología';
 $('story-map-slot').hidden=s.visual!=='map';$('story-diagram').hidden=!['topology','short'].includes(s.visual);$('story-budget').hidden=!['budget','summary'].includes(s.visual);$('story-security').hidden=s.visual!=='security';
 traceLayout(s.visual==='map'&&Boolean(s.demo)&&!['before-ok','before-cut','wan-cascade'].includes(s.id));
 $('story-result').textContent='';$('story-result').className='';
 if(s.visual==='security')securityPanel();
 if(s.visual==='short')closingFilm();else if(s.visual==='topology')diagram();else if(s.visual==='budget')budget();else if(s.visual==='summary')summaryPanel(s.id);else{zoomReset();requestAnimationFrame(()=>{if(state.active&&state.generation===generation){if(s.demo&&!['before-ok','before-cut','wan-cascade'].includes(s.id))runDemo(false);else if(s.id==='closing')startClosingTraffic();else if(s.demo==='wan-cascade'){if(state.cascadePlayed)runDemo(false);else scheduleDemo(runCascadeAction,3500);}else zoomReset();}});}
}
function diagram(before=true){
 const mode=before?'antes':'despues';
 if(ST.mode!==mode)toggleMode();
 const site=SEDES.find(s=>s.id===route().source),template=document.createElement('template');
 template.innerHTML=before?LegacyBaseline.topology(site):renderTopoTab(site);
 const svg=template.content.querySelector('.topo-svg');
 svg.removeAttribute('width');svg.removeAttribute('height');
 $('story-diagram').replaceChildren(svg);
 const button=document.createElement('button');button.type='button';
 button.textContent=before?'Ver propuesta '+C5App.variant():'Ver red anterior';
 button.onclick=()=>{clearTimeout(demoTimer);diagram(!before);};
 $('story-diagram').append(button);
 if(before)scheduleDemo(()=>{if($('dev-overlay').classList.contains('vis')||$('sm-overlay').classList.contains('vis'))return;diagram(false);},14000);
}
function traceLayout(show){$('story-trace-slot').hidden=!show;document.querySelector('.client-visual').classList.toggle('has-trace',show);}
function runDemo(authorized){
 const s=scene(),src=SEDES.find(s=>s.id===route().source),dst=SEDES.find(s=>s.id===route().destination),a=getPCs(src)[0],b=getPCs(dst)[0];
 if(ST.mode==='despues'&&(s.demo!=='security'||authorized))setPingDiagnosticRule(src.id,dst.id,a.ip,b.ip);
 const r=s.visual==='security'&&!authorized?evaluateMapPing(src.id,dst.id,a.ip,b.ip):runMapPing(src.id,dst.id,a.ip,b.ip),z=ST.mode==='despues'?C5App.status(src.id):null;
 const wanted=authorized?true:s.expectedOk;
 let matches=r.ok===wanted;
 if(s.expectedWan&&s.id!=='wan-cascade')matches=matches&&z.activeWan===s.expectedWan;
 if(s.id==='wan-cascade'){const step=story.wanCascade[state.cascadeStage],cm=C5App.status('cm');matches=z.activeWan===step.expectedBranchWan&&cm.activeWan===step.expectedCentralWan&&r.ok===step.expectedPing;}
 if(s.expectedEdge)matches=matches&&r.route.some(n=>n.id==='site:'+src.id+':'+s.expectedEdge)&&!r.route.some(n=>n.id==='site:'+src.id+':r1');
 if(s.expectedWifi)matches=matches&&C5App.access(src.id,a).pcMode==='wifi'&&r.route.some(n=>n.kind==='ap')&&!r.route.some(n=>n.id==='site:'+src.id+':sw1');
 if(s.expectedCentral)matches=matches&&r.route.some(n=>n.id==='site:cm:'+s.expectedCentral);
 if(s.demo==='security'&&!authorized)matches=matches&&r.policy.action==='deny';
 state.lastReport={scene:s.id,ok:r.ok,expected:wanted,asExpected:matches,policy:r.policy,route:r.route.map(n=>({id:n.id,label:n.label,kind:n.kind})),sourceIp:ST.mode==='despues'?C5App.access(src.id,a).pcIp:a.ip,wan:z?.activeWan,edge:z?.activeEdge,variant:C5App.variant()};
 const outcome=r.ok?'camino encontrado':r.policy.action==='deny'?'bloqueado por política':'sin camino disponible';
 $('story-result').className=matches?'expected':'unexpected';$('story-result').textContent=(matches?'Resultado: ':'Revisar resultado: ')+outcome+'.';
 if(s.id==='wan-cascade'){const step=story.wanCascade[state.cascadeStage],app=C5App.securityTest(src.id,'app'),voice=C5App.securityTest(src.id,'voice');showQuota(app.ok);const carrier=z.activeWan&&C5App.status('cm').activeWan?wanName(z.activeWan):null;$('story-result').textContent=carrier?carrier+' · '+(app.ok&&voice.ok?'Sistema y llamadas disponibles':!app.ok&&!voice.ok?'Sistema y llamadas sin acceso':app.ok?'Sistema disponible · voz sin acceso':'Voz disponible · sistema sin acceso'):'Sin enlace disponible';updateCascadeButton();scheduleDemo(afterCascadePing,500);}
 if(s.id==='before-cut'){traceLayout(false);$('story-result').textContent='Comprobación: Arica no alcanza Casa Matriz. La consulta del ejecutivo queda pendiente.';}
 if(s.visual==='map'||authorized)$('ping-trace-details').open=true;
}
function showQuota(reachable){
 const output=$('counter-screen')?.querySelector('output');
 if(output)output.textContent=reachable?'Respuesta recibida de Casa Matriz':'Sin respuesta de Casa Matriz';
}
function closingFilm(){
 const host=$('story-diagram'),button=$('story-replay'), generation=state.generation;
 const central=SEDES.find(s=>s.id==='cm'), offices=SEDES.filter(s=>s!==central);
 const [cx,cy]=sedePos(central),project=(lat,lon)=>[mapXAtLatitude(mx(lon),lat),my(lat)],pole=project(-33.15,-70.72);
 host.innerHTML='<section class="national-demo"><h2>Acceso al sistema</h2><svg viewBox="-65 -25 500 1050" role="img" aria-label="Consulta de Arica a Santiago"><use href="#geography-layer"/><use href="#pascua-inset"/><use href="#antartica-layer"/><g class="routes"></g><g class="sites"></g></svg><div class="national-status" role="status"></div></section>';
 const svg=host.querySelector('svg'),status=host.querySelector('.national-status');
 function add(parent,tag,attrs,label){
   const n=document.createElementNS(svg.namespaceURI,tag);
   for(const [key,value] of Object.entries(attrs))n.setAttribute(key,value);
   if(label)n.textContent=label;
   parent.append(n);return n;
 }
 let step=0;
 const actions=['Consultar el sistema','Cortar el acceso de Arica','Probar el corte del poste central','Repetir la escena'];
 function draw(){
   const routes=svg.querySelector('.routes'),sites=svg.querySelector('.sites');
   routes.replaceChildren();sites.replaceChildren();
   ST.mpls.cm=step===3?'caido':'activo';ST.mpls[route().source]=step===2?'caido':'activo';_refresh();
   svg.setAttribute('viewBox',step===3?'-65 -25 500 1050':'65 -15 300 420');
   for(const s of offices){
     const [x,y]=sedePos(s),example=s.id===route().source;
     const ok=evaluateMapPing(s.id,'cm',getPCs(s)[0].ip,getPCs(central)[0].ip).ok;
     add(sites,'circle',{cx:x,cy:y,r:step===3?6:3,fill:ok?'#a2ede0':'#ff9079'});
     if(!example){
       if(step===3){
         const bend=Math.min(15,Math.abs(y-pole[1])*0.08);
         const controlX=(x+pole[0])/2+bend,controlY=(y+pole[1])/2;
         const link=add(routes,'path',{d:'M'+x+' '+y+' Q'+controlX+' '+controlY+' '+pole.join(' '),fill:'none',stroke:'#ed9586','stroke-width':1.3,opacity:0.78,'vector-effect':'non-scaling-stroke','data-office':s.id});
         add(link,'title',{},s.city+' · MPLS hacia Casa Matriz interrumpido');
       }
       continue;
     }

     const landmarks=[[-18.7,-70.2],[-19.9,-69.8],[-22.45,-69.65],[-24.8,-69.85],[-27.35,-70.3],[-29.9,-70.95],[-31.5,-71.05]].map(([lat,lon])=>project(lat,lon));
     const full=[[x,y],...landmarks,pole,[cx,cy]];
     const trip=ok?full:step===3?full.slice(0,-1):full.slice(0,3);
     const end=trip[trip.length-1],line=pts=>'M'+pts.map(p=>p.join(' ')).join(' L');
     add(routes,'path',{'data-office':s.id,d:line(full),fill:'none',stroke:'#9ab7c4','stroke-width':2,'stroke-dasharray':'4 3'});
     
     if(step){
       const packet=add(sites,'circle',{r:step===3?10:7,fill:'#ffdb78',stroke:'#162335','stroke-width':2});
       function send(points,arrived){
         const motion=add(packet,'animateMotion',{path:line(points),dur:'2s',begin:'indefinite',fill:'freeze'});
         motion.addEventListener('endEvent',()=>{if(packet.isConnected&&state.generation===generation)arrived();},{once:true});
         motion.beginElement();
       }
       send(trip,()=>{
         if(!ok){showQuota(false);button.disabled=false;if(step===2)scheduleDemo(advance,6500);return;}
         status.textContent='Casa Matriz recibe la consulta y envía la respuesta a Arica.';
         packet.replaceChildren();packet.setAttribute('fill','#70efd6');
         send([...trip].reverse(),()=>{showQuota(true);button.disabled=false;status.textContent='Respuesta recibida en Arica. El ejecutivo puede continuar la atención.';scheduleDemo(advance,5500);});
       });
     }
     if(!ok&&example)add(sites,'text',{x:end[0]-9,y:end[1]+8,fill:'#ff866e','font-size':32},'×');
     if(example)add(sites,'text',{x:x+12,y:y+6,fill:'white','font-size':23},'Arica');
   }
   if(step===3)routes.append(routes.querySelector('[data-office="'+route().source+'"]'));
   for(const offset of [-4,4])add(routes,'path',{d:'M'+pole.join(' ')+' Q'+(cx+offset*3)+' '+(cy-25)+' '+cx+' '+cy,fill:'none',stroke:step===3?'#ff846b':'#ffdc95','stroke-width':3});
   add(sites,'circle',{cx,cy,r:8,fill:'#ffe7a8'});
   add(sites,'text',{x:cx+14,y:cy+8,fill:'white','font-size':24},'Casa Matriz');
   const captions=['El ejecutivo necesita consultar el sistema.','El ejecutivo envía una consulta.','Corte local. La consulta de Arica se detiene antes de llegar a Santiago.','Corte del poste compartido. Ambos MPLS quedan fuera de servicio. Las 22 sucursales pierden acceso al sistema.'];
   if(step)document.getElementById('counter-screen').querySelector('output').textContent='Consultando a Casa Matriz…';status.textContent=captions[step];button.textContent=actions[step];button.disabled=step!==0;
   if(!step)document.getElementById('counter-screen').querySelector('output').textContent='Pendiente de consulta';
 }
 function advance(){clearTimeout(demoTimer);step=(step+1)%4;draw();if(step===0)scheduleDemo(advance,3500);}
 button.hidden=false;button.onclick=advance;draw();scheduleDemo(advance,3500);

}function authorize(){if(!state.active||scene().id!=='security')return;$('story-security').hidden=true;$('story-map-slot').hidden=false;traceLayout(true);runDemo(true);$('story-policy').disabled=true;}
function securityPanel(){
 const cases=['app','database','guest-internal','voice','user-mgmt','admin'].map(id=>C5App.securityTest(route().source,id));
 $('story-security').innerHTML='<p class="client-section">ACL definidas por el proyecto</p><table><thead><tr><th>Comunicación</th><th>Resultado</th></tr></thead><tbody>'+cases.map(r=>'<tr><td>'+esc(r.flow.label)+'<small>'+esc(r.flow.protocol.toUpperCase()+'/'+r.flow.port)+'</small></td><td class="'+(r.ok?'c5-policy-allow':'c5-policy-deny')+'">'+(r.policy.action==='deny'?'Bloqueado':r.ok?'Permitido':'Sin camino')+'</td></tr>').join('')+'</tbody></table><p>Cada prueba consulta la regla, las direcciones y el camino disponibles. «Explorar las ACL» permite revisar los detalles.</p>';
}
function summaryPanel(id){
 const money = value => '$'+value.toLocaleString('es-CL');
 const panels = {
  expansion: [['Seis aperturas · logística adicional aparte','Importe en CLP'],['Red futura A, con contingencia',money(story.scope.futureNetworkA)],['Red futura B, con contingencia',money(story.scope.futureNetworkB)],['WAN mensual al abrir las seis',money(story.scope.futureWanMonthly)]],
  decision: [['23 sedes · IVA incluido','A','B'],['Inversión inicial',money(story.budget.A.initial),money(story.budget.B.initial)],['Costo a cinco años',money(story.budget.A.period),money(story.budget.B.period)]]
 };
 const [headers,...rows]=panels[id];
 $('story-budget').innerHTML='<table><thead><tr>'+headers.map(v=>'<th>'+esc(v)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 if(id==='decision'){
   const conclusion=document.createElement('p');
   conclusion.textContent='Con B, la financiera ahorraría '+money(story.budget.A.period-story.budget.B.period)+' en cinco años.';
   $('story-budget').append(conclusion);
 }
 if(id==='expansion'){
   const panel=$('story-budget'),table=panel.querySelector('table');
   table.id='future-costs';document.querySelector('.client-copy').append(table);
   const cities=futureCoordinates;
   const markers=cities.map(([lat,lon],i)=>{
     const [x,y]=sedePos({lat,lon});
     const labelY=[125,270,324,445,520,580][i];
     return '<path d="M'+x+' '+y+' L267 '+labelY+' H285" fill="none" stroke="#ffcc82" stroke-width="2"/><circle cx="'+x+'" cy="'+y+'" r="7" fill="#ffcc82"/><text x="294" y="'+(labelY+7)+'">'+esc(story.scope.future[i])+'</text>';
   }).join('');
   const [x,y]=sedePos(SEDES.find(site=>site.id==='cm'));
   panel.innerHTML='<svg style="width:100%;height:100%;min-height:0" viewBox="-115 -20 680 1040" role="img" aria-label="Mapa de Chile con las seis sucursales futuras y Casa Matriz"><use href="#geography-layer"/><use href="#pascua-inset"/><use href="#antartica-layer"/><g fill="#f3f6fa" font-size="24" font-family="system-ui">'+markers+'<circle cx="'+x+'" cy="'+y+'" r="6" fill="#80dfdb"/><path d="M'+x+' '+y+' H38" stroke="#80dfdb"/><text x="33" y="'+(y+7)+'" text-anchor="end" fill="#80dfdb">Casa Matriz</text></g></svg>';
 }
}
function budget(){
 const b=story.budget,full=n=>'$'+n.toLocaleString('es-CL'),short=n=>'$'+(n/1000000).toLocaleString('es-CL',{maximumFractionDigits:1})+' millones';
 $('story-budget').innerHTML='<p class="client-section">C5-ECO-3 · CLP · 60 meses · IVA incluido</p><table><thead><tr><th>Concepto · 23 sedes</th><th>A · Cisco / Palo Alto</th><th>B · MikroTik / OPNsense</th></tr></thead><tbody>'+[['Inversión inicial','initial'],['WAN mensual','monthly'],['TCO 60 meses','period']].map(([label,key])=>'<tr><th>'+label+'</th><td title="'+full(b.A[key])+'">'+short(b.A[key])+'</td><td title="'+full(b.B[key])+'">'+short(b.B[key])+'</td></tr>').join('')+'</tbody></table><p>Referencia económica inicial: '+short(b.original)+'. A incluye suscripciones propietarias; B usa equipos de menor costo sin el mismo paquete. Ambas comparten WAN mensual. El TCO suma inversión inicial, 60 meses de WAN y reserva operativa; la expansión futura va aparte.</p><p><a href="https://github.com/hu-herrera/financiera-pacifico-entrega-docente/blob/main/02_Entregables/Entregable_7.pdf" target="_blank" rel="noopener">Respaldo económico C5-ECO-3</a></p>';
}
function close(){delete document.getElementById("map-container").dataset.cellularDemo;
 if(!state.active)return;
 setPaused(false);stopClosingTraffic();clearTimeout(demoTimer);const snapshot=state.snapshot,map=$('map-container');state.active=false;
 clearPacketSimulation();PC_CONSOLE_RETURN=null;closeDevModal();closeSedeModal();closeDashboardPing();
 $('presentation-overlay').hidden=true;document.body.classList.remove('client-presenting');
 const trace=$('ping-trace-card');if(state.traceHome.next?.parentNode===state.traceHome.parent)state.traceHome.parent.insertBefore(trace,state.traceHome.next);else state.traceHome.parent.append(trace);
 if(state.mapHome.next?.parentNode===state.mapHome.parent)state.mapHome.parent.insertBefore(map,state.mapHome.next);else state.mapHome.parent.append(map);
 if(ST.mode!==snapshot.st.mode)toggleMode();
 C5App.endPresentationSession(snapshot.c5);LegacyBaseline.restoreState(snapshot.legacy);
 for(const k of Object.keys(ST))if(!(k in snapshot.st))delete ST[k];Object.assign(ST,snapshot.st);
 PING_DIAGNOSTIC_RULE=snapshot.rule;PC_TERMINALS.clear();for(const [k,v]of snapshot.terminals)PC_TERMINALS.set(k,v);
 root.PING_PLAYBACK_SPEED=snapshot.speed;Object.assign(ZOOM,snapshot.zoom);map.classList.toggle('expanded',snapshot.expanded);
 _refresh();aplicarZoom();MAP_PING_LAST=snapshot.mapLast;state.snapshot=null;state.lastReport=null;$('c5-profile-select').disabled=ST.mode==='antes';
 if(document.fullscreenElement===$('presentation-overlay'))document.exitFullscreen().catch(()=>{});
 $('presentation-launch').focus();
}
root.ClientPresentation={get paused(){return pausedAt!==null;},install,start,close,go,authorize,get active(){return state.active;},get index(){return state.index;},get report(){return state.lastReport;}};
})(window);





