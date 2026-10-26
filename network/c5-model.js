/* Logical C5 paths; this does not execute OSPF, IPsec, HA or applications. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.C5Model=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const MW={starlink:'starlink',leo:'kuiper',entel5g:'g5',wom4g:'g4'};
const makeState=()=>({faults:[],adminDown:[],savedAdminDown:[],preferredEdge:null,preferredWan:null,preferredApplicationHost:null,preferredServicesHost:null});
function endpoints(s){return s.endpoints.map((p,i)=>({idx:i+1,id:'PC-'+(s.id==='cm'?'CM':s.id.toUpperCase())+'-'+String(i+1).padStart(3,'0'),ip:p.pc,phoneIp:p.phone,phoneId:'TEL-'+s.id.toUpperCase()+'-'+String(i+1).padStart(3,'0'),phoneModel:'SIP-T54W',sw:p.switch,port:p.port,vlan:10,voiceVlan:20,mac:`02:75:${s.number.toString(16).padStart(2,'0')}:00:${(i+1).toString(16).padStart(2,'0')}:01`}));}
function inspect(s,state,external={}){
 const bad=new Set([...state.faults,...state.adminDown]),up=k=>!bad.has('site')&&!bad.has(k),edges=s.id==='cm'?['fwA','fwB']:['r1','r2'];
 const usable=(l,i)=>up(l.a)&&up(l.b)&&up(l.a+':'+l.portA)&&up(l.b+':'+l.portB)&&up('link:'+i);
 const links=s.links.filter(usable),members=[1,2].filter(n=>up('sw'+n));
 const fabric=members.length===2&&links.some(l=>l.role==='STACK'),partition=members.length===2&&!fabric;
 // No split-brain or forwarding guarantee is invented after complete control/fabric isolation.
 const carp=s.after.firewall_ha_control==='CARP_SERVICE_INTERFACES';
 const sharedCarp=carp&&members.some(member=>edges.every(e=>links.some(l=>l.a===e&&l.b==='sw'+member&&l.role==='LAN_AGGREGATE')));
 const ha=s.id!=='cm'||!edges.every(up)||(carp?sharedCarp:links.some(l=>['HA1','HA1_BACKUP'].includes(l.role)));
 const haSyncAvailable=s.id==='cm'&&links.some(l=>carp?l.role==='HA1':['HA2','HA2_BACKUP'].includes(l.role));
 const paths=[];
 if(!partition&&ha)for(const member of members)for(const edge of edges){
  const lan=links.some(l=>l.a===edge&&l.b==='sw'+member&&l.role.startsWith('LAN_'));
  if(!lan)continue;
  for(const w of s.wan_services){
   if(!up('wan:'+w.id)||!up('upstream:'+w.id)||!up('tunnel:'+edge+':'+w.id)||external[w.id]===false)continue;
   if(links.some(l=>l.a===edge&&l.b===w.distributor&&l.role.startsWith('WAN_')&&(l.role==='WAN_TRUNK'?l.allowed_vlans.includes(w.vlan):l.vlan===w.vlan))&&links.some(l=>l.a==='cpe:'+w.id&&l.b===w.distributor&&l.role==='WAN_ACCESS'&&l.vlan===w.vlan))paths.push({switch:member,edge,wan:w.id,distributor:w.distributor});
  }
 }
 const edge=[state.preferredEdge,...edges].find(e=>paths.some(p=>p.edge===e))||null;
 const available=s.wan_services.filter(w=>paths.some(p=>p.edge===edge&&p.wan===w.id));
 const wan=available.find(w=>w.id===state.preferredWan)?.id||available[0]?.id||null;
 if(edge)state.preferredEdge=edge;if(wan)state.preferredWan=wan;
 const localGateway=s.id==='cm'?members.length>0&&!partition&&ha&&edges.some(e=>links.some(l=>l.a===e&&/^sw[12]$/.test(l.b)&&l.role.startsWith('LAN_'))):members.length>0&&!partition;
 const perSwitch=Object.fromEntries([1,2].map(n=>[n,Boolean(up('sw'+n)&&localGateway)]));
 const serverConnected=id=>up(id)&&links.some(l=>l.a===id&&l.role.startsWith('SERVER_')&&(id==='backup'?l.vlan===50:l.allowed_vlans?.includes(50)&&l.allowed_vlans?.includes(130))&&members.includes(Number(l.b.at(-1))));
 const hosts=s.datacenter_ha?.enabled?s.datacenter_ha.nodes.filter(serverConnected):['dc1','dc2'].filter(up),witness=serverConnected('backup'),votes=hosts.length+(witness?1:0),quorum=!partition&&up('cluster:quorum')&&votes>=2,replication=up('storage:replication')&&up('storage:stale')&&up('storage:inconsistent');
 const selectHost=(preference,original)=>{const next=hosts.includes(preference)?preference:hosts.includes(original)?original:hosts[0];return next&&((next===(preference||original))||quorum&&replication&&up('cluster:fencing'))?next:null;};
 const appHost=selectHost(state.preferredApplicationHost,'dc1'),serviceHost=selectHost(state.preferredServicesHost,'dc2');
 if(s.datacenter_ha?.enabled&&quorum&&appHost)state.preferredApplicationHost=appHost;if(s.datacenter_ha?.enabled&&quorum&&serviceHost)state.preferredServicesHost=serviceHost;
 const dc=s.datacenter_ha?.enabled?{hosts,backup:witness,quorum,votes,replication,activeApplicationHost:quorum&&up('vm:application')?appHost:null,activeServicesHost:quorum&&up('vm:services')?serviceHost:null,activeMonitoringHost:quorum&&hosts.length===2?hosts.find(h=>h!==appHost)||serviceHost:null,applicationHost:Boolean(quorum&&appHost&&up('vm:application')),servicesHost:Boolean(quorum&&serviceHost&&up('vm:services')),monitoringHost:quorum&&hosts.length===2&&Boolean(serviceHost),mode:hosts.length===2?'normal':'contingencia',recoveryTested:false}:{hosts,backup:up('backup'),applicationHost:up('dc1')&&up('sw1'),servicesHost:up('dc2')&&up('sw2'),recoveryTested:false};
 return {profile:'C5',siteAvailable:up('site'),switchLocalL2:{1:up('sw1'),2:up('sw2')},interMemberL2:fabric,stackPartitioned:partition,activeStackMembers:members,gatewayAvailable:localGateway,
  activeEdge:edge,activeWan:wan,wanAvailable:s.wan_services.filter(w=>paths.some(p=>p.wan===w.id)).map(w=>w.id),paths,links,
  switchGateway:perSwitch,haControl:ha,haSyncAvailable,capacityCertified:false,sessionContinuityVerified:false,
  poweredNodes:Object.fromEntries([...edges,'sw1','sw2','wanA','wanB','dc1','dc2','backup'].map(n=>[n,up(n)])),
  dc};
}
function access(s,state,pc,z=inspect(s,state)){
 const bad=new Set([...state.faults,...state.adminDown]);
 const admin=!bad.has('port:'+pc.idx),phonePower=!bad.has('phone:power:'+pc.idx);
 const wired=admin&&phonePower&&z.switchLocalL2[pc.sw];
 const aps=[1,2].flatMap(n=>Array.from({length:s.id==='cm'?2:1},(_,i)=>({id:'ap'+((n-1)*(s.id==='cm'?2:1)+i+1),switch:n}))).map(a=>({...a,link:z.links.find(l=>l.a===a.id&&l.b==='sw'+a.switch&&l.role==='AP_TRUNK')})).filter(a=>z.switchGateway[a.switch]&&!bad.has(a.id)&&a.link?.allowed_vlans.includes(130));
 const possible=admin&&z.siteAvailable&&!bad.has('wifi:auth')&&!bad.has('wifi:coverage');
 const pcAps=possible?aps.filter(a=>a.link.allowed_vlans.includes(110)):[],phoneAps=possible?aps.filter(a=>a.link.allowed_vlans.includes(120)):[];
 const ap=pcAps.length?pcAps[(pc.idx-1)%pcAps.length]:null,phoneAp=phoneAps.length?phoneAps[(pc.idx-1)%phoneAps.length]:null,pcWifi=!wired&&Boolean(ap)&&!bad.has('wifi:pc:'+pc.idx),phoneWifi=!wired&&phonePower&&Boolean(phoneAp)&&!bad.has('wifi:phone:'+pc.idx);
 return {pcMode:wired?'wired':pcWifi?'wifi':'down',phoneMode:wired?'wired':phoneWifi?'wifi':'down',switch:wired?pc.sw:pcWifi?ap.switch:null,phoneSwitch:wired?pc.sw:phoneWifi?phoneAp.switch:null,ap:pcWifi?ap.id:null,phoneAp:phoneWifi?phoneAp.id:null,local:wired||pcWifi,network:(wired||pcWifi)&&z.gatewayAvailable,pcIp:pcWifi?s.endpoints[pc.idx-1].wifi_pc_reserved:pc.ip,phoneIp:phoneWifi?s.endpoints[pc.idx-1].wifi_phone_reserved:pc.phoneIp,recoveryMeasured:false};
}
function choosePath(s,z,member){return z.paths.find(p=>p.switch===member&&p.wan===z.activeWan&&p.edge===z.activeEdge)||z.paths.find(p=>p.switch===member&&p.wan===z.activeWan)||(z.interMemberL2?z.paths.find(p=>p.wan===z.activeWan):null)||null;}
function overlayPath(branch,z,hub,hz){
 if(!z.activeWan||!hz.activeWan||!z.gatewayAvailable||!hz.gatewayAvailable)return false;
 if(branch.id==='cm')return true;
 const w=hub.wan_services.find(w=>w.id===hz.activeWan),endpoint='CM_'+hz.activeWan.toUpperCase();
 return Boolean(w?.carrier_handoff?.static_reachable_ipsec_endpoint_required&&(branch.tunnels||[]).some(t=>t.router===z.activeEdge&&t.wan===z.activeWan&&t.hub_endpoint===endpoint&&t.hub_public_ip===w.carrier_handoff.vip));
}
function recoveryAudit(s){
 if(!s.datacenter_ha?.enabled)throw Error('La prueba requiere el datacenter con HA.');
 const tests=[
  {label:'Caída DC-01: aplicación y BD pasan a DC-02',faults:['dc1'],check:z=>z.dc.activeApplicationHost==='dc2'&&z.dc.servicesHost},
  {label:'Caída DC-02: servicios pasan a DC-01',faults:['dc2'],check:z=>z.dc.activeServicesHost==='dc1'&&z.dc.applicationHost},
  {label:'Caída del testigo: dos hosts conservan mayoría',faults:['backup'],check:z=>z.dc.votes===2&&z.dc.applicationHost&&z.dc.servicesHost},
  {label:'Host y testigo caídos: se detiene por falta de mayoría',faults:['dc1','backup'],check:z=>!z.dc.quorum&&!z.dc.applicationHost&&!z.dc.servicesHost},
  {label:'Sin fencing: no reinicia la aplicación en otro host',faults:['dc1','cluster:fencing'],check:z=>!z.dc.applicationHost},
  {label:'Sin réplica: no anuncia recuperación de la aplicación',faults:['dc1','storage:replication'],check:z=>!z.dc.applicationHost},
  {label:'Caída de SW1: hosts accesibles por la segunda NIC',faults:['sw1'],check:z=>z.dc.hosts.length===2&&z.dc.applicationHost&&z.dc.servicesHost},
  {label:'Caída de ambos hosts: servicios interrumpidos',faults:['dc1','dc2'],check:z=>!z.dc.applicationHost&&!z.dc.servicesHost}
 ];
 const rows=tests.map(t=>{const z=inspect(s,{...makeState(),faults:[...t.faults]});return {label:t.label,faults:t.faults,pass:Boolean(t.check(z)),votes:z.dc.votes,applicationHost:z.dc.activeApplicationHost,servicesHost:z.dc.activeServicesHost};});
 return {scope:'MODELO_LOGICO',rows,passed:rows.filter(r=>r.pass).length,total:rows.length,rtoTargetSeconds:s.datacenter_ha.recovery_seconds_target,rpoTargetSeconds:s.datacenter_ha.rpo_seconds_target,rtoMeasuredSeconds:null,rpoMeasuredSeconds:null,sessionsPreserved:false,hardwareVerified:false};
}
// Synthetic ledger: demonstrates replica selection and reconciliation, never bank transactions.
function recoveryExercise(s,options={}){
 if(!s.datacenter_ha?.enabled)throw Error('El ejercicio requiere HA en Casa Matriz.');
 const scenario=options.scenario||'host';
 const scenarios={host:['dc1'],stale:['dc1','storage:stale'],quorum:['dc1','backup'],fencing:['dc1','cluster:fencing'],corrupt:['dc1','storage:inconsistent'],application:['dc1','vm:application'],both:['dc1','dc2']};
 if(!Object.hasOwn(scenarios,scenario))throw Error('Escenario de recuperación desconocido.');
 const failureSecond=options.failureSecond??120;
 if(!Number.isFinite(failureSecond)||failureSecond<0)throw Error('Instante de fallo inválido.');
 const snapshots=options.snapshots??[{second:scenario==='stale'?0:90,status:'complete',integrity:scenario!=='corrupt',applicationConsistent:true},{second:110,status:'failed',integrity:true,applicationConsistent:true}];
 if(!Array.isArray(snapshots)||snapshots.some(p=>!Number.isFinite(p.second)||p.second<0||!['complete','failed','running'].includes(p.status)||typeof p.integrity!=='boolean'||typeof p.applicationConsistent!=='boolean'))throw Error('Historial de réplicas inválido.');
 const ledger=options.ledger??Array.from({length:12},(_,i)=>({id:'DEMO-'+String(i+1).padStart(3,'0'),second:i*10}));
 if(!Array.isArray(ledger)||new Set(ledger.map(t=>t.id)).size!==ledger.length||ledger.some(t=>typeof t.id!=='string'||!t.id||!Number.isFinite(t.second)||t.second<0))throw Error('Registro didáctico inválido.');
 const committed=ledger.filter(t=>t.second<=failureSecond).map(t=>({...t}));
 const selected=snapshots.filter(p=>p.status==='complete'&&p.second<=failureSecond).sort((a,b)=>b.second-a.second)[0]||null;
 const age=selected?failureSecond-selected.second:null,target=s.datacenter_ha.rpo_seconds_target;
 const fresh=age!==null&&age<=target,consistent=Boolean(selected?.integrity&&selected?.applicationConsistent);
 const state={...makeState(),faults:[...scenarios[scenario]]};
 if(!fresh&&!state.faults.includes('storage:stale'))state.faults.push('storage:stale');
 if(!consistent&&!state.faults.includes('storage:inconsistent'))state.faults.push('storage:inconsistent');
 const z=inspect(s,state),bad=new Set(state.faults);
 const checks=[
  {id:'host',label:'Host alternativo y red disponibles',ok:z.dc.hosts.includes('dc2')&&z.gatewayAvailable},
  {id:'quorum',label:'Mayoría de votos disponible',ok:z.dc.quorum},
  {id:'fencing',label:'Aislamiento del host fallado confirmado',ok:!bad.has('cluster:fencing')},
  {id:'replica',label:'Última réplica completada dentro del objetivo',ok:fresh},
  {id:'integrity',label:'Copia íntegra y consistencia de aplicación comprobada',ok:consistent},
  {id:'application',label:'Aplicación disponible en el host alternativo',ok:Boolean(z.dc.applicationHost)}
 ];
 const eligible=checks.every(c=>c.ok);
 const inReplica=consistent?committed.filter(t=>t.second<=selected.second):[];
 const reconcile=consistent?committed.filter(t=>t.second>selected.second):[];
 return {scope:'EJERCICIO_DIDACTICO_DATOS_SINTETICOS',scenario,faults:[...state.faults],failureSecond,
  selectedReplica:selected?{...selected}:null,replicaAgeSeconds:age,rpoTargetSeconds:target,rpoWithinTarget:fresh,
  eligible,applicationHost:z.dc.activeApplicationHost,networkAvailable:z.gatewayAvailable&&Boolean(z.activeWan),votes:z.dc.votes,
  checks,dataStateKnown:consistent,inReplica,reconcile,servedOperations:eligible?inReplica:[],operationCount:committed.length,
  reconciliation:'Revisar identificadores y estado con el sistema de registro autorizado antes de reintentar; no duplicar operaciones.',
  backupRestoreExecuted:false,rtoMeasuredSeconds:null,rpoMeasuredSeconds:null,sessionsPreserved:false,hardwareVerified:false};
}
return Object.freeze({MW,makeState,endpoints,inspect,access,choosePath,overlayPath,recoveryAudit,recoveryExercise});
});
