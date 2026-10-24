/* C5 security policy shared by the browser and the project documents. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.C5Security=api;})(typeof window!=='undefined'?window:null,function(){
'use strict';
const services=Object.freeze({app:'10.70.200.10',database:'10.70.200.11',pbx:'10.70.200.20',dns:'10.70.200.30',aaa:'10.70.200.31',nms:'10.70.200.40',backup:'10.70.200.50',admin:'10.80.0.10'});
const rules=Object.freeze([
 {id:'ALLOW-CLUSTER-CONTROL',action:'allow',from:'Hosts 10.80.0.11 y 10.80.0.12',to:'El otro host del clúster',service:'UDP 5405–5412; TCP 22 y 60000–60050',control:'Firewall de hipervisores y gestión',reason:'Corosync, réplica ZFS y migración solo entre hosts autorizados.'},
 {id:'ALLOW-CLUSTER-WITNESS',action:'allow',from:'Hosts 10.80.0.11 y 10.80.0.12',to:'BKP-01 10.70.200.50',service:'TCP 5403',control:'ACL de gestión, firewall central y host BKP',reason:'Voto qdevice del clúster de dos nodos.'},
 {id:'ALLOW-CLUSTER-BACKUP',action:'allow',from:'Hosts 10.80.0.11 y 10.80.0.12',to:'BKP-01 10.70.200.50',service:'TCP 8007',control:'ACL de gestión, firewall central y host BKP',reason:'Copias al repositorio mediante su API autenticada.'},
 {id:'ALLOW-NOC-HYPERVISOR',action:'allow',from:services.admin,to:'Hosts 10.80.0.11 y 10.80.0.12',service:'TCP 8006',control:'Firewall de hipervisores y gestión',reason:'Administración del clúster solo desde el bastión NOC.'},
 {id:'ALLOW-LOCAL-ICMP',action:'allow',from:'Usuarios de la misma sede',to:'Usuarios de la misma sede',service:'ICMP',control:'Acceso local / ACL de SVI',reason:'Diagnóstico local entre puestos de la sede.'},
 {id:'LAB-ICMP-HOST-PAIR',action:'allow',from:'Par de diagnóstico autorizado',to:'Host exacto autorizado',service:'ICMP',control:'ACL de acceso y firewall central',reason:'Excepción temporal limitada a dos IP activas.'},
 {id:'ALLOW-APP-DATABASE',action:'allow',from:services.app,to:services.database,service:'TCP 5432',control:'Firewall de los hosts APP y BD',reason:'Solo el servidor de aplicación consulta PostgreSQL.'},
 {id:'ALLOW-USERS-APP',action:'allow',from:'Usuarios VLAN 10 y 110',to:services.app,service:'TCP 443',control:'ACL de acceso y firewall central',reason:'Acceso de los colaboradores a la aplicación financiera por HTTPS.'},
 {id:'ALLOW-VOICE-PBX',action:'allow',from:'Voz VLAN 20 y 120',to:services.pbx,service:'TCP 5061',control:'ACL de acceso y firewall central',reason:'Señalización SIP sobre TLS hacia la central telefónica.'},
 {id:'ALLOW-VOICE-RTP',action:'allow',from:'Voz VLAN 20 y 120',to:services.pbx,service:'UDP 10000–20000',control:'ACL de acceso y firewall central',reason:'Audio con medios anclados en la PBX, sin voz directa entre sedes.'},
 {id:'ALLOW-PBX-RTP',action:'allow',from:services.pbx,to:'Voz VLAN 20 y 120',service:'UDP 10000–20000',control:'Firewall central y ACL de voz',reason:'Audio desde la PBX hacia el rango de medios de los teléfonos.'},
 {id:'ALLOW-CORP-DNS',action:'allow',from:'Usuarios, voz, gestión y servidores',to:services.dns,service:'UDP/TCP 53',control:'ACL de acceso y firewall central',reason:'Resolución de nombres a través del DNS corporativo.'},
 {id:'ALLOW-CORP-NTP',action:'allow',from:'Usuarios, voz, gestión y servidores',to:services.dns,service:'UDP 123',control:'ACL de acceso y firewall central',reason:'Sincronización horaria con el servicio central.'},
 {id:'ALLOW-MGMT-AAA',action:'allow',from:'Gestión VLAN 130',to:services.aaa,service:'TCP 49 / UDP 1812–1813',control:'ACL de gestión y firewall central',reason:'TACACS+ de administración y RADIUS de acceso Wi-Fi desde los equipos de red.'},
 {id:'ALLOW-ADMIN-MGMT',action:'allow',from:services.admin+' (bastión NOC)',to:'Redes de gestión VLAN 130',service:'TCP 22/443 e ICMP',control:'ACL de gestión y firewall central',reason:'Administración remota desde el bastión autorizado del NOC.'},
 {id:'ALLOW-NMS-MGMT',action:'allow',from:services.nms,to:'Redes de gestión VLAN 130',service:'UDP 161 e ICMP',control:'ACL de gestión y firewall central',reason:'Monitoreo de equipos desde NMS. SNMPv3 con autenticación y cifrado.'},
 {id:'ALLOW-MGMT-LOGS',action:'allow',from:'Gestión VLAN 130',to:services.nms,service:'TCP 6514 / UDP 162',control:'ACL de gestión y firewall central',reason:'Syslog TLS y notificaciones SNMPv3 al colector central.'},
 {id:'ALLOW-GUEST-DNS',action:'allow',from:'Invitados VLAN 40',to:'1.1.1.1 / 9.9.9.9',service:'UDP/TCP 53',control:'ACL de invitados y firewall central',reason:'DNS de invitados mediante resolutores públicos definidos.'},
 {id:'DENY-GUEST-PRIVATE',action:'deny',from:'Invitados VLAN 40',to:'Redes privadas e internas',service:'Cualquiera',control:'ACL de invitados y firewall central',reason:'Los invitados no acceden a aplicaciones, voz, servidores ni gestión corporativa.'},
 {id:'ALLOW-USERS-WEB',action:'allow',from:'Usuarios VLAN 10 y 110',to:'Internet público',service:'TCP 80/443',control:'ACL de acceso y firewall central',reason:'Navegación mediante la salida central y sus controles de seguridad.'},
 {id:'ALLOW-GUEST-WEB',action:'allow',from:'Invitados VLAN 40',to:'Internet público',service:'TCP 80/443',control:'ACL de invitados y firewall central',reason:'Navegación de invitados con salida central.'},
 {id:'DENY-USERS-DATABASE',action:'deny',from:'Usuarios VLAN 10 y 110',to:services.database,service:'Cualquiera',control:'ACL de acceso y firewall central',reason:'Los puestos utilizan la aplicación y no conectan directamente a la base de datos.'},
 {id:'DENY-UNAUTHORIZED-MGMT',action:'deny',from:'Cualquier otro origen',to:'Gestión VLAN 130',service:'Cualquiera',control:'ACL de gestión y firewall central',reason:'Solo el puesto NOC y el NMS pueden iniciar los accesos de gestión definidos.'},
 {id:'DENY-INTERSITE-ICMP',action:'deny',from:'Usuarios de otra sede',to:'Usuarios',service:'ICMP',control:'ACL de acceso y firewall central',reason:'El diagnóstico entre sedes requiere una excepción explícita.'},
 {id:'DENY-DEFAULT',action:'deny',from:'Cualquiera',to:'Cualquiera',service:'No autorizado arriba',control:'ACL / firewall según recorrido',reason:'Todo flujo sin permiso explícito queda bloqueado y se registra.'}
].map(Object.freeze));
function ipv4(ip){if(typeof ip!=='string'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip))return null;const p=ip.split('.').map(Number);return p.some(n=>n>255)?null:p.reduce((n,v)=>(n*256+v)>>>0,0);}
function inNetwork(ip,cidr){const [base,bits]=String(cidr).split('/'),a=ipv4(ip),b=ipv4(base),n=Number(bits);if(a===null||b===null||!Number.isInteger(n)||n<0||n>32)return false;const mask=n===0?0:(0xffffffff<<(32-n))>>>0;return (a&mask)===(b&mask);}
function privateIp(ip){return ['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'].some(n=>inNetwork(ip,n));}
function publicIp(ip){return ipv4(ip)!==null&&!['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.168.0.0/16','192.0.0.0/24','192.0.2.0/24','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24','224.0.0.0/3'].some(n=>inNetwork(ip,n));}
function classify(sites,ip){
 for(const s of sites)for(const [key,zone]of [['users','USERS'],['wifi_users','USERS'],['voice','VOICE'],['wifi_voice','VOICE'],['guests','GUESTS'],['management','MGMT'],['servers','SERVERS']]){
  const net=s.addressing[key];if(net&&inNetwork(ip,net.network))return {site:s.id,zone,vlan:net.vlan};
 }
 return {site:null,zone:publicIp(ip)?'INTERNET':'UNKNOWN'};
}
function evaluate(sites,flow,diagnostic=null){
 const source=classify(sites,flow.sourceIp),target=classify(sites,flow.destinationIp),port=Number(flow.port),protocol=String(flow.protocol).toLowerCase();
 const result=id=>{const rule=rules.find(r=>r.id===id);return {...rule,rule:rule.id,source,target,protocol,port,log:true};};
 if(ipv4(flow.sourceIp)===null||ipv4(flow.destinationIp)===null||!['tcp','udp','icmp'].includes(protocol)||!Number.isInteger(port)||(protocol==='icmp'?port!==0:port<1||port>65535))return {...result('DENY-DEFAULT'),reason:'Dirección IPv4, protocolo o puerto inválido.'};
 if(!source.site||source.site!==flow.sourceSite)return {...result('DENY-DEFAULT'),reason:'El origen no pertenece a las redes de la sede indicada.'};
 const users=source.zone==='USERS',voice=source.zone==='VOICE',mgmt=source.zone==='MGMT',corp=['USERS','VOICE','MGMT','SERVERS'].includes(source.zone),dst=flow.destinationIp,tcp=protocol==='tcp',udp=protocol==='udp',icmp=protocol==='icmp';
 let id='DENY-DEFAULT';
 const cluster=['10.80.0.11','10.80.0.12'];
 if(cluster.includes(flow.sourceIp)&&cluster.includes(dst)&&dst!==flow.sourceIp&&(udp&&port>=5405&&port<=5412||tcp&&(port===22||port>=60000&&port<=60050)))id='ALLOW-CLUSTER-CONTROL';
 else if(cluster.includes(flow.sourceIp)&&dst===services.backup&&tcp&&port===5403)id='ALLOW-CLUSTER-WITNESS';
 else if(cluster.includes(flow.sourceIp)&&dst===services.backup&&tcp&&port===8007)id='ALLOW-CLUSTER-BACKUP';
 else if(flow.sourceIp===services.admin&&cluster.includes(dst)&&tcp&&port===8006)id='ALLOW-NOC-HYPERVISOR';
 else if(icmp&&users&&target.zone==='USERS'&&source.site===target.site)id='ALLOW-LOCAL-ICMP';
 else if(icmp&&users&&target.zone==='USERS'&&diagnostic&&diagnostic.src===source.site&&diagnostic.dst===target.site&&diagnostic.source===flow.sourceIp&&diagnostic.target===dst)id='LAB-ICMP-HOST-PAIR';
 else if(flow.sourceIp===services.app&&dst===services.database&&tcp&&port===5432)id='ALLOW-APP-DATABASE';
 else if(users&&dst===services.app&&tcp&&port===443)id='ALLOW-USERS-APP';
 else if(voice&&dst===services.pbx&&tcp&&port===5061)id='ALLOW-VOICE-PBX';
 else if(voice&&dst===services.pbx&&udp&&port>=10000&&port<=20000)id='ALLOW-VOICE-RTP';
 else if(flow.sourceIp===services.pbx&&target.zone==='VOICE'&&udp&&port>=10000&&port<=20000)id='ALLOW-PBX-RTP';
 else if(corp&&dst===services.dns&&(tcp||udp)&&port===53)id='ALLOW-CORP-DNS';
 else if(corp&&dst===services.dns&&udp&&port===123)id='ALLOW-CORP-NTP';
 else if(mgmt&&dst===services.aaa&&(tcp&&port===49||udp&&[1812,1813].includes(port)))id='ALLOW-MGMT-AAA';
 else if(flow.sourceIp===services.admin&&target.zone==='MGMT'&&(icmp||tcp&&[22,443].includes(port)))id='ALLOW-ADMIN-MGMT';
 else if(flow.sourceIp===services.nms&&target.zone==='MGMT'&&(icmp||udp&&port===161))id='ALLOW-NMS-MGMT';
 else if(mgmt&&dst===services.nms&&(tcp&&port===6514||udp&&port===162))id='ALLOW-MGMT-LOGS';
 else if(source.zone==='GUESTS'&&['1.1.1.1','9.9.9.9'].includes(dst)&&(tcp||udp)&&port===53)id='ALLOW-GUEST-DNS';
 else if(source.zone==='GUESTS'&&(privateIp(dst)||target.zone!=='INTERNET'))id='DENY-GUEST-PRIVATE';
 else if(users&&target.zone==='INTERNET'&&tcp&&[80,443].includes(port))id='ALLOW-USERS-WEB';
 else if(source.zone==='GUESTS'&&target.zone==='INTERNET'&&tcp&&[80,443].includes(port))id='ALLOW-GUEST-WEB';
 else if(users&&dst===services.database)id='DENY-USERS-DATABASE';
 else if(target.zone==='MGMT')id='DENY-UNAUTHORIZED-MGMT';
 else if(users&&target.zone==='USERS'&&source.site!==target.site&&icmp)id='DENY-INTERSITE-ICMP';
 return result(id);
}
function evaluateReturn(sites,request,reply,diagnostic=null){
 const initial=evaluate(sites,request,diagnostic),deny={action:'deny',rule:'DENY-UNRELATED-RETURN',reason:'La respuesta no corresponde a un flujo autorizado.'};
 if(initial.action!=='allow'||reply.sourceIp!==request.destinationIp||reply.destinationIp!==request.sourceIp||reply.protocol!==request.protocol||classify(sites,reply.sourceIp).site!==reply.sourceSite)return deny;
 const icmp=request.protocol==='icmp';
 if(icmp?(reply.port!==0||request.port!==0):(!Number.isInteger(request.sourcePort)||request.sourcePort<1||request.sourcePort>65535||reply.sourcePort!==request.port||reply.port!==request.sourcePort))return deny;
 return {action:'allow',rule:'RETURN-'+initial.rule,reason:'Respuesta del flujo autorizado.',control:'Estado del firewall y permisos de retorno en las ACL'};
}
function host(network,offset=10){return network.split('/')[0].split('.').slice(0,3).join('.')+'.'+offset;}
function cases(s,pcIp=s.endpoints[0].pc){
 const flow=(id,label,sourceIp,destinationIp,protocol,port,sourceSite=s.id)=>({id,label,sourceSite,sourceIp,destinationIp,protocol,port});
 return [flow('app','Colaborador → aplicación HTTPS',pcIp,services.app,'tcp',443),flow('database','Colaborador → base de datos',pcIp,services.database,'tcp',5432),flow('guest-internal','Invitado → aplicación interna',host(s.addressing.guests.network),services.app,'tcp',443),flow('guest-web','Invitado → web pública',host(s.addressing.guests.network),'8.8.8.8','tcp',443),flow('voice','Teléfono → PBX TLS',s.endpoints[0].phone,services.pbx,'tcp',5061),flow('user-mgmt','Colaborador → gestión SSH',pcIp,host(s.addressing.management.network,2),'tcp',22),flow('admin','NOC → gestión SSH',services.admin,host(s.addressing.management.network,2),'tcp',22,'cm'),flow('dns','Colaborador → DNS corporativo',pcIp,services.dns,'udp',53),flow('aaa','Gestión → RADIUS central',host(s.addressing.management.network,2),services.aaa,'udp',1812)];
}
function networkPair(cidr){const [base,bits]=cidr.split('/'),wildcard=(2**(32-Number(bits))-1)>>>0;return base+' '+[24,16,8,0].map(n=>(wildcard>>>n)&255).join('.');}
function ciscoAccess(s){
 const lines=['! C5 '+s.id.toUpperCase()+' - ACL del acceso L3 y puertos de acceso', '! Aplicar sobre el stack/gateway de acceso; nunca sobre los trunks de proveedores.', '! Las reglas del firewall central y los controles de host complementan estas ACL.'],blocks={};
 const corp=['users','wifi_users','voice','wifi_voice','guests','management'];
 for(const key of corp){const n=s.addressing[key],net=networkPair(n.network),name='C5-'+s.id.toUpperCase()+'-V'+n.vlan+'-IN';let sequence=10;
  blocks[key]=[];const ace=text=>{blocks[key].push(text);lines.push(' '+sequence+' '+text);sequence+=10;};lines.push('ip access-list extended '+name);
  ace('remark Origen '+n.network+' / VLAN'+n.vlan+' / direccion IN');
  if(key!=='management'){
   ace('permit udp host 0.0.0.0 eq 68 host 255.255.255.255 eq 67');
   ace('permit udp '+net+' eq 68 host '+n.gateway+' eq 67');
  }
  if(['users','wifi_users'].includes(key)){
   for(const other of ['users','wifi_users'])ace('permit icmp '+net+' '+networkPair(s.addressing[other].network));
   ace('permit tcp '+net+' host '+services.app+' eq 443');
  }
  if(['voice','wifi_voice'].includes(key)){
   ace('permit tcp '+net+' host '+services.pbx+' eq 5061');
   ace('permit udp '+net+' host '+services.pbx+' range 10000 20000');
  }
  if(key!=='guests'){
   ace('permit udp '+net+' host '+services.dns+' eq 53');ace('permit tcp '+net+' host '+services.dns+' eq 53');ace('permit udp '+net+' host '+services.dns+' eq 123');
  }else for(const dns of ['1.1.1.1','9.9.9.9'])for(const proto of ['udp','tcp'])ace('permit '+proto+' '+net+' host '+dns+' eq 53');
  if(key==='management'){
   if(s.id==='cm'){for(const host of ['10.80.0.11','10.80.0.12']){for(const port of [5403,8007])ace('permit tcp host '+host+' host '+services.backup+' eq '+port);ace('permit tcp host '+services.admin+' host '+host+' eq 8006');}}
   ace('permit tcp '+net+' host '+services.aaa+' eq 49');for(const port of [1812,1813])ace('permit udp '+net+' host '+services.aaa+' eq '+port);
   if(s.id==='cm'){for(const port of [22,443])ace('permit tcp host '+services.admin+' 10.80.0.0 0.0.255.255 eq '+port);ace('permit icmp host '+services.admin+' 10.80.0.0 0.0.255.255');}
   for(const port of [22,443])ace('permit tcp '+net+' eq '+port+' host '+services.admin+' range 1024 65535 established');
   ace('permit icmp '+net+' host '+services.admin+' echo-reply');ace('permit icmp '+net+' host '+services.nms+' echo-reply');
   ace('permit udp '+net+' eq 161 host '+services.nms+' range 1024 65535');ace('permit udp '+net+' host '+services.nms+' eq 162');ace('permit tcp '+net+' host '+services.nms+' eq 6514');
  }
  for(const privateNet of ['10.0.0.0 0.255.255.255','172.16.0.0 0.15.255.255','192.168.0.0 0.0.255.255'])ace('deny ip '+net+' '+privateNet+' log');
  if(['users','wifi_users','guests'].includes(key)){
   for(const special of ['0.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','192.0.0.0/24','192.0.2.0/24','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24','224.0.0.0/3'])ace('deny ip '+net+' '+networkPair(special));
   for(const port of [80,443])ace('permit tcp '+net+' any eq '+port);
  }
  ace('deny ip any any log');lines.push('exit','interface Vlan'+n.vlan,' ip access-group '+name+' in','exit');
 }
 const pacl=(suffix,keys)=>{const name='C5-'+s.id.toUpperCase()+'-'+suffix;lines.push('ip access-list extended '+name);let n=10;for(const text of new Set(keys.flatMap(k=>blocks[k]).filter(t=>t!=='deny ip any any log'))){lines.push(' '+n+' '+text);n+=10;}lines.push(' '+n+' deny ip any any log','exit');return name;};
 const edge=pacl('EDGE-V4',['users','voice']);
 for(const pc of s.endpoints)lines.push('interface GigabitEthernet'+pc.switch+'/0/'+pc.port,' switchport mode access',' switchport access vlan 10',' switchport voice vlan 20',' spanning-tree portfast',' spanning-tree bpduguard enable',' ip access-group '+edge+' in','exit');
 lines.push('vlan 999',' name UNUSED-NATIVE','exit');
 for(const link of s.links.filter(l=>l.role==='AP_TRUNK'))lines.push('interface '+link.portB,' switchport mode trunk',' switchport trunk native vlan 999',' switchport trunk allowed vlan 40,110,120,130','exit');
 lines.push('ip access-list standard C5-VTY-NOC',' 10 permit host '+services.admin,' 999 deny any log','exit','ip ssh version 2','line vty 0 15',' access-class C5-VTY-NOC in',' transport input ssh','exit','! Guardar despues de verificar las pruebas y el acceso de gestion.');
 return lines.join('\n')+'\n';
}
// Proposed class budgets for this academic workload; no DSCP from a client is trusted.
const qosPolicy=Object.freeze({version:1,shaperPercent:90,scope:'PRESUPUESTO_DE_COLAS_SIMULADO',classes:Object.freeze([
 Object.freeze({id:'VOICE',name:'Voz de la PBX',percent:20,dscp:'EF',match:'SIP TLS TCP 5061 y RTP UDP 10000–20000 con la PBX; solo flujos permitidos'}),
 Object.freeze({id:'FINANCIAL',name:'Aplicación financiera',percent:40,dscp:'AF31',match:'Usuarios VLAN10/110 → '+services.app+' TCP443; respuesta de la sesión autorizada'}),
 Object.freeze({id:'CONTROL',name:'Servicios de red y gestión',percent:10,dscp:'CS2',match:'DNS/NTP, AAA y gestión autorizada; control de routing clasificado en el equipo'}),
 Object.freeze({id:'BULK',name:'Réplica y respaldo',percent:5,dscp:'CS1',match:'Solo hosts del clúster: réplica TCP22/60000–60050 y backup TCP8007'}),
 Object.freeze({id:'DEFAULT',name:'Navegación y otros permisos',percent:25,dscp:'BE',match:'Resto del tráfico permitido; las ACL siguen vigentes'})
])});
function qosClassify(sites,flow,request=null){
 const policy=request?evaluateReturn(sites,request,flow):evaluate(sites,flow),original=request?evaluate(sites,request):policy,rule=original.rule;
 if(policy.action!=='allow')return {classId:'BLOCKED',dscp:'BE',policy:policy.rule,reason:'La QoS no autoriza un flujo bloqueado.'};
 const f=request||flow;
 const id=['ALLOW-USERS-APP'].includes(rule)?'FINANCIAL':['ALLOW-VOICE-PBX','ALLOW-VOICE-RTP','ALLOW-PBX-RTP'].includes(rule)?'VOICE':rule==='ALLOW-CLUSTER-BACKUP'||rule==='ALLOW-CLUSTER-CONTROL'&&f.protocol==='tcp'?'BULK':/^(ALLOW-(CORP-|MGMT-|ADMIN-|NMS-|NOC-|CLUSTER-))/.test(rule)?'CONTROL':'DEFAULT';
 return {classId:id,dscp:qosPolicy.classes.find(c=>c.id===id).dscp,policy:policy.rule,clientDscpTrusted:false};
}
function qosAllocation(s,wanId,demand,scenarioUplinkMbps=null){
 const wan=s.wan_services.find(w=>w.id===wanId);if(!wan)throw Error('Transporte no disponible en esta sede.');
 if(scenarioUplinkMbps!==null&&(!Number.isFinite(scenarioUplinkMbps)||scenarioUplinkMbps<=0||scenarioUplinkMbps>100000))throw Error('La subida de la simulación debe ser mayor que cero y no superar 100000 Mbps.');
 const rows=qosPolicy.classes.map(c=>{const offered=demand[c.id]??0;if(!Number.isFinite(offered)||offered<0)throw Error('Demanda de clase inválida.');return {...c,offeredMbps:offered,allocatedMbps:0};});
 const uplink=scenarioUplinkMbps??wan.up_required_mbps,basis=scenarioUplinkMbps===null?wan.capacity_basis:'ENTRADA_DE_SIMULACION_NO_MEDICION';
 if(!Number.isFinite(uplink)||uplink<=0)return {status:'CAPACIDAD_NO_DEFINIDA',wan:wan.id,basis,shaperMbps:null,congested:null,rows,hardwareVerified:false};
 const capacity=uplink*qosPolicy.shaperPercent/100,total=rows.reduce((n,r)=>n+r.offeredMbps,0),congested=total>capacity;
 // Fluid budget illustration: LLQ voice is bounded to 20% under congestion.
 // Remaining bandwidth is shared by weights; this is not a packet scheduler benchmark.
 if(!congested)rows.forEach(r=>r.allocatedMbps=r.offeredMbps);
 else{
  rows[0].allocatedMbps=Math.min(rows[0].offeredMbps,capacity*rows[0].percent/100);
  let remaining=capacity-rows[0].allocatedMbps,waiting=rows.slice(1).filter(r=>r.offeredMbps>0);
  while(remaining>1e-9&&waiting.length){const weights=waiting.reduce((n,r)=>n+r.percent,0),pool=remaining;
   for(const r of waiting){const grant=Math.min(r.offeredMbps-r.allocatedMbps,pool*r.percent/weights);r.allocatedMbps+=grant;remaining-=grant;}
   waiting=waiting.filter(r=>r.offeredMbps-r.allocatedMbps>1e-9);
  }
 }
 return {status:'SIMULADO',wan:wan.id,basis,uplinkMbps:uplink,shaperMbps:capacity,offeredMbps:total,congested,rows:rows.map(r=>({...r,reservedMbps:capacity*r.percent/100,deferredMbps:Math.max(0,r.offeredMbps-r.allocatedMbps)})),hardwareVerified:false,latencyMeasured:false};
}
function vpnPlan(s,node,allSites=[s]){
 const central=s.id==='cm',tunnels=central?allSites.filter(p=>p.id!=='cm').flatMap(p=>p.tunnels||[]):(s.tunnels||[]).filter(t=>!node||t.router===node);
 const peers=tunnels.map(t=>({tunnel:t.id,transport:t.wan,vrf:t.transport_vrf,localIp:central?t.hub_ip:t.branch_ip,remoteIp:central?t.branch_ip:t.hub_ip,publicEndpoint:t.hub_public_ip,initiator:'SUCURSAL',localIdentity:central?'cm-'+t.hub_endpoint.toLowerCase().replace('cm_','')+'.academic.invalid':t.ike_identity,peerIdentity:central?t.ike_identity:'cm-'+t.hub_endpoint.toLowerCase().replace('cm_','')+'.academic.invalid',identityMatch:'EXACT',identityIsPlaceholder:true}));
 return {status:'DISEÑO_SIN_SA_REAL',authentication:'CERTIFICADO_IKEV2',ike:{version:2,encryption:'AES-256',integrity:'SHA-256',prf:'SHA-256',dhGroup:19,lifetimeSeconds:28800},esp:{encryption:'AES-256-GCM-16',pfsGroup:19,lifetimeSeconds:3600},natTraversal:true,ports:['UDP500','UDP4500'],innerMtuCandidate:1400,tcpMssIpv4Candidate:1360,peers,secretMaterialIncluded:false,deployable:false,requirements:['Emitir certificados y claves en los equipos; no incorporarlos al repositorio.','Validar CA, vigencia, SAN igual al ID IKE exacto y revocación; sin aceptar identidades distintas.','Preparar hora y consulta de revocación antes del túnel para evitar dependencia circular.','Sustituir RFC5737 y academic.invalid por extremos e identidades asignados en el laboratorio.','Comprobar IKE/Child SA, ida y retorno, NAT-T, MTU y clasificación antes del cifrado en ambos fabricantes.','Medir capacidad con cifrado, inspección y tráfico concurrente; el presupuesto de colas no certifica rendimiento.']};
}
return Object.freeze({services,rules,ipv4,inNetwork,classify,evaluate,evaluateReturn,cases,networkPair,ciscoAccess,qosPolicy,qosClassify,qosAllocation,vpnPlan});
});
