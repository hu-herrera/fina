/* Stateful protocol simulation. Uses virtual time; no vendor firmware is executed. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.C5Protocols=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
function runtime(state){return state.protocols||(state.protocols={clock:0,config:{},sessions:{},neighbors:{},events:[],sequence:0,flows:[],disabledRules:[],services:{},leases:{}});}
function config(state,node){const r=runtime(state);return r.config[node]||(r.config[node]={ospf:true,area:0,ike:true,certificate:true,trust:true,identity:null,esp:true,lacp:true,vlansDown:[],ospfReadyAt:0,ikeReadyAt:0});}
function view(state){return {clock:runtime(state).clock,config:runtime(state).config};}
function settings(v,node){return {ospf:true,area:0,ike:true,certificate:true,trust:true,identity:null,esp:true,lacp:true,vlansDown:[],ospfReadyAt:0,ikeReadyAt:0,...v?.config?.[node]};}
function event(state,protocol,node,from,to,detail){const r=runtime(state);r.events.push({sequence:++r.sequence,second:r.clock,protocol,node,from,to,detail});if(r.events.length>500)r.events.splice(0,r.events.length-500);}
function linkAllowed(state,l){
 const v=view(state),a=settings(v,l.a),b=settings(v,l.b);
 if(l.role==='LAN_ROUTED')return a.ospf&&b.ospf&&(a.areas?.[l.network]??a.area)===(b.areas?.[l.network]??b.area)&&v.clock>=a.ospfReadyAt&&v.clock>=b.ospfReadyAt;
 if(l.role==='STACK'&&l.redundancy?.includes('LACP'))return a.lacp&&b.lacp;
 if(l.role==='LAN_AGGREGATE')return a.lacp&&b.lacp&&[50,131].every(n=>!a.vlansDown.includes(n)&&!b.vlansDown.includes(n));
 return true;
}
function edgeAllowed(state,node,site,wan){const r=runtime(state),c=settings(view(state),node),ids=site?.id==='cm'?['cm-'+wan+'.academic.invalid']:(site?.tunnels||[]).filter(t=>t.router===node&&t.wan===wan).map(t=>t.id.toLowerCase()+'.academic.invalid');return c.ike&&c.certificate&&c.trust&&c.esp&&r.clock>=c.ikeReadyAt&&(!c.identity||ids.includes(c.identity));}
function vlanUp(state,node,vlan){return !settings(view(state),node).vlansDown.includes(vlan);}
function neighbors(site,state,physicalLinks,node=null){
 const r=runtime(state),rows=site.links.map((l,index)=>({l,index})).filter(({l})=>l.role==='LAN_ROUTED'&&(!node||[l.a,l.b].includes(node))).map(({l,index})=>{
  const a=settings(view(state),l.a),b=settings(view(state),l.b),physical=physicalLinks.includes(l),up=physical&&linkAllowed(state,l);
  return {index,localNode:l.a,peerNode:l.b,localIp:l.router_ip,peerIp:l.stack_ip,interface:l.portA,peerInterface:l.portB,network:l.network,area:a.area,state:up?'FULL':'DOWN',reason:!physical?'Interfaz sin enlace':!a.ospf||!b.ospf?'Proceso deshabilitado':(a.areas?.[l.network]??a.area)!==(b.areas?.[l.network]??b.area)?'Área incompatible':r.clock<Math.max(a.ospfReadyAt,b.ospfReadyAt)?'Reconvergencia en curso':'Adyacencia formada'};
 });
 for(const row of rows){const key=String(row.index),previous=r.neighbors[key];if(previous!==row.state){if(row.state==='FULL')for(const stage of ['INIT','2-WAY','EXSTART','EXCHANGE','LOADING','FULL'])event(state,'OSPF',row.localNode,stage==='INIT'?(previous||'DOWN'):null,stage,row.network);else event(state,'OSPF',row.localNode,previous||'DOWN','DOWN',row.reason);r.neighbors[key]=row.state;}}
 return rows;
}
function tunnelStatus(branch,z,hub,hz){
 if(!z.activeWan||!hz.activeWan||!z.gatewayAvailable||!hz.gatewayAvailable)return {ok:false,state:'DOWN',reason:'Sin camino de transporte o gateway'};
 if(branch.id==='cm')return {ok:true,state:'LOCAL',reason:'Tráfico local en central'};
 const w=hub.wan_services.find(w=>w.id===hz.activeWan),endpoint='CM_'+hz.activeWan.toUpperCase();
 const t=(branch.tunnels||[]).find(t=>t.router===z.activeEdge&&t.wan===z.activeWan&&t.hub_endpoint===endpoint&&t.hub_public_ip===w?.carrier_handoff.vip);
 if(!t||!w?.carrier_handoff?.static_reachable_ipsec_endpoint_required)return {ok:false,state:'DOWN',reason:'Extremos del túnel incompatibles'};
 const a=settings(z.protocolConfig,z.activeEdge),b=settings(hz.protocolConfig,hz.activeEdge),expected=t.id.toLowerCase()+'.academic.invalid',hubIdentity='cm-'+hz.activeWan+'.academic.invalid';
 const base={tunnel:t,localIdentity:a.identity||t.ike_identity,peerIdentity:b.identity||hubIdentity};
 if(!a.ike||!b.ike)return {...base,ok:false,state:'DOWN',reason:'IKE deshabilitado'};
 if(z.protocolConfig?.clock<a.ikeReadyAt||hz.protocolConfig?.clock<b.ikeReadyAt)return {...base,ok:false,state:'IKE_SA_INIT',reason:'Negociación en curso'};
 if(!a.certificate||!b.certificate||!a.trust||!b.trust||base.localIdentity!==expected||base.peerIdentity!==hubIdentity)return {...base,ok:false,state:'AUTH_FAILED',reason:'Certificado, confianza o identidad incompatible'};
 if(!a.esp||!b.esp)return {...base,ok:false,state:'CHILD_SA_FAILED',reason:'Propuesta ESP no compatible'};
 return {...base,ok:true,state:'ESTABLISHED',reason:'IKE_AUTH y Child SA completados'};
}
function spi(state){const r=runtime(state);return (++r.sequence+0x10000000).toString(16).padStart(8,'0');}
function establish(branch,z,hub,hz,state,hubState){
 const result=tunnelStatus(branch,z,hub,hz),r=runtime(state),hr=runtime(hubState);
 for(const sa of Object.values(r.sessions))if(sa.site===branch.id&&sa.state==='ESTABLISHED'&&(sa.edge!==z.activeEdge||sa.wan!==z.activeWan||sa.hubEdge!==hz.activeEdge||sa.hubWan!==hz.activeWan||!result.ok)){sa.state='DOWN';if(hr.sessions[sa.id])hr.sessions[sa.id].state='DOWN';event(state,'IPSEC',sa.edge,'ESTABLISHED','DOWN',result.reason);}
 if(!result.tunnel)return result;
 const id=result.tunnel.id,prior=r.sessions[id];
 if(!result.ok){if(prior?.state!==result.state)event(state,'IKEv2',z.activeEdge,prior?.state||'DOWN',result.state,result.reason);r.sessions[id]={...prior,id,site:branch.id,edge:z.activeEdge,wan:z.activeWan,hubEdge:hz.activeEdge,hubWan:hz.activeWan,state:result.state,reason:result.reason};if(hr.sessions[id])hr.sessions[id].state=result.state;return result;}
 let sa=prior;
 if(!sa||sa.state!=='ESTABLISHED'||sa.hubEdge!==hz.activeEdge||r.clock-sa.created>=3600){
  for(const stage of ['IKE_SA_INIT','IKE_AUTH','CHILD_SA','ESTABLISHED'])event(state,'IKEv2',z.activeEdge,sa?.state||'DOWN',stage,id);
  sa=r.sessions[id]={id,site:branch.id,edge:z.activeEdge,wan:z.activeWan,hubEdge:hz.activeEdge,hubWan:hz.activeWan,localIp:result.tunnel.branch_ip,remoteIp:result.tunnel.hub_ip,peer:result.tunnel.hub_public_ip,localIdentity:result.localIdentity,peerIdentity:result.peerIdentity,state:'ESTABLISHED',created:r.clock,lifetime:3600,spiOut:spi(state),spiIn:spi(state),encaps:0,decaps:0,bytesOut:0,bytesIn:0,rekeys:(prior?.rekeys||0)+(prior?1:0)};
  hr.sessions[id]={...clone(sa),edge:hz.activeEdge,localIp:sa.remoteIp,remoteIp:sa.localIp,localIdentity:sa.peerIdentity,peerIdentity:sa.localIdentity,spiOut:sa.spiIn,spiIn:sa.spiOut};
 }
 return {...result,sa};
}
function transmit(state,hubState,sa,bytes=256){if(!sa||sa.state!=='ESTABLISHED')return false;sa.encaps++;sa.decaps++;sa.bytesOut+=bytes;sa.bytesIn+=bytes;const peer=runtime(hubState).sessions[sa.id];if(peer){peer.encaps++;peer.decaps++;peer.bytesOut+=bytes;peer.bytesIn+=bytes;}return true;}
function advance(state,seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>86400)throw Error('Avance de tiempo fuera del rango 0..86400 s.');runtime(state).clock+=seconds;return runtime(state).clock;}
function nat(state,flow,publicIp){const r=runtime(state);r.nat=r.nat||[];const key=[flow.sourceIp,flow.destinationIp,flow.protocol,flow.port,publicIp].join(':');let row=r.nat.find(a=>a.key===key);if(!row){row={key,source:flow.sourceIp,destination:flow.destinationIp,protocol:flow.protocol,destinationPort:flow.port,publicIp,translatedPort:40000+(++r.sequence%20000),created:r.clock};r.nat.push(row);if(r.nat.length>500)r.nat.shift();event(state,'NAT','cm',null,'TRANSLATION_CREATED',row.source+' → '+publicIp+':'+row.translatedPort);}return row;}
function recordFlow(state,flow,result){const r=runtime(state),entry={id:++r.sequence,second:r.clock,source:flow.sourceIp,destination:flow.destinationIp,protocol:flow.protocol,port:flow.port,rule:result.policy?.id||result.policy?.rule,action:result.ok?'ESTABLISHED':result.policy?.action==='deny'?'DENY':'UNREACHABLE',bytes:result.ok?256:0};r.flows.push(entry);if(r.flows.length>100)r.flows.shift();return entry;}
function recovery(s,options,inspect,makeState){
 const scenario=options.scenario||'host',faults={host:['dc1'],stale:['dc1','storage:stale'],quorum:['dc1','backup'],fencing:['dc1','cluster:fencing'],corrupt:['dc1','storage:inconsistent'],application:['dc1','vm:application'],both:['dc1','dc2']}[scenario];if(!faults)throw Error('Escenario de recuperación desconocido.');
 const failureSecond=options.failureSecond??157,interval=options.replicationInterval??60,duration=options.replicationDuration??4,operationInterval=options.operationInterval??10;
 if(!Number.isFinite(failureSecond)||failureSecond<0||failureSecond>86400||![interval,duration,operationInterval].every(v=>Number.isFinite(v)&&v>0&&v<=86400))throw Error('Parámetros de tiempo inválidos.');
 const events=[],ledger=options.ledger??[],snapshots=options.snapshots??[];
 if(!options.ledger)for(let at=operationInterval;at<=failureSecond;at+=operationInterval){const op={id:'OP-'+String(ledger.length+1).padStart(4,'0'),second:at};ledger.push(op);events.push({second:at,type:'COMMIT',id:op.id});}
 if(!options.snapshots)for(let at=interval;at<=failureSecond;at+=interval){const completed=at+duration,status=completed<=failureSecond?'complete':'running';snapshots.push({second:at,completedSecond:completed,status,integrity:scenario!=='corrupt',applicationConsistent:true});events.push({second:at,type:'REPLICA_START'});if(status==='complete')events.push({second:completed,type:'REPLICA_COMPLETE',dataSecond:at});}
 if(!Array.isArray(ledger)||new Set(ledger.map(t=>t.id)).size!==ledger.length||ledger.some(t=>typeof t.id!=='string'||!t.id||!Number.isFinite(t.second)||t.second<0))throw Error('Registro de operaciones inválido.');
 if(!Array.isArray(snapshots)||snapshots.some(p=>!Number.isFinite(p.second)||p.second<0||!['complete','failed','running'].includes(p.status)||typeof p.integrity!=='boolean'||typeof p.applicationConsistent!=='boolean'))throw Error('Historial de réplicas inválido.');
 let selected=snapshots.filter(p=>p.status==='complete'&&(p.completedSecond??p.second)<=failureSecond&&p.second<=failureSecond).sort((a,b)=>b.second-a.second)[0]||null;
 if(scenario==='stale')selected=snapshots.filter(p=>p.status==='complete'&&p.second<failureSecond-s.datacenter_ha.rpo_seconds_target).sort((a,b)=>b.second-a.second)[0]||null;
 const committed=ledger.filter(t=>t.second<=failureSecond),age=selected?failureSecond-selected.second:null,target=s.datacenter_ha.rpo_seconds_target,fresh=age!==null&&age<=target,consistent=Boolean(selected?.integrity&&selected?.applicationConsistent),state={...makeState(),faults:[...faults]};
 if(!fresh&&!state.faults.includes('storage:stale'))state.faults.push('storage:stale');if(!consistent&&!state.faults.includes('storage:inconsistent'))state.faults.push('storage:inconsistent');
 const z=inspect(s,state),bad=new Set(state.faults),checks=[{id:'host',label:'Host alternativo y red disponibles',ok:z.dc.hosts.includes('dc2')&&z.gatewayAvailable},{id:'quorum',label:'Mayoría de votos disponible',ok:z.dc.quorum},{id:'fencing',label:'Aislamiento del host fallado confirmado',ok:!bad.has('cluster:fencing')},{id:'replica',label:'Última réplica completada dentro del objetivo',ok:fresh},{id:'integrity',label:'Copia íntegra y consistente',ok:consistent},{id:'application',label:'Aplicación disponible en el host alternativo',ok:Boolean(z.dc.applicationHost)}];
 const eligible=checks.every(c=>c.ok),inReplica=consistent?committed.filter(t=>t.second<=selected.second):[],reconcile=consistent?committed.filter(t=>t.second>selected.second):[];events.push({second:failureSecond,type:'HOST_FAILURE'});
 let ready=failureSecond;if(eligible)for(const [type,seconds]of [['FAILURE_DETECTED',5],['FENCING_CONFIRMED',5],['VM_STARTED',30],['HTTPS_OPERATION_OK',10]]){ready+=seconds;events.push({second:ready,type});}else events.push({second:failureSecond,type:'RECOVERY_BLOCKED',checks:checks.filter(c=>!c.ok).map(c=>c.id)});
 const lastCommitted=committed.at(-1)?.second??0,lastRecovered=inReplica.at(-1)?.second??0;
 return {scope:'EJECUCION_EVENTOS_TIEMPO_VIRTUAL',scenario,faults:state.faults,failureSecond,replicationInterval:interval,replicationDuration:duration,operationInterval,selectedReplica:selected?clone(selected):null,replicaAgeSeconds:age,rpoTargetSeconds:target,rpoWithinTarget:fresh,eligible,applicationHost:z.dc.activeApplicationHost,networkAvailable:z.gatewayAvailable&&Boolean(z.activeWan),votes:z.dc.votes,checks,dataStateKnown:consistent,inReplica:clone(inReplica),reconcile:clone(reconcile),servedOperations:eligible?clone(inReplica):[],operationCount:committed.length,reconciliation:'Conciliar el estado de las operaciones posteriores a la copia antes de reintentarlas.',events:events.sort((a,b)=>a.second-b.second),rtoSimulatedSeconds:eligible?ready-failureSecond:null,rpoSimulatedSeconds:consistent?lastCommitted-lastRecovered:null,recoverySecond:eligible?ready:null,backupRestoreExecuted:false,rtoMeasuredSeconds:null,rpoMeasuredSeconds:null,sessionsPreserved:false,hardwareVerified:false};
}
return Object.freeze({runtime,config,settings,view,event,linkAllowed,edgeAllowed,vlanUp,neighbors,tunnelStatus,establish,transmit,advance,nat,recordFlow,recovery});
});
