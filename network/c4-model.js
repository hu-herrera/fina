/* C4 educational model. Logical availability only; no hardware/SLA certification. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.C4Model=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const WAN=['starlink','leo','entel5g','gtd4g'],MW={starlink:'starlink',leo:'kuiper',entel5g:'g5',gtd4g:'g4'};
function makeState(){return {faults:[],preferred:'fwA',interfaces:{},pending:{},startup:null};}
function setFault(s,id,down){s.faults=s.faults.filter(x=>x!==id);if(down)s.faults.push(id);return s;}
function address(n){return {users:{vlan:10,network:`10.70.${n}.0/25`,gateway:`10.70.${n}.1`},voice:{vlan:20,network:`10.70.${64+n}.0/25`,gateway:`10.70.${64+n}.1`},wifiUsers:{vlan:110,network:`10.81.${n}.0/25`,gateway:`10.81.${n}.1`},wifiVoice:{vlan:120,network:`10.82.${n}.0/25`,gateway:`10.82.${n}.1`},guests:{vlan:40,network:`10.70.${96+n}.0/26`,gateway:`10.70.${96+n}.1`},management:{vlan:130,network:`10.80.${n}.0/27`,gateway:`10.80.${n}.1`,fwA:`10.80.${n}.10`,fwB:`10.80.${n}.11`},transit:{vlan:131,network:`10.80.${n}.64/29`,stack:`10.80.${n}.65`,firewall:`10.80.${n}.66`}};}
function inspect(plan,s,external={}){
 const f=new Set(s.faults),up=id=>!f.has(id),siteUp=up('site'),power=siteUp&&(up('upsA')||up('upsB'));
 // C1300 DC switches have a single modeled feed; other infrastructure nodes
 // assume the documented dual A/B feeds. WAN CPE feeds are handled below.
 const node=id=>siteUp&&up(id)&&(id==='dcA'?up('upsA'):id==='dcB'?up('upsB'):power);
 const stackMembers=[1,2].filter(n=>node('sw'+n)),partition=stackMembers.length===2&&!up('stackA')&&!up('stackB');
 const stack=stackMembers.length>0&&!partition;
 const interfaceUp=(fw,port)=>s.interfaces[fw+':'+port]!==false&&up(fw+':'+port);
 const lan=(fw,member)=>s.interfaces['uplink:'+plan.lan_links.find(l=>l.firewall===fw&&l.switch==='sw'+member).switch_port]!==false&&node(fw)&&stack&&node('sw'+member)&&interfaceUp(fw,plan.id==='cm'?(member===1?'ethernet1/19':'ethernet1/20'):(member===1?'ethernet1/9':'ethernet1/10'))&&s.interfaces[fw+':ae1']!==false&&s.interfaces['stack:Po'+(fw==='fwA'?21:22)]!==false;
 const wans=fw=>WAN.filter((p,i)=>node(fw)&&up('ups'+(i%2===0?'A':'B'))&&up('wan:'+p)&&up('cpe:'+p)&&up('handoff:'+p)&&up('gateway:'+p)&&up('upstream:'+p)&&up('handoff:'+p+':'+fw)&&interfaceUp(fw,plan.firewall_ports_per_member.find(x=>x.provider===p).port)&&external[p]!==false);
 // Do not invent split-brain prevention when all control connectivity is lost.
 const both=node('fwA')&&node('fwB'),control=both&&up('ha1');
 const candidates=['fwA','fwB'].filter(fw=>[1,2].some(m=>lan(fw,m)));
 let active=both&&!control?null:[s.preferred,...['fwA','fwB'].filter(fw=>fw!==s.preferred)].find(fw=>candidates.includes(fw)&&wans(fw).length)||candidates[0]||null;
 if(active)s.preferred=active;
 const available=active?wans(active):[],gateway=Boolean(active&&candidates.includes(active));
 const paths={1:Boolean(node('sw1')&&gateway),2:Boolean(node('sw2')&&gateway)};
 const storageNodes=[1,2,3].filter(n=>node('host'+n)),dcSwitches=['dcA','dcB'].filter(node);
 const dcNetwork=plan.id==='cm'&&stack&&dcSwitches.some(dc=>stackMembers.some(n=>s.interfaces['uplink:Te'+n+'/1/'+(dc==='dcA'?3:4)]!==false));
 const poweredNodes=Object.fromEntries(['fwA','fwB','sw1','sw2','dcA','dcB','host1','host2','host3','backup'].map(id=>[id,node(id)]));
 const wanInfrastructure=Object.fromEntries(WAN.map((id,i)=>{const feed=siteUp&&up('ups'+(i%2===0?'A':'B'));return [id,{cpeAvailable:feed&&up('cpe:'+id),handoffAvailable:feed&&up('handoff:'+id)}];}));
 return {profile:'C4',siteAvailable:siteUp,poweredNodes,wanInfrastructure,activeFirewall:active,firewallModel:plan.firewall_model,wanAvailable:available,activeWan:(plan.wan_preference||WAN).find(k=>available.includes(k))||null,stackFunctional:stack,stackPartitioned:partition,activeStackMembers:stackMembers,switchLocalL2:{1:node('sw1'),2:node('sw2')},interMemberL2:stackMembers.length===2&&stack,switchGateway:paths,switchInternet:{1:paths[1]&&available.length>0,2:paths[2]&&available.length>0},gatewayAvailable:gateway,lanAvailableByFirewall:Object.fromEntries(['fwA','fwB'].map(fw=>[fw,[1,2].filter(n=>lan(fw,n))])),haControl:control,ha2:both&&(up('ha2')||up('ha2backup')),sessionContinuityVerified:false,dc:{nodes:storageNodes,switches:dcSwitches,quorum:storageNodes.length>=2,eligibleForVmRestart:dcNetwork&&storageNodes.length>=2,canRebuildThreeHostReplicas:dcNetwork&&storageNodes.length>=3,backup:node('backup')&&dcNetwork,recoveryTested:false,offsiteRecoveryAvailable:false},managementIndependentOob:false,capacityCertified:false};
}
function endpointAccess(plan,s,pc,z){
 z=z||inspect(plan,s);const f=new Set(s.faults),admin=s.interfaces['port:Gi'+pc.sw+'/0/'+pc.port]!==false;
 const wired=admin&&z.switchLocalL2[pc.sw],wifi=plan.wireless;
 // Administrative shutdown is intentional; do not bypass it through Wi-Fi.
 const aps=wifi&&admin&&z.siteAvailable&&z.gatewayAvailable&&!f.has('wifi:auth')&&!f.has('wifi:coverage')?wifi.aps.filter(a=>z.switchGateway[a.switch]&&!f.has(a.id)&&s.interfaces['port:Gi'+a.switch+'/0/'+a.port]!==false):[];
 const affected=wired?0:((!z.switchLocalL2[1]?Math.ceil(plan.pcs/2):0)+(!z.switchLocalL2[2]?Math.floor(plan.pcs/2):0))*2;
 const capacity=aps.length*wifi.ap_client_budget>=affected;
 const ap=!wired&&capacity?aps[(pc.idx-1)%aps.length]:null;
 const pcWifi=Boolean(ap&&!f.has('wifi:pc:'+pc.idx)),phoneWifi=Boolean(ap&&!f.has('wifi:phone:'+pc.idx)&&!f.has('phone:power:'+pc.idx));
 return {pcMode:wired?'wired':pcWifi?'wifi':'down',phoneMode:f.has('phone:power:'+pc.idx)?'down':wired?'wired':phoneWifi?'wifi':'down',switch:wired?pc.sw:pcWifi?ap.switch:null,ap:pcWifi?ap.id:null,local:wired||pcWifi,network:wired?Boolean(z.switchGateway[pc.sw]):pcWifi,pcIp:pcWifi?`10.81.${plan.number}.${10+pc.idx-1}`:pc.ip,phoneIp:phoneWifi?`10.82.${plan.number}.${10+pc.idx-1}`:pc.phoneIp,recoveryMeasured:false};
}
function endpoints(plan){const n=plan.number,half=Math.ceil(plan.pcs/2);return Array.from({length:plan.pcs},(_,i)=>({idx:i+1,id:'PC-'+(n===0?'CM':'S'+String(n).padStart(2,'0'))+'-'+String(i+1).padStart(3,'0'),ip:`10.70.${n}.${10+i}`,phoneIp:`10.70.${64+n}.${10+i}`,phoneId:'TEL-'+(n===0?'CM':'S'+String(n).padStart(2,'0'))+'-'+String(i+1).padStart(3,'0'),phoneModel:plan.wireless?.phone_model||'SIP-T33G',sw:i<half?1:2,port:i<half?i+1:i-half+1,vlan:10,voiceVlan:20}));}
function specification(plan,s){return {profile:'C4',schema_version:1,scope:'ESPECIFICACION_SIMULADA_NO_CONFIG_CERTIFICADA',site:plan,addressing:address(plan.number),endpoint_inventory:endpoints(plan),state:{...s.interfaces},temporary_icmp_exception_exported:false};}
function capacity(providers,report,z){
 const u=report.planning_max_utilization;
 if(!(u>0&&u<=1)||!Array.isArray(report.cases))throw Error('Informe de capacidad inválido');
 const speeds=new Map(providers.map(p=>[p.id,p.model_mbps_assumed]));
 if(speeds.size!==providers.length||providers.some(p=>!Number.isFinite(p.model_mbps_assumed)||p.model_mbps_assumed<0))throw Error('Proveedores de capacidad inválidos');
 if(new Set(z.wanAvailable).size!==z.wanAvailable.length||z.wanAvailable.some(k=>!speeds.has(k)))throw Error('WAN desconocida o repetida');
 const hasPath=Boolean(z.gatewayAvailable&&z.activeWan&&z.wanAvailable.includes(z.activeWan));
 const round=n=>Math.round(n*1000)/1000;
 const active=hasPath?speeds.get(z.activeWan)*u:0;
 const aggregate=hasPath?z.wanAvailable.reduce((sum,k)=>sum+speeds.get(k),0)*u:0;
 return {status:hasPath?'NOMINAL_REFERENCE_ONLY':'NO_PATH',active_wan:hasPath?z.activeWan:null,
  active_path_budget_mbps:round(active),ideal_aggregate_budget_mbps:round(aggregate),
  contracted_upload_mbps:null,contracted_download_mbps:null,load_balancing_verified:false,
  cases:report.cases.map(c=>{const demand=c.demand.full_envelope_mbps;if(!Number.isFinite(demand)||demand<0)throw Error('Demanda inválida');return {id:c.id,demand_mbps:demand,active_path_deficit_mbps:round(Math.max(0,demand-active)),ideal_aggregate_deficit_mbps:round(Math.max(0,demand-aggregate))};})};
}
return Object.freeze({WAN,MW,makeState,setFault,address,inspect,endpoints,endpointAccess,specification,capacity});
});
