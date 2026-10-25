/* Client-facing presentation using the existing map, topology and ping engine. */
(function(root){
'use strict';
if(!root.C5App)return;
const $=id=>document.getElementById(id),story=root.ClientStory;
const state={active:false,index:0,generation:0,snapshot:null,lastReport:null,mapHome:null,example:null,raf:0,autoplay:true};
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
 const assurance=document.createElement('button');assurance.id='story-assurance';assurance.type='button';assurance.textContent='QoS / VPN / HA';assurance.onclick=()=>{openSedeModal(route().source);smTab('assurance',document.querySelector('[data-c5-assurance]'));};document.querySelector('.client-actions').append(assurance);
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
 const more=document.createElement('details');more.className='story-more';more.innerHTML='<summary>Explorar detalles</summary>';document.querySelector('.client-actions').append(more);for(const id of ['story-topology','story-policy','story-acl','story-assurance'])more.append($(id));
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
 stopExample();state.index=index;state.lastReport=null;const generation=++state.generation,s=scene();prepare(s);
 document.querySelector('.client-copy').scrollTop=0;document.querySelector('.client-body').scrollTop=0;
 $('stage-kicker').textContent=(s.mode==='antes'?'ESCENARIO ACTUAL':'PROPUESTA')+' · '+(index+1)+' / '+story.scenes.length;
 $('stage-title').textContent=s.title;$('stage-description').textContent=s.message;
 $('stage-facts').innerHTML=s.points.map(p=>'<li>'+esc(p)+'</li>').join('');
 $('story-scope').hidden=index!==0;$('story-scope').textContent=story.scope.sites+' sedes · '+story.scope.workstations+' PCs · '+story.scope.phones+' teléfonos';
 $('story-future').hidden=s.id!=='close';$('story-future').textContent='Aperturas previstas: '+story.scope.future.join(', ')+'. No incluidas en las compras actuales.';
 $('stage-progress').textContent=(index+1)+' / '+story.scenes.length;$('stage-prev').disabled=index===0;$('stage-next').disabled=false;$('stage-next').textContent=index===story.scenes.length-1?'Finalizar presentación':'Siguiente diapositiva';
 $('story-replay').hidden=!hasExample(s);$('story-policy').hidden=s.id!=='security';$('story-policy').disabled=false;$('story-acl').hidden=s.id!=='security';
 $('story-topology').hidden=s.visual==='budget';$('story-assurance').hidden=!['proposal','security','close'].includes(s.id);
 $('story-map-slot').hidden=s.visual!=='map';$('story-diagram').hidden=s.visual!=='topology';$('story-budget').hidden=s.visual!=='budget';$('story-security').hidden=s.visual!=='security';
 traceLayout(s.visual==='map'&&Boolean(s.demo));
 $('story-result').textContent='';$('story-result').className='';
 renderExampleIntro();
 if(s.visual==='security')securityPanel();
 if(hasExample(s)&&state.autoplay)requestAnimationFrame(()=>{if(state.active&&state.generation===generation)startExample();});
 if(s.visual==='topology')diagram();else if(s.visual==='budget')budget();else{zoomReset();requestAnimationFrame(()=>{if(state.active&&state.generation===generation){zoomReset();}});}
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

const explanations={
 context:['Una atención depende de la conexión','Una ejecutiva necesita consultar el sistema central para atender a un cliente. Vamos a observar qué ocurre cuando el camino falla.','Seguiremos una solicitud desde la oficina hasta central.','Cada cambio debe reducir una dependencia concreta.'],
 'before-ok':['La oficina puede trabajar mientras el camino está disponible','El computador de Arica se comunica con Punta Arenas a través de la red central. Este diagnóstico nos permite seguir la conexión.','Una sola salida alcanza para funcionar en este momento.','La prueba todavía no demuestra qué ocurriría ante una falla.'],
 'before-cut':['Un corte deja a la oficina sin alternativa','La ejecutiva conserva su computador encendido, pero una atención que depende de central debe esperar. Cortaremos el único acceso de la sucursal.','El problema es la falta de otro camino.','La red local puede seguir disponible sin acceso a central.'],
 diagnosis:['Más Internet no resuelve todas las fallas','Un acceso, un router y un switch sostienen el camino de la sucursal. Si falla una pieza sin alternativa, puede interrumpir el trabajo.','El enlace transporta la comunicación.','El router elige por dónde enviarla; el switch conecta los puestos.'],
 proposal:['Cada equipo adicional cubre una dependencia','Dos routers conectan los puestos con dos grupos de accesos. Los firewalls de central controlan los permisos antes de llegar a los servicios.','Otra conexión cubre la pérdida de un transporte.','Otro router cubre la pérdida del equipo que lo utiliza.'],
 wan:['La oficina encuentra otra salida','El proveedor principal deja de llegar al destino, aunque su terminal siga conectado. Observaremos primero el camino normal y después el respaldo.','La nueva comunicación debe evitar el transporte averiado.','El respaldo conserva prioridades, con menor capacidad disponible.'],
 router:['La segunda salida también necesita otro router','Ahora la falla está dentro de nuestra red: apagaremos R1. R2 debe poder utilizar sus propios enlaces para dar salida al puesto.','Dos proveedores sobre un router único conservan una dependencia.','La prueba comprueba una nueva comunicación por R2.'],
 switch:['El puesto cambia de medio para seguir conectado','Apagaremos el switch del puesto. Su cable deja de servir; el PC puede usar el acceso Wi-Fi de emergencia del switch superviviente.','El AP conecta por radio; no repara el cable averiado.','El teléfono necesita su propia radio y alimentación.'],
 security:['Conectarse no concede acceso a todo','Una colaboradora necesita la aplicación financiera. Un invitado y un acceso directo a la base de datos requieren resultados distintos. Probaremos los tres casos.','La aplicación puede consultar la base de datos.','El computador del colaborador no recibe ese mismo permiso.'],
 firewall:['Conexión y aplicación necesitan respaldos distintos','Primero perderemos un firewall central. Después veremos cómo el modelo decide si puede recuperar la aplicación tras perder un servidor.','El firewall controla accesos; el servidor ejecuta los servicios.','La recuperación necesita datos utilizables y una decisión segura.'],
 investment:['Dos alternativas para el mismo problema','Comparamos la inversión inicial y el alcance de cinco años. La decisión considera equipos, licencias, soporte y capacidad de operación.','A combina Cisco y Palo Alto. B utiliza MikroTik y OPNsense.','Ambas superan los 160 millones de referencia.'],
 close:['En contingencia elegimos qué trabajo atender primero','Una copia grande puede competir con la atención financiera y la voz. El ejemplo muestra cómo se reparte un respaldo limitado.','QoS distribuye la capacidad disponible; no la aumenta.','Video: hasta 30 terminales remotos y 3 centrales en operación normal; se suspende en contingencia.']
};
function hasExample(s){return Boolean(s.demo)||s.id==='close';}
function installExamples(){
 const lab=document.createElement('section');lab.id='story-lab';lab.setAttribute('aria-label','Historia del ejemplo');document.querySelector('.client-visual').prepend(lab);
 const controls=document.createElement('div');controls.className='story-player';controls.innerHTML='<label><input id="story-autoplay" type="checkbox" checked> Iniciar ejemplos al avanzar</label><button id="story-pause" type="button" hidden>Pausar ejemplo</button><button id="story-step" type="button" hidden>Avanzar etapa</button><button id="story-details" type="button">Ver recorrido técnico</button>';
 document.querySelector('.client-copy').append(controls);
 $('story-autoplay').onchange=e=>state.autoplay=e.target.checked;
 $('story-pause').onclick=pauseExample;$('story-step').onclick=nextExample;
 $('story-details').onclick=()=>{const v=document.querySelector('.client-visual');v.classList.toggle('show-technical');$('story-details').textContent=v.classList.contains('show-technical')?'Ocultar recorrido técnico':'Ver recorrido técnico';zoomReset();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.example?.status==='running')pauseExample();});
}
function renderExampleIntro(){
 document.querySelector('.story-more').open=false;document.querySelector('.story-more').hidden=['story-topology','story-policy','story-acl','story-assurance'].every(id=>$(id).hidden);const s=scene(),a=explanations[s.id];$('stage-title').textContent=a[0];$('stage-description').textContent=a[1];$('stage-facts').innerHTML=a.slice(2).map(p=>'<li>'+esc(p)+'</li>').join('');
 document.querySelector('.client-visual').classList.toggle('has-example',hasExample(s));
 document.querySelector('.client-visual').classList.remove('show-technical');$('story-details').textContent='Ver recorrido técnico';
 $('story-replay').textContent='Empezar ejemplo';$('story-pause').hidden=true;$('story-step').hidden=true;$('story-details').hidden=s.visual!=='map'||!s.demo;
 $('story-lab').classList.remove('story-type-ha','story-type-qos');
 $('story-lab').innerHTML='<div class="story-lab-heading"><span class="story-live">CASO ACADÉMICO · '+(C5App.variant()==='B'?'ALTERNATIVA B':'ALTERNATIVA A')+'</span><span id="story-phase">'+(hasExample(s)?'Listo para empezar':'Qué cambia y por qué')+'</span></div><ol id="story-timeline" aria-label="Etapas del ejemplo"></ol><h2 id="story-event">Una solicitud necesita un camino completo</h2><p id="story-event-copy">Oficina, conexión y servicios centrales dependen unos de otros.</p><div id="story-journey" class="story-journey"></div><div id="story-evidence"></div><p id="story-takeaway"></p>';
 journey(['Puesto de trabajo','Red de la oficina','Conexión disponible','Servicios centrales']);
 if(s.id==='context')chapter('Una persona espera una respuesta','El recorrido inferior permite ubicar las 23 sedes del diseño. Las seis aperturas futuras se evalúan por separado.','neutral');
 if(s.id==='diagnosis')chapter('Tres funciones, tres dependencias','El switch conecta los puestos. El router da salida. El enlace comunica la oficina con central.','neutral');
 if(s.id==='proposal')chapter('La propuesta agrega alternativas con una función','El dibujo muestra conexiones propias para conservar otro camino cuando falla una pieza.','neutral');
 if(s.id==='investment')chapter('La inversión se compara con un horizonte común','Los totales incluyen el desembolso inicial una vez y separan conectividad y reserva operativa.','neutral');
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
function pauseExample(){const e=state.example;if(!e||e.status==='done')return;e.status=e.status==='paused'?'running':'paused';e.last=performance.now();document.querySelector('.client-visual').classList.toggle('example-paused',e.status==='paused');$('story-pause').textContent=e.status==='paused'?'Continuar ejemplo':'Pausar ejemplo';if(PACKET_ANIMATION.frame&&!PACKET_ANIMATION.done&&PACKET_ANIMATION.paused!==(e.status==='paused'))pauseMapPing();}
function nextExample(){const e=state.example;if(!e||e.status==='done')return;clearPacketSimulation();advanceExample();}
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
 $('story-evidence').innerHTML='';$('story-takeaway').textContent='';$('story-replay').textContent='Repetir ejemplo';$('story-pause').hidden=false;$('story-pause').textContent='Pausar ejemplo';$('story-step').hidden=false;
 let steps;
 if(s.id==='security')steps=securitySteps();else if(s.id==='close')steps=qosSteps();else {
 steps=[{label:'Situación',duration:3500,action(){chapter('Una oficina necesita comunicarse','Comparamos la misma solicitud antes y después del fallo. La animación representa el modelo, sin cronometrar recuperación real.');journey(['Puesto de Arica','Red de la oficina','Acceso a central','Destino']);}},
 {label:'Camino inicial',duration:2500,waitPacket:true,action(){networkStage(true);}},
 {label:s.demo==='before-ok'?'Solicitud y respuesta':'Fallo y respuesta',duration:4500,waitPacket:true,action(){networkStage(false);}},
 {label:'Qué aprendemos',duration:6000,action(){const r=state.lastReport;chapter(r.asExpected?'El resultado coincide con el escenario':'El resultado necesita revisión',s.mode==='antes'?'Una conexión única puede dejar a la sucursal esperando. Agregar otra salida debe acompañarse de equipos y políticas coherentes.':s.id==='switch'?'El puesto necesita un medio alternativo y un AP con sus dependencias disponibles.':s.id==='router'?'Otra conexión y otro router cubren fallos distintos. La nueva ruta evita R1 apagado.':s.id==='firewall'?'El firewall alternativo conserva el control de accesos. Ahora revisaremos también los servidores.':'Con uno, dos o tres proveedores caídos se conserva un camino mientras el resto de las dependencias esté disponible. Al perder los cuatro accesos, la comunicación central se interrumpe.',r.asExpected?'success':'danger');$('story-takeaway').textContent='El ping comprueba un camino del modelo. El acceso a la aplicación se evalúa por separado.';}}];
 if(s.id==='wan'){steps[2].action=()=>carrierStage(['starlink']);steps.splice(3,0,{label:'Satelitales caídos',duration:4500,waitPacket:true,action:()=>carrierStage(['starlink','leo'])},{label:'Último respaldo',duration:4500,waitPacket:true,action:()=>carrierStage(['starlink','leo','entel5g'])},{label:'Sin ningún acceso',duration:5000,action:()=>carrierStage(['starlink','leo','entel5g','wom4g'])});}
 if(s.id==='before-ok')steps.splice(2,1);if(s.id==='firewall')steps.push(...haSteps());
 }
 state.example={status:'running',step:-1,steps,elapsed:0,last:performance.now(),results:[],generation:state.generation};advanceExample();
 function tick(now){const e=state.example;if(!e||!state.active||e.generation!==state.generation||e.status==='done')return;const modal=$('sm-overlay').classList.contains('vis')||$('dev-overlay').classList.contains('vis');if(e.status==='running'&&!document.hidden&&!modal){e.elapsed+=Math.max(0,now-e.last);const x=e.steps[e.step];if(e.elapsed>=x.duration&&(!x.waitPacket||!PACKET_ANIMATION.frame||PACKET_ANIMATION.done))advanceExample();}e.last=now;if(e.status!=='done')state.raf=requestAnimationFrame(tick);}
 state.raf=requestAnimationFrame(tick);
}
function carrierStage(cut){
 cleanScene();for(const sede of SEDES)for(const wan of cut)ST.links[sede.id][C5Model.MW[wan]]='caido';_refresh();runDemo(false,true);
 const r=state.lastReport,wanted=cut.length<4;r.expected=wanted;r.asExpected=r.ok===wanted&&(!wanted||r.wan===['starlink','leo','entel5g','wom4g'][cut.length]);state.example.results.push(structuredClone(r));
 const labels={starlink:'Starlink',leo:'Amazon Leo',entel5g:'Entel 5G',wom4g:'WOM 4G'};
 journey(['Puesto de Arica','Red de la oficina',r.wan?labels[r.wan]:'Sin accesos','Casa Matriz'],r.ok?'flowing':'blocked',r.ok?-1:2);
 chapter(r.ok?'Permanece un camino por '+labels[r.wan]:'Se agotaron los cuatro accesos',r.ok?'La misma pérdida de proveedores se aplica a central y sucursales. El modelo encuentra una nueva ruta.':'La continuidad por transportes termina cuando no queda ninguno. Una red local encendida no sustituye el acceso a central.',r.ok?'success':'danger');
 const app=C5App.securityTest(route().source,'app');evidence('Acceso a la aplicación central',app.ok?'Permitido y alcanzable':'Sin camino',r.ok?'Respaldo móvil: la capacidad disponible limita la concurrencia.':'Cuatro proveedores interrumpidos en ambos extremos.');
}
function securitySteps(){
 const list=[['app','La colaboradora abre la aplicación','APP por HTTPS es el acceso necesario para atender al cliente.'],['database','El puesto intenta entrar directamente a la base','La aplicación tiene un permiso distinto del computador del colaborador.'],['guest-internal','Un invitado intenta acceder a la intranet','La red de invitados conserva Internet y separa los recursos internos.']];
 return list.map(([id,title,copy])=>({label:id==='app'?'Trabajo autorizado':id==='database'?'Acceso restringido':'Invitado aislado',duration:6500,action(){cleanScene();const r=C5App.securityTest(route().source,id);state.example.results.push({case:id,ok:r.ok,action:r.policy.action,reachable:r.reachable});securityPanel();$('story-security').querySelectorAll('tbody tr').forEach(tr=>tr.classList.toggle('story-row-current',tr.textContent.includes(r.flow.label)));chapter(title,copy,r.ok?'success':'danger');journey([id==='guest-internal'?'Dispositivo invitado':'Puesto colaborador','Reglas de acceso',id==='database'?'Base de datos':'Aplicación central','Decisión del modelo'],r.ok?'flowing':'blocked',r.ok?-1:1);if(!r.ok&&r.policy.action==='deny')$('story-journey').querySelector('.node-failed .story-node-caption').textContent='Acceso denegado';evidence(r.flow.label,r.ok?'Permitido y alcanzable':r.policy.action==='deny'?'Bloqueado por política':'Sin camino',r.policy.id+' · '+r.flow.protocol.toUpperCase()+'/'+r.flow.port);$('story-result').textContent=r.reason;state.lastReport={scene:'security',ok:r.ok,expected:id==='app',asExpected:id==='app'?r.ok:r.policy.action==='deny',policy:r.policy};}}));
}
function haSteps(){return [0,3,4,5,7].map((i,k)=>({label:['Servidor alternativo','Sin mayoría','Aislamiento seguro','Datos disponibles','Límite del sitio'][k],duration:6500,action(){$('story-map-slot').hidden=true;traceLayout(false);$('story-lab').classList.add('story-type-ha');$('story-result').textContent='';$('story-details').hidden=true;const audit=C5App.recoveryAudit(),r=audit.rows[i];state.example.results.push({case:'ha',...r});chapter(r.label,i===0?'El modelo permite recuperar la aplicación en el host superviviente con datos, mayoría y aislamiento.':i===3?'Dos hosts sin mayoría no deben asumir que pueden iniciar la misma aplicación.':i===4?'Fencing significa aislar al host fallado antes de reiniciar su servicio en otro.':i===5?'Sin copia utilizable de los datos, el modelo bloquea la recuperación.':'Perder los dos hosts interrumpe los servicios. La redundancia dentro del edificio no resuelve la pérdida de toda central.',r.applicationHost?'success':'warning');journey(['DC-01: caído',r.faults.includes('dc2')?'DC-02: caído':'DC-02: superviviente','Mayoría: '+r.votes+' votos',r.applicationHost?'Aplicación en '+r.applicationHost.toUpperCase():'Aplicación detenida'],r.applicationHost?'success':'blocked',r.applicationHost?-1:3);$('story-journey').classList.add('ha-nodes');evidence('Dependencias de recuperación',r.applicationHost?'Aplicación elegible en '+r.applicationHost.toUpperCase():'Recuperación bloqueada',r.pass?'El modelo cumple la condición de este escenario.':'La comprobación no coincide con lo esperado.');$('story-takeaway').textContent='Objetivos del diseño: RTO 300 s y RPO 60 s. No son tiempos medidos ni continuidad de sesiones.';}}));}
function qosSteps(){
 $('story-lab').classList.add('story-type-qos');$('story-map-slot').hidden=true;traceLayout(false);
 const demand={VOICE:1.5,FINANCIAL:4,CONTROL:.5,BULK:5,DEFAULT:9},names={VOICE:'Voz',FINANCIAL:'Aplicación financiera',CONTROL:'Servicios básicos',BULK:'Copias',DEFAULT:'Tráfico general'};
 return [{label:'Demanda concurrente',duration:5000,action(){chapter('Varias tareas compiten por el mismo respaldo','Voz, aplicación, servicios, copias y tráfico general ofrecen 20 Mbps. La subida elegida para este ejemplo es 10 Mbps.');journey(['Atención al cliente','Voz y servicios','Copias y navegación','Capacidad compartida']);$('story-journey').classList.add('ha-nodes');$('story-journey').querySelectorAll('.story-node-caption').forEach(el=>el.textContent='Tarea concurrente');evidence('Supuesto de este ejemplo','20 Mbps solicitados / 10 Mbps de subida','Son valores didácticos, no una medición del proveedor.');}},
 {label:'Reparto por prioridad',duration:10000,action(){const site=C5App.site(route().source),r=C5Security.qosAllocation(site,'leo',demand,10);state.example.results.push({case:'qos',...r});chapter('La prioridad reserva capacidad para atender','Reservamos el 90 % de esa subida: 9 Mbps para repartir. La aplicación y voz reciben lo solicitado; las tareas grandes reciben menos y deben esperar.','success');$('story-evidence').innerHTML='<div class="story-qos">'+r.rows.map(row=>'<div><span>'+esc(names[row.id])+'</span><div class="story-bar"><i style="width:'+Math.min(100,row.offeredMbps/9*100)+'%"></i><b style="width:'+Math.min(100,row.allocatedMbps/9*100)+'%"></b></div><strong>'+row.allocatedMbps.toFixed(1)+' / '+row.offeredMbps+' Mbps</strong></div>').join('')+'</div><p class="story-chart-key">Barra tenue: demanda · barra sólida: capacidad asignada</p>';evidenceQosResult(r);}},
 {label:'Operación degradada',duration:7000,action(){chapter('El respaldo conserva prioridades y exige límites','En contingencia se suspende el video y se posponen copias. QoS reparte capacidad; no crea más ancho de banda.','warning');$('story-takeaway').textContent='En operación normal: hasta 30 terminales remotos y 3 centrales con video, respetando límites por sede. El diseño se recalcula antes de crecer.';}}];
}
function evidenceQosResult(r){state.lastReport={scene:'close',ok:r.status==='SIMULADO',asExpected:r.congested&&Math.abs(r.shaperMbps-9)<1e-6,qos:r};$('story-result').textContent='Resultado calculado: '+r.shaperMbps+' Mbps disponibles. Congestión: '+(r.congested?'sí':'no')+'.';}

root.ClientPresentation={install,start,close,go,authorize,get active(){return state.active;},get index(){return state.index;},get report(){return state.lastReport;},startExample,pauseExample,nextExample,get example(){return state.example?{status:state.example.status,step:state.example.step,total:state.example.steps.length,results:state.example.results}:null;}};
})(window);
