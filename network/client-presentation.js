/* Client-facing presentation using the existing map, topology and ping engine. */
(function(root){
'use strict';
if(!root.C5App)return;
const $=id=>document.getElementById(id),story=root.ClientStory;
const state={active:false,index:0,generation:0,snapshot:null,lastReport:null,mapHome:null};
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
 $('stage-next').onclick=()=>go(state.index+1);$('stage-prev').onclick=()=>go(state.index-1);$('stage-close').onclick=close;
 $('story-replay').onclick=()=>go(state.index);$('story-policy').onclick=authorize;
 const traceSlot=document.createElement('aside');traceSlot.id='story-trace-slot';traceSlot.hidden=true;document.querySelector('.client-visual').append(traceSlot);
 $('story-acl').onclick=()=>C5App.openSecurity(route().source);
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
  if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(e.key==='ArrowRight')go(state.index+1);else if(e.key==='ArrowLeft')go(state.index-1);}
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
function go(index){
 if(!state.active||index<0||index>=story.scenes.length)return;
 state.index=index;state.lastReport=null;const generation=++state.generation,s=scene();prepare(s);
 document.querySelector('.client-copy').scrollTop=0;document.querySelector('.client-body').scrollTop=0;
 $('stage-kicker').textContent=(s.mode==='antes'?'ESCENARIO ACTUAL':'PROPUESTA')+' · '+(index+1)+' / '+story.scenes.length;
 $('stage-title').textContent=s.title;$('stage-description').textContent=s.message;
 $('stage-facts').innerHTML=s.points.map(p=>'<li>'+esc(p)+'</li>').join('');
 $('story-scope').hidden=index!==0;$('story-scope').textContent=story.scope.sites+' sedes · '+story.scope.workstations+' PCs · '+story.scope.phones+' teléfonos';
 $('story-future').hidden=s.id!=='close';$('story-future').textContent='Aperturas previstas: '+story.scope.future.join(', ')+'. No incluidas en las compras actuales.';
 $('stage-progress').textContent=(index+1)+' / '+story.scenes.length;$('stage-prev').disabled=index===0;$('stage-next').disabled=index===story.scenes.length-1;
 $('story-replay').hidden=!s.demo;$('story-policy').hidden=s.id!=='security';$('story-policy').disabled=false;$('story-acl').hidden=s.id!=='security';
 $('story-topology').hidden=s.visual==='budget';
 $('story-map-slot').hidden=s.visual!=='map';$('story-diagram').hidden=s.visual!=='topology';$('story-budget').hidden=s.visual!=='budget';$('story-security').hidden=s.visual!=='security';
 traceLayout(s.visual==='map'&&Boolean(s.demo));
 $('story-result').textContent='';$('story-result').className='';
 if(s.visual==='security')securityPanel();
 if(s.visual==='topology')diagram();else if(s.visual==='budget')budget();else{zoomReset();requestAnimationFrame(()=>{if(state.active&&state.generation===generation){if(s.demo)runDemo(false);else zoomReset();}});}
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
function runDemo(authorized){
 const s=scene(),src=SEDES.find(s=>s.id===route().source),dst=SEDES.find(s=>s.id===route().destination),a=getPCs(src)[0],b=getPCs(dst)[0];
 if(ST.mode==='despues'&&(s.demo!=='security'||authorized))setPingDiagnosticRule(src.id,dst.id,a.ip,b.ip);
 const r=s.visual==='security'&&!authorized?evaluateMapPing(src.id,dst.id,a.ip,b.ip):runMapPing(src.id,dst.id,a.ip,b.ip),z=ST.mode==='despues'?C5App.status(src.id):null;
 const wanted=authorized?true:s.expectedOk;
 let matches=r.ok===wanted;
 if(s.expectedWan)matches=matches&&z.activeWan===s.expectedWan;
 if(s.expectedEdge)matches=matches&&r.route.some(n=>n.id==='site:'+src.id+':'+s.expectedEdge)&&!r.route.some(n=>n.id==='site:'+src.id+':r1');
 if(s.expectedWifi)matches=matches&&C5App.access(src.id,a).pcMode==='wifi'&&r.route.some(n=>n.kind==='ap')&&!r.route.some(n=>n.id==='site:'+src.id+':sw1');
 if(s.expectedCentral)matches=matches&&r.route.some(n=>n.id==='site:cm:'+s.expectedCentral);
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
 const snapshot=state.snapshot,map=$('map-container');state.active=false;
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
root.ClientPresentation={install,start,close,go,authorize,get active(){return state.active;},get index(){return state.index;},get report(){return state.lastReport;}};
})(window);
