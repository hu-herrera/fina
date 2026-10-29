/* C5 browser integration. Historical C4 and PRE-C4 remain explicit test fixtures. */
(function(root){
'use strict';
if(root.__TEST_C4_PROFILE__||root.__TEST_PRE_C4_PROFILE__||root.__TEST_LEGACY_PROFILE__)return;
const P=root.C5Protocols,Console=root.C5Console,M=root.C5Model,D=root.C5Data,security=root.C5Security,states=new Map(),transport=new Map(),inspectionCache=new Map();
const enabled=()=>ST.mode!=='antes',esc=v=>escapeCLI(String(v)),names={starlink:'Starlink',leo:'Amazon Leo',entel5g:'Entel 5G',wom4g:'WOM 4G'};
let variant='A';try{if(localStorage.getItem('financiera-c5-variant')==='B')variant='B';}catch(e){}
let recoveryEpoch=0;
let demoSession=false;
const site=id=>(variant==='B'?D.bSites:D.sites).find(s=>s.id===id),sede=id=>SEDES.find(s=>s.id===id);
const key=id=>(variant==='B'?'financiera-c5-v2:':'financiera-c5-v1:')+variant+':'+id;
function state(id){
 const k=variant+':'+id;if(!states.has(k)){
  const z=M.makeState();try{const saved=demoSession?null:JSON.parse(localStorage.getItem(key(id)));if([1,2].includes(saved?.version)&&Array.isArray(saved.adminDown)&&saved.adminDown.every(x=>typeof x==='string'&&/^(link:\d+|port:\d+)$/.test(x))){z.adminDown=[...saved.adminDown];z.savedAdminDown=[...saved.adminDown];if(saved.version===2&&saved.protocolConfig&&typeof saved.protocolConfig==='object'){P.runtime(z).config=structuredClone(saved.protocolConfig);z.savedProtocolConfig=structuredClone(saved.protocolConfig);}}}catch(e){z.persistenceWarning='No se pudo leer la configuración guardada.';}
  states.set(k,z);
 }return states.get(k);
}
let inspections=0;
function status(id){
 const p=site(id),s=state(id),signature=()=>JSON.stringify([s.faults,s.adminDown,s.preferredEdge,s.preferredWan,s.preferredApplicationHost,s.preferredServicesHost,P.runtime(s).config,P.runtime(s).clock,P.runtime(s).leases,P.runtime(s).recoveryReadyAt,ST.links[id]]),key=variant+':'+id,cached=inspectionCache.get(key),stamp=signature();
 if(cached?.state===s&&cached.site===p&&cached.stamp===stamp)return cached.result;
 const result=M.inspect(p,s,Object.fromEntries(p.wan_services.map(w=>[w.id,!['caido','inactivo','recuperando'].includes(ST.links[id]?.[M.MW[w.id]])])));inspections++;
 inspectionCache.set(key,{state:s,site:p,stamp:signature(),result});return result;
}
const pcs=s=>M.endpoints(site(s.id)),access=(id,pc)=>{const current=state(id),effective=status('cm').dc.servicesHost&&P.runtime(state('cm')).services.aaa!==false?current:{...current,faults:[...current.faults,'wifi:auth']};return M.access(site(id),effective,pc,status(id));};
const label=()=>variant==='A'?'A · Cisco / Palo Alto':'B · MikroTik / OPNsense';
const rate=n=>n>=1000?(n/1000)+' Gbps':n+' Mbps';
const wanCapacity=w=>w.id==='leo'?'↓ '+rate(w.terminal_peak_down_mbps)+' · ↑ '+rate(w.terminal_peak_up_mbps):w.up_required_mbps?'↓ '+rate(w.down_required_mbps)+' · ↑ '+rate(w.up_required_mbps):'Contingencia móvil';
const edgeLabel=(id,node)=>id==='cm'?node:(node==='r1'?'R1':'R2');
const modelName=(id,node)=>{const p=site(id);return node.startsWith('sw')?p.after.switch_models[Number(node.at(-1))-1]:node.startsWith('r')?p.after.router_model:node.startsWith('fw')?p.after.firewall_model:p.server_devices?.find(d=>d.id===node)?.model|| (node.startsWith('ap')?p.after.ap_model:p.after.wan_distributor_models?.[node]||'Distribuidor WAN');};
function wrap(name,fn){const old=root[name];if(typeof old!=='function')throw Error('Missing C5 integration '+name);root[name]=function(...args){return enabled()?fn(...args):old.apply(this,args);};}
function refresh(){
 _refresh();
 if(document.getElementById('sm-overlay').classList.contains('vis')&&['acl','assurance'].includes(SM_TAB))smTab(SM_TAB,document.querySelector('#sm-tabs .sm-tab.active'));
 if(document.getElementById('dev-overlay').classList.contains('vis')&&DEV_STATE.type==='pc'&&DEV_STATE.tab==='cfg')document.getElementById('dev-body').innerHTML=pcConfig(sede(DEV_STATE.sedeId),DEV_STATE.pc);
 else if(document.getElementById('dev-overlay').classList.contains('vis')&&DEV_STATE.c5&&DEV_STATE.tab!=='cli')openDeviceView(DEV_STATE.sedeId,DEV_STATE.type,DEV_STATE.tab);
}
function setVariant(v){
 if(!['A','B'].includes(v)||variant===v)return variant;
 recoveryEpoch++;transport.set(variant,JSON.parse(JSON.stringify(ST.links)));variant=v;
 if(transport.has(v))ST.links=JSON.parse(JSON.stringify(transport.get(v)));else initLinks();
 PING_DIAGNOSTIC_RULE=null;PC_CONSOLE_RETURN=null;PC_TERMINALS.clear();
 document.getElementById('dev-overlay').classList.remove('vis');
 try{if(!demoSession)localStorage.setItem('financiera-c5-variant',v);}catch(e){}
 document.getElementById('c5-profile-select').value=v;
 refresh();addLog('C5 · '+label()+' · escenarios y configuraciones aislados por variante.','ok');return v;
}
function fault(id,k){const z=state(id),was=z.faults.includes(k);if(id==='cm'&&k==='dc1'&&!was){P.runtime(z).recoveryReadyAt=P.runtime(z).clock+50;P.event(z,'HA','dc1','RUNNING','FAILURE_DETECTED','Reinicio en host alternativo disponible en t='+P.runtime(z).recoveryReadyAt+' s');}z.faults=z.faults.includes(k)?z.faults.filter(x=>x!==k):[...z.faults,k];ST.evCount++;addLog('C5 '+id.toUpperCase()+' · '+k+' '+(z.faults.includes(k)?'interrumpido':'restaurado')+' en el modelo','warn');refresh();}
function reset(id){
  recoveryEpoch++;
 for(const s of id?[site(id)]:D.sites){state(s.id).faults=[];state(s.id).preferredEdge=null;state(s.id).preferredWan=null;state(s.id).preferredApplicationHost=null;state(s.id).preferredServicesHost=null;delete P.runtime(state(s.id)).recoveryReadyAt;ST.links[s.id]={starlink:'activo',kuiper:'standby',g5:'standby',g4:'standby'};}
 PING_DIAGNOSTIC_RULE=null;refresh();
}
function save(id){const s=state(id),cfg=structuredClone(P.runtime(s).config);s.savedAdminDown=[...s.adminDown];s.savedProtocolConfig=cfg;if(demoSession)return 'Configuración temporal guardada en la presentación.';try{localStorage.setItem(key(id),JSON.stringify({version:2,adminDown:s.adminDown,protocolConfig:cfg}));return 'Interfaces y protocolos guardados en este navegador y alternativa.';}catch(e){return 'No se pudo guardar; los cambios siguen en memoria.';}}
function clearConfig(id){try{if(!demoSession)localStorage.removeItem(key(id));}catch(e){}const s=state(id);s.adminDown=[];s.savedAdminDown=[];s.savedProtocolConfig={};delete s.protocols;refresh();}
function advanceClock(seconds){for(const s of (variant==='B'?D.bSites:D.sites)){const st=state(s.id),r=P.runtime(st),was=r.recoveryReadyAt&&r.clock<r.recoveryReadyAt;P.advance(st,seconds);if(was&&r.clock>=r.recoveryReadyAt)P.event(st,'HA','dc2','RECOVERING','SERVICE_READY','Ventana de reinicio completada en tiempo virtual.');}refresh();return P.runtime(state('cm')).clock;}
function applyPolicy(decision,id){const disabled=new Set([...P.runtime(state(id)).disabledRules,...P.runtime(state('cm')).disabledRules]);return decision.action==='allow'&&disabled.has(decision.id)?{...decision,action:'deny',reason:'Regla '+decision.id+' deshabilitada en la configuración activa.'}:decision;}
function routeText(id,n){
 const p=site(id),s=state(id),z=status(id),cfg=deviceConfig(id,n),rows=[];
 if(n.startsWith('r')){
  const adj=P.neighbors(p,s,z.links,n).filter(a=>a.state==='FULL');for(const l of cfg.ports.filter(p=>p.roleId==='LAN_ROUTED'&&p.up))rows.push('C '+l.network+' directly connected, '+l.port);
  if(adj.length)for(const net of Object.values(p.addressing))rows.push('O '+net.network+' via '+adj[0].peerIp+' · OSPF 1');
  const candidate=M.inspect(p,{...s,preferredEdge:n},Object.fromEntries(p.wan_services.map(w=>[w.id,!['caido','inactivo','recuperando'].includes(ST.links[id]?.[M.MW[w.id]])])));
  if(candidate.activeEdge===n&&M.overlayPath(p,candidate,site('cm'),status('cm'))&&status('cm').dc.servicesHost)rows.push('S* 0.0.0.0/0 via VPN '+candidate.activeWan+' · '+n);
 }else{
  for(const net of cfg.vlans)if(P.vlanUp(s,n,net.vlan))rows.push('C '+net.network+' · Vlan'+net.vlan);
  if(z.gatewayAvailable&&overlayReady(id)&&status('cm').dc.servicesHost)rows.push((id==='cm'?'S* ':'O* ')+'0.0.0.0/0 via '+z.activeEdge+' / '+names[z.activeWan]);
 }
 return rows.join('\n')||'Sin rutas operativas en este equipo.';
}
function syncProtocols(){for(const s of (variant==='B'?D.bSites:D.sites))if(s.id!=='cm')overlayReady(s.id);}
function consoleContext(id,n){return {site:site(id),state:state(id),node:n,variant,device:deviceConfig(id,n),status:status(id),refresh,advance:advanceClock,sync:syncProtocols,routes:()=>routeText(id,n),rules:security.rules,centralState:()=>state('cm'),tracks:()=>site(id).wan_services.map(w=>({name:w.id,up:status(id).wanAvailable.includes(w.id),overlay:overlayReady(id)&&status(id).activeWan===w.id})),services:()=>({host:status('cm').dc.servicesHost,...P.runtime(state('cm')).services}),endpoints:()=>pcs(sede(id)),access:pc=>access(id,pc)};}
function button(id,k,title){return `<button type="button" class="btn btn-n" data-c5-fault="${esc(k)}" onclick="C5App.fault('${id}','${k}')">${state(id).faults.includes(k)?'Restaurar':'Fallar'} ${esc(title)}</button>`;}
function overlayReady(id){return P.establish(site(id),status(id),site('cm'),status('cm'),state(id),state('cm')).ok;}
function summary(id){const p=site(id),z=status(id);return `<div class="c5-summary"><strong>C5 · ${esc(label())} · ${id==='cm'?'dos firewalls A/P':'dos routers; seguridad centralizada'}</strong><p>${id==='cm'?'Firewall elegido':'Router elegido'}: ${z.activeEdge||'ninguno'} · WAN: ${names[z.activeWan]||'sin camino'} · ${variant==='B'&&id!=='cm'?'switches independientes RSTP':'stack de acceso'} ${z.stackPartitioned?'aislado':z.activeStackMembers.join('+')||'sin acceso'}</p><p class="ping-note">${p.workstations} PCs y ${p.phones} teléfonos · dos switches · ${p.wan_services.length} WAN. ${id==='cm'?'Dos hosts y un repositorio de respaldo existentes.':'Salida por central con las mismas reglas de seguridad en cada transporte.'}</p></div>`;}
function dcInfo(){const z=status('cm');return '<div class="c5-dc-info"><h3>Datacenter · alta disponibilidad de servicios</h3><p>Aplicación / BD: '+(z.dc.activeApplicationHost?.toUpperCase()||'sin host disponible')+' · telefonía / DNS / AAA: '+(z.dc.activeServicesHost?.toUpperCase()||'sin host disponible')+'.</p><p>Quórum: '+z.dc.votes+'/3 votos · '+(z.dc.quorum?'mayoría disponible':'servicios detenidos para evitar conflicto')+' · '+(z.dc.mode==='normal'?'dos hosts disponibles':'prioridad a servicios críticos; NMS pausado')+'. BKP-01 aporta el tercer voto y conserva los respaldos.</p><p>APP 10.70.200.10 · BD .11 · PBX .20 · DNS/NTP .30 · AAA .31 · NMS .40 · backup .50. VLAN50, gateway 10.70.200.1. NOC: 10.80.0.10 en VLAN130.</p><p>Cada host y BKP-01 tiene NIC1 → SW1 y NIC2 → SW2. Réplica ZFS cada 60 s y reinicio de VMs en el host superviviente; la recuperación no conserva la sesión abierta.</p></div>';}
function topology(s){
 const p=site(s.id),z=status(s.id),hosts=pcs(s),id=s.id,cm=id==='cm',W=1300,rows=Math.ceil(Math.ceil(hosts.length/2)/4),H=790+rows*88+(cm?240:0);
 const text=(x,y,t,n=14)=>`<text x="${x}" y="${y}" text-anchor="middle" fill="#d5e2ef" font-size="${n}">${esc(t)}</text>`;
 const line=(x,y,a,b,on=true)=>`<line x1="${x}" y1="${y}" x2="${a}" y2="${b}" stroke="${on?'#35c987':'#f36570'}" stroke-width="2"${on?'':' stroke-dasharray="6 4"'}/>`;
 const box=(x,y,w,title,sub,node,on=true)=>`<g${node?` role="button" tabindex="0" onclick="C5App.open('${id}','${node}')" onkeydown="if(event.key==='Enter')C5App.open('${id}','${node}')" style="cursor:pointer"`:''}><rect x="${x}" y="${y}" width="${w}" height="70" rx="8" fill="#172235" stroke="${on?'#35c987':'#f36570'}" stroke-width="2"/>${text(x+w/2,y+25,title,15)}${text(x+w/2,y+50,sub,12)}</g>`;
 let svg=text(650,28,'C5 · '+s.code+' · '+label(),21);
 p.wan_services.forEach((w,i)=>{const width=285,x=25+i*320;svg+=box(x,55,width,names[w.id]+' · CPE',wanCapacity(w),null,z.wanAvailable.includes(w.id));svg+=line(x+width/2,125,w.distributor==='wanA'?330:970,170,z.wanAvailable.includes(w.id));});
 for(const [i,wan] of ['wanA','wanB'].entries())svg+=box(160+i*640,170,340,'WAN-'+(i?'B':'A')+' · '+'MikroTik '+modelName(id,wan),cm?(i?'Puerto físico · VLAN202/204 · 1 GbE':'Puerto físico · VLAN201/203 · 2,5 GbE'):(i?'Distribuidor · Leo + WOM':'Distribuidor · Starlink + Entel'),wan,z.poweredNodes[wan]);
 const edges=cm?['fwA','fwB']:['r1','r2'];
 for(const [i,e]of edges.entries()){
  for(const [j,w]of ['wanA','wanB'].entries())svg+=line(330+j*640,240,330+i*640,300,z.paths.some(a=>a.edge===e&&a.distributor===w));
  svg+=box(110+i*640,300,440,modelName(id,e)+' · '+edgeLabel(id,e),z.poweredNodes[e]?(e===z.activeEdge?'ACTIVO':'disponible / alternativa'):'APAGADO',e,z.poweredNodes[e]);
  for(const member of [1,2])svg+=line(330+i*640,370,330+(member-1)*640,450,z.links.some(l=>l.a===e&&l.b==='sw'+member&&l.role.startsWith('LAN_'))&&!z.stackPartitioned);
 }
 svg+='<rect x="290" y="390" width="720" height="28" rx="5" fill="#0b1420"/>'+text(650,410,cm?'HA de firewalls y agregados LAN separados':'Cuatro enlaces LAN L3 independientes · no EtherChannel entre routers',14);
 for(const n of [1,2])svg+=box(110+(n-1)*640,450,440,modelName(id,'sw'+n)+' · SW'+n,cm?'LAN + servidores · dos miembros':variant==='A'?'SVI/gateway en stack · VLAN segmentadas':'RSTP / gateway redundante','sw'+n,z.switchLocalL2[n]);
 svg+=line(550,485,750,485,z.interMemberL2)+text(650,550,variant==='B'&&!cm?'Interconexión RSTP · sin LACP multichasis':'Dos enlaces StackWise; no son LACP');
 const apCount=cm?4:2;for(let i=1;i<=apCount;i++){const member=cm?Math.ceil(i/2):i,x=cm?80+(i-1)*310:180+(i-1)*640;svg+=box(x,575,cm?280:300,'AP'+i+' · '+modelName(id,'ap'+i),'Contingencia · SW'+member+' / autenticación','ap'+i,z.switchLocalL2[member]&&z.links.some(l=>l.a==='ap'+i&&l.role==='AP_TRUNK'));}
 for(const pc of hosts){const group=hosts.filter(h=>h.sw===pc.sw),i=group.findIndex(h=>h.idx===pc.idx),x=30+(pc.sw-1)*650+(i%4)*154,y=680+Math.floor(i/4)*88,a=access(id,pc);svg+=`<g class="topo-pc c5-pair" role="button" tabindex="0" onclick="openPC('${id}',${pc.idx-1})" onkeydown="if(event.key==='Enter')openPC('${id}',${pc.idx-1})" style="cursor:pointer"><title>${esc(pc.id+' '+a.pcIp+' · '+pc.phoneId+' '+a.phoneIp+' · SW'+pc.sw+' puerto '+pc.port)}</title><rect x="${x}" y="${y}" width="146" height="72" rx="6" fill="#172235" stroke="${a.local?'#35c987':'#f36570'}"/>${text(x+73,y+20,'TEL '+pc.idx+' → PC '+pc.idx,12)}${text(x+73,y+41,a.pcIp,11)}${text(x+73,y+59,a.pcMode==='wifi'?'Wi-Fi · '+a.ap:'SW'+pc.sw+' / puerto '+pc.port,11)}</g>`;}
 const base=700+rows*88;svg+=text(650,base,'Un puerto de acceso por par teléfono → PC; cada equipo usa su propia radio al fallar el cable',13);
 if(cm){for(const [i,n]of ['dc1','dc2','backup'].entries()){
  for(const member of [1,2]){const side=member===1?12:1288,on=z.links.some(l=>l.a===n&&l.b==='sw'+member);svg+=line(member===1?110:1190,485,side,485,on)+line(side,485,side,base+25+member*5,on)+line(side,base+25+member*5,240+i*410,base+25+member*5,on)+line(240+i*410,base+25+member*5,240+i*410,base+55,on);}
  svg+=box(50+i*410,base+55,380,n==='dc1'?'DC-01 · host de aplicaciones':n==='dc2'?'DC-02 · host de servicios':'BKP-01 · respaldos / voto',modelName(id,n)+' · '+p.server_devices.find(d=>d.id===n).ip,n,z.poweredNodes[n]);
  svg+=text(240+i*410,base+145,'NIC1 → SW1 / Gi1/0/'+(43+i)+' · NIC2 → SW2 / Gi2/0/'+(43+i),11);
 }}
 return '<div class="topo-wrap c5-topology">'+topoToolbar(s)+summary(id)+`<div class="topo-viewport"><svg class="topo-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Topología C5 ${s.code}">${svg}</svg></div>`+(cm?dcInfo():'')+'</div>';
}
function lab(s){const p=site(s.id),cm=s.id==='cm',edges=cm?['fwA','fwB']:['r1','r2'];return summary(s.id)+`<button class="btn btn-b" onclick="C5App.reset('${s.id}')">Restaurar fallos de esta sede</button><p class="ping-note">Restaurar fallos conserva la configuración administrativa. Configuraciones A/B y por sede son independientes.</p><div class="c5-fault-grid">`+[...edges,'sw1','sw2','wanA','wanB','ap1','ap2',...(cm?['ap3','ap4','dc1','dc2','backup','cluster:quorum','cluster:fencing','storage:replication','storage:stale','storage:inconsistent','vm:application','vm:services']:[])].map(k=>button(s.id,k,k.toUpperCase())).join('')+button(s.id,'wifi:auth','autenticación Wi-Fi')+'</div>'+p.wan_services.map(w=>'<fieldset><legend>'+names[w.id]+'</legend>'+['wan:','cpe:','upstream:'].map((prefix,i)=>button(s.id,prefix+w.id,['enlace','CPE','upstream con portadora'][i])).join('')+'</fieldset>').join('')+'<details><summary>Fallos de enlaces físicos y de control</summary>'+p.links.map((l,i)=>button(s.id,'link:'+i,'#'+i+' '+l.a+' ↔ '+l.b+' · '+(variant==='B'&&l.role==='STACK'&&!cm?'LACP / RSTP':variant==='B'&&l.role==='HA1'?'pfsync / XMLRPC':l.role))).join('')+'</details>'+(cm?dcInfo():'');}
const node=(s,k,l,kind='router',offset=0)=>simulationNode('site:'+s.id+':'+k,l,[sedePos(s)[0]+offset,sedePos(s)[1]],kind);
function localPath(s,pc){const a=access(s.id,pc);return [node(s,'pc:'+pc.idx,pc.id+' · '+a.pcIp,'pc'),...(a.pcMode==='wifi'?[node(s,a.ap,'Wi-Fi · '+a.ap,'ap',.5)]:[node(s,'phone:'+pc.idx,pc.phoneId+' · puente Ethernet','phone',.5)]),node(s,'sw'+a.switch,'SW-'+s.code+'-'+a.switch,'switch',1)];}
function path(s,member){const z=status(s.id),p=M.choosePath(site(s.id),z,member);if(!p)return [];return [...(p.switch!==member?[node(s,'sw'+p.switch,'SW-'+s.code+'-'+p.switch,'switch',1)]:[]),node(s,p.edge,(s.id==='cm'?(variant==='A'?'NGFW ':'OPNsense '):'Router ')+s.code+' '+p.edge,s.id==='cm'?'firewall':'router',2),node(s,p.distributor,(p.distributor==='wanA'?'WAN-A':'WAN-B')+' · '+modelName(s.id,p.distributor),'handoff',3),node(s,'cpe:'+p.wan,'CPE '+names[p.wan],'handoff',4),(()=>{const endpoint=getWanEndpoint(s,false);return {...simulationNode('wan:'+s.id,s.code+' · '+names[p.wan],endpoint.point,'provider'),anchorId:endpoint.anchorId,antennaId:endpoint.antennaId};})()];}
function route(src,dst,collapse,sp=pcs(src)[0],dp=pcs(dst)[0]){
 if(!sp||!dp||packetPolicyDecision(src,dst,sp,dp).action!=='allow')return [];
 const a=access(src.id,sp),b=access(dst.id,dp);if(!a.local||!b.local)return [];
 if(src.id===dst.id){
  const z=status(src.id);if(a.switch!==b.switch&&!z.interMemberL2)return [];
  if(a.pcMode!==b.pcMode&&!z.gatewayAvailable)return [];
  const middle=a.pcMode!==b.pcMode?[node(src,'svi','Gateway SVI · VLAN10 ↔ VLAN110','router',2)]:[];
  const first=localPath(src,sp),last=localPath(dst,dp).reverse();
  return [...first,...middle,...(a.switch===b.switch?last.slice(1):last)];
 }
 const cm=sede('cm');if(!a.network||!b.network||!overlayReady(src.id)||!overlayReady(dst.id)||!status('cm').dc.servicesHost)return [];
 const first=path(src,a.switch),last=path(dst,b.switch);if(!first.length||!last.length)return [];
 const hub=src.id!=='cm'&&dst.id!=='cm'?path(cm,status('cm').activeStackMembers[0]):[];
 if(src.id!=='cm'&&dst.id!=='cm'&&!hub.length)return [];
 // One central firewall hop; transport legs surround it. Do not insert obsolete branch NGFWs.
 const transit=hub.length?[...hub.slice(1).reverse(),hub[0],...hub.slice(1)]:[];
 return [...localPath(src,sp),...first,...transit,...last.reverse(),...localPath(dst,dp).reverse()];
}
function pcConfig(s,pc){const a=access(s.id,pc),p=site(s.id);return `<div class="dsec"><h3>${esc(pc.id)}</h3><p>Acceso: ${a.pcMode} · IP activa ${a.pcIp} /25 · gateway ${a.pcMode==='wifi'?p.addressing.wifi_users.gateway:p.addressing.users.gateway}</p><p>Reserva cableada: ${pc.ip} · SW${pc.sw} / puerto ${pc.port} · VLAN10.</p><p>${pc.phoneId}: ${a.phoneMode} · ${a.phoneIp} · SIP-T54W existente · VLAN20 o Wi-Fi voz120. Adaptador de energía independiente.</p><p>Conexión cableada: switch → teléfono → PC. Cada equipo usa su propia radio en la contingencia Wi-Fi.</p>${pc.idx===1?`<button class="btn btn-b" onclick="C5App.pcConsole('${s.id}')">Consola local ${s.id==='cm'?'del firewall':'del router'} disponible</button><p id="pc-console-status" role="status"></p>`:''}</div>`;}
function securityCases(id){const p=pcs(sede(id))[0],a=access(id,p);return security.cases(site(id),a.pcIp).map(f=>f.id==='voice'?{...f,sourceIp:a.phoneIp}:f);}
function securityTest(id,caseId){
 const flow=securityCases(id).find(f=>f.id===caseId);if(!flow)throw Error('Flujo no definido.');
 const decision=applyPolicy(security.evaluate(D.sites,flow,PING_DIAGNOSTIC_RULE),id),src=sede(flow.sourceSite),pc=pcs(src)[0],a=access(src.id,pc),cm=sede('cm'),central=status('cm');
 const sourceStatus=status(src.id),guestAccess=sourceStatus.links.some(l=>l.role==='AP_TRUNK'&&l.allowed_vlans.includes(40)&&sourceStatus.switchGateway[Number(l.b.at(-1))]&&P.vlanUp(state(src.id),l.b,40));
 let local=decision.source.zone==='USERS'?a.network:decision.source.zone==='VOICE'?a.phoneMode!=='down'&&sourceStatus.gatewayAvailable&&P.vlanUp(state(src.id),'sw'+a.phoneSwitch,a.phoneMode==='wifi'?120:20):decision.source.zone==='GUESTS'?guestAccess:sourceStatus.gatewayAvailable;
 let available=local&&central.gatewayAvailable;
 if(flow.destinationIp===security.services.nms)available=available&&central.dc.monitoringHost;
 if(flow.sourceIp===security.services.admin)available=available&&central.dc.servicesHost;
 if(src.id!=='cm')available=available&&Boolean(overlayReady(src.id)&&central.dc.servicesHost);
 if(decision.target.zone==='INTERNET')available=available&&Boolean(central.activeWan);
 else if([security.services.app,security.services.database].includes(flow.destinationIp))available=available&&central.dc.applicationHost;
 else if([security.services.pbx,security.services.dns,security.services.aaa,security.services.nms].includes(flow.destinationIp))available=available&&central.dc.servicesHost;
 if(decision.target.zone==='MGMT'&&decision.target.site!==src.id){const dest=status(decision.target.site);available=available&&dest.gatewayAvailable&&Boolean(overlayReady(decision.target.site)&&central.dc.servicesHost);}
 // A management subnet can be reachable while the addressed device is powered off.
 if(decision.target.zone==='MGMT'){
  const targetSite=site(decision.target.site),z=status(targetSite.id),nodes=Object.entries(targetSite.after.management_addresses).filter(([,ip])=>ip===flow.destinationIp).map(([n])=>n);
  if(nodes.length)available=available&&nodes.some(n=>z.poweredNodes[n]!==false&&!state(targetSite.id).faults.includes(n)&&(!n.startsWith('sw')||z.switchGateway[Number(n.at(-1))]));
 }
 const svc=P.runtime(state('cm')).services;
 if(flow.destinationIp===security.services.app)available=available&&svc.app!==false&&svc.database!==false;
 for(const [name,ip]of Object.entries(security.services))if(flow.destinationIp===ip)available=available&&svc[name]!==false;
 const ok=decision.action==='allow'&&Boolean(available),r=[];
 if(ok){
  r.push(...(decision.source.zone==='USERS'?localPath(src,pc):decision.source.zone==='VOICE'?[node(src,'phone:'+pc.idx,pc.phoneId+' · '+a.phoneIp,'phone'),...(a.phoneAp?[node(src,a.phoneAp,'Wi-Fi · '+a.phoneAp,'ap')]:[]),node(src,'sw'+a.phoneSwitch,'SW-'+src.code+'-'+a.phoneSwitch,'switch')]:[node(src,'source',flow.sourceIp+' · '+decision.source.zone,'pc')]));
  if(src.id!=='cm'){r.push(...path(src,decision.source.zone==='USERS'?a.switch:decision.source.zone==='VOICE'?a.phoneSwitch:status(src.id).activeStackMembers[0]));r.push(...path(cm,central.activeStackMembers[0]).reverse());}
  else r.push(node(cm,central.activeEdge,(variant==='A'?'NGFW ':'OPNsense ')+'CM '+central.activeEdge,'firewall'));
  if(decision.target.zone==='MGMT'&&decision.target.site!=='cm'&&decision.target.site!==src.id){const dst=sede(decision.target.site);r.push(...path(dst,status(dst.id).activeStackMembers[0]).reverse());}
  if(decision.target.zone==='INTERNET')r.push(...path(cm,central.activeStackMembers[0]));
  if(decision.target.zone==='SERVERS'){const host=flow.destinationIp===security.services.backup?'backup':flow.destinationIp===security.services.nms?central.dc.activeMonitoringHost:[security.services.app,security.services.database].includes(flow.destinationIp)?central.dc.activeApplicationHost:central.dc.activeServicesHost;if(host){const cable=central.links.find(l=>l.a===host&&l.role.startsWith('SERVER_'));if(cable)r.push(node(cm,cable.b,'SW-CM-'+cable.b.at(-1)+' · '+cable.portB,'switch'));r.push(node(cm,host,host.toUpperCase()+' · '+(cable?.portA||'NIC1/NIC2'),'server'));}}
  r.push(node(sede(decision.target.site)||cm,'destination',flow.destinationIp+' · '+flow.protocol.toUpperCase()+'/'+flow.port,decision.target.zone==='SERVERS'?'server':'host'));
 }
 const translation=ok&&decision.target.zone==='INTERNET'?P.nat(state('cm'),flow,site('cm').wan_services.find(w=>w.id===central.activeWan).carrier_handoff.vip):null;
 const result={translation,flow,policy:decision,ok,reachable:Boolean(available),route:r,reason:decision.action==='deny'?decision.reason:ok?'Flujo permitido y camino disponible.':'Regla permitida, pero destino o servicio no disponible.'};
 P.recordFlow(state(src.id),flow,result);if(src.id!=='cm'){P.recordFlow(state('cm'),flow,result);if(ok){const vpn=P.establish(site(src.id),status(src.id),site('cm'),central,state(src.id),state('cm'));P.transmit(state(src.id),state('cm'),vpn.sa);}}
 return result;
}
function securityView(id){return '<div class="c5-security"><h3>ACL / Seguridad · '+esc(id.toUpperCase())+'</h3><p>Los colaboradores acceden a la aplicación por HTTPS. La base de datos, la gestión y la voz tienen permisos específicos. Invitados solo navegan por Internet.</p><label for="c5-security-case">Flujo de prueba</label><select id="c5-security-case">'+securityCases(id).map(f=>'<option value="'+f.id+'">'+esc(f.label)+'</option>').join('')+'</select> <button class="btn btn-b" onclick="C5App.runSecurityTest(\''+id+'\')">Evaluar flujo</button><div id="c5-security-result" role="status" aria-live="polite"></div><details><summary>Ver las '+security.rules.length+' reglas y su ubicación</summary><div class="c5-policy-scroll"><table class="c5-policy-table"><thead><tr><th>Regla / control</th><th>Origen</th><th>Destino</th><th>Servicio</th><th>Acción</th></tr></thead><tbody>'+security.rules.map(r=>'<tr><td>'+esc(r.id)+'<br><small>'+esc(r.control)+'</small></td><td>'+esc(r.from)+'</td><td>'+esc(r.to)+'</td><td>'+esc(r.service)+'</td><td>'+esc(r.action==='allow'?'Permitir':'Bloquear')+'</td></tr>').join('')+'</tbody></table></div></details><p><a href="https://github.com/hu-herrera/financiera-pacifico-entrega-docente/blob/main/02_Entregables/Entregable_4.pdf" target="_blank" rel="noopener">Política completa por sede</a></p></div>';}
function runSecurityTest(id){const r=securityTest(id,document.getElementById('c5-security-case').value);document.getElementById('c5-security-result').innerHTML='<p class="'+(r.ok?'c5-policy-allow':'c5-policy-deny')+'"><strong>'+esc(r.policy.action==='deny'?'BLOQUEADO':r.ok?'PERMITIDO':'SIN CAMINO')+'</strong> · '+esc(r.policy.id)+'</p><p>'+esc(r.flow.sourceIp+' → '+r.flow.destinationIp+' · '+r.flow.protocol.toUpperCase()+'/'+r.flow.port)+'</p><p>'+esc(r.reason)+'</p><p>Control: '+esc(r.policy.control)+'</p>'+(r.route.length?'<details><summary>Ver recorrido</summary><ol>'+r.route.map(n=>'<li>'+esc(n.label)+'</li>').join('')+'</ol></details>':'');return r;}
function policyText(id){const disabled=new Set(id?[...P.runtime(state(id)).disabledRules,...P.runtime(state('cm')).disabledRules]:[]);return security.rules.map(r=>r.id+' · '+r.action.toUpperCase()+(disabled.has(r.id)?' (DESHABILITADA)':'')+' · '+r.from+' → '+r.to+' · '+r.service+'\n  '+r.control).join('\n');}
function details(id){const p=site(id);document.getElementById('detail-panel').innerHTML='<div class="dc"><h3>'+esc(p.city)+'</h3>'+summary(id)+p.wan_services.map(w=>'<div class="drow"><span>'+names[w.id]+'</span><span>'+displayLinkStates(id)[M.MW[w.id]]+'</span></div>').join('')+`<button class="btn btn-b" onclick="openSedeModal('${id}')">Ver sede / Ping / Consolas</button>`+'</div>';}
function protocolAction(id,node,command){const result=cli(id,node,command),out=document.getElementById('c5-protocol-result');if(out)out.textContent=result;return result;}
function protocolView(id){
 syncProtocols();const r=P.runtime(state(id)),nodes=id==='cm'?['fwA','fwB']:['r1','r2'],active=status(id).activeEdge;
 return '<h3>Operación de protocolos</h3><p>Reloj virtual: '+r.clock+' s · borde seleccionado: '+esc(active||'sin borde utilizable')+'. Los comandos y las pruebas usan el mismo estado.</p><div>'+nodes.map(n=>'<button class="btn btn-n" onclick="C5App.open(\''+id+'\',\''+n+'\',\'cli\')">Consola '+n+'</button>').join('')+'<button class="btn btn-b" onclick="C5App.advanceClock(5)">Avanzar 5 s</button></div><p>Prueba HTTPS, cambia una interfaz o un protocolo y consulta rutas, vecinos y asociaciones. El tiempo virtual controla las ventanas de reconvergencia y reinicio.</p>'+deviceTable(['Asociación','Estado','Paquetes ida / vuelta','Renovaciones'],Object.values(r.sessions).filter(sa=>sa.state==='ESTABLISHED').slice(0,24).map(sa=>[sa.id,sa.state,(sa.encaps||0)+' / '+(sa.decaps||0),sa.rekeys||0]))+'<pre id="c5-protocol-result" class="c5-config-text"></pre>';
}
function assuranceView(id){
 const p=site(id),vpn=security.vpnPlan(p,null,variant==='B'?D.bSites:D.sites);
 const classification=securityCases(id).filter(f=>['app','database','voice','guest-web'].includes(f.id)).map(f=>({flow:f,classification:security.qosClassify(D.sites,f)}));
 return '<div class="c5-assurance">'+protocolView(id)+'<h3>Prioridad del tráfico</h3><p>La aplicación financiera se identifica por sus usuarios, servidor y puerto HTTPS. Marcar un paquete como prioritario no cambia sus permisos.</p>'+deviceTable(['Flujo conocido','Clase','Marcado propuesto'],classification.map(r=>[r.flow.label,({FINANCIAL:'Financiera',VOICE:'Voz',CONTROL:'Servicios',BULK:'Respaldo',DEFAULT:'General',BLOCKED:'Bloqueado'})[r.classification.classId],r.classification.dscp]))+
 '<form id="c5-qos-form" onsubmit="event.preventDefault();C5App.runQos(\''+id+'\')"><div class="c5-qos-inputs"><label>Enlace a evaluar<select id="c5-qos-wan" aria-label="Enlace a evaluar">'+p.wan_services.map(w=>'<option value="'+w.id+'"'+(status(id).activeWan===w.id?' selected':'')+'>'+names[w.id]+'</option>').join('')+'</select></label><label>Subida del escenario (Mbps)<input id="c5-qos-uplink" type="number" min="0.001" max="100000" step="any" placeholder="Usar supuesto del diseño"></label>'+security.qosPolicy.classes.map((c,i)=>'<label>'+esc(c.name)+' (Mbps)<input data-qos-demand="'+c.id+'" aria-label="Demanda '+esc(c.name)+'" type="number" min="0" step="any" value="'+[1.5,8,.5,4,6][i]+'" required></label>').join('')+'</div><button class="btn btn-b" type="submit">Simular congestión</button></form><div id="c5-qos-result" role="status" aria-live="polite"></div><p>Se reserva un margen de 10 % para encapsulación. Voz tiene un límite de 20 % bajo congestión; las otras clases comparten lo disponible por sus pesos. Es un reparto de capacidad, sin emular tiempos de paquetes. Las dos direcciones deben dimensionarse por separado.</p>'+deviceTable(['Clase','Reserva propuesta','Condición'],security.qosPolicy.classes.map(c=>[c.name,c.percent+' %',c.match]))+
 '<details><summary>VPN · '+vpn.peers.length+' túneles configurados</summary><p>IKEv2 con autenticación por identidad y certificado del modelo; ESP AES-256-GCM, PFS19 y NAT-T. Una identidad incompatible o una propuesta inválida impide utilizar el túnel. Las asociaciones y los contadores se consultan en la consola.</p>'+deviceTable(['Túnel','Identidad local','Identidad remota','Extremo central'],vpn.peers.map(t=>[t.tunnel,t.localIdentity,t.peerIdentity,t.publicEndpoint]))+'</details>'+
 '<details><summary>Recuperación de servicios centrales</summary><p>Objetivos del diseño: recuperar en 300 s y limitar la pérdida de datos a 60 s. Los dos hosts usan réplica asíncrona, mayoría de 2/3 votos y fencing. La última réplica exitosa determina los datos recuperables.</p><button class="btn btn-b" type="button" onclick="C5App.runRecoveryAudit()">Probar recuperación en el modelo</button><div id="c5-recovery-result" role="status" aria-live="polite"></div><p>Explorar los datos recuperables sin modificar los fallos actuales:</p><label for="c5-recovery-scenario">Escenario del datacenter</label><select id="c5-recovery-scenario"><option value="host">Caída de DC-01 con réplica reciente</option><option value="stale">Réplica demasiado antigua</option><option value="quorum">Sin mayoría de votos</option><option value="fencing">Sin aislamiento confirmado</option><option value="corrupt">Copia inconsistente</option><option value="application">Aplicación no supera la validación</option><option value="both">Ambos servidores caídos</option></select> <label>Fallo en t (s)<input id="c5-recovery-time" type="number" min="0" max="86400" value="157"></label><label>Intervalo de réplica (s)<input id="c5-replication-interval" type="number" min="1" max="86400" value="60"></label><button class="btn btn-b" type="button" onclick="C5App.runRecoveryExercise()">Ejecutar recuperación y datos</button><div id="c5-recovery-exercise-result" role="status" aria-live="polite"></div></details>'+
 '<details><summary>Alcance técnico</summary><p>Simulación de protocolos, equipos y servicios con tiempo virtual. Las asociaciones, contadores y tiempos corresponden a ejecuciones del modelo. El procedimiento de implantación y las referencias de fabricantes están en los anexos técnicos.</p></details></div>';
}
function runQos(id){
 const out=document.getElementById('c5-qos-result');if(!out)return;
 try{
  const input=document.getElementById('c5-qos-uplink').value.trim(),demand=Object.fromEntries([...document.querySelectorAll('[data-qos-demand]')].map(el=>[el.dataset.qosDemand,el.value.trim()===''?NaN:Number(el.value)]));
  const r=security.qosAllocation(site(id),document.getElementById('c5-qos-wan').value,demand,input===''?null:Number(input));P.runtime(state(id)).qos=r;
  if(r.status==='CAPACIDAD_NO_DEFINIDA'){out.textContent='Este enlace móvil no tiene subida efectiva acreditada. Ingresa una capacidad para explorar el escenario; no se usará la velocidad máxima como garantía.';return r;}
  const n=v=>v.toLocaleString('es-CL',{maximumFractionDigits:3});
  out.innerHTML='<p><strong>'+(r.congested?'CONGESTIÓN SIMULADA':'CAPACIDAD SUFICIENTE EN ESTE ESCENARIO')+'</strong> · '+names[r.wan]+'. Shaper '+n(r.shaperMbps)+' Mbps; demanda '+n(r.offeredMbps)+' Mbps.</p><p>'+(input===''?'Capacidad basada en el supuesto del diseño.':'Capacidad ingresada para esta simulación.')+' No es una medición del proveedor.</p>'+deviceTable(['Clase','Demanda Mbps','Asignado Mbps','Sin servir Mbps'],r.rows.map(c=>[c.name,n(c.offeredMbps),n(c.allocatedMbps),n(c.deferredMbps)]));return r;
 }catch(e){out.textContent=e.message;return {status:'ENTRADA_INVALIDA'};}
}
function runRecoveryAudit(){const r=M.recoveryAudit(site('cm')),out=document.getElementById('c5-recovery-result');if(out)out.innerHTML='<p>'+r.passed+' de '+r.total+' comprobaciones del modelo cumplen lo esperado. Los tiempos de recuperación se obtienen en el ejercicio de eventos con reloj virtual. La prueba usa estados aislados y conserva tus fallos actuales.</p>'+deviceTable(['Fallo / resultado esperado','Comprobación del modelo'],r.rows.map(c=>[c.label,c.pass?'PASA':'FALLA']));return r;}
function recoveryExercise(options={}){return M.recoveryExercise(site('cm'),options);}
function recoveryExerciseView(r){
 return '<div class="c5-recovery-exercise"><p><strong>Ejecución de recuperación</strong> · '+(r.eligible?'Servicio recuperado en '+esc(r.applicationHost.toUpperCase()):'Recuperación bloqueada')+'</p><p>Fallo en t='+r.failureSecond+' s · última copia completada: '+(r.selectedReplica?'datos hasta t='+r.selectedReplica.second+' s, completada en t='+(r.selectedReplica.completedSecond??r.selectedReplica.second)+' s':'ninguna')+'.</p>'+deviceTable(['Resultado de la ejecución','Tiempo virtual'],[['RTO observado',r.rtoSimulatedSeconds===null?'Sin recuperación':r.rtoSimulatedSeconds+' s'],['RPO observado',r.rpoSimulatedSeconds===null?'Datos no verificables':r.rpoSimulatedSeconds+' s'],['Antigüedad de la copia',r.replicaAgeSeconds===null?'Sin copia':r.replicaAgeSeconds+' s']])+deviceTable(['Condición de recuperación','Resultado'],r.checks.map(c=>[c.label,c.ok?'Cumple':'Intervención necesaria']))+'<p>'+r.operationCount+' operaciones generadas; '+r.inReplica.length+' presentes en la copia; '+r.reconcile.length+' posteriores por conciliar.</p>'+deviceTable(['Operación','Registro','Estado'],[...r.inReplica.slice(-2).map(t=>[t.id,'t='+t.second+' s','Presente']),...r.reconcile.map(t=>[t.id,'t='+t.second+' s','Conciliar'])])+'<details><summary>Eventos de esta ejecución</summary><pre class="c5-config-text">'+esc(r.events.map(e=>'t='+e.second+' '+e.type+(e.id?' '+e.id:'')).join('\n'))+'</pre></details><p>'+esc(r.reconciliation)+'</p></div>';
}
function runRecoveryExercise(){const r=recoveryExercise({scenario:document.getElementById('c5-recovery-scenario').value,failureSecond:Number(document.getElementById('c5-recovery-time').value),replicationInterval:Number(document.getElementById('c5-replication-interval').value)});document.getElementById('c5-recovery-exercise-result').innerHTML=recoveryExerciseView(r);return r;}
function pcCommand(id,pc,command){
 const cmd=command.trim().toLowerCase().replace(/\s+/g,' '),s=state(id),r=P.runtime(s),a=access(id,pc),cm=state('cm'),cr=P.runtime(cm),dnsNames=Object.fromEntries(Object.entries(security.services).map(([k,ip])=>[k+'.financiera.test',ip]));
 if(cmd==='ipconfig /release'){r.leases[pc.idx]='RELEASED';P.event(s,'DHCP',pc.id,'BOUND','RELEASED','Dirección retirada del puesto.');refresh();return 'Dirección liberada. IPv4: 0.0.0.0';}
 if(cmd==='ipconfig /renew'){if(r.services.dhcp===false||!status(id).gatewayAvailable||!a.local)return 'DHCP: sin respuesta del servicio local o sin acceso al gateway.';r.leases[pc.idx]='BOUND';P.event(s,'DHCP',pc.id,'DISCOVER','ACK',pc.ip);refresh();return 'DHCP DISCOVER → OFFER → REQUEST → ACK. Dirección asignada: '+access(id,pc).pcIp;}
 if(cmd==='route print'&&r.leases[pc.idx]==='RELEASED')return 'Sin rutas IPv4 de este adaptador: dirección liberada.';
 const resolve=name=>{if(isValidIPv4(name))return name;if(!a.network||!securityTest(id,'dns').ok||cr.services.dns===false)return null;return dnsNames[name]||null;};
 let m=cmd.match(/^nslookup (\S+)$/);if(m){const ip=resolve(m[1]);P.event(s,'DNS',pc.id,null,ip?'ANSWER':'NO_ANSWER',m[1]);return ip?'Servidor: '+security.services.dns+'\nNombre: '+m[1]+'\nDirección: '+ip:'DNS: nombre no registrado o servidor sin respuesta.';}
 m=cmd.match(/^curl https:\/\/(\S+?)(?:\/.*)?$/);if(m){const ip=resolve(m[1]);if(!ip)return 'DNS: no se pudo resolver el destino.';if(ip!==security.services.app)return 'Destino HTTPS no definido para esta operación.';const result=securityTest(id,'app');return a.network&&result.ok?'HTTP/1.1 200 OK\nAplicación disponible · host '+status('cm').dc.activeApplicationHost:'HTTPS: operación sin respuesta. '+result.reason;}
 m=command.trim().match(/^sim transaction ([A-Za-z0-9_-]{1,64})$/i);if(m){if(!a.network||!securityTest(id,'app').ok)return 'Operación no confirmada: aplicación o camino no disponible.';cr.operations=cr.operations||[];const duplicate=cr.operations.find(o=>o.id===m[1]);if(duplicate)return 'Operación '+m[1]+' ya confirmada en t='+duplicate.second+' s; no se duplica.';cr.operations.push({id:m[1],second:cr.clock,site:id});P.event(cm,'APP','dc','REQUEST','COMMIT',m[1]);return 'Operación '+m[1]+' confirmada en t='+cr.clock+' s del reloj virtual.';}
 if(cmd==='sip register'||cmd==='sip call'){
  const signaling=securityTest(id,'voice'),voice=securityCases(id).find(f=>f.id==='voice'),rtp=applyPolicy(security.evaluate(D.sites,{...voice,protocol:'udp',port:10000}),id);r.calls=r.calls||{};
  if(!signaling.ok||cmd==='sip call'&&rtp.action!=='allow'){r.calls[pc.idx]='DOWN';return 'Telefonía sin servicio: revisar PBX, red de voz y permisos SIP/RTP.';}
  if(cmd==='sip call'&&r.calls[pc.idx]!=='REGISTERED')return 'Primero registra el teléfono: sip register.';r.calls[pc.idx]=cmd==='sip register'?'REGISTERED':'CALL_ESTABLISHED';P.event(s,'SIP',pc.phoneId,null,r.calls[pc.idx],'Señalización TLS'+(cmd==='sip call'?' y permiso RTP disponibles.':'.'));return cmd==='sip register'?'SIP: teléfono registrado en PBX.':'Llamada simulada establecida: SIP TLS y RTP autorizados.';
 }
 return null;
}
function exportSpec(id){const p=site(id);return {profile:'C5',variant,scope:'MODELO_EDUCATIVO_NO_CONFIGURACION_DE_FABRICANTE',site:p,addressing:p.addressing,security:{services:security.services,rules:security.rules},endpoint_inventory:pcs(sede(id)),state:{adminDown:[...state(id).adminDown],protocolConfig:structuredClone(P.runtime(state(id)).config),virtualClockSeconds:P.runtime(state(id)).clock},temporary_faults_exported:false,temporary_icmp_exception_exported:false,vendor_interoperability_proven:false,physical_port_mapping_b_verified:false,source:{profile:D.profile,asOf:D.as_of,variant,siteId:id,repository:'hu-herrera/fina'},qos:security.qosPolicy,vpn:security.vpnPlan(p,null,variant==='B'?D.bSites:D.sites),recoveryObjectives:{rtoTargetSeconds:site('cm').datacenter_ha.recovery_seconds_target,rpoTargetSeconds:site('cm').datacenter_ha.rpo_seconds_target,rtoMeasuredSeconds:null,rpoMeasuredSeconds:null}};}
function download(id){const data=exportSpec(id),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='C5-'+variant+'-'+id+'-especificacion.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);return data;}
function normalizeDevice(id,type){return type==='router'||type==='fw'&&id==='cm'?(id==='cm'?(status(id).activeEdge||'fwA'):'r1'):type;}
function deviceConfig(id,n,startup=false){return root.C5DeviceConfig.build(site(id),n,variant,{...state(id),adminDown:startup?state(id).savedAdminDown:state(id).adminDown},status(id),security,variant==='B'?D.bSites:D.sites);}
function configText(id,n,startup=false){return root.C5DeviceConfig.text(deviceConfig(id,n,startup))+'\n\nCONFIGURACIÓN OPERATIVA DEL SIMULADOR\n'+JSON.stringify(startup?state(id).savedProtocolConfig||{}:P.runtime(state(id)).config,null,2);}
function deviceState(id,n){const z=status(id),c=deviceConfig(id,n);return ['Equipo: '+id.toUpperCase()+' / '+n,'Modelo: '+c.model,'Función: '+c.role,'IP de gestión: '+c.managementIp,...(c.server?[...['Núcleos: '+c.server.physical_cores,'RAM: '+c.server.ram_gib_after+' GiB','Almacenamiento: '+c.server.usable_storage_gb_after+' GB útiles'],'Servicios: '+c.server.services.map(s=>s.name+' '+s.ip).join(' · '),'Quórum: '+z.dc.votes+'/3','Aplicación / BD: '+(z.dc.activeApplicationHost||'sin host'),'Telefonía / servicios: '+(z.dc.activeServicesHost||'sin host')]:[]),'Estado: '+(c.powered?'Encendido':'Apagado'),...(c.isFirewall?['Sincronización de sesiones: '+(z.haSyncAvailable?'enlace disponible':'sin enlace; no se conserva el estado entre miembros')]:[]),...(/^(r|fw)/.test(n)?['Rol de borde: '+(c.active?'Activo':'Reserva'),'Transporte seleccionado: '+c.wan]:[]),'Redundancia: '+c.redundancy,'Interfaces operativas: '+c.ports.filter(p=>p.up).length+' / '+c.ports.length].join('\n');}
function downloadConfig(id,type){const text=configText(id,normalizeDevice(id,type)),url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='C5-'+variant+'-'+id+'-'+type+'-configuracion.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return text;}
function deviceTable(headers,rows){return '<div class="c5-policy-scroll"><table class="c5-policy-table"><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function cli(id,type,command){
 const short=command.trim().toLowerCase().replace(/\s+/g,' '),aliases={'en':'enable','conf t':'configure terminal','wr':'write memory','copy running-config startup-config':'write memory','show run':'show running-config','sh run':'show running-config','show start':'show startup-config','shut':'shutdown','no shut':'no shutdown'};command=aliases[short]||command.replace(/^sh\s+/i,'show ').replace(/^int\s+/i,'interface ');
  const n=normalizeDevice(id,type),z=status(id),s=state(id),p=site(id),cmd=command.trim().toLowerCase().replace(/\s+/g,' ');
 if(z.poweredNodes[n]===false||s.faults.includes('site')||s.faults.includes(n))return 'Sin respuesta: equipo apagado en el escenario.';
 const operation=Console.execute(consoleContext(id,n),command);if(operation)return operation.text;
 if(['show access-lists','show ip access-lists','show security policy','show firewall rules'].includes(cmd))return policyText(id);
 if(['help','?'].includes(cmd))return 'show status · show interfaces · show ip route · show inventory\nshow access-lists · show security policy · show running-config · show startup-config\nsim link <número> down|up (un enlace de este equipo)\nsim port <número de PC> down|up (el switch del PC)\nsave / write memory · clear · exit';
 if(cmd==='show status'||cmd==='show high-availability state')return deviceState(id,n);
 if(['show interfaces','show interface all','show interfaces status'].includes(cmd))return deviceConfig(id,n).ports.map(p=>'#'+p.index+' '+p.port+' ↔ '+p.peer+' / '+p.peerPort+' · '+p.role+' · '+(p.up?'UP':'DOWN')+' · '+p.speed+' Mbps'+(p.address?' · '+p.address:'')+(p.vlans.length?' · VLAN '+p.vlans.join(','):'')).join('\n');
 if(cmd==='show ip route'||cmd==='show routing route')return Object.values(p.addressing).map(a=>a.network+' · VLAN'+a.vlan).join('\n')+'\n'+(z.gatewayAvailable&&overlayReady(id)&&status('cm').dc.servicesHost?'Default full-tunnel por '+z.activeEdge+' / '+names[z.activeWan]: 'Default retirado: sin camino completo a central y sus servicios.');
 if(cmd==='show inventory'||cmd==='show version')return n+' · '+modelName(id,n)+'\nVariante '+variant;
 if(['show running-config','show configuration','/export','show startup-config'].includes(cmd))return configText(id,n,cmd==='show startup-config');
 if(['save','write memory'].includes(cmd))return save(id);
 const m=cmd.match(/^sim (link|port) (\d+) (down|up)$/);
 if(m){const i=Number(m[2]),target=m[1]+':'+i;
  if(m[1]==='link'&&!p.links.some((l,j)=>j===i&&(l.a===n||l.b===n)))return 'Enlace inexistente o ajeno a este equipo. Usa show interfaces.';
  if(m[1]==='port'&&!pcs(sede(id)).some(pc=>pc.idx===i&&'sw'+pc.sw===n))return 'Puerto de PC inexistente o ajeno a este switch.';
  s.adminDown=s.adminDown.filter(x=>x!==target);if(m[3]==='down')s.adminDown.push(target);refresh();return 'Estado administrativo aplicado en el modelo. save lo conserva al recargar.';
 }
 if(['clear','cls'].includes(cmd))return '';
 if(cmd==='exit')return 'Usa «Volver al PC» o Esc para salir de la consola.';
 return 'Comando no disponible. Escribe help para ver las opciones.';
}
function openDeviceView(id,type,tab='ov'){
 type=normalizeDevice(id,type);DEV_STATE={sedeId:id,type,tab,c5:true};
 document.getElementById('dev-title').textContent=sede(id).code+' · '+type;
 document.getElementById('dev-model').textContent=modelName(id,type);
 document.getElementById('dev-tabs').innerHTML=['ov','ports','networks','acl','config','cli','export'].map(t=>`<button class="dev-tab${t===tab?' active':''}" onclick="C5App.open('${id}','${type}','${t}')">${({ov:'Estado',ports:'Interfaces',networks:'VLAN / Redes',acl:'ACL / Seguridad',config:'Configuración',cli:'CLI',export:'Exportar'})[t]}</button>`).join('');
 const body=document.getElementById('dev-body');
 if(tab==='cli'){
  body.innerHTML=(PC_CONSOLE_RETURN?'<button class="btn btn-b" onclick="returnToPCTerminal()">Volver al PC</button>':'')+'<p class="ping-note">Escribe help para consultar los comandos.</p><div class="term"><pre id="c5-cli-out" style="white-space:pre-wrap;max-height:340px;overflow:auto"></pre><input id="c5-cli-input" class="term-input" aria-label="Comando C5" autocomplete="off"></div>';
  const out=document.getElementById('c5-cli-out');out.textContent='Conectado a '+type+'. Escribe help.';
  document.getElementById('c5-cli-input').onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();const c=e.target.value;e.target.value='';const r=cli(id,type,c);if(['clear','cls'].includes(c.trim().toLowerCase()))out.textContent='';else out.textContent+='\n'+type+'> '+c+'\n'+r;out.scrollTop=out.scrollHeight;};
 }else if(tab==='acl'){body.innerHTML=securityView(id);runSecurityTest(id);}else{
  const c=deviceConfig(id,type);
  if(tab==='ports')body.innerHTML=deviceTable(['Interfaz','Conexión','Función','VLAN','Dirección','Velocidad','Administración','Estado'],c.ports.map(p=>[p.port,p.peer+' / '+p.peerPort,p.role,p.vlans.join(',')||'L3',p.address||(c.server?'bond0 · '+c.server.management_ip:p.network)||'—',p.speed+' Mbps',p.enabled?'Habilitada':'Deshabilitada',p.up?'UP':'DOWN']).concat(c.endpoints.map(p=>[p.port,'Teléfono '+p.phone+' → PC '+p.pc,'Puesto','10 / voz 20',p.pc,'1 Gbps',p.enabled?'Habilitado':'Deshabilitado',p.up?'UP':'DOWN'])));
  else if(tab==='networks')body.innerHTML=deviceTable(['Red','VLAN','Subred','IP de interfaz','Gateway','Responsable'],c.vlans.map(v=>[v.name,v.vlan,v.network,v.interfaceIp||'—',v.gateway,v.owner]));
  else if(tab==='export')body.innerHTML='<h3>Exportación del equipo</h3><p>La configuración TXT reúne interfaces, redes, enrutamiento y reglas. La especificación JSON permite revisar los datos estructurados de la sede.</p>'+`<button class="btn btn-b" onclick="C5App.downloadConfig('${id}','${type}')">Descargar configuración TXT</button> <button class="btn btn-b" onclick="C5App.download('${id}')">Descargar especificación JSON</button>`;
  else if(tab==='config'){body.innerHTML=`<button class="btn btn-b" onclick="C5App.downloadConfig('${id}','${type}')">Descargar configuración TXT</button><pre id="c5-device-config" class="c5-config-text"></pre>`;document.getElementById('c5-device-config').textContent=configText(id,type);}
  else{body.innerHTML=(c.server?'<h3>'+esc(c.server.name)+' · '+esc(c.server.model)+'</h3>'+deviceTable(['Servicio','IP','Puerto'],c.server.services.map(s=>[s.name,s.ip,s.port])):'')+deviceTable(['Parámetro','Valor'],deviceState(id,type).split('\n').map(v=>{const i=v.indexOf(':');return [v.slice(0,i),v.slice(i+1).trim()];}));}
 }
 document.getElementById('dev-overlay').classList.add('vis');document.getElementById('c5-cli-input')?.focus();
}
root.C5App={enabled,state,status,access,site,pcs,variant:()=>variant,setVariant,fault,reset,cli,download,downloadConfig,deviceConfig,configText,diagnostics:()=>({inspections}),exportSpec,clearConfig,preferPrimary(id){state(id).preferredEdge=null;state(id).preferredWan=null;refresh();},open:(id,type,tab)=>{PC_CONSOLE_RETURN=null;openDeviceView(id,type,tab);},pcConsole(id){const z=status(id),nodes=id==='cm'?['fwA','fwB']:['r1','r2'],chosen=z.activeEdge||nodes.find(n=>z.poweredNodes[n])||nodes[0],error=connectPCConsole(sede(id),pcs(sede(id))[0],chosen);if(error){const out=document.getElementById('pc-console-status');if(out)out.textContent=error;}return error;}};
const prior=root.ActiveProfile;
Object.assign(root.C5App,{
 protocolAction,protocolView,pcCommand,advanceClock,syncProtocols,routeText,securityCases,securityTest,securityView,runSecurityTest,assuranceView,runQos,runRecoveryAudit,recoveryExercise,recoveryExerciseView,runRecoveryExercise,qosClassify:flow=>security.qosClassify(D.sites,flow),recoveryAudit:()=>M.recoveryAudit(site('cm')),
 openSecurity(id){openSedeModal(id);const btn=document.querySelector('#sm-tabs [data-c5-security]');smTab('acl',btn);},
 beginPresentationSession(){
  if(demoSession)throw Error('Ya hay una sesión de presentación activa.');
  const snapshot=structuredClone({variant,states:[...states],transport:[...transport]});
  demoSession=true;recoveryEpoch++;states.clear();transport.clear();return snapshot;
 },
 resetPresentationScene(){if(!demoSession)throw Error('No hay sesión temporal.');recoveryEpoch++;states.clear();transport.clear();initLinks();PING_DIAGNOSTIC_RULE=null;},
 endPresentationSession(snapshot){
  recoveryEpoch++;variant=snapshot.variant;states.clear();transport.clear();for(const [k,v] of snapshot.states)states.set(k,v);for(const [k,v] of snapshot.transport)transport.set(k,v);demoSession=false;
  document.getElementById('c5-profile-select').value=variant;
 }
});
root.ActiveProfile=Object.freeze({...prior,enabled:()=>enabled()||prior.enabled(),selectedWan:id=>enabled()?M.MW[status(id).activeWan]||null:prior.selectedWan(id),status:id=>enabled()?status(id):prior.status(id),siteReady:id=>enabled()?Boolean(overlayReady(id)&&status('cm').dc.servicesHost):prior.siteReady(id),l2Local:(id,n)=>enabled()?status(id).switchLocalL2[n]:prior.l2Local(id,n),path:(id,n)=>enabled()?status(id).switchGateway[n]:prior.path(id,n),overlayInterfaceUp:id=>enabled()?Boolean(overlayReady(id)&&status('cm').dc.servicesHost):prior.overlayInterfaceUp(id),rawSite:id=>enabled()?{nodes:{router:Boolean(status(id).activeEdge),firewall:status('cm').poweredNodes.fwA||status('cm').poweredNodes.fwB,sw1:status(id).switchLocalL2[1],sw2:status(id).switchLocalL2[2]}}:prior.rawSite(id)});
wrap('getPCs',pcs);wrap('getSwitchPCPorts',(s,n)=>pcs(s).filter(p=>p.sw===n).map(pc=>({pc,port:pc.port})));
wrap('isSwitchPCPortAvailable',(id,pc)=>Boolean(pc&&access(id,pc).local));wrap('isPCNetworkAvailable',(id,pc)=>Boolean(pc&&access(id,pc).network));
wrap('isPCOnConfiguredVlan',()=>true);wrap('getSwitchPCVlan',(id,pc)=>access(id,pc).pcMode==='wifi'?110:10);
wrap('isSiteLanAvailable',id=>Boolean(status(id).gatewayAvailable&&overlayReady(id)&&status('cm').dc.servicesHost));wrap('isRouterLanAvailable',id=>status(id).gatewayAvailable);
wrap('isSwitchStackLinkAvailable',id=>status(id).interMemberL2);wrap('isSwitchUplinkAvailable',(id,n)=>status(id).switchGateway[n]);wrap('isSwitchPathAvailable',(id,n)=>status(id).switchGateway[n]);
wrap('isWanInterfaceAdminDown',(id,k)=>!status(id).wanAvailable.some(w=>M.MW[w]===k));
wrap('displayLinkStates',id=>Object.fromEntries(Object.entries(M.MW).map(([w,k])=>[k,status(id).activeWan===w?'activo':status(id).wanAvailable.includes(w)?'standby':'caido'])));
wrap('renderTopoTab',topology);wrap('renderActiveTopoTab',topology);
wrap('renderRedundantLabTab',s=>lab(s)+`<p class="ping-note">No se retorna automáticamente al equipo/WAN reparado. «Volver al principal» reevalúa la preferencia manualmente; E7 añade una espera didáctica de estabilidad.</p><button class="btn btn-b" onclick="C5App.preferPrimary('${s.id}')">Volver al principal</button><details><summary>Túneles y transporte de la VPN</summary>`+(s.id==='cm'?'<p>Los cuatro transportes de central son extremos del overlay; las sucursales pueden usar un proveedor distinto al central.</p>':['r1','r2'].flatMap(e=>site(s.id).wan_services.map(w=>button(s.id,'tunnel:'+e+':'+w.id,e+' / '+names[w.id]))).join(''))+'</details>');
wrap('buildPacketRoute',route);wrap('collapsePacketRoute',r=>r);
wrap('renderLocalPingTopology',(s,a,b)=>'<div class="ping-local-topology"><p>'+route(s,s,false,a,b).map(n=>esc(n.label)).join(' → ')+'</p></div>');
wrap('packetPolicyDecision',(src,dst,a,b,app='icmp')=>{
 if(!a||!b)return {action:'deny',rule:'HOST-NO-DISPONIBLE'};
 return applyPolicy(security.evaluate(D.sites,{sourceSite:src.id,sourceIp:access(src.id,a).pcIp,destinationIp:access(dst.id,b).pcIp,protocol:app==='icmp'?'icmp':'tcp',port:app==='icmp'?0:app==='ssl'?443:22},PING_DIAGNOSTIC_RULE),src.id);
});
const oldSetRule=setPingDiagnosticRule;
wrap('setPingDiagnosticRule',(src,dst,source,target)=>{const active=(id,ip)=>{const p=site(id)&&pcs(sede(id)).find(p=>p.ip===ip||access(id,p).pcIp===ip);return p?access(id,p).pcIp:ip;};oldSetRule(src,dst,src?active(src,source):source,src?active(dst,target):target);});
wrap('pingHostOptions',(s,exclude)=>pcs(s).filter(p=>p.ip!==exclude).map(p=>{const a=access(s.id,p);return '<option value="'+p.ip+'">'+esc(p.id)+' · '+a.pcIp+' · '+a.pcMode+' · VLAN '+(a.pcMode==='wifi'?110:10)+(a.local?'':' · sin acceso')+'</option>';}).join(''));
wrap('evaluateMapPing',(srcId,dstId,sourceIp,targetIp)=>{
 const src=sede(srcId),dest=sede(dstId);if(!src||!dest)return null;
 const srcPc=sourceIp?pcs(src).find(p=>p.ip===sourceIp||access(srcId,p).pcIp===sourceIp):pcs(src)[0],destPc=targetIp?pcs(dest).find(p=>p.ip===targetIp||access(dstId,p).pcIp===targetIp):pcs(dest)[0];
 const policy=packetPolicyDecision(src,dest,srcPc,destPc),r=route(src,dest,false,srcPc,destPc),ok=r.length>=2;
 const reason=ok?'':!srcPc||!destPc?'Host no disponible.':policy.action!=='allow'?'Bloqueado por política: '+policy.rule:'Sin ruta C5: revisar acceso, enlaces LAN/WAN, hub CM y dependencia de servicios centrales.';
 const blockedRoute=srcPc?localPath(src,srcPc):[];
 return {src,dest,srcPc,destPc,policy,route:r,blockedRoute,ok,reason,endpoint:getWanEndpoint(src,false),rtt:ok?estimatePingRtt(src,dest,r):0};
});
wrap('buildSimulationGraph',()=>({nodes:new Map(),edges:new Map()}));
wrap('findDeviceTargetPC',ip=>{for(const s of SEDES){const pc=pcs(s).find(p=>access(s.id,p).local&&access(s.id,p).pcIp===ip);if(pc)return {site:s,pc};}return null;});
wrap('evaluatePCPing',(s,pc,target)=>{
 const a=access(s.id,pc),p=site(s.id);
 if(!isValidIPv4(target))return {ok:false,reason:'Destino IPv4 no válido o nombre no modelado.'};
 if(target==='127.0.0.1'||a.local&&target===a.pcIp)return {ok:true,rtt:1,route:[{label:pc.id+' · '+a.pcIp}]};
 const peer=findDeviceTargetPC(target);
 if(peer){const r=route(s,peer.site,false,pc,peer.pc),policy=packetPolicyDecision(s,peer.site,pc,peer.pc);return {ok:r.length>=2,rtt:r.length?estimatePingRtt(s,peer.site,r):0,route:r,peer,reason:policy.action==='allow'?'Sin ruta C5 disponible.':'Bloqueado: '+policy.rule};}
 if(target===(a.pcMode==='wifi'?p.addressing.wifi_users.gateway:p.addressing.users.gateway))return {ok:a.network,rtt:1,route:a.network?[{label:pc.id},{label:s.id==='cm'?'Gateway del firewall central':'SVI del acceso'}]:[],reason:'Sin conexión al gateway local.'};
 return {ok:false,reason:'Destino sin respuesta ICMP. Para probar servicios centrales, abre ACL / Seguridad.'};
});
wrap('renderDetail',details);wrap('genPCConfig',pcConfig);
const oldPCTerminal=genPCTerminal;
wrap('genPCTerminal',(s,pc)=>oldPCTerminal(s,pc).replace('console router',s.id==='cm'?'console fwa':'console r1').replace('console fw</strong>',s.id==='cm'?'console fwb</strong>':'console r2</strong>'));
const oldOpenSite=openSedeModal;
openSedeModal=function(id){oldOpenSite(id);let b=document.querySelector('#sm-tabs [data-c5-security]');if(enabled()&&!b){b=document.createElement('button');b.type='button';b.className='sm-tab';b.dataset.c5Security='true';b.onclick=()=>smTab('acl',b);document.getElementById('sm-tabs').append(b);}if(b){b.textContent='ACL / Seguridad';b.hidden=!enabled();}};
const openSiteWithSecurity=openSedeModal;
openSedeModal=function(id){openSiteWithSecurity(id);let b=document.querySelector('#sm-tabs [data-c5-assurance]');if(enabled()&&!b){b=document.createElement('button');b.type='button';b.className='sm-tab';b.dataset.c5Assurance='true';b.textContent='QoS / VPN / HA';b.onclick=()=>smTab('assurance',b);document.getElementById('sm-tabs').append(b);}if(b)b.hidden=!enabled();};
const oldSiteTab=smTab;
smTab=function(tab,btn){if(!['acl','assurance'].includes(tab)||!enabled())return oldSiteTab(tab,btn);rememberTopologyView();SM_TAB=tab;document.querySelectorAll('.sm-tab').forEach(b=>b.classList.toggle('active',b===btn));document.getElementById('sm-body').innerHTML=tab==='acl'?securityView(SM_ID):assuranceView(SM_ID);if(tab==='acl')runSecurityTest(SM_ID);else runQos(SM_ID);};
wrap('openDevice',(type,id)=>{PC_CONSOLE_RETURN=null;openDeviceView(id,type);});
wrap('connectPCConsole',(s,pc,type)=>{
 if(pc.idx!==1)return 'La consola local está conectada al PC 001 de la sede.';
 type=normalizeDevice(s.id,type);if(![...(s.id==='cm'?['fwA','fwB']:['r1','r2']),'sw1','sw2'].includes(type))return 'Ese equipo no existe en la topología de esta sede.';
 if(!status(s.id).poweredNodes[type])return 'Sin respuesta: equipo apagado en el escenario.';
 PC_CONSOLE_RETURN={sedeId:s.id,pcIdx:pc.idx-1};openDeviceView(s.id,type,'cli');return null;
});
wrap('renderCmdTab',s=>summary(s.id)+[...(s.id==='cm'?['fwA','fwB']:['r1','r2']),'sw1','sw2'].map(t=>`<button class="btn btn-b" onclick="C5App.open('${s.id}','${t}','cli')">Consola ${t}</button>`).join('')+`<button class="btn btn-b" onclick="C5App.download('${s.id}')">Exportar C5 JSON</button>`);
wrap('renderTablesTab',s=>'<pre style="white-space:pre-wrap">'+esc(pcs(s).map(p=>{const a=access(s.id,p);return p.id+' · '+a.pcIp+' · '+a.pcMode+' · '+p.phoneId+' '+a.phoneIp;}).join('\n'))+'</pre>');
wrap('renderKPIsTab',s=>summary(s.id)+'<p>Metas de diseño: central '+D.scope.availability_core_target_percent+' %, sucursal '+D.scope.availability_branch_target_percent+' %. Requieren medición y SLA para acreditarse.</p><p>Recuperación objetivo: 300 s. Pérdida de datos objetivo: 60 s. Ambas siguen sin medición de una aplicación real.</p>');
wrap('showModal',()=>{document.getElementById('modal-body').innerHTML=summary('cm')+dcInfo();document.getElementById('modal').classList.add('vis');});
wrap('openComparativa',()=>{document.getElementById('comp-body').innerHTML='<h3>ANTES → C5</h3><p>23 sedes, 650 puestos, datacenter dentro de CM. Inventario mixto según renovación por sede.</p><h3>A · Cisco / Palo Alto</h3><p>44 routers de sucursal (7 reutilizados), 44 switches de sucursal (17 reutilizados) y dos firewalls centrales. Se conservan dos switches centrales, servidores y teléfonos.</p><h3>B · MikroTik / OPNsense</h3><p>44 routers y 44 switches MikroTik, dos OPNsense centrales, switches Cisco centrales reutilizados. No se atribuye StackWise ni una CLI PAN-OS a MikroTik. Misma intención de conectividad; interoperabilidad física no certificada.</p>';document.getElementById('modal-comp').classList.add('vis');});
const oldReset=sc_reset;sc_reset=function(){recoveryEpoch++;if(enabled())for(const p of D.sites){state(p.id).faults=[];state(p.id).preferredEdge=null;state(p.id).preferredWan=null;}return oldReset();};
wrap('resetRedundantLab',reset);wrap('toggleRedundantLab',(id,kind,k)=>fault(id,k==='router'?(id==='cm'?'fwA':'r1'):k==='firewall'?'fwA':k));
wrap('sc_e3',()=>fault('cm','fwA'));
wrap('sc_e4',()=>{const id='s19',s=state(id);if(!s.faults.includes('site'))s.faults.push('site');for(const w of site(id).wan_services)ST.links[id][M.MW[w.id]]='caido';if(ST.failback[id])ST.failback[id].pending=false;ST.evCount++;addLog('C5 · E4: caída completa de S19. Equipos, red local y cuatro WAN indisponibles; el respaldo externo no recupera una sede apagada.','alert');refresh();selectSede(id);});
wrap('sc_dropLink',(k,silent)=>{let count=0;for(const s of D.sites)if(s.wan_services.some(w=>M.MW[w.id]===k)){ST.links[s.id][k]='caido';count++;}ST.evCount++;if(!silent)addLog('C5 · '+LK_NAME[k]+' interrumpido en '+count+' ubicaciones del alcance.','warn');refresh();});
wrap('sc_dropAll',()=>{for(const s of D.sites)for(const w of s.wan_services)ST.links[s.id][M.MW[w.id]]='caido';ST.evCount++;addLog('C5 · todas las WAN interrumpidas; no se infiere probabilidad de falla.','alert');refresh();});
wrap('sc_drop2',()=>{for(const s of D.sites){const available=s.wan_services.filter(w=>!['caido','inactivo'].includes(ST.links[s.id][M.MW[w.id]]));for(const w of available.sort(()=>Math.random()-.5).slice(0,Math.min(2,Math.max(0,available.length-1))))ST.links[s.id][M.MW[w.id]]='caido';}ST.evCount++;addLog('C5 · caída aleatoria de hasta dos transportes; se conserva uno por ubicación, no se certifica servicio.','warn');refresh();});
wrap('sc_e2',()=>{for(const id of ['s15','s16','s17']){ST.links[id].kuiper='caido';ST.links[id].g4='caido';}ST.evCount++;addLog('C5 · Leo y WOM interrumpidos en tres sedes; revisar alternativa disponible.','warn');refresh();});
wrap('sc_e6',()=>{for(const s of D.sites){ST.links[s.id].starlink='caido';ST.links[s.id].kuiper='caido';}ST.evCount++;addLog('C5 · satelitales interrumpidos. Sucursales y CM conservan Entel/WOM; continúa el camino central si sus equipos, VPN y servicios están disponibles. Capacidad móvil degradada.','alert');refresh();});
wrap('sc_e7',()=>{const epoch=++recoveryEpoch,v=variant;let count=0;for(const s of D.sites)if(ST.links[s.id].starlink==='caido'){ST.links[s.id].starlink='recuperando';count++;}addLog('C5 · retorno controlado Starlink: espera didáctica de 5 segundos; no es una medición real.','warn');refresh();if(count)setTimeout(()=>{if(epoch!==recoveryEpoch||v!==variant||!enabled())return;for(const s of D.sites)if(ST.links[s.id].starlink==='recuperando'){ST.links[s.id].starlink='standby';state(s.id).preferredWan=null;}addLog('C5 · ventana de estabilidad simulada completada; se reevalúa el principal disponible.','ok');refresh();},5000);});
const oldToggle=toggleMode;toggleMode=function(){recoveryEpoch++;if(enabled())transport.set('after:'+variant,JSON.parse(JSON.stringify(ST.links)));PING_DIAGNOSTIC_RULE=null;PC_CONSOLE_RETURN=null;document.getElementById('dev-overlay').classList.remove('vis');closeSedeModal();oldToggle();if(enabled()&&transport.has('after:'+variant)){ST.links=JSON.parse(JSON.stringify(transport.get('after:'+variant)));refresh();}document.getElementById('c5-profile-select').disabled=!enabled();};
const oldOpenSede=openSedeModal;openSedeModal=function(id){oldOpenSede(id);if(enabled()){document.getElementById('sm-sub').textContent=sede(id).city+' · C5 · '+label()+' · '+site(id).workstations+' pares teléfono/PC';document.querySelector('#sm-tabs [onclick*="lab"]').textContent='Fallos / WAN / continuidad';}};
const oldMetrics=updateMetrics;updateMetrics=function(){oldMetrics();if(enabled()){document.getElementById('m-op').nextElementSibling.textContent='Sedes con ruta central';document.getElementById('m-down').nextElementSibling.textContent='Sin ruta central';const b=document.querySelector('#sg-acad-despues [onclick="sc_e3()"]');if(b)b.textContent='E3 Firewall CM';const e4=document.querySelector('#sg-acad-despues [onclick="sc_e4()"]');if(e4)e4.textContent='E4 Sede caída';}};
// Keep one selector reachable from the map, not hidden inside an already-open topology.
const choice=document.createElement('label');choice.className='c5-profile-picker';choice.innerHTML='Equipos <select id="c5-profile-select" aria-label="Alternativa de equipos"><option value="A">A · Cisco / Palo Alto</option><option value="B">B · MikroTik / OPNsense</option></select>';
document.getElementById('topbar').append(choice);document.getElementById('c5-profile-select').value=variant;document.getElementById('c5-profile-select').onchange=e=>setVariant(e.target.value);
LK_NAME.g4='WOM 4G';LK_NAME.kuiper='Amazon Leo';
document.querySelector('#leg-4g').lastChild.textContent='WOM 4G';
const drop4=document.querySelector('[onclick="sc_dropLink(\'g4\')"]');if(drop4)drop4.textContent='↓ WOM 4G';
// Provider panels show design inputs, not invented SLA, RF measurements or device logs.
function info(title,subtitle,body){PC_CONSOLE_RETURN=null;DEV_STATE={type:'c5-info',tab:'ov'};document.getElementById('dev-title').textContent=title;document.getElementById('dev-model').textContent=subtitle;document.getElementById('dev-tabs').innerHTML='';document.getElementById('dev-body').innerHTML='<div class="c5-summary">'+body+'</div>';document.getElementById('dev-overlay').classList.add('vis');}
wrap('openProveedorModal',(id,k)=>{const w=site(id)?.wan_services.find(w=>M.MW[w.id]===k);if(!w)return info('Transporte no incluido','C5 · '+id.toUpperCase(),'<p>Esta ubicación no tiene este transporte. Central dispone de Starlink, Leo, Entel y WOM.</p>');info(names[w.id]+' · '+id.toUpperCase(),'Enlace y capacidad','<p>Estado: '+displayLinkStates(id)[k]+'. Distribuidor '+w.distributor+'. VLAN '+w.vlan+'.</p><p>'+(w.id==='leo'?'Terminal Leo Ultra: hasta '+rate(w.terminal_peak_down_mbps)+' de bajada y '+rate(w.terminal_peak_up_mbps)+' de subida. Mínimo de aceptación del perfil crítico: '+w.down_required_mbps+'/'+w.up_required_mbps+' Mbps; no es la velocidad del terminal.':w.up_required_mbps?'Servicio del proyecto: '+rate(w.down_required_mbps)+' de bajada / '+rate(w.up_required_mbps)+' de subida.':'Contingencia móvil'+(w.data_gb?' · '+w.data_gb+' GB mensuales.':'.'))+'</p><p><a href="https://github.com/hu-herrera/financiera-pacifico-entrega-docente/blob/main/Anexos/Inventario_IPAM_Puertos.md" target="_blank" rel="noopener">Ficha técnica y condiciones del enlace</a></p>');});
wrap('openAntenaModal',id=>{const a=ANTENAS.find(a=>a.id===id);if(a)openProveedorModal(a.sedeId,a.tipo);});
wrap('showTipAntena',(e,a)=>{document.getElementById('tt-name').textContent=a.tipo==='g5'?'Entel 5G':'WOM 4G';document.getElementById('tt-ip').textContent=a.city;document.getElementById('tt-links').textContent='Acceso móvil de contingencia';const tip=document.getElementById('tooltip'),box=document.getElementById('map-container').getBoundingClientRect();tip.style.left=Math.max(0,e.clientX-box.left+10)+'px';tip.style.top=Math.max(0,e.clientY-box.top+10)+'px';tip.classList.add('vis');});
wrap('openSatModal',tipo=>info(tipo==='starlink'?'Starlink':'Amazon Leo','Conectividad WAN de las sedes','<p>Los transportes satelitales proporcionan los caminos principal y alternativo de la red.</p><p>Selecciona el enlace de una sede para consultar su capacidad objetivo, distribuidor y estado.</p>'));
refresh();addLog('C5 activo: routers por sucursal, seguridad centralizada, datacenter y teléfonos existentes. '+label()+'.','ok');
})(window);

