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
 if(s.demo==='before-cut')ST.mpls[route().source]='caido';
 if(s.demo==='wan')C5App.fault(route().source,'upstream:starlink');
 if(s.demo==='router')C5App.fault(route().source,'r1');
 if(s.demo==='switch')C5App.fault(route().source,'sw1');
 if(s.demo==='firewall')C5App.fault('cm','fwA');
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
 const caption=document.createElement('p');caption.textContent=(ST.mode==='antes'?'ANTES · infraestructura existente común a ambas alternativas':C5App.variant()==='A'?'DESPUÉS · A · Cisco / Palo Alto':'DESPUÉS · B · MikroTik / OPNsense')+' · '+s.code+' '+s.city+'. «Ver topología» permite ampliar, arrastrar y explorar los equipos.';$('story-diagram').append(caption);
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
 const cases=['app','database','guest-internal','voice','user-mgmt','admin'].map(id=>C5App.securityTest(route().source,id));
 $('story-security').innerHTML='<p class="client-section">ACL definidas por el proyecto</p><table><thead><tr><th>Comunicación</th><th>Resultado</th></tr></thead><tbody>'+cases.map(r=>'<tr><td>'+esc(r.flow.label)+'<small>'+esc(r.flow.protocol.toUpperCase()+'/'+r.flow.port)+'</small></td><td class="'+(r.ok?'c5-policy-allow':'c5-policy-deny')+'">'+(r.policy.action==='deny'?'Bloqueado':r.ok?'Permitido':'Sin camino')+'</td></tr>').join('')+'</tbody></table><p>Cada prueba consulta la regla, las direcciones y el camino disponibles. «Explorar las ACL» permite revisar los detalles.</p>';
}
function budget(){
 const b=story.budget,full=n=>'$'+n.toLocaleString('es-CL'),short=n=>'$'+(n/1000000).toLocaleString('es-CL',{maximumFractionDigits:1})+' millones';
 $('story-budget').innerHTML='<p class="client-section">CLP · IVA incluido</p><table><thead><tr><th>Concepto</th><th>A</th><th>B</th></tr></thead><tbody>'+[['Compra inicial','initial'],['WAN mensual','monthly'],['Alcance a 60 meses','period']].map(([label,key])=>'<tr><th>'+label+'</th><td title="'+full(b.A[key])+'">'+short(b.A[key])+'</td><td title="'+full(b.B[key])+'">'+short(b.B[key])+'</td></tr>').join('')+'</tbody></table><p>Presupuesto original: '+short(b.original)+'. Las dos opciones requieren aprobación adicional.</p><p>El alcance a cinco años incluye conectividad y las reservas de operación detalladas en el presupuesto.</p><p><a href="https://github.com/hu-herrera/financiera-pacifico-entrega-docente/blob/main/02_Entregables/Entregable_7.pdf" target="_blank" rel="noopener">Consultar presupuesto y supuestos comparativos A/B · Entregable 7</a></p>';
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

function hasExample(s){return Boolean(s.demo)||s.id==='close';}
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
 $('story-lab').innerHTML='<div class="story-lab-heading"><span class="story-live">CASO ACADÉMICO · '+(C5App.variant()==='B'?'ALTERNATIVA B':'ALTERNATIVA A')+'</span><span id="story-phase">'+(hasExample(s)?'Listo para empezar':'Qué cambia y por qué')+'</span></div><ol id="story-timeline" aria-label="Etapas del ejemplo"></ol><h2 id="story-event"></h2><p id="story-event-copy"></p><div id="story-journey" class="story-journey"></div><div id="story-evidence"></div><p id="story-takeaway"></p>';
 chapter(s.intro.title,s.intro.copy,'neutral');
 $('story-journey').innerHTML='';
 if(s.id==='finale'){
  $('story-lab').classList.add('story-type-close');$('story-map-slot').hidden=true;
  $('story-phase').textContent='Conclusión · preguntas y demostración';
  chapter('Continuidad con alternativas y control','La mejora propuesta cubre fallas de enlaces y equipos, mantiene permisos por servicio y condiciona la recuperación a una copia utilizable.','neutral');
  $('story-journey').innerHTML='';
  $('story-evidence').innerHTML='<div class="story-conclusions">'+[
   ['Conectividad','Otra salida ante la pérdida de un proveedor o router.'],
   ['Seguridad','Aplicación, voz, invitados y gestión con permisos propios.'],
   ['Recuperación','Host alternativo, mayoría, aislamiento y réplica utilizable.']
  ].map(([title,copy])=>'<div><strong>'+esc(title)+'</strong><p>'+esc(copy)+'</p></div>').join('')+'</div>';
  $('story-takeaway').textContent='Gracias. Abrimos las preguntas y las pruebas sobre el simulador.';
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
function advanceExample(){const e=state.example;if(!e)return;e.step++;e.elapsed=0;e.last=performance.now();if(e.step>=e.steps.length){e.status='done';$('story-phase').textContent='Ejemplo terminado';$('story-pause').hidden=true;$('story-step').hidden=true;document.querySelector('.client-visual').classList.remove('example-paused');return;}
 const x=e.steps[e.step];$('story-phase').textContent=(e.step+1)+' / '+e.steps.length+' · '+x.label;
 $('story-timeline').innerHTML=e.steps.map((step,i)=>'<li '+(i===e.step?'aria-current="step"':'')+' class="'+(i<e.step?'finished':'')+'">'+esc(step.label)+'</li>').join('');
 x.action();if(e.status==='paused'&&PACKET_ANIMATION.frame&&!PACKET_ANIMATION.done&&!PACKET_ANIMATION.paused)pauseMapPing();
}
function cleanScene(){prepare({...scene(),demo:null});}
function networkStage(baseline){
 cleanScene();if(!baseline){const s=scene();if(s.demo==='before-cut')ST.mpls[route().source]='caido';else if(s.demo==='wan')C5App.fault(route().source,'upstream:starlink');else if(s.demo==='router')C5App.fault(route().source,'r1');else if(s.demo==='switch')C5App.fault(route().source,'sw1');else if(s.demo==='firewall')C5App.fault('cm','fwA');_refresh();}
 runDemo(false,baseline);const r=state.lastReport,s=scene();state.example.results.push(structuredClone(r));
 const active=r.route.filter(n=>['router','firewall','ap'].includes(n.kind)).map(n=>n.label).slice(0,4).join(' · ');
 const after=s.mode==='despues'?C5App.securityTest(route().source,'app'):null;
 journey(['Puesto de Arica',s.demo==='switch'&&!baseline?'Wi-Fi de emergencia':'Red de la oficina',r.ok?(r.wan==='leo'?'Salida Amazon Leo':s.mode==='antes'?'Acceso MPLS':'Salida disponible'):'Acceso MPLS caído','Casa Matriz'],r.ok?'flowing':'blocked',r.ok?-1:2);
 evidence('Diagnóstico de conectividad',r.ok?'Camino disponible':'Sin camino',active||'La solicitud no tiene una alternativa elegible.');
 if(after){const box=document.createElement('p');box.className='story-service-check';box.textContent='Aplicación HTTPS: '+(after.ok?'permitida y alcanzable en el modelo':after.reason);$('story-evidence').append(box);}
 chapter(baseline?'Primero: la conexión funciona':r.ok?'Una nueva comunicación encuentra otro camino':'Ahora: la oficina pierde su único acceso',baseline?'Observa la solicitud y la respuesta en el mapa. El ejemplo espera a que termine su recorrido.':r.ok?'El camino se calcula con el fallo aplicado. El cambio no concede permisos adicionales.':'Los equipos locales pueden seguir encendidos. La comunicación con central queda interrumpida.',r.ok?'success':'danger');
}
function startExample(){
 if(!state.active||!hasExample(scene()))return;stopExample();cleanScene();const s=scene();
 if(state.tour){state.tour.phase='example';state.tour.elapsed=0;}
 $('story-evidence').innerHTML='';$('story-takeaway').textContent='';$('story-replay').textContent='Repetir ejemplo';$('story-pause').hidden=false;$('story-pause').textContent='Pausar ejemplo';$('story-step').hidden=false;
 let steps;
 if(s.id==='security')steps=securitySteps();else if(s.id==='close')steps=qosSteps();else {
 steps=[{label:'Situación',duration:3500,action(){chapter(s.intro.title,s.intro.copy);journey(['Puesto de Arica','Red de la oficina','Acceso a central','Destino']);}},
 {label:'Camino inicial',duration:2500,waitPacket:true,action(){networkStage(true);}},
 {label:s.demo==='before-ok'?'Solicitud y respuesta':'Fallo y respuesta',duration:4500,waitPacket:true,action(){networkStage(false);}},
 {label:'Qué aprendemos',duration:6000,action(){const r=state.lastReport;chapter(r.asExpected?'El resultado coincide con el escenario':'El resultado necesita revisión',s.mode==='antes'?'Una conexión única puede dejar a la sucursal esperando. Agregar otra salida debe acompañarse de equipos y políticas coherentes.':s.id==='switch'?'El puesto necesita un medio alternativo y un AP con sus dependencias disponibles.':s.id==='router'?'Otra conexión y otro router cubren fallos distintos. La nueva ruta evita R1 apagado.':s.id==='firewall'?'El firewall alternativo conserva el control de accesos. Ahora revisaremos también los servidores.':'Con uno, dos o tres proveedores caídos se conserva un camino mientras el resto de las dependencias esté disponible. Al perder los cuatro accesos, la comunicación central se interrumpe.',r.asExpected?'success':'danger');$('story-takeaway').textContent='El ping comprueba un camino del modelo. El acceso a la aplicación se evalúa por separado.';}}];
 if(s.id==='wan'){steps[2].action=()=>carrierStage(['starlink']);steps.splice(3,0,{label:'Satelitales caídos',duration:4500,waitPacket:true,action:()=>carrierStage(['starlink','leo'])},{label:'Último respaldo',duration:4500,waitPacket:true,action:()=>carrierStage(['starlink','leo','entel5g'])},{label:'Sin ningún acceso',duration:5000,action:()=>carrierStage(['starlink','leo','entel5g','wom4g'])});}
 if(s.id==='before-ok')steps.splice(2,1);if(s.id==='firewall')steps.push(...haSteps());
 }
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
 chapter(r.ok?'Permanece un camino por '+labels[r.wan]:'Se agotaron los cuatro accesos',r.ok?'La pérdida de transportes afecta solo a S06. Central conserva sus accesos y el modelo encuentra una nueva ruta.':'La continuidad por transportes termina cuando no queda ninguno. Una red local encendida no sustituye el acceso a central.',r.ok?'success':'danger');
 const app=C5App.securityTest(route().source,'app');evidence('Acceso a la aplicación central',app.ok?'Permitido y alcanzable':'Sin camino',r.ok?(r.wan==='leo'?'Respaldo satelital: la capacidad disponible limita la concurrencia.':'Respaldo móvil: la capacidad disponible limita la concurrencia.'):'Cuatro transportes interrumpidos en S06; central conserva sus accesos.');
}
function securitySteps(){
 const list=[['app','La colaboradora abre la aplicación','APP por HTTPS es el acceso necesario para atender al cliente.'],['database','El puesto intenta entrar directamente a la base','La aplicación tiene un permiso distinto del computador del colaborador.'],['guest-internal','Un invitado intenta acceder a la intranet','La red de invitados conserva Internet y separa los recursos internos.']];
 return list.map(([id,title,copy])=>({label:id==='app'?'Trabajo autorizado':id==='database'?'Acceso restringido':'Invitado aislado',duration:6500,action(){cleanScene();const r=C5App.securityTest(route().source,id);state.example.results.push({case:id,ok:r.ok,action:r.policy.action,reachable:r.reachable});securityPanel();$('story-security').querySelectorAll('tbody tr').forEach(tr=>tr.classList.toggle('story-row-current',tr.textContent.includes(r.flow.label)));chapter(title,copy,r.ok?'success':'danger');journey([id==='guest-internal'?'Dispositivo invitado':'Puesto colaborador','Reglas de acceso',id==='database'?'Base de datos':'Aplicación central','Decisión del modelo'],r.ok?'flowing':'blocked',r.ok?-1:1);if(!r.ok&&r.policy.action==='deny')$('story-journey').querySelector('.node-failed .story-node-caption').textContent='Acceso denegado';evidence(r.flow.label,r.ok?'Permitido y alcanzable':r.policy.action==='deny'?'Bloqueado por política':'Sin camino',r.policy.id+' · '+r.flow.protocol.toUpperCase()+'/'+r.flow.port);$('story-result').textContent=r.reason;state.lastReport={scene:'security',ok:r.ok,expected:id==='app',asExpected:id==='app'?r.ok:r.policy.action==='deny',policy:r.policy};}}));
}
function recoveryChapter(scenario,title,copy,kind='summary'){
 cleanScene();const r=C5App.recoveryExercise({scenario});C5App.state('cm').faults=[...r.faults];_refresh();
 $('story-map-slot').hidden=true;traceLayout(false);$('story-lab').classList.add('story-type-ha');$('story-details').hidden=true;
 const app=C5App.securityTest(route().source,'app');
 state.example.results.push({case:'recovery',...r,httpsAvailable:app.ok});
 chapter(title,copy,r.eligible?'success':'warning');
 journey(['DC-01: caído',scenario==='both'?'DC-02: caído':'DC-02: alternativo','Mayoría: '+r.votes+'/3',r.eligible?'Datos y aplicación':'Revisión necesaria'],r.eligible?'success':'blocked',r.eligible?-1:3);
 $('story-journey').classList.add('ha-nodes');
 if(kind==='data'){
  $('story-evidence').innerHTML='<div class="story-recovery-stats"><div><span>Réplica completada</span><strong>t='+r.selectedReplica.second+' s</strong></div><div><span>Servidor falla</span><strong>t='+r.failureSecond+' s</strong></div><div><span>Ventana sin replicar</span><strong>'+r.replicaAgeSeconds+' s</strong></div></div><p class="story-recovery-label">'+r.operationCount+' operaciones generadas durante la ejecución · solo se usa una réplica completada</p><div class="story-ledger">'+[...r.inReplica.slice(-2).map(t=>({...t,present:true})),...r.reconcile.map(t=>({...t,present:false}))].map(t=>'<div class="'+(t.present?'present':'reconcile')+'"><span>'+esc(t.id)+'</span><span>t='+t.second+' s</span><strong>'+(t.present?'En la réplica':'Por conciliar')+'</strong></div>').join('')+'</div><p class="story-recovery-label">'+r.inReplica.length+' operaciones presentes · '+r.reconcile.length+' requieren conciliación</p>';
 }else if(kind==='checks'){
  $('story-evidence').innerHTML='<ol class="story-recovery-checks">'+r.checks.map(c=>'<li><span aria-hidden="true">'+(c.ok?'✓':'!')+'</span>'+esc(c.label)+'</li>').join('')+'</ol><p class="story-recovery-label">Redes comprueba el camino. Sistemas valida aplicación y datos. Operación autoriza la reapertura.</p>';
 }else evidence('Decisión del modelo',r.eligible?'Recuperación elegible':'Recuperación bloqueada',r.checks.filter(c=>!c.ok).map(c=>c.label).join(' · '));
 $('story-result').textContent='Aplicación HTTPS: '+(app.ok?'permitida y alcanzable en el modelo':'sin servicio en este escenario')+'.';
 $('story-takeaway').textContent=kind==='data'?r.reconcile.length+' operaciones requieren conciliación antes de reintentar; sus identificadores evitan duplicados.':kind==='checks'?'Nosotros entregamos preparación y procedimientos. La financiera administra y ejecuta la recuperación.':'Resultado de esta ejecución: recuperación '+(r.rtoSimulatedSeconds===null?'bloqueada':r.rtoSimulatedSeconds+' s')+'; RPO '+(r.rpoSimulatedSeconds===null?'no verificable':r.rpoSimulatedSeconds+' s')+' de tiempo virtual.';
 state.lastReport={scene:'firewall',ok:app.ok,expected:r.eligible,asExpected:app.ok===r.eligible,recovery:r};
}
function haSteps(){
 const auditStep=(i,k)=>({label:['Servidor alternativo','Sin mayoría','Aislamiento seguro','Datos disponibles','Límite del sitio'][k],duration:6500,action(){
  cleanScene();const audit=C5App.recoveryAudit(),r=audit.rows[i];C5App.state('cm').faults=[...r.faults];_refresh();
  $('story-map-slot').hidden=true;traceLayout(false);$('story-lab').classList.add('story-type-ha');$('story-result').textContent='';$('story-details').hidden=true;
  state.example.results.push({case:'ha',...r});
  chapter(r.label,i===0?'La aplicación y la BD pueden reiniciarse en DC-02. Internet y la recuperación del servicio son comprobaciones distintas.':i===3?'Sin mayoría no se reinician servicios: evitamos decisiones contradictorias.':i===4?'Antes de reiniciar, debe confirmarse que el host fallado quedó aislado.':i===5?'Sin una réplica utilizable, el modelo bloquea el reinicio automático.':'Si perdemos ambos hosts no queda dónde ejecutar la aplicación. Una copia guardada no sustituye a un servidor disponible.',r.applicationHost?'success':'warning');
  journey(['DC-01: caído',r.faults.includes('dc2')?'DC-02: caído':'DC-02: superviviente','Mayoría: '+r.votes+' votos',r.applicationHost?'Aplicación en '+r.applicationHost.toUpperCase():'Aplicación detenida'],r.applicationHost?'success':'blocked',r.applicationHost?-1:3);$('story-journey').classList.add('ha-nodes');
  evidence('Dependencias de recuperación',r.applicationHost?'Aplicación elegible en '+r.applicationHost.toUpperCase():'Recuperación bloqueada',r.pass?'El modelo cumple la condición de este escenario.':'La comprobación no coincide con lo esperado.');
  $('story-takeaway').textContent='Objetivos del diseño: RTO 300 s y RPO 60 s. El ejercicio calcula sus resultados sobre eventos del reloj virtual.';
 }});
 return [auditStep(0,0),
  {label:'Qué datos vuelven',duration:12000,action(){recoveryChapter('host','¿Qué información conserva el servidor alternativo?','La ejecución genera operaciones, inicia réplicas y registra su finalización antes de aplicar la caída de DC-01. Las operaciones posteriores a la copia requieren conciliación.','data');}},
  {label:'Antes de reabrir',duration:10000,action(){recoveryChapter('host','Recuperar exige comprobar el servicio','El camino responde, pero también verificamos mayoría, aislamiento, copia y aplicación. Los resultados proceden de las comprobaciones y eventos de esta ejecución.','checks');}},
  {label:'Réplica antigua',duration:8500,action(){recoveryChapter('stale','Una copia antigua no cumple el objetivo','Seleccionamos una copia anterior al objetivo de antigüedad. La recuperación se bloquea y exige revisar la pérdida potencial.');}},
  {label:'Copia inconsistente',duration:8500,action(){recoveryChapter('corrupt','Una copia reciente también puede estar dañada','El modelo bloquea el reinicio. El administrador debe buscar una copia válida, restaurarla en aislamiento y comprobar aplicación y datos antes de reabrir.');}},
  auditStep(7,4)];
}

function qosSteps(){
 $('story-lab').classList.add('story-type-qos');$('story-map-slot').hidden=true;$('story-diagram').hidden=true;traceLayout(false);
 const demand={VOICE:1.5,FINANCIAL:4,CONTROL:.5,BULK:5,DEFAULT:9},names={VOICE:'Voz',FINANCIAL:'Aplicación financiera',CONTROL:'Servicios básicos',BULK:'Copias',DEFAULT:'Tráfico general'};
 return [{label:'Demanda concurrente',duration:5000,action(){chapter('Varias tareas compiten por el mismo respaldo','Voz, aplicación, servicios, copias y tráfico general ofrecen 20 Mbps. La subida elegida para este ejemplo es 10 Mbps.');journey(['Atención al cliente','Voz y servicios','Copias y navegación','Capacidad compartida']);$('story-journey').classList.add('ha-nodes');$('story-journey').querySelectorAll('.story-node-caption').forEach(el=>el.textContent='Tarea concurrente');evidence('Supuesto de este ejemplo','20 Mbps solicitados / 10 Mbps de subida','Son valores didácticos, no una medición del proveedor.');}},
 {label:'Reparto por prioridad',duration:10000,action(){const site=C5App.site(route().source),r=C5Security.qosAllocation(site,'leo',demand,10);state.example.results.push({case:'qos',...r});chapter('La prioridad reserva capacidad para atender','Reservamos el 90 % de esa subida: 9 Mbps para repartir. La aplicación y voz reciben lo solicitado; las tareas grandes reciben menos y deben esperar.','success');$('story-evidence').innerHTML='<div class="story-qos">'+r.rows.map(row=>'<div><span>'+esc(names[row.id])+'</span><div class="story-bar"><i style="width:'+Math.min(100,row.offeredMbps/9*100)+'%"></i><b style="width:'+Math.min(100,row.allocatedMbps/9*100)+'%"></b></div><strong>'+row.allocatedMbps.toFixed(1)+' / '+row.offeredMbps+' Mbps</strong></div>').join('')+'</div><p class="story-chart-key">Barra tenue: demanda · barra sólida: capacidad asignada</p>';evidenceQosResult(r);}},
 {label:'Operación degradada',duration:7000,action(){chapter('El respaldo conserva prioridades y exige límites','En contingencia se suspende el video y se posponen copias. QoS reparte capacidad; no crea más ancho de banda.','warning');$('story-takeaway').textContent='En operación normal: hasta 30 terminales remotos y 3 centrales con video, respetando límites por sede. El diseño se recalcula antes de crecer.';}}];
}
function evidenceQosResult(r){state.lastReport={scene:'close',ok:r.status==='SIMULADO',asExpected:r.congested&&Math.abs(r.shaperMbps-9)<1e-6,qos:r};$('story-result').textContent='Resultado calculado: '+r.shaperMbps+' Mbps disponibles. Congestión: '+(r.congested?'sí':'no')+'.';}

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

