/* Client-facing presentation using the existing map, topology and ping engine. */
(function(root){
'use strict';
if(!root.C5App)return;
const $=id=>document.getElementById(id),story=root.ClientStory;
const state={active:false,index:0,generation:0,snapshot:null,lastReport:null,mapHome:null,example:null,raf:0,autoplay:false,tour:null,tourRaf:0};
const scene=()=>story.scenes[state.index];
const route=()=>story.demoRoute;
const esc=v=>escapeCLI(String(v));
function install(){
 if($('presentation-launch'))return;
 const launch=document.createElement('button');launch.id='presentation-launch';launch.type='button';launch.textContent='Presentar';launch.onclick=start;$('topbar').append(launch);
 const notice=document.createElement('span');notice.id='presentation-launch-status';notice.setAttribute('role','status');$('topbar').append(notice);
 const stage=document.createElement('section');stage.id='presentation-overlay';stage.className='client-stage';stage.hidden=true;stage.setAttribute('role','dialog');stage.setAttribute('aria-modal','true');stage.setAttribute('aria-label','Presentación al cliente');
 stage.innerHTML=`<header class="client-head"><span>Financiera Pacífico</span><div><label>Alternativa <select id="story-variant" aria-label="Alternativa de presentación"><option value="A">A · Cisco / Palo Alto</option><option value="B">B · MikroTik / OPNsense</option></select></label><button id="story-fullscreen" type="button">Pantalla completa</button><button id="stage-close" type="button">Salir</button></div></header>
 <main class="client-body"><article class="client-copy"><p id="stage-kicker" class="client-section"></p><h1 id="stage-title"></h1><p id="stage-description" class="client-message"></p><p id="story-scope" class="client-scope"></p><ul id="stage-facts"></ul><p id="story-future" hidden></p><div class="client-actions"><button id="story-replay" type="button">Repetir demostración</button><button id="story-policy" type="button" hidden>Autorizar este diagnóstico</button><button id="story-acl" type="button" hidden>Explorar las ACL</button><button id="story-topology" type="button">Ver topología</button></div><p id="story-result" role="status" aria-live="polite"></p></article><div class="client-visual"><div id="story-map-slot"></div><div id="story-diagram" hidden></div><div id="story-budget" hidden></div><div id="story-security" hidden></div></div></main>
 <footer class="client-footer"><div><button id="stage-prev" type="button">Anterior</button><span id="stage-progress"></span><button id="stage-next" type="button">Siguiente diapositiva</button></div><p>Flechas: diapositivas · Esc: cerrar</p></footer>`;
 document.body.append(stage);
 installExamples();
 $('stage-next').onclick=()=>state.index===story.scenes.length-1?close():go(state.index+1);$('stage-prev').onclick=()=>go(state.index-1);$('stage-close').onclick=close;
 $('story-replay').onclick=startExample;$('story-policy').onclick=authorize;
 const traceSlot=document.createElement('aside');traceSlot.id='story-trace-slot';traceSlot.hidden=true;document.querySelector('.client-visual').append(traceSlot);
 $('story-acl').onclick=()=>C5App.openSecurity(route().source);
 const assurance=document.createElement('button');assurance.id='story-assurance';assurance.type='button';assurance.textContent='Protocolos / QoS / HA';assurance.onclick=()=>{openSedeModal(route().source);smTab('assurance',document.querySelector('[data-c5-assurance]'));};document.querySelector('.client-actions').append(assurance);
 $('story-topology').onclick=()=>openSedeModal(scene().id==='firewall'?'cm':route().source);
 $('story-variant').onchange=e=>{C5App.setVariant(e.target.value);go(state.index);};
 $('story-fullscreen').onclick=async()=>{try{if(document.fullscreenElement===stage)await document.exitFullscreen();else if(!document.fullscreenElement)await stage.requestFullscreen();}catch(e){$('story-result').textContent='El navegador no permitió pantalla completa. La presentación continúa en esta ventana.';}};
 document.addEventListener('fullscreenchange',()=>{if(state.active&&scene().visual==='map')requestAnimationFrame(zoomReset);});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(state.active&&scene().visual==='map')requestAnimationFrame(zoomReset);}).observe($('story-map-slot'));
 document.addEventListener('keydown',e=>{
  if(!state.active)return;
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
  if(e.code==='Space'&&state.tour&&['running','paused'].includes(state.tour.status)&&document.activeElement?.tagName!=='BUTTON'){e.preventDefault();e.stopImmediatePropagation();toggleTour();return;}
  if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(e.key==='ArrowRight')go(state.index+1);else if(e.key==='ArrowLeft')go(state.index-1);}
 },true);
 const more=document.createElement('details');more.className='story-more';more.innerHTML='<summary>Explorar detalles</summary>';document.querySelector('.client-actions').append(more);for(const id of ['story-topology','story-policy','story-acl','story-assurance'])more.append($(id));
 installTour();
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
function prepare(s){
 clearPacketSimulation();PC_CONSOLE_RETURN=null;closeDevModal();closeSedeModal();
 C5App.resetPresentationScene();LegacyBaseline.restoreState([]);
 if(ST.mode!==s.mode)toggleMode();
 C5App.resetPresentationScene();ST.failback={};ST.enlaceActual={};ST.selId=route().source;
 _refresh();
}
function go(index,automatic=false){
 if(!state.active||index<0||index>=story.scenes.length)return;
 if(state.tour?.status==='done')stopTour();
 if(state.tour){if(!automatic)pauseTour();state.tour.elapsed=0;state.tour.phase='intro';state.tour.last=performance.now();}
 stopExample();state.index=index;state.lastReport=null;const generation=++state.generation,s=scene();prepare(s);
 document.querySelector('.client-copy').scrollTop=0;document.querySelector('.client-body').scrollTop=0;
 $('stage-kicker').textContent=(s.mode==='antes'?'ESCENARIO ACTUAL':'PROPUESTA')+' · '+(index+1)+' / '+story.scenes.length;
 $('stage-title').textContent=s.title;$('stage-description').textContent=s.message;
 $('stage-facts').innerHTML=s.points.map(p=>'<li>'+esc(p)+'</li>').join('');
 $('story-scope').hidden=index!==0;$('story-scope').textContent=story.scope.sites+' sedes · '+story.scope.workstations+' PCs · '+story.scope.phones+' teléfonos';
 $('story-future').hidden=s.id!=='close';$('story-future').textContent='Aperturas previstas: '+story.scope.future.join(', ')+'. No incluidas en las compras actuales.';
 $('stage-progress').textContent=(index+1)+' / '+story.scenes.length;$('stage-prev').disabled=index===0;$('stage-next').disabled=false;$('stage-next').textContent=index===story.scenes.length-1?'Finalizar presentación':'Siguiente diapositiva';
 $('story-replay').hidden=!hasExample(s);$('story-policy').hidden=s.id!=='security';$('story-policy').disabled=false;$('story-acl').hidden=s.id!=='security';
 $('story-topology').hidden=['budget','summary'].includes(s.visual);$('story-assurance').hidden=!['proposal','security','close','finale'].includes(s.id);
 $('story-map-slot').hidden=s.visual!=='map';$('story-diagram').hidden=s.visual!=='topology';$('story-budget').hidden=s.visual!=='budget';$('story-security').hidden=s.visual!=='security';
 traceLayout(s.visual==='map'&&Boolean(s.demo));
 $('story-result').textContent='';$('story-result').className='';
 renderExampleIntro();
 if(s.visual==='security')securityPanel();
 if(hasExample(s)&&state.autoplay&&!state.tour)requestAnimationFrame(()=>{if(state.active&&!state.tour&&state.generation===generation)startExample();});
 if(s.visual==='topology')diagram();else if(s.visual==='budget')budget();else{zoomReset();requestAnimationFrame(()=>{if(state.active&&state.generation===generation){zoomReset();}});}
 renderTour();
}
function diagram(){
 const s=SEDES.find(s=>s.id===route().source),template=document.createElement('template');template.innerHTML=renderTopoTab(s);
 const svg=template.content.querySelector('.topo-svg');
 svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.removeAttribute('width');svg.removeAttribute('height');
 svg.querySelectorAll('[onclick],[onkeydown],[tabindex],[role="button"]').forEach(el=>{for(const attr of ['onclick','onkeydown','tabindex','role','style'])el.removeAttribute(attr);});
 $('story-diagram').replaceChildren(svg);
 const caption=document.createElement('p');caption.textContent=(ST.mode==='antes'?'ANTES · infraestructura existente común a ambas alternativas':C5App.variant()==='A'?'DESPUÉS · A · Cisco / Palo Alto':'DESPUÉS · B · MikroTik / OPNsense')+' · '+s.code+' '+s.city+'.';$('story-diagram').append(caption);
}
function traceLayout(show){$('story-trace-slot').hidden=!show;document.querySelector('.client-visual').classList.toggle('has-trace',show);}
function runDemo(authorized,baseline=false){
 const s=scene(),src=SEDES.find(s=>s.id===route().source),dst=SEDES.find(s=>s.id===route().destination),a=getPCs(src)[0],b=getPCs(dst)[0];
 if(ST.mode==='despues'&&(s.demo!=='security'||authorized))setPingDiagnosticRule(src.id,dst.id,a.ip,b.ip);
 const r=s.visual==='security'&&!authorized?evaluateMapPing(src.id,dst.id,a.ip,b.ip):runMapPing(src.id,dst.id,a.ip,b.ip),z=ST.mode==='despues'?C5App.status(src.id):null;
 const wanted=baseline?true:authorized?true:s.expectedOk;
 let matches=r.ok===wanted;
 if(!baseline&&s.expectedWan)matches=matches&&z.activeWan===s.expectedWan;
 if(!baseline&&s.expectedEdge)matches=matches&&r.route.some(n=>n.id==='site:'+src.id+':'+s.expectedEdge)&&!r.route.some(n=>n.id==='site:'+src.id+':r1');
 if(!baseline&&s.expectedWifi)matches=matches&&C5App.access(src.id,a).pcMode==='wifi'&&r.route.some(n=>n.kind==='ap')&&!r.route.some(n=>n.id==='site:'+src.id+':sw1');
 if(!baseline&&s.expectedCentral)matches=matches&&r.route.some(n=>n.id==='site:cm:'+s.expectedCentral);
 if(s.demo==='security'&&!authorized)matches=matches&&r.policy.action==='deny';
 state.lastReport={scene:s.id,ok:r.ok,expected:wanted,asExpected:matches,policy:r.policy,route:r.route.map(n=>({id:n.id,label:n.label,kind:n.kind})),sourceIp:ST.mode==='despues'?C5App.access(src.id,a).pcIp:a.ip,wan:z?.activeWan,edge:z?.activeEdge,variant:C5App.variant()};
 const outcome=r.ok?'camino encontrado':r.policy.action==='deny'?'bloqueado por política':'sin camino disponible';
 $('story-result').className=matches?'expected':'unexpected';$('story-result').textContent=(matches?'Resultado: ':'Revisar resultado: ')+outcome+'.';
 if(s.visual==='map'||authorized)$('ping-trace-details').open=true;
}
function authorize(){if(!state.active||scene().id!=='security')return;$('story-security').hidden=true;$('story-map-slot').hidden=false;traceLayout(true);runDemo(true);$('story-policy').disabled=true;}
function securityPanel(){
 const cases=['database'].map(id=>C5App.securityTest(route().source,id));
 $('story-security').innerHTML='<p class="client-section">ACL definidas por el proyecto</p><table><thead><tr><th>Comunicación</th><th>Resultado</th></tr></thead><tbody>'+cases.map(r=>'<tr><td>'+esc(r.flow.label)+'<small>'+esc(r.flow.protocol.toUpperCase()+'/'+r.flow.port)+'</small></td><td class="'+(r.ok?'c5-policy-allow':'c5-policy-deny')+'">'+(r.policy.action==='deny'?'Bloqueado':r.ok?'Permitido':'Sin camino')+'</td></tr>').join('')+'</tbody></table><p>La aplicación consulta la base de datos. El puesto del colaborador no tiene ese permiso directo.</p>';
}
function budget(){
 const b=story.budget,short=n=>'$'+(n/1000000).toLocaleString('es-CL',{maximumFractionDigits:1})+' millones';
 $('story-budget').innerHTML='<p class="client-section">Comparación A/B · CLP, IVA supuesto incluido</p><table><thead><tr><th>Concepto</th><th>A</th><th>B</th></tr></thead><tbody>'+[
 ['Routers de sucursal','Cisco','MikroTik'],['Firewall central','Palo Alto','OPNsense'],['Inversión inicial',short(b.A.initial),short(b.B.initial)],['WAN mensual',short(b.A.monthly),short(b.B.monthly)],['Total a cinco años',short(b.A.period),short(b.B.period)]
 ].map(row=>'<tr>'+row.map((v,i)=>i?'<td>'+esc(v)+'</td>':'<th>'+esc(v)+'</th>').join('')+'</tr>').join('')+'</tbody></table><p>El total incluye el inicial una vez, 60 meses WAN y reservas de operación.</p><p>Referencia presupuestaria: '+short(b.original)+'. El financiamiento o el alcance requieren revisión.</p>';
}
function close(){
 if(!state.active)return;
 stopTour();
 stopExample();const snapshot=state.snapshot,map=$('map-container');state.active=false;
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

function hasExample(s){return Boolean(s.demo);}
function installExamples(){
 const lab=document.createElement('section');lab.id='story-lab';lab.setAttribute('aria-label','Historia del ejemplo');document.querySelector('.client-visual').prepend(lab);
 const controls=document.createElement('div');controls.className='story-player';controls.innerHTML='<label><input id="story-autoplay" type="checkbox"> Iniciar ejemplos al avanzar</label><button id="story-pause" type="button" hidden>Pausar ejemplo</button><button id="story-step" type="button" hidden>Avanzar etapa</button><button id="story-details" type="button">Ver recorrido técnico</button>';
 document.querySelector('.client-copy').append(controls);
 $('story-autoplay').onchange=e=>state.autoplay=e.target.checked;
 $('story-pause').onclick=pauseExample;$('story-step').onclick=nextExample;
 $('story-details').onclick=()=>{const v=document.querySelector('.client-visual');v.classList.toggle('show-technical');$('story-details').textContent=v.classList.contains('show-technical')?'Ocultar recorrido técnico':'Ver recorrido técnico';zoomReset();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(state.tour)pauseTour();else if(state.example?.status==='running')pauseExample();}});
}
function renderExampleIntro(){
 document.querySelector('.story-more').open=false;document.querySelector('.story-more').hidden=['story-topology','story-policy','story-acl','story-assurance'].every(id=>$(id).hidden);const s=scene();
 document.querySelector('.client-visual').classList.toggle('has-example',hasExample(s));
 document.querySelector('.client-visual').classList.remove('show-technical');$('story-details').textContent='Ver recorrido técnico';
 $('story-replay').textContent='Empezar ejemplo';$('story-pause').hidden=true;$('story-step').hidden=true;$('story-details').hidden=s.visual!=='map'||!s.demo;
 $('story-lab').classList.remove('story-type-ha','story-type-qos','story-type-close');
 $('story-lab').innerHTML='<div class="story-lab-heading"><span class="story-live">'+(hasExample(s)?'EJEMPLO EN EL SIMULADOR':'AVANCE DEL PROYECTO')+' · '+(C5App.variant()==='B'?'ALTERNATIVA B':'ALTERNATIVA A')+'</span><span id="story-phase">'+(hasExample(s)?'Listo para empezar':'Avance del proyecto')+'</span></div><ol id="story-timeline" aria-label="Etapas del ejemplo"></ol><h2 id="story-event"></h2><p id="story-event-copy"></p><div id="story-journey" class="story-journey"></div><div id="story-evidence"></div><p id="story-takeaway"></p>';
 chapter(s.intro.title,s.intro.copy,'neutral');
 $('story-journey').innerHTML='';
 if(s.id==='finale'){
  $('story-lab').classList.add('story-type-close');$('story-map-slot').hidden=true;
  $('story-phase').textContent='Observaciones y próximos pasos';
  chapter('Un avance para recibir observaciones','La propuesta permite revisar el alcance y ajustar las decisiones antes de llevarlas a un piloto.','neutral');
  $('story-journey').innerHTML='';
  $('story-evidence').innerHTML='<div class="story-conclusions">'+[
   ['Desarrollado','Diseño, simulador, inventario y presupuesto.'],
   ['Por revisar','Alcance, prioridades y alternativa de inversión.'],
   ['Continuación','Ajustar la propuesta con las observaciones del profesor.']
  ].map(([title,copy])=>'<div><strong>'+esc(title)+'</strong><p>'+esc(copy)+'</p></div>').join('')+'</div>';
  $('story-takeaway').textContent='Muchas gracias.';
 }
}
function storyIcon(label){
 const path=/Puesto|Atención|Dispositivo|colaborador|invitado/i.test(label)?'<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M8 21v-5m8 5v-5"/>':/DC-|Aplicación|Servicios|Base|Destino/i.test(label)?'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M8 6h1m-1 6h1m-1 6h1"/>':/Salida|Conexión|Acceso|Capacidad/i.test(label)?'<path d="M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-12-1 4.5 4.5 0 0 0 0 9Z"/><path d="m10 12-2 2 2 2m4-4 2 2-2 2"/>':'<rect x="3" y="14" width="6" height="6" rx="1"/><rect x="15" y="14" width="6" height="6" rx="1"/><rect x="9" y="3" width="6" height="5" rx="1"/><path d="M12 8v3H6v3m6-3h6v3"/>';
 return '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+path+'</svg>';
}
function journey(labels,tone='neutral',bad=-1){
 $('story-journey').className='story-journey '+tone;
 $('story-journey').innerHTML=labels.map((label,i)=>'<div class="story-node '+(i===bad?'node-failed':'')+'"><span class="story-node-icon" aria-hidden="true">'+storyIcon(label)+'<small>'+['01','02','03','04'][i]+'</small></span><strong>'+esc(label)+'</strong><span class="story-node-caption">'+(i===bad?'Interrumpido':i===labels.length-1?'Destino':'Parte del camino')+'</span></div>').join('');
}
function chapter(title,copy,tone='neutral'){$('story-event').textContent=title;$('story-event-copy').textContent=copy;$('story-lab').dataset.tone=tone;}
function evidence(title,value,detail){$('story-evidence').innerHTML='<div class="story-proof"><span>'+esc(title)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></div>';}
function stopExample(){if(state.raf)cancelAnimationFrame(state.raf);state.raf=0;state.example=null;document.querySelector('.client-visual')?.classList.remove('example-paused');}
function setExamplePaused(paused){const e=state.example;if(!e||e.status==='done')return;e.status=paused?'paused':'running';e.last=performance.now();document.querySelector('.client-visual').classList.toggle('example-paused',paused);$('story-pause').textContent=paused?'Continuar ejemplo':'Pausar ejemplo';if(PACKET_ANIMATION.frame&&!PACKET_ANIMATION.done&&PACKET_ANIMATION.paused!==paused)pauseMapPing();}
function pauseExample(){if(state.tour&&state.tour.status!=='done'){toggleTour();return;}const e=state.example;if(e)setExamplePaused(e.status!=='paused');}
function nextExample(){const e=state.example;if(!e||e.status==='done')return;if(state.tour)pauseTour();clearPacketSimulation();advanceExample();if(PACKET_ANIMATION.frame&&!PACKET_ANIMATION.done&&PACKET_ANIMATION.paused)pauseMapPing();}
function advanceExample(){const e=state.example;if(!e)return;e.step++;e.elapsed=0;e.last=performance.now();if(e.step>=e.steps.length){e.status='done';$('story-phase').textContent=e.steps[0].label;$('story-pause').hidden=true;$('story-step').hidden=true;document.querySelector('.client-visual').classList.remove('example-paused');return;}
 const x=e.steps[e.step];$('story-phase').textContent=x.label;
 $('story-timeline').innerHTML=e.steps.map((step,i)=>'<li '+(i===e.step?'aria-current="step"':'')+' class="'+(i<e.step?'finished':'')+'">'+esc(step.label)+'</li>').join('');
 x.action();if(e.status==='paused'&&PACKET_ANIMATION.frame&&!PACKET_ANIMATION.done&&!PACKET_ANIMATION.paused)pauseMapPing();
}
function cleanScene(){prepare({...scene(),demo:null});}
function startExample(){
 if(!state.active||!hasExample(scene()))return;stopExample();cleanScene();const s=scene();
 if(state.tour){state.tour.phase='example';state.tour.elapsed=0;}
 $('story-evidence').innerHTML='';$('story-takeaway').textContent='';$('story-replay').textContent='Repetir ejemplo';$('story-pause').hidden=false;$('story-pause').textContent='Pausar ejemplo';$('story-step').hidden=true;
 const steps=[{label:'Conexión por Leo',duration:58000,waitPacket:true,action(){carrierStage(['starlink']);}}];
 state.example={status:'running',step:-1,steps,elapsed:0,last:performance.now(),results:[],generation:state.generation};advanceExample();
 if(state.tour?.status==='paused')setExamplePaused(true);
 function tick(now){const e=state.example;if(!e||!state.active||e.generation!==state.generation||e.status==='done')return;const modal=$('sm-overlay').classList.contains('vis')||$('dev-overlay').classList.contains('vis');if(e.status==='running'&&!document.hidden&&!modal){e.elapsed+=Math.max(0,now-e.last);const x=e.steps[e.step],duration=state.tour?1000*(scene().tourTiming.steps[x.label]??Math.max(x.duration/1000,13))/tourRate():x.duration;if(e.elapsed>=duration&&(!x.waitPacket||!PACKET_ANIMATION.frame||PACKET_ANIMATION.done))advanceExample();}e.last=now;if(e.status!=='done')state.raf=requestAnimationFrame(tick);}
 state.raf=requestAnimationFrame(tick);
}
function carrierStage(cut){
 cleanScene();for(const wan of cut)ST.links[route().source][C5Model.MW[wan]]='caido';_refresh();runDemo(false,true);
 const r=state.lastReport,wanted=cut.length<4;r.expected=wanted;r.asExpected=r.ok===wanted&&(!wanted||r.wan===['starlink','leo','entel5g','wom4g'][cut.length]);state.example.results.push(structuredClone(r));
 const labels={starlink:'Starlink',leo:'Amazon Leo',entel5g:'Entel 5G',wom4g:'WOM 4G'};
 journey(['Puesto de Arica','Red de la oficina',r.wan?labels[r.wan]:'Sin accesos','Casa Matriz'],r.ok?'flowing':'blocked',r.ok?-1:2);
 chapter(r.ok?'La sucursal continúa por '+labels[r.wan]:'La sucursal quedó sin conexión',r.ok?'Starlink está interrumpido en Arica. La nueva solicitud usa el respaldo; Casa Matriz mantiene sus conexiones.':'La continuidad por transportes termina cuando no queda ninguno. Una red local encendida no sustituye el acceso a central.',r.ok?'success':'danger');
 const app=C5App.securityTest(route().source,'app');evidence('Acceso a la aplicación central',app.ok?'Aplicación disponible':'Sin conexión',r.ok?'La aplicación sigue disponible por el enlace de respaldo.':'Cuatro transportes interrumpidos en S06; central conserva sus accesos.');
}
// A narrated tour reuses the actual examples, including their packet-completion guard.
// Its timers control presentation pacing, never recovery measurements or test results.
function installTour(){
 const bar=document.createElement('div');bar.className='story-tour';bar.setAttribute('aria-label','Recorrido automático');
 bar.innerHTML='<button id="story-tour-start" type="button">Reproducir recorrido</button><button id="story-tour-pause" type="button" hidden>Pausar recorrido</button><button id="story-tour-repeat" type="button" hidden>Repetir escena</button><button id="story-tour-stop" type="button" hidden>Modo manual</button><label>Ritmo <select id="story-tour-rate" aria-label="Ritmo del recorrido"><option value="0.75">Pausado</option><option value="1" selected>Normal</option><option value="1.5">Ágil</option></select></label><span id="story-tour-status" role="status" aria-live="polite">${story.scenes.length} escenas · tú pones la voz</span>';
 document.querySelector('.client-footer').append(bar);
 $('story-tour-start').onclick=startTour;$('story-tour-pause').onclick=toggleTour;$('story-tour-stop').onclick=stopTour;
 $('story-tour-repeat').onclick=()=>go(state.index,true);
 $('story-tour-rate').onchange=()=>{if(state.tour)state.tour.last=performance.now();};
 // Inspecting equipment must not leave the narration running in the background.
 for(const id of ['story-topology','story-policy','story-acl','story-assurance','story-details'])$(id).addEventListener('click',pauseTour);
}
function tourRate(){return Number($('story-tour-rate').value)||1;}
function renderTour(){
 if(!$('story-tour-start'))return;const t=state.tour,live=t&&t.status!=='done';
 $('presentation-overlay').classList.toggle('tour-playing',Boolean(live));
 $('story-tour-start').hidden=Boolean(live);$('story-tour-start').textContent=t?.status==='done'?'Reiniciar recorrido':'Reproducir recorrido';
 for(const id of ['story-tour-pause','story-tour-repeat','story-tour-stop'])$(id).hidden=!live;
 $('story-tour-pause').textContent=t?.status==='paused'?'Continuar recorrido':'Pausar recorrido';
 $('story-autoplay').disabled=Boolean(live);
 $('story-tour-status').textContent=!t?story.scenes.length+' escenas · lectura aproximada '+Math.ceil(story.tourEstimatedSeconds/60)+' min':t.status==='done'?'Recorrido terminado · preguntas y demostración':(t.status==='paused'?'En pausa':'En reproducción')+' · escena '+(state.index+1)+' / '+story.scenes.length;
}
function pauseTour(){const t=state.tour;if(!t||t.status!=='running')return;t.status='paused';t.last=performance.now();setExamplePaused(true);renderTour();}
function toggleTour(){
 const t=state.tour;if(!t||t.status==='done')return;
 if(t.status==='running'){pauseTour();return;}
 if(document.hidden||$('sm-overlay').classList.contains('vis')||$('dev-overlay').classList.contains('vis'))return;
 t.status='running';t.last=performance.now();setExamplePaused(false);renderTour();
}
function stopTour(){
 if(state.tourRaf)cancelAnimationFrame(state.tourRaf);state.tourRaf=0;
 if(state.tour)setExamplePaused(true);state.tour=null;renderTour();
}
function startTour(){
 if(!state.active)return;stopTour();
 const t={status:'running',phase:'intro',elapsed:0,last:performance.now()};state.tour=t;go(0,true);
 function tick(now){
  if(!state.active||state.tour!==t)return;state.tourRaf=0;
  if(document.hidden||$('sm-overlay').classList.contains('vis')||$('dev-overlay').classList.contains('vis'))pauseTour();
  if(t.status==='running'){
   t.elapsed+=Math.max(0,now-t.last)*tourRate();
   if(t.phase==='intro'){
    if(hasExample(scene())){if(t.elapsed>=scene().tourTiming.introSeconds*1000)startExample();}
    else if(scene().id==='finale'){t.status='done';renderTour();}
    else if(t.elapsed>=scene().tourTiming.introSeconds*1000)nextTourScene();
   }else if(t.phase==='example'&&state.example?.status==='done'){t.phase='outro';t.elapsed=0;}
   else if(t.phase==='outro'&&t.elapsed>=scene().tourTiming.outroSeconds*1000)nextTourScene();
  }
  t.last=now;if(t.status!=='done')state.tourRaf=requestAnimationFrame(tick);
 }
 state.tourRaf=requestAnimationFrame(tick);
}
function nextTourScene(){
 if(state.index<story.scenes.length-1){go(state.index+1,true);return;}
 state.tour.status='done';renderTour();
}

root.ClientPresentation={install,start,close,go,authorize,get active(){return state.active;},get index(){return state.index;},get report(){return state.lastReport;},startExample,pauseExample,nextExample,startTour,pauseTour,toggleTour,stopTour,get tour(){return state.tour?{status:state.tour.status,phase:state.tour.phase}:null;},get example(){return state.example?{status:state.example.status,step:state.example.step,total:state.example.steps.length,results:state.example.results}:null;}};
})(window);

