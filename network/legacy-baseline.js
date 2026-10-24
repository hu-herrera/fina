/* Academic baseline. Independent from the proposed network and its CLI state. */
(function(root){
'use strict';
const inventory=root.LegacyInventory;
const currentBaseline=Boolean(root.C5Data&&!root.__TEST_C4_PROFILE__&&!root.__TEST_PRE_C4_PROFILE__&&!root.__TEST_LEGACY_PROFILE__);
if(currentBaseline)for(const s of inventory.sites){
 const p=root.C5Data.sites.find(p=>p.id===s.id);
 Object.assign(s,{router_model:p.before.routers.model,routers:p.before.routers.quantity,switch_model:p.before.switches.model,switches:p.before.switches.quantity,phone_model:p.before.phone_model,wan_access_mbps_assumed:p.before.wan_access_mbps,wan_circuits:p.before.wan_circuits});
 s.access_ports_per_switch=s.switch_model.includes('-48')?48:24;s.access_ports_total=s.access_ports_per_switch*s.switches;
 for(const m of [s.router_model,s.switch_model])if(!inventory.hardware_catalog[m])inventory.hardware_catalog[m]={last_support:'Por verificar por SKU; equipo reutilizado del caso C5'};
}
const sites=new Map(inventory.sites.map(s=>[s.id,s]));
const state=new Map();
const before=()=>ST.mode==='antes';
const esc=v=>escapeCLI(String(v));
const site=id=>sites.get(typeof id==='string'?id:id.id);
const hw=model=>inventory.hardware_catalog[model]||{last_support:'No verificado'};
function devices(id){
 if(!state.has(id))state.set(id,{router:true,router2:true,sw1:true,sw2:true,firewall:true,dc1:true,dc2:true,backup:true,...(currentBaseline?{mplsA:true,mplsB:true}:{})});
 return state.get(id);
}
function on(id,key){return devices(id)[key]!==false;}
function routerUp(id){return id==='cm'?(on(id,'router')||on(id,'router2')):on(id,'router');}
function access(id,member=1){return member<=site(id).switches&&on(id,'sw'+member);}
function lan(id){return id==='cm'?(access(id,1)||access(id,2)):access(id,1)&&routerUp(id);}
function wan(id){return (id==='cm'||ST.mpls[id]==='activo')&&routerUp(id);}
function hub(){return routerUp('cm')&&on('cm','firewall')&&lan('cm')&&(!currentBaseline||on('cm','mplsA')||on('cm','mplsB'));}
function wanName(s){return currentBaseline?(s.isCM?'2 MPLS centrales · 1 Gbps cada uno':'MPLS cableado · '+site(s).wan_access_mbps_assumed+' Mbps'):s.isCM?'MPLS central · '+inventory.original_wan.central_access_mbps_assumed+' Mbps supuestos':'MPLS cableado · '+site(s).wan_access_mbps_assumed+' Mbps supuestos';}
function cleanUI(text){if(!currentBaseline)return text;return text.replace('Las líneas representan agrupaciones lógicas; contratos, módulos y cableado detallado pendientes.','Un puerto por puesto: switch → teléfono → PC. Uplinks e interfaces identificados en cada equipo.').replace('Inventario supuesto para explicar el caso. La antigüedad no fuerza fallos.','Inventario por sede según su renovación.').replace('Acceso único · 100 Mbps: supuesto del caso','Acceso único de la sucursal · 100 Mbps').replace('55 pares PC/teléfono en el stack; hosts en zona de servidores · cableado detallado pendiente','55 pares PC/teléfono · servidores en VLAN50 · puertos identificados').replace(/\bsupuest[oa]s?\b/gi,'').replace(/\s*· escenario académico/g,'').replace('VPN/ACL por verificar; no equivale a ausencia de seguridad','ACL y salida centralizada').replace('soporte según SKU por verificar','Inventario de la sede');}
function memberFor(s,i){return s.isCM?(i<Math.ceil(site(s).pcs/2)?1:2):1;}
function portFor(s,pc){return s.isCM?((pc.idx-1)%Math.ceil(site(s).pcs/2))+1:pc.idx;}
const oldGetPCs=getPCs;
getPCs=function(s){return oldGetPCs(s).map((pc,i)=>before()?{...pc,sw:memberFor(s,i),phoneId:'TEL-'+s.code+'-'+String(pc.idx).padStart(3,'0'),phoneIp:'10.70.'+(64+s.num)+'.'+(9+pc.idx),phoneModel:currentBaseline?site(s).phone_model:'CP-7942G',port:portFor(s,pc)}:pc);};
function phones(s){return getPCs(s).map(pc=>({id:pc.phoneId,ip:pc.phoneIp,vlan:20,pc:pc.id,sw:pc.sw,port:pc.port,powered:access(s.id,pc.sw)}));}
function service(name){
 const z=inventory.datacenter.server_zone_candidate.reserved_service_addresses;
 const entry={application:['dc1',z.application],database:['dc1',z.database],call_control:['dc2',z.call_control],dns_ntp:['dc2',z.dns_ntp],nms_logs:['dc2',z.nms_logs],backup:['backup',z.backup]}[name];
 const member=inventory.datacenter.host_network_members_assumed[entry[0]],network=access('cm',member);
 return {host:entry[0],ip:entry[1],switchMember:member,powered:on('cm',entry[0]),network,operational:on('cm',entry[0])&&network,simulated:true};
}
function toggle(id,key){
 if(!before()||!devices(id).hasOwnProperty(key))return;
 const allowed=['router','sw1',...(id==='cm'?['router2','sw2','firewall','dc1','dc2','backup',...(currentBaseline?['mplsA','mplsB']:[])]:[])];
 if(!allowed.includes(key))return;
 devices(id)[key]=!on(id,key);
 if(id==='cm'&&key.startsWith('router'))ST.cmActive=on('cm','router')?'rtr1':'rtr2';
 addLog('ANTES · '+id.toUpperCase()+' · '+key+' '+(on(id,key)?'restaurado':'apagado')+' en el modelo','warn');
 _refresh();

}
function toggleMplsCore(){
 if(!before())return;
 ST.mpls.cm=ST.mpls.cm==='activo'?'caido':'activo';
 addLog('ANTES · acceso/CPE MPLS central '+(ST.mpls.cm==='activo'?'restaurado':'caído')+'; los hosts y la LAN local tienen estados independientes.','warn');
 ST.evCount++;_refresh();
}
function endpoint(id,index,type='phone'){
 if(!before())return;
 const s=SEDES.find(s=>s.id===id),pc=getPCs(s)[index];if(!pc)return;
 const status=service('call_control');
 const canRegister=access(id,pc.sw)&&status.operational&&(id==='cm'||wan(id)&&hub()&&ST.mpls.cm==='activo');
 PC_CONSOLE_RETURN=null;DEV_STATE={type:'legacy-info',sedeId:id,tab:'info'};
 document.getElementById('dev-title').textContent=pc.phoneId+' — '+pc.phoneModel;
 document.getElementById('dev-model').textContent=currentBaseline?'Teléfono IP existente · puente Ethernet Gigabit':'Equipo supuesto del escenario ANTES · soporte finalizado 31-01-2021';
 document.getElementById('dev-tabs').innerHTML='';
 document.getElementById('dev-body').innerHTML='<div class="legacy-info"><p>IP '+pc.phoneIp+' /25 · VLAN 20 · gateway 10.70.'+(64+s.num)+'.1</p><p>Switch '+pc.sw+' · Gi'+pc.sw+'/0/'+pc.port+' → teléfono → '+pc.id+' ('+pc.ip+')</p><p>PoE: '+(access(id,pc.sw)?'alimentado en el modelo':'sin alimentación por caída del switch')+'. Dos conexiones 10/100: este camino del PC tiene un máximo nominal de 100 Mbps.</p><p>Control de llamadas: '+status.ip+' en DC-02. '+(canRegister?'Dependencias de red disponibles; registro y llamadas no emulados.':'Dependencias no disponibles para registro/nuevas llamadas.')+'</p><p>Recibir una IP no demuestra telefonía funcional. No se simulan conversaciones ni grabaciones.</p></div>';
 document.getElementById('dev-overlay').classList.add('vis');
 if(currentBaseline)document.getElementById('dev-body').innerHTML=document.getElementById('dev-body').innerHTML.replace('Dos conexiones 10/100: este camino del PC tiene un máximo nominal de 100 Mbps.','Puente Ethernet Gigabit: teléfono y PC comparten el puerto de acceso.');
}
function datacenterInfo(name){
 if(!before())return;
 const info=service(name),labels={application:'Core financiero · aplicación',database:'Base de datos',call_control:'Control de llamadas',dns_ntp:'DNS / NTP',nms_logs:'NMS / registros',backup:'Repositorio de respaldos'};
 PC_CONSOLE_RETURN=null;DEV_STATE={type:'legacy-info',sedeId:'cm',tab:'info'};
 document.getElementById('dev-title').textContent=labels[name];
 document.getElementById('dev-model').textContent='Datacenter inicial supuesto · servicio lógico, no aplicación real';
 document.getElementById('dev-tabs').innerHTML='';
 const capacity=inventory.datacenter.assumed_host_capacity[info.host],capacityText=(capacity.physical_cores?capacity.physical_cores+' núcleos · '+capacity.ram_gib+' GiB RAM · ':'')+capacity.usable_storage_gb+' GB útiles (supuestos académicos, no recursos medidos).';
 if(currentBaseline){
  const host=root.C5Data.sites[0].server_devices.find(d=>d.id===info.host),port=info.host==='backup'?44:43;
  document.getElementById('dev-model').textContent=host.model+' · infraestructura actual';
  document.getElementById('dev-body').innerHTML='<div class="legacy-info"><h3>'+esc(host.name)+' · '+esc(host.role)+'</h3><p>IP del servicio: '+info.ip+' · VLAN50 · 10.70.200.0/24 · gateway 10.70.200.1.</p><p>NIC1 → SW'+info.switchMember+' / Gi'+info.switchMember+'/0/'+port+' · 1 Gbps.</p><p>Host: '+(info.powered?'encendido':'apagado')+' · conexión: '+(info.network?'disponible':'sin red')+'.</p><p>'+(capacity.physical_cores?capacity.physical_cores+' núcleos · '+capacity.ram_gib+' GiB RAM · ':'')+capacity.usable_storage_gb+' GB útiles.</p><p>'+host.services.filter(s=>!s.name.includes('AAA')&&!s.name.includes('Bastión')).map(s=>esc(s.name+' · '+s.ip+' · '+s.port)).join('<br>')+'</p></div>';
  document.getElementById('dev-overlay').classList.add('vis');return;
 }
 document.getElementById('dev-body').innerHTML='<div class="legacy-info"><p>Reserva IP: '+info.ip+' · VLAN 50 · 10.70.200.0/24.</p><p>Alojamiento: '+({dc1:'DC-01',dc2:'DC-02',backup:'BKP-01'}[info.host])+'. Estado del alojamiento: '+(info.powered?'encendido':'apagado')+'. Enlace único a SW'+info.switchMember+'. Red del datacenter: '+(info.network?'disponible':'sin acceso')+'.</p><p>'+({application:'Comparte DC-01 con la base de datos. No hay clúster declarado; la aplicación depende de que ambos servicios estén disponibles.',database:'Datos ficticios de clientes y operaciones. No contiene registros reales ni hay motor de base de datos instalado.',call_control:'Plataforma y versión pendientes de definir. No se acreditan llamadas SIP/SCCP ni licencias.',dns_ntp:'Servicios previstos en DC-02; sin consultas o sincronización reales.',nms_logs:'Supervisión existente en el caso. Retención, capacidad y respuesta ante incidentes pendientes de acreditar.',backup:'Repositorio en el mismo edificio. Copia externa, protección y restauración no verificadas.'}[name])+'</p><p>'+capacityText+'</p><p>Modelo, rendimiento, SO, licencias y soporte no verificados. Encendido no equivale a certificación del servicio.</p></div>';
 document.getElementById('dev-overlay').classList.add('vis');
}
function control(id,key,label){return '<button type="button" class="btn btn-legacy" data-legacy-toggle="'+key+'" onclick="LegacyBaseline.toggle(\''+id+'\',\''+key+'\')">'+(on(id,key)?'Apagar ':'Restaurar ')+label+'</button>';}
function topology(s){
 const b=site(s),pcs=getPCs(s),cm=s.isCM,W=1300,gridY=cm?620:440,cols=cm?8:6,cellW=cm?145:185,cellH=100;
 const H=gridY+Math.ceil(pcs.length/cols)*cellH+45;
 const text=(x,y,t,size=14,color='#becbdd')=>'<text x="'+x+'" y="'+y+'" text-anchor="middle" fill="'+color+'" font-family="system-ui" font-size="'+size+'">'+esc(t)+'</text>';
 const line=(x,y,a,c,up=true)=>'<line x1="'+x+'" y1="'+y+'" x2="'+a+'" y2="'+c+'" stroke="'+(up?'#738ba9':'#f0787e')+'" stroke-width="2"'+(up?'':' stroke-dasharray="6 4"')+'/>';
 const box=(x,y,w,title,subtitle,up=true,click='')=>'<g'+(click?' onclick="'+click+'" style="cursor:pointer"':'')+'><rect x="'+x+'" y="'+y+'" width="'+w+'" height="72" rx="9" fill="#182333" stroke="'+(up?'#859db8':'#f0787e')+'" stroke-width="2"/>'+text(x+w/2,y+28,title,16)+text(x+w/2,y+53,subtitle,12)+'</g>';
 let svg=text(650,30,'ANTES · '+s.code+' · infraestructura inicial',22)+text(650,54,'Origen '+inventory.history.initial_network_year_assumed+' · renovación principal '+inventory.history.main_refresh_years_assumed.join('–')+' · ampliaciones parciales hasta '+inventory.history.growth_and_partial_improvements_years_assumed[1]+' · escenario académico',13);
 if(cm){
  svg+=(currentBaseline?box(410,80,230,'MPLS A · 1 Gbps','Acceso principal',ST.mpls.cm==='activo'&&on('cm','mplsA'),"LegacyBaseline.toggle('cm','mplsA')")+box(660,80,230,'MPLS B · 1 Gbps','Acceso alternativo',ST.mpls.cm==='activo'&&on('cm','mplsB'),"LegacyBaseline.toggle('cm','mplsB')"):box(410,80,480,'MPLS cableado · CPE compartido',(inventory.original_wan.central_access_mbps_assumed/1000)+' Gbps supuesto · CPE compartido, sin diversidad',ST.mpls.cm==='activo'))+box(70,80,300,'Internet · ISP A',inventory.original_wan.central_isp_capacity_mbps_each_assumed+' Mbps supuestos → ASA')+box(930,80,300,'Internet · ISP B',inventory.original_wan.central_isp_capacity_mbps_each_assumed+' Mbps supuestos → ASA');
  svg+=currentBaseline?line(525,152,360,185,ST.mpls.cm==='activo'&&on('cm','mplsA'))+line(775,152,940,185,ST.mpls.cm==='activo'&&on('cm','mplsB')):line(650,152,360,185,ST.mpls.cm==='activo')+line(650,152,940,185,ST.mpls.cm==='activo');
  svg+=line(220,152,90,170)+line(90,170,90,321)+line(90,321,460,321,on('cm','firewall'))+line(1080,152,1210,170)+line(1210,170,1210,321)+line(1210,321,840,321,on('cm','firewall'));
  svg+=box(190,185,340,'Cisco 2911 #1',on('cm','router')?(ST.cmActive==='rtr1'?'HSRP activo':'HSRP reserva'):'Apagado',on('cm','router'),"openDevice('router','cm')")+box(770,185,340,'Cisco 2911 #2',on('cm','router2')?(ST.cmActive==='rtr2'?'HSRP activo':'HSRP reserva'):'Apagado',on('cm','router2'),"openDevice('router','cm')");
  svg+=line(360,257,650,285,routerUp('cm'))+line(940,257,650,285,routerUp('cm'));
  svg+=box(460,285,380,'ASA 5512-X · único','Último soporte 31-08-2022',on('cm','firewall'),"openDevice('fw','cm')")+line(650,357,385,390,on('cm','firewall')&&access('cm',1))+line(650,357,915,390,on('cm','firewall')&&access('cm',2));
  svg+=box(170,390,430,currentBaseline?b.switch_model+' · miembro 1':'3750-X PoE · miembro 1',currentBaseline?'Equipo existente reutilizado en C5':'48 puertos · último soporte 31-10-2021',access('cm',1),"openDevice('sw1','cm')")+box(700,390,430,currentBaseline?b.switch_model+' · miembro 2':'3750-X PoE · miembro 2',currentBaseline?'Equipo existente reutilizado en C5':'48 puertos · último soporte 31-10-2021',access('cm',2),"openDevice('sw2','cm')");
  svg+=line(600,425,700,425,access('cm',1)&&access('cm',2))+text(650,379,currentBaseline?'StackWise · equipos existentes reutilizados':'StackWise Plus · esquema lógico',12);
  svg+=line(385,462,255,490,access('cm',1))+line(915,462,650,490,access('cm',2))+line(385,462,1045,490,access('cm',1));
  svg+=box(80,490,350,'DC-01 · aplicación + base de datos','Dos VMs · enlace único a SW1',on('cm','dc1'),"LegacyBaseline.datacenterInfo('application')")+box(475,490,350,'DC-02 · telefonía y servicios','DNS/NTP · NMS/logs · enlace a SW2',on('cm','dc2'),"LegacyBaseline.datacenterInfo('call_control')")+box(870,490,350,'BKP-01 · respaldos','Mismo edificio · enlace único a SW1',on('cm','backup'),"LegacyBaseline.datacenterInfo('backup')");
  svg+=text(650,592,'55 pares PC/teléfono en el stack; hosts en zona de servidores · cableado detallado pendiente',13);
 }else{
  svg+=box(410,85,480,wanName(s),'Acceso único · 100 Mbps: supuesto del caso',wan(s.id));
  svg+=line(650,157,650,190,wan(s.id))+box(410,190,480,currentBaseline?b.router_model+' · único':'Cisco 1921 · único',currentBaseline?'Inventario mixto según renovación de la sede':'Último soporte 30-09-2023',routerUp(s.id),"openDevice('router','"+s.id+"')");
  svg+=line(650,262,650,295,routerUp(s.id))+box(370,295,560,b.switch_model+' · PoE',b.access_ports_total+' puertos · '+(currentBaseline?'soporte según SKU por verificar':'último soporte 30-11-2020'),access(s.id),"openDevice('sw1','"+s.id+"')");
  svg+=line(650,367,650,400,access(s.id))+text(650,417,'Sin firewall dedicado en esta sede · VPN/ACL por verificar; no equivale a ausencia de seguridad',13);
 }
 pcs.forEach((pc,i)=>{
  const x=70+(i%cols)*cellW,y=gridY+Math.floor(i/cols)*cellH,powered=access(s.id,pc.sw);
  svg+='<g data-legacy-pair="'+pc.idx+'">'+line(x+25,y-12,x+25,y,powered)+text(x+66,y-15,'SW'+pc.sw+' · Gi'+pc.sw+'/0/'+pc.port,10);
  svg+='<g class="legacy-phone" tabindex="0" role="button" aria-label="'+pc.phoneId+'" onclick="LegacyBaseline.endpoint(\''+s.id+'\','+(pc.idx-1)+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();LegacyBaseline.endpoint(\''+s.id+'\','+(pc.idx-1)+')}"><title>'+pc.phoneId+' · '+pc.phoneIp+' · VLAN 20</title><rect x="'+x+'" y="'+y+'" width="48" height="39" rx="5" fill="#263b51" stroke="'+(powered?'#e3ba6a':'#f0787e')+'"/>'+text(x+24,y+24,'TEL',11)+'</g>';
  svg+=line(x+48,y+20,x+75,y+20,powered)+'<g class="topo-pc" onclick="openPC(\''+s.id+'\','+(pc.idx-1)+')"><title>'+pc.id+' · '+pc.ip+' · por '+pc.phoneId+'</title><rect class="pc-body" x="'+(x+75)+'" y="'+y+'" width="49" height="38" rx="4" fill="#233348" stroke="#8fa5bd"/><rect class="pc-screen" x="'+(x+80)+'" y="'+(y+5)+'" width="39" height="24" fill="#122235"/>'+text(x+99,y+56,'PC '+pc.idx,11)+'</g>'+text(x+24,y+56,'TEL '+pc.idx,11)+text(x+63,y+75,'1 puerto · voz 20 / datos 10',10)+'</g>';
 });
 const keys=[['router',cm?'router #1':'router'],['sw1',cm?'switch #1':'switch'],...(cm?[['router2','router #2'],['sw2','switch #2'],['firewall','ASA'],['dc1','DC-01'],['dc2','DC-02'],['backup','BKP-01']]:[])];
 const services=cm?'<div class="legacy-services">'+Object.entries({application:'Aplicación',database:'Base de datos',call_control:'Telefonía',dns_ntp:'DNS / NTP',nms_logs:'NMS / logs',backup:'Respaldos'}).map(([key,label])=>'<button type="button" class="btn btn-legacy" onclick="LegacyBaseline.datacenterInfo(\''+key+'\')">'+label+' · '+(service(key).operational?'dependencias disponibles':'sin dependencias')+'</button>').join('')+'</div>':'';
 return cleanUI('<div class="topo-wrap legacy-baseline">'+topoToolbar(s)+'<p class="ping-note">'+b.pcs+' PCs + '+b.phones+' teléfonos · '+b.access_ports_total+' puertos de acceso · '+(currentBaseline?'teléfono existente → PC por puente Ethernet Gigabit supuesto':'teléfono → PC a 100 Mbps nominales')+'. Las líneas representan agrupaciones lógicas; contratos, módulos y cableado detallado pendientes.</p><div class="legacy-controls">'+keys.map(([key,label])=>control(s.id,key,label)).join('')+(cm&&currentBaseline?control('cm','mplsA','MPLS A')+control('cm','mplsB','MPLS B'):'')+(cm?'<button type="button" class="btn btn-legacy" data-legacy-wan="cm" onclick="LegacyBaseline.toggleMplsCore()">'+(ST.mpls.cm==='activo'?'Cortar':'Restaurar')+' acceso MPLS central</button>':'')+'</div>'+services+'<div class="topo-viewport"><svg class="topo-svg" width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Topología inicial de '+esc(s.city)+'">'+svg+'</svg></div></div>');
}
function deviceText(s,type,tab){
 const b=site(s),router=type==='router',fw=type==='fw';
 const model=router?b.router_model:fw?'ASA5512-K9':b.switch_model;
 if(currentBaseline){
  const out=['CONFIGURACIÓN ACTUAL · ANTES · '+s.code,model,''];
  if(router){const old=/1921|2911/.test(model),wan=old?'Gi0/0':'Gi0/0/0',lan=old?'Gi0/1':'Gi0/0/1';out.push('WAN '+wan+' · '+wanName(s)+' · '+root.C5Data.sites.find(p=>p.id===s.id).before.wan_customer_ip+'/30 · PE '+root.C5Data.sites.find(p=>p.id===s.id).before.wan_provider_ip,'LAN '+lan+' · trunk VLAN10 datos / VLAN20 voz / VLAN30 gestión',lan+'.10 · 10.70.'+s.num+'.1/25',lan+'.20 · 10.70.'+(64+s.num)+'.1/25',s.isCM?'Dos routers HSRP; dos MPLS de 1 Gbps; dos ISP de 500 Mbps hacia ASA.':'Un router y un acceso MPLS. Salida a Internet por Casa Matriz.');}
  else if(fw)out.push('ASA central · equipo único','Interior: stack y zona de servidores VLAN50.','Exterior: ISP A / ISP B · 500 Mbps cada uno.','NAT de navegación centralizado y control de acceso corporativo.');
  else{out.push('VLAN10 datos · VLAN20 voz · VLAN30 gestión'+(s.isCM?' · VLAN50 servidores':''));for(const p of getPCs(s).filter(p=>p.sw===Number(type.at(-1))))out.push('Gi'+p.sw+'/0/'+p.port+' · acceso10 / voz20 · '+p.phoneId+' '+p.phoneIp+' → '+p.id+' '+p.ip+' · '+(access(s.id,p.sw)?'UP':'DOWN'));}
  return esc(out.join('\n'));
 }
 const out=['DIAGNÓSTICO EDUCATIVO · ANTES · '+s.code,model,'Último soporte del fabricante: '+hw(model).last_support,'Modelo del escenario; IOS, licencias, uptime y mediciones no verificados.',''];
 if(router){
  if(currentBaseline)out.push('Equipo existente según cohorte C5. Numeración de puertos, firmware y configuración previa no aportados por el caso.',wanName(s)+': '+(wan(s.id)?'disponible en el modelo':'sin ruta en el modelo'),'Las direcciones e interfaces son reservas de escenario, no configuración recogida de hardware.');
  else{
  out.push('Interfaces físicas: '+(s.isCM?'Gi0/0, Gi0/1 y Gi0/2; asignación WAN/tránsito por validar':'Gi0/0 WAN; Gi0/1 troncal LAN'),wanName(s)+': '+(wan(s.id)?'disponible en el modelo':'sin ruta en el modelo'));
  if(s.isCM)out.push('2 routers; HSRP '+ST.cmActive+' seleccionado. Sin tiempo de conmutación medido.','Gateways VLAN en stack L3 de CM. Doble ISP de Internet separado de MPLS.');
  else out.push('Gi0/1.10 · 10.70.'+s.num+'.1/25 · datos','Gi0/1.20 · 10.70.'+(64+s.num)+'.1/25 · voz','Gi0/1.30 · 10.70.'+s.num+'.161/28 · gestión','Sin segunda WAN ni segundo router. VPN/ACL y rutas reales requieren verificación.');
  }
 }else if(fw)out.push('ASA central único. Estado: '+(on('cm','firewall')?'encendido':'apagado'),tab==='rules'?'Políticas originales no aportadas por el caso; no se inventa una ACL permit any any.':'Interfaces y licencias por verificar; no hay telemetría de un equipo real.');
 else{
  out.push(b.switches+' miembro(s) · '+b.access_ports_per_switch+' puertos por miembro · PoE','Datos VLAN 10 / voz VLAN 20 en el MISMO puerto del teléfono.','Gestión VLAN 30'+(s.isCM?' / servidores VLAN 50 · '+(currentBaseline?'stack existente C9200L':'stack StackWise Plus'):' · acceso L2, sin otro switch'));
  if(tab==='ports'||tab==='vlan')for(const pc of getPCs(s).filter(p=>p.sw===Number(type.slice(-1))))out.push('Gi'+pc.sw+'/0/'+pc.port+' · '+pc.phoneId+' → '+pc.id+' · datos 10 / voz 20 · '+(access(s.id,pc.sw)?'up':'down'));
 }
 if(tab==='eol')out.push(currentBaseline?'Inventario mixto: no se presume que todos los equipos hayan perdido soporte. Verificar SKU y versión de cada unidad.':'Sin soporte oficial actual no implica una avería automática ni acredita un CVE explotado.','Renovación, controles compensatorios y plan de recuperación requieren evaluación.');
 return esc(out.join('\n'));
}
function detail(s){
 const b=site(s);
 return cleanUI('<div class="dc"><div class="dh"><div class="dtitle">'+esc(s.name)+' · ANTES</div><div>'+esc(s.city)+'</div></div><div class="dsec">'+
 [['Puestos',b.pcs+' PCs + '+b.phones+' teléfonos'],['Router',b.routers+' × '+b.router_model],['Switches',b.switches+' × '+b.switch_model],['Firewall',s.isCM?'ASA 5512-X único':'Sin appliance local; ACL/VPN por verificar'],['Acceso',wanName(s)+' · '+(wan(s.id)?'disponible':'caído')],['Ruta central',s.isCM?'Servicios locales según switch/host':(!hub()||ST.mpls.cm!=='activo'?'Interrumpida en CM':wan(s.id)&&lan(s.id)?'Dependencias disponibles':'Sin acceso desde la sede')],['Soporte',currentBaseline?'Renovación '+root.C5Data.sites.find(p=>p.id===s.id).last_network_refresh_assumed:'Fuera de soporte; fechas en diagnóstico'],['Disponibilidad','Sin medición histórica'],['RTO','≤5 min: requisito, no medido']].map(([k,v])=>'<div class="drow"><span class="dkey">'+esc(k)+'</span><span class="dval">'+esc(v)+'</span></div>').join('')+'</div><p class="ping-note">Inventario supuesto para explicar el caso. La antigüedad no fuerza fallos.</p><button class="btn btn-b" onclick="openSedeModal(\''+s.id+'\')">Ver topología interna completa</button></div>');
}
function wrap(name,handler){const old=root[name];root[name]=function(...args){return before()?handler(...args):old.apply(this,args);};}
wrap('renderRedundantLabTab',()=>'<div class="legacy-info"><h3>Pruebas del escenario ANTES</h3><p>Usa los controles de la topología para apagar/restaurar los equipos iniciales. '+(currentBaseline?'Inventario mixto según cohorte: dos switches reutilizados en CM y uno por sucursal, sin atribuir fin de soporte uniforme.':'Las pruebas LACP y StackWise-80 corresponden a DESPUÉS; la base usa StackWise Plus en CM y un switch en cada sucursal.')+'</p></div>');
wrap('renderTablesTab',s=>'<div class="legacy-info"><h3>Inventario de direcciones y puertos · '+s.code+'</h3><p>Reservas del escenario, no caché ARP aprendida ni registro real de llamadas.</p><table class="vtable"><tr><th>PC / VLAN 10</th><th>Teléfono / VLAN 20</th><th>Puerto compartido</th></tr>'+getPCs(s).map(p=>'<tr><td>'+p.id+' · '+p.ip+'</td><td>'+p.phoneId+' · '+p.phoneIp+'</td><td>SW'+p.sw+' · Gi'+p.sw+'/0/'+p.port+'</td></tr>').join('')+'</table></div>');
wrap('showModal',()=>{
 const count=SEDES.filter(s=>!sedeDown(s.id)).length;
 document.getElementById('modal-body').innerHTML='<div class="legacy-info"><h3>Estado de la base inicial</h3><p>'+count+' de 23 sedes con acceso disponible en el modelo.</p><p>22 sucursales con MPLS cableado único, incluidas S21/S22; 100 Mbps por remota como supuesto académico. CM: MPLS y dos ISP de Internet, sin contratos acreditados.</p><p>Disponibilidad, RTO y latencias históricas: sin medir. Las fallas se activan manualmente para estudiar sus efectos.</p><button class="btn btn-n" onclick="closeModal()">Cerrar</button></div>';
 document.getElementById('modal').classList.add('vis');
});
wrap('renderDetail',id=>{document.getElementById('detail-panel').innerHTML=detail(SEDES.find(s=>s.id===id));});
// Connectivity is intentionally separate from modern CLI edits and WAN state.
wrap('isRouterLanAvailable',id=>routerUp(id));
wrap('isSwitchPCPortAvailable',(id,pc)=>Boolean(pc&&access(id,pc.sw)));
wrap('getSwitchPCPortSettings',()=>({switchportMode:'access',accessVlan:10,voiceVlan:20}));
wrap('isSwitchUplinkAvailable',(id,member)=>access(id,member));
wrap('isSwitchStackLinkAvailable',id=>id==='cm'&&access(id,1)&&access(id,2));
wrap('isSwitchPathAvailable',(id,member)=>access(id,member));
wrap('isPCNetworkAvailable',(id,pc)=>Boolean(pc&&access(id,pc.sw)&&(id==='cm'||routerUp(id))));
wrap('isSiteLanAvailable',id=>lan(id));
wrap('getSwitchPCPorts',(s,member)=>getPCs(s).filter(pc=>pc.sw===member).map(pc=>({pc,port:pc.port})));
wrap('sedeDown',id=>!lan(id)||!wan(id)||!hub()||(id!=='cm'&&ST.mpls.cm!=='activo'));
wrap('getWanEndpoint',(s)=>({type:'mpls',label:wanName(s),point:sedePos(s)}));
wrap('getPacketRouteEndpoint',(s)=>({type:'mpls',label:wanName(s),point:sedePos(s)}));
wrap('packetPolicyDecision',()=>({action:'allow',rule:'BASE-ICMP-DIAGNOSTICO'}));
function route(src,dst,collapse=true,a=getPCs(src)[0],b=getPCs(dst)[0]){
 if(!a||!b||!access(src.id,a.sw)||!access(dst.id,b.sw))return [];
 const node=(id,label,s,kind)=>simulationNode(id,label,sedePos(s),kind);
 const local=(s,p)=>[node('site:'+s.id+':pc:'+p.idx,p.id,s,'pc'),node('site:'+s.id+':phone:'+p.idx,p.phoneId+(currentBaseline?' · puente Gigabit':' · switch interno 10/100'),s,'phone'),node('site:'+s.id+':switch:'+p.sw,'SW-'+s.code+'-0'+p.sw,s,'switch')];
 if(src.id===dst.id){
  const path=local(src,a);if(a.sw!==b.sw)path.push(node('site:'+src.id+':switch:'+b.sw,'SW-'+src.code+'-0'+b.sw,src,'switch'));
  return path.concat(local(dst,b).slice(0,2).reverse());
 }
 if(!wan(src.id)||!wan(dst.id)||!hub())return [];
 // Every remote depends on the shared central MPLS access, including S21/S22.
 if(ST.mpls.cm!=='activo')return [];
 const cm=SEDES[0],out=local(src,a);
 if(src.id!=='cm')out.push(node('site:'+src.id+':router','RTR-'+src.code,src,'router'),node('wan:'+src.id,wanName(src),src,'operator-cloud'));
 out.push(node('site:cm:router','RTR-CM · '+ST.cmActive,cm,'router'),node('site:cm:firewall','ASA-CM · concentrador del modelo',cm,'firewall'));
 if(dst.id!=='cm')out.push(node('wan:'+dst.id,wanName(dst),dst,'operator-cloud'),node('site:'+dst.id+':router','RTR-'+dst.code,dst,'router'));
 return out.concat(local(dst,b).reverse());
}
wrap('buildPacketRoute',route);
wrap('estimatePingRtt',(s,d)=>s.id===d.id?2:34);
wrap('genPCConfig',(s,pc)=>'<div class="legacy-info"><h3>'+esc(pc.id)+'</h3><p>IP '+pc.ip+' /25 · gateway 10.70.'+s.num+'.1 · VLAN 10</p><p>'+esc(pc.phoneId)+' ('+pc.phoneIp+', VLAN 20) → PC · switch '+pc.sw+' · Gi'+pc.sw+'/0/'+pc.port+'</p><p>Puerto físico compartido; '+(currentBaseline?'puente Ethernet Gigabit':'enlace 10/100')+'. '+(access(s.id,pc.sw)?'Acceso local disponible.':'Switch apagado: teléfono sin PoE y PC sin acceso.')+'</p><p>OS y protección endpoint no verificados.</p></div>');
wrap('genRouterRunningConfig',s=>deviceText(s,'router','iface'));
wrap('genSwitchRunningConfig',(s,n)=>deviceText(s,'sw'+n,'ports'));
wrap('genRouterRoutes',s=>deviceText(s,'router','wan'));
const originalOpenDevice=openDevice;
openDevice=function(type,id){
 if(before()&&((type==='fw'&&id!=='cm')||(type==='sw2'&&id!=='cm')))return;
 originalOpenDevice(type,id);
 if(before()){
  const b=site(id),model=type==='router'?b.router_model:type==='fw'?'ASA5512-K9':b.switch_model;
  document.getElementById('dev-title').textContent=model+' · '+id.toUpperCase();
  document.getElementById('dev-model').textContent=currentBaseline?'Infraestructura actual · renovación '+root.C5Data.sites.find(p=>p.id===id).last_network_refresh_assumed:'Último soporte '+hw(model).last_support+' · versión y licencias no verificadas';
 }
};
const oldReset=sc_reset;
sc_reset=function(){if(before())state.clear();return oldReset();};
const oldMetrics=updateMetrics;
updateMetrics=function(){oldMetrics();if(before()){if(!currentBaseline)document.getElementById('m-uptime').textContent='Sin medir';document.getElementById('m-preemp').textContent='Sin medir';}};
const oldTerminal=pcTerminalSession;
pcTerminalSession=function(s,pc){return oldTerminal({...s,id:ST.mode+':'+s.id},pc);};
sc_antes_e2=function(){if(needAntes())return;SEDES.filter(s=>!s.isCM).forEach(s=>ST.mpls[s.id]='caido');ST.evCount++;addLog('ANTES · corte MPLS: 22 sucursales sin acceso central, incluidas S21/S22; sin respaldo inalámbrico en ANTES.','alert');_refresh();};
sc_dropMPLS=sc_antes_e2;
sc_antes_e1=function(){if(needAntes())return;ST.mpls.s08='caido';ST.evCount++;addLog('ANTES · MPLS S08 caído; sin camino alternativo. RTO no medido.','alert');_refresh();selectSede('s08');};
sc_antes_e3=function(){if(needAntes())return;const selected=ST.cmActive==='rtr1'?'router':'router2';toggle('cm',selected);};
sc_antes_e4=function(){if(needAntes())return;ST.evCount++;addLog('ANTES · ejercicio de cambio manual: revisión, registro y rollback pendientes de acreditar; no se modifica configuración.','warn');_refresh();};
root.LegacyBaseline=Object.freeze({site,devices,centralMplsAvailable:()=>ST.mpls.cm==='activo'&&(!currentBaseline||on('cm','mplsA')||on('cm','mplsB')),phones,service,toggle,toggleMplsCore,endpoint,datacenterInfo,topology,deviceText,route,captureState:()=>structuredClone([...state]),restoreState(entries){state.clear();for(const [k,v] of entries)state.set(k,structuredClone(v));}});
})(window);
