/* Commands operate on the same state used by C5 forwarding. */
(function(root,factory){const api=factory(typeof module!=='undefined'&&module.exports?require('./c5-protocols.js'):root.C5Protocols);if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.C5Console=api;})(typeof window!=='undefined'?window:null,function(P){
'use strict';
function execute(ctx,command){
 const {site:s,state:st,node:n,device:d,status:z}=ctx,r=P.runtime(st),c=P.config(st,n),cmd=command.trim().toLowerCase().replace(/\s+/g,' '),out=text=>({text}),changed=text=>{P.event(st,'CLI',n,null,'CONFIG_CHANGED',command);ctx.refresh();return out(text);};
 const cli=(r.cli||(r.cli={}))[n]||((r.cli[n])={mode:'exec'}),switchNode=n.startsWith('sw'),edge=/^(r\d|fw[ab])$/i.test(n),ospfNode=switchNode||n.startsWith('r');
 const aliases={'show ip ospf nei':'show ip ospf neighbor','/routing ospf neighbor print':'show ip ospf neighbor','/ip ipsec active-peers print':'show crypto ikev2 sa','/ip ipsec installed-sa print':'show crypto ipsec sa','show vpn ike-sa':'show crypto ikev2 sa','show vpn ipsec-sa':'show crypto ipsec sa','/ip route print':'show ip route','show routing route':'show ip route','show ip int br':'show ip interface brief','show int status':'show interfaces','show interface all':'show interfaces','show port-channel summary':'show etherchannel summary','/interface bridge host print':'show mac address-table','/log print':'show logging'};
 const q=aliases[cmd]||cmd;
 if(['help','?','show ?'].includes(q))return out('CONSULTAS DEL EQUIPO\nshow status · show interfaces · show ip interface brief · show ip route\nshow ip ospf neighbor · show ip protocols · show crypto ikev2 sa · show crypto ipsec sa\nshow vlan brief · show mac address-table · show arp · show etherchannel summary\nshow spanning-tree · show vrrp · show ip nat translations · show policy-map interface · show ip dhcp binding · show session all · show logging · show clock\nshow running-config · show startup-config · show access-lists\nCONFIGURACIÓN\nenable · configure terminal · interface <nombre> · shutdown / no shutdown · end\nrouter ospf 1 · shutdown / no shutdown · network <red> <wildcard> area <n>\nwrite memory · clear ip ospf process · clear crypto sa\nCONTROLES DE LA SIMULACIÓN\nsim vpn identity <identidad|auto> · sim vpn certificate valid|invalid\nsim vpn trust valid|invalid · sim vpn esp up|down · sim vpn ike up|down\nsim ospf area <n> · sim acl <ID-regla> up|down\nsim service app|database|dns|aaa|pbx|ntp|dhcp up|down\nsim advance <segundos> · sim link <número> down|up · sim port <PC> down|up\nLos comandos show consultan estados y eventos del simulador.');
 if(q==='enable'){cli.mode='privileged';return out('Modo privilegiado.');}
 if(['configure terminal','conf t','configure'].includes(q)){cli.mode='config';return out('Modo de configuración. Usa end para volver.');}
 if(q==='end'){cli.mode='exec';delete cli.interface;return out('Modo de consulta.');}
 if(q==='exit'&&cli.mode!=='exec'){cli.mode=cli.mode==='config'?'exec':'config';delete cli.interface;return out('Modo '+cli.mode+'.');}
 if(q==='show clock')return out('Reloj virtual: '+r.clock+' s');
 if(q==='show logging'||q==='show log system'||q==='show log traffic')return out(r.events.map(e=>'t='+e.second+' #'+e.sequence+' '+e.protocol+' '+e.node+' '+(e.from||'')+' → '+e.to+' '+(e.detail||'')).join('\n')||'Sin eventos registrados.');
 if(q==='show ip ospf neighbor'||q==='show ip ospf interface brief'){
  if(!ospfNode||s.id==='cm')return out('Este equipo no ejecuta OSPF en el diseño vigente.');
  return out('Adyacencias OSPF · área y estado operativo\n'+P.neighbors(s,st,z.links,n).map(a=>{const first=a.localNode===n;return [first?a.peerNode:a.localNode,first?a.peerIp:a.localIp,a.state,'área '+(P.settings(P.view(st),n).areas?.[a.network]??c.area),first?a.interface:a.peerInterface,a.reason].join(' · ');}).join('\n'));
 }
 if(q==='show ip protocols')return out(ospfNode&&s.id!=='cm'?'OSPF 1 · '+(c.ospf?'habilitado':'shutdown')+' · área base '+c.area+'\nReconvergencia disponible en t='+c.ospfReadyAt+' s. Reloj: '+r.clock+' s.':'Enrutamiento del perfil central; sin proceso OSPF en este equipo.');
 if(q==='show track'||q==='show ip sla statistics')return out(ctx.tracks().map(w=>w.name+' · transporte '+(w.up?'UP':'DOWN')+' · overlay seleccionado '+(w.overlay?'UP':'NO')).join('\n'));
 if(q==='show ntp status')return out(ctx.services().host&&ctx.services().ntp!==false?'NTP corporativo disponible en la simulación. Reloj virtual '+r.clock+' s.':'NTP corporativo sin respuesta.');
 if(q==='show radius statistics')return out(ctx.services().host&&ctx.services().aaa!==false?'RADIUS disponible · EAP-TLS habilitado en el modelo.':'AAA/RADIUS sin respuesta; el acceso Wi-Fi no puede autenticarse.');
 if(q==='show ip route')return out(ctx.routes());
 if(q==='show ip interface brief')return out(d.ports.map(p=>p.port+' · '+(p.address||'sin IP')+' · '+(p.enabled?'administración up':'administratively down')+' · '+(p.up?'up':'down')).join('\n')+(switchNode?'\n'+d.networks.map(v=>'Vlan'+v.vlan+' '+v.gateway+' '+(P.vlanUp(st,n,v.vlan)&&z.switchLocalL2[Number(n.at(-1))]?'up':'down')).join('\n'):''));
 if(q==='show crypto ikev2 sa'||q==='show crypto ipsec sa'){
  if(!edge)return out('Este equipo no termina VPN en el diseño.');ctx.sync();
  const rows=Object.values(r.sessions).filter(sa=>sa.edge===n);if(!rows.length)return out('Sin asociaciones en este equipo. '+(r.clock<c.ikeReadyAt?'Negociación disponible en t='+c.ikeReadyAt+' s.':''));
  return out('ASOCIACIONES DE LA SIMULACIÓN · '+(q.includes('ipsec')?'ESP AES-256-GCM / PFS19':'IKEv2 AES-256 / SHA-256 / DH19')+'\n'+rows.map(sa=>[sa.id,sa.state,sa.reason||'',q.includes('ipsec')?'SPI in/out '+(sa.spiIn||'—')+'/'+(sa.spiOut||'—')+' · encaps '+(sa.encaps||0)+' · decaps '+(sa.decaps||0)+' · bytes '+(sa.bytesOut||0)+'/'+(sa.bytesIn||0)+' · vida '+Math.max(0,3600-(r.clock-(sa.created||0)))+' s':'ID local '+(sa.localIdentity||'—')+' · ID remoto '+(sa.peerIdentity||'—')].join(' · ')).join('\n'));
 }
 if(q==='show session all'||q==='show session info')return out(r.flows.map(f=>'#'+f.id+' t='+f.second+' '+f.source+' → '+f.destination+' '+f.protocol+'/'+f.port+' '+f.action+' '+f.rule+' '+f.bytes+' bytes').join('\n')||'Sin flujos evaluados.');
 if(q==='show ip nat translations')return out((P.runtime(ctx.centralState()).nat||[]).map(a=>a.protocol+' '+a.publicIp+':'+a.translatedPort+' ← '+a.source+' → '+a.destination+':'+a.destinationPort).join('\n')||'Sin traducciones NAT. Los destinos internos no usan NAT.');
 if(q==='show policy-map interface')return out(r.qos?r.qos.rows.map(a=>a.id+' · ofrecido '+a.offeredMbps+' Mbps · asignado '+a.allocatedMbps+' Mbps · diferido '+a.deferredMbps+' Mbps').join('\n'):'Sin ejercicio de congestión ejecutado en esta sede. Usa Protocolos / QoS / HA.');
 if(q==='show vrrp'||q==='show vrrp brief'||q==='/interface vrrp print')return out(z.gatewayMode==='VRRP'?'VRRP · MASTER SW'+z.gatewayMember+' · '+(n==='sw'+z.gatewayMember?'MASTER':'BACKUP')+' · prioridad '+(c.vrrpPriority??(n==='sw1'?110:100)):'Gateways en el stack; VRRP no aplica a este equipo.');
 let toggle=q.match(/^sim lacp (up|down)$/);if(toggle){if(!d.ports.some(p=>p.roleId==='LAN_AGGREGATE'||p.roleId==='STACK'&&ctx.variant==='B'))return out('Este equipo no tiene agregado LACP en el diseño.');c.lacp=toggle[1]==='up';return changed('LACP '+toggle[1]);}
 let priority=q.match(/^sim vrrp priority (\d+)$/);if(priority){if(z.gatewayMode!=='VRRP'||!switchNode)return out('VRRP no aplica.');if(Number(priority[1])>254)return out('Prioridad fuera de 0..254.');c.vrrpPriority=Number(priority[1]);return changed('Prioridad VRRP aplicada.');}
 if(q==='show vlan brief')return out(d.vlans.map(v=>'VLAN '+v.vlan+' · '+v.name+' · '+(P.vlanUp(st,n,v.vlan)?'active':'shutdown')+' · '+v.network).join('\n')||'Sin VLAN de acceso en este equipo.');
 if(q==='show mac address-table'||q==='show mac address-table dynamic')return out(d.endpoints.filter(p=>p.up).map(p=>'VLAN10 · '+(ctx.endpoints().find(e=>e.ip===p.pc)?.mac||'sin MAC')+' · '+p.port+' · '+p.pc).join('\n')||'Sin puestos activos en este equipo.');
 if(q==='show arp'||q==='show ip arp')return out(n.startsWith('r')?d.ports.filter(p=>p.up&&p.roleId==='LAN_ROUTED').map(p=>s.links[p.index].stack_ip+' · '+p.port+' · vecino SVI directamente conectado').join('\n')||'Sin vecinos L3 directamente conectados.':ctx.endpoints().filter(p=>ctx.access(p).network).map(p=>ctx.access(p).pcIp+' · '+p.mac+' · SW'+p.sw+' / '+p.port).join('\n')||'Sin vecinos de acceso alcanzables.');
 if(q==='show ip dhcp binding')return out(ctx.endpoints().map(p=>p.ip+' · '+p.mac+' · '+(r.leases[p.idx]||'RESERVA')+' · PC'+p.idx).join('\n'));
 if(q==='show spanning-tree'||q==='show spanning-tree brief'||q==='show switch')return out((ctx.variant==='A'||s.id==='cm'?'StackWise · miembros ':'RSTP · raíz SW'+(z.switchLocalL2[1]?1:2)+' · miembros ')+z.activeStackMembers.join(',')+'\nInterconexión: '+(z.interMemberL2?'FORWARDING':'DOWN')+' · '+(z.stackPartitioned?'partición: gateways detenidos':'sin partición'));
 if(q==='show etherchannel summary')return out(d.ports.filter(p=>['LAN_AGGREGATE','STACK'].includes(p.roleId)).map(p=>(p.roleId==='STACK'&&ctx.variant==='A'?'STACKWISE':p.roleId==='STACK'?'LACP entre switches':s.links[p.index].port_channel||'LACP')+' · '+p.port+' · '+(p.up&&c.lacp?'BUNDLED / FORWARDING':'DOWN')).join('\n')||'No hay EtherChannel en este equipo; los tránsitos LAN son L3 independientes.');
 if(q==='clear ip ospf process'){
  if(!ospfNode||s.id==='cm')return out('OSPF no aplica a este equipo.');c.ospfReadyAt=r.clock+4;return changed('Proceso reiniciado. Adyacencias en DOWN hasta t='+c.ospfReadyAt+' s del reloj virtual.');
 }
 if(q==='clear crypto sa'||q==='clear crypto ikev2 sa'){
  if(!edge)return out('Este equipo no termina VPN.');c.ikeReadyAt=r.clock+3;for(const sa of Object.values(r.sessions))if(sa.edge===n)sa.state='DOWN';return changed('Asociaciones retiradas. Nueva negociación disponible en t='+c.ikeReadyAt+' s.');
 }
 let m=q.match(/^sim advance (\d+(?:\.\d+)?)$/);if(m)return out('Reloj virtual: '+ctx.advance(Number(m[1]))+' s.');
 m=q.match(/^sim vpn (identity|certificate|trust|esp|ike) (\S+)$/);if(m){if(!edge)return out('Este equipo no termina VPN.');const [_,key,value]=m;if(key==='identity')c.identity=value==='auto'?null:command.trim().split(/\s+/).at(-1);else if(key==='certificate'||key==='trust'){if(!['valid','invalid'].includes(value))return out('Usa valid o invalid.');c[key]=value==='valid';}else{if(!['up','down'].includes(value))return out('Usa up o down.');c[key]=value==='up';}return changed('VPN '+key+' actualizado. Consulta asociaciones y prueba el tráfico.');}
 m=q.match(/^sim ospf area (\d+)$/);if(m){if(!ospfNode||s.id==='cm')return out('OSPF no aplica.');if(Number(m[1])>4294967295)return out('Área inválida.');c.area=Number(m[1]);delete c.areas;return changed('Área OSPF aplicada: '+c.area);}
 m=command.trim().match(/^sim acl ([A-Z0-9-]+) (up|down)$/i);if(m){const id=m[1].toUpperCase();if(!ctx.rules.some(a=>a.id===id&&a.action==='allow'))return out('Regla ALLOW inexistente. Las denegaciones por defecto permanecen activas.');r.disabledRules=r.disabledRules.filter(v=>v!==id);if(m[2].toLowerCase()==='down')r.disabledRules.push(id);return changed(id+' '+m[2]);}
 m=q.match(/^sim service (app|database|dns|aaa|pbx|ntp|dhcp) (up|down)$/);if(m){if(m[1]!=='dhcp'&&s.id!=='cm')return out('Ese servicio se administra en Casa Matriz.');r.services[m[1]]=m[2]==='up';return changed('Servicio '+m[1]+' '+m[2]);}
 if(/^interface\s+/.test(q)){
  if(!['config','interface'].includes(cli.mode))return out('Entra con configure terminal.');const name=q.slice(10).replace(/\s/g,''),normalize=v=>v.toLowerCase().replace('gigabitethernet','gi').replace('tengigabitethernet','te');
  const v=name.match(/^vlan(\d+)$/),port=d.ports.find(p=>[p.port,p.designPort].some(v=>normalize(v)===normalize(name))),pc=d.endpoints.find(p=>normalize(p.port)===normalize(name));
  if(v&&!d.vlans.some(a=>a.vlan===Number(v[1])))return out('VLAN inexistente en este equipo.');if(!v&&!port&&!pc)return out('Interfaz inexistente. Consulta show interfaces.');cli.interface=v?{kind:'vlan',value:Number(v[1])}:port?{kind:'link',value:port.index}:{kind:'port',value:pc.number};cli.mode='interface';return out('Configurando '+name+'.');
 }
 if(q==='router ospf 1'){if(!ospfNode||s.id==='cm')return out('OSPF no aplica.');if(!['config','ospf'].includes(cli.mode))return out('Entra con configure terminal.');cli.mode='ospf';return out('Configuración OSPF 1.');}
 if(q==='shutdown'||q==='no shutdown'){
  const down=q==='shutdown';if(cli.mode==='ospf'){c.ospf=!down;return changed('OSPF '+(down?'shutdown':'habilitado'));}
  if(cli.mode!=='interface'||!cli.interface)return out('Selecciona una interfaz o router ospf 1.');const i=cli.interface;
  if(i.kind==='vlan'){const nodes=ctx.variant==='A'&&switchNode?['sw1','sw2']:[n];for(const node of nodes){const cfg=P.config(st,node);cfg.vlansDown=cfg.vlansDown.filter(v=>v!==i.value);if(down)cfg.vlansDown.push(i.value);}}
  else{const key=i.kind+':'+i.value;st.adminDown=st.adminDown.filter(v=>v!==key);if(down)st.adminDown.push(key);}return changed('Interfaz '+(down?'administratively down':'habilitada'));
 }
 if(q==='no router ospf 1'&&cli.mode==='config'&&ospfNode){c.ospf=false;return changed('Proceso OSPF retirado.');}
 m=q.match(/^network (\d+\.\d+\.\d+\.\d+) (\d+\.\d+\.\d+\.\d+) area (\d+)$/);if(m&&cli.mode==='ospf'){
  const ip=v=>v.split('.').reduce((a,b)=>(a*256+Number(b))>>>0,0),valid=v=>v.split('.').every(x=>Number(x)<=255);if(!valid(m[1])||!valid(m[2])||Number(m[3])>4294967295)return out('Red, wildcard o área inválida.');const mask=(~ip(m[2]))>>>0,matches=s.links.filter(l=>l.role==='LAN_ROUTED'&&[l.a,l.b].includes(n)&&((ip(l.a===n?l.router_ip:l.stack_ip)&mask)>>>0)===((ip(m[1])&mask)>>>0));if(!matches.length)return out('La sentencia no coincide con un tránsito LAN de este equipo.');c.areas=c.areas||{};for(const l of matches)c.areas[l.network]=Number(m[3]);c.ospf=true;return changed('Área actualizada en '+matches.length+' interfaces OSPF.');
 }
 return null;
}
return Object.freeze({execute});
});
