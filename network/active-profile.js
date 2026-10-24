/* Operative simulated topology after migration. Physical deployment NOT asserted.
 * WAN -> Cisco C8300 (Gi0/0/0..3) -> Po10/ae1 -> PA-1410 Layer3
 * -> ae2/Po20 -> C9200L members 1+2 joined by StackWise-80.
 */
(function(root){
'use strict';
const m=root.RedundantLab;
const reverseWan={starlink:'starlink',kuiper:'leo',g5:'entel5g',g4:'gtd4g'};
const mapPort={starlink:m.PORTS.wan.starlink,kuiper:m.PORTS.wan.leo,g5:m.PORTS.wan.entel5g,g4:m.PORTS.wan.gtd4g};
const desc={starlink:'Starlink',kuiper:'Amazon Leo',g5:'Entel 5G',g4:'GTD 4G'};
const nextHop=(n,key)=>({starlink:'100.64.'+n+'.1',kuiper:'100.64.'+n+'.5',
    g5:'100.85.'+n+'.1',g4:'100.92.'+n+'.1'})[key];
const wanNet=(n,key)=>({starlink:'100.64.'+n+'.0/30',kuiper:'100.64.'+n+'.4/30',
    g5:'100.85.'+n+'.0/30',g4:'100.92.'+n+'.0/30'})[key];
const wanIp=(n,key)=>({starlink:'100.64.'+n+'.2',kuiper:'100.64.'+n+'.6',
    g5:'100.85.'+n+'.2',g4:'100.92.'+n+'.2'})[key];
const tunnel=(key)=>({starlink:'Tunnel100',kuiper:'Tunnel200',g5:'Tunnel300',g4:'Tunnel400'})[key];
const distance={starlink:1,kuiper:10,g5:20,g4:30};
function enabled(){
  return !root.__TEST_LEGACY_PROFILE__ && typeof ST!=='undefined' && ST.mode!=='antes';
}
function rawSite(siteId){
  const s=SEDES.find(s=>s.id===siteId);
  if(!s)throw Error('Invalid site '+siteId);
  const b=getRedundantLabState(siteId);
  // Cargar startup-config persistido antes de evaluar el estado operativo.
  // La topología debe reflejar shutdowns incluso tras refrescar la página
  // sin que el usuario tenga que abrir las consolas primero.
  const routerSession=deviceCliSession(siteId,'router');
  const stackSessions=[1,2].map(sw=>deviceCliSession(siteId,'sw'+sw));
  const copy={siteNum:b.siteNum,nodes:{...b.nodes},links:{...b.links},
    wan:{...b.wan},wanGateway:{...b.wanGateway},wanUpstream:{...b.wanUpstream},
    oob:{...b.oob}};
  const wanMap={starlink:'starlink',kuiper:'leo',g5:'entel5g',g4:'gtd4g'};
  for(const [oldKey,newKey] of Object.entries(wanMap)){
    if(['caido','inactivo','recuperando'].includes(ST.links[siteId]?.[oldKey]))
      copy.wan[newKey]=false;
    const session=routerSession;
    if(session?.interfaces && (session.interfaces[mapPort[oldKey]]?.shutdown))
      copy.wan[newKey]=false;
  }
  for(const p of m.PORTS.transit){
    const session=routerSession;
    const short=p.router.replace('TenGigabitEthernet','Te');
    if(session?.interfaces[p.router]?.shutdown||session?.interfaces[short]?.shutdown||
       session?.interfaces.Po10?.shutdown||session?.interfaces['Port-channel10']?.shutdown)
      copy.links[p.id]=false;
  }
  // Po20 es UN port-channel del StackWise, no dos bundles independientes.
  // Apagarlo desde cualquiera de sus consolas desactiva los cuatro miembros.
  const po20Down=stackSessions.some(session=>
    session?.interfaces.Po20?.shutdown||session?.interfaces['Port-channel20']?.shutdown);
  for(const p of m.PORTS.distribution){
    const short=p.switch.replace('GigabitEthernet','Gi');
    if(po20Down||stackSessions.some(session=>
      session?.interfaces[short]?.shutdown||session?.interfaces[p.switch]?.shutdown))
      copy.links[p.id]=false;
  }
  return copy;
}
function status(siteId){return m.inspect(rawSite(siteId))}
function hasMember(siteId,member){
  const state=status(siteId);
  return Boolean(state.activeStackMembers.includes(member)&&state.stackFunctional);
}
function path(siteId,member){
  return Boolean(status(siteId).switchGateway[member]);
}
function directLink(siteId,member){
  const state=status(siteId);
  return state.paStackMembers.some(id=>m.PORTS.distribution.some(p=>p.id===id&&p.member===member));
}
function l2Stack(siteId){return status(siteId).interMemberL2}
function linkMembers(siteId){
  const a=rawSite(siteId);
  return m.PORTS.stack.map(id=>({id,up:Boolean(a.links[id]&&a.nodes.sw1&&a.nodes.sw2)}));
}
function selectedWan(siteId){
  const key=status(siteId).activeWan;
  return Object.keys(reverseWan).find(k=>reverseWan[k]===key)||null;
}
function siteReady(siteId){
  const z=status(siteId);
  return Boolean(z.activeWan&&(z.switchInternet[1]||z.switchInternet[2]));
}
function overlayInterfaceUp(siteId){
  // Estado administrativo del túnel de la WAN seleccionada, NO prueba de
  // SA IKEv2/IPsec ni de una adyacencia OSPF establecida en hardware.
  const wan=selectedWan(siteId);
  if(!wan)return false;
  const cfg=deviceCliSession(siteId,'router');
  return !cfg.interfaces[tunnel(wan)]?.shutdown;
}
function l2Local(siteId,member){return Boolean(status(siteId).switchLocalL2[member])}
function activeRoute(s){
  const n=s.num, id=routerIdentity(s),z=status(s.id);
  const primary=selectedWan(s.id),lan=[];
  const out=['Codes: C - connected, L - local, S - static, O - OSPF (modelled only)',
    'Router-ID '+id.loopback+'; PEER/SAs not verified on hardware'];
  if(primary)
    out.push('S* 0.0.0.0/0 ['+distance[primary]+'/0] via '+nextHop(n,primary)+', '+mapPort[primary]);
  if(z.transitUp){
    out.push('C 10.72.'+n+'.0/30 is directly connected, Port-channel10',
      'L 10.72.'+n+'.1/32 is directly connected, Port-channel10');
    for(const v of m.VLAN){
      out.push('S 10.70.'+n+'.'+v.network+'/'+v.prefix+
        ' [1/0] via 10.72.'+n+'.2, Port-channel10');
    }
  }
  for(const [key,kind] of Object.entries(reverseWan)){
    if(!rawSite(s.id).wan[kind])continue;
    out.push('C '+wanNet(n,key)+' is directly connected, '+mapPort[key],
      'L '+wanIp(n,key)+'/32 is directly connected, '+mapPort[key]);
  }
  out.push('L '+id.loopback+'/32 is directly connected, Loopback0');
  if(primary && overlayInterfaceUp(s.id)){
    const central=SEDES.find(v=>v.isCM);
    const hubReady=s.isCM||(!central?false:
      siteReady(central.id)&&overlayInterfaceUp(central.id));
    if(hubReady){
      for(const remote of SEDES){
        if(remote.id===s.id||!siteReady(remote.id)||
           !overlayInterfaceUp(remote.id))continue;
        for(const v of m.VLAN.filter(v=>v.id!==40)){
          out.push('O 10.70.'+remote.num+'.'+v.network+'/'+v.prefix+
            ' [110/30] via OVERLAY-'+tunnel(primary)+
            ' (modelled; IKEv2/OSPF adjacency not verified)');
        }
      }
    }
  }
  return 'RTR-'+s.code+'> <span class="ios-cmd">show ip route</span><br><br>'+out.join('<br>');
}
function candidate(s){return m.siteCandidate(s.num,PC_COUNT[s.id])}
function runningRouter(s,startup){
  const statusLine='! SIMULADOR. WAN/vpn peer, AAA y SLA remoto requieren operador/hardware';
  const base=candidate(s).cisco.split('\n');
  const lines=['Building configuration...',
    startup?'! Startup profile (modelled)':'! Operational StackWise/L3 profile (modelled)',
    'version 17.9','hostname RTR-'+s.code,statusLine,
    'ip name-server '+CENTRAL_SERVICES.dns1,
    'ip name-server '+CENTRAL_SERVICES.dns2,'!',
    ...base,'!','! VPN IKEv2 OVERLAY: defined as intent, not an established SA',
    '! Tunnel100/200/300/400 require validated endpoints, NAT-T and per-ISP source routing',
    '! Explicit 203.0.113.0/24 peers are documentation addresses and NOT deployable',
    '! Core management and firewall security policies are not certified on hardware','end'];
  return cliText('RTR-'+s.code+'>',startup?'show startup-config':'show running-config',lines);
}
function runningSwitch(s,startup){
  const base=candidate(s).stack.split('\n');
  const lines=['Building configuration...',startup?'! Startup profile (modelled)':'! StackWise-80 target: unified logical control plane (modelled)',
    ...base,'! AAA, DHCP-snooping/DAI and StackWise ring require hardware validation','end'];
  return cliText('STACK-'+s.code+'>',startup?'show startup-config':'show running-config',lines);
}
function firewallCommand(s,cmd){
  const n=s.num,p='PA-'+s.code+'>',h=p+' <span class="ios-cmd">'+escapeCLI(cmd)+'</span><br><br>';
  const z=status(s.id),a=candidate(s);
  if(['show running-config','show startup-config'].includes(cmd)){
    const lines=['# SIMULADOR - PA-1410 Layer3; NO se ha hecho commit en un equipo físico',
      'set deviceconfig system hostname PA-'+s.code,
      '# MGT físico sin dirección en este presupuesto; gestión restringida por ae2.30',
      // Gestión en banda se define una sola vez en paloCandidate().
      ...a.palo.split('\n'),
      '# Políticas y servidores DNS/NTP reservados, no aprovisionados; sin sesiones reales'];
    return h+lines.map(escapeCLI).join('<br>');
  }
  if(cmd==='show system info'||cmd==='show interface management')
    return h+'PA-1410 · PAN-OS (emulación)<br>Data gateway: ae2.30 10.70.'+n+'.161/28<br>'+
      'In-band: HTTPS/SSH desde IP del stack .162 sujeto a perfil de gestión<br>'+
      'MGT físico: no aprovisionado (OOB opcional).<br>HA del PA único: NO';
  if(cmd==='show interface all')
    return h+['ae1 10.72.'+n+'.2/30 Layer3 LACP e1/19 + e1/20 '+(z.transitUp?'up':'down'),
      ...m.VLAN.map(v=>'ae2.'+v.id+' 10.70.'+n+'.'+v.offset+'/'+v.prefix+' Layer3 zona '+({10:'USERS',20:'VOICE',30:'MGMT-DATA',40:'GUESTS'}[v.id])),
      'ae2 Po20 MEC cuatro miembros '+z.paStackMembers.join(','),
      'MGT sin configuración (OOB opcional)'].join('<br>');
  if(cmd==='show routing route'||cmd==='show routing summary')
    return h+['S* 0.0.0.0/0 via 10.72.'+n+'.1 ae1 '+(z.transitUp?'active':'unreachable'),
      ...m.VLAN.map(v=>'C 10.70.'+n+'.'+v.network+'/'+v.prefix+' ae2.'+v.id),
      'C 10.72.'+n+'.0/30 ae1','Rutas intersede por el Cisco; se requieren SA/OSPF reales'].join('<br>');
  if(cmd==='show zone')
    return h+['TRANSIT ae1','USERS ae2.10','VOICE ae2.20','MGMT-DATA ae2.30','GUESTS ae2.40',
      'Default interzone deny; intra-zone behaviour per PAN-OS'].join('<br>');
  if(cmd==='show rulebase security rules'||cmd==='show security policy')
    return h+m.securityRulesForSite(n).map(r=>r.name+' : '+r.from.join(',')+' -> '+r.to.join(',')+
      ' '+r.apps.join(',')+' '+r.action.toUpperCase()).join('<br>')+
      '<br>Profile candidate, not committed on hardware.';
  if(cmd==='show vpn ike-sa'||cmd==='show vpn ipsec-sa')
    return h+'VPN IKEv2/IPsec terminates on Cisco C8300; Palo Alto does not terminate the overlay.';
  if(cmd==='show session info'||cmd==='show session all')
    return h+'No real PAN-OS session counters in simulator; security decisions are policy-model based.';
  if(cmd==='show log traffic'||cmd==='show log threat')
    return h+'No real PAN-OS traffic/threat events were collected; use authorised packet simulations.';
  if(cmd==='show high-availability state')
    return h+'One PA-1410 per branch: SINGLE POINT OF FAILURE. Physical HA only if separately deployed.';
  return null;
}
function switchCommand(s,member,cmd){
  const n=s.num,z=status(s.id),prefix='STACK-'+s.code+'> <span class="ios-cmd">'+escapeCLI(cmd)+'</span><br><br>';
  const rows=[];
  const port=p=>p.switch.replace('GigabitEthernet','Gi');
  const down=!z.stackFunctional;
  if(cmd==='show etherchannel summary'||cmd==='show port-channel summary'){
    return prefix+'Group Port-channel Protocol Ports<br>20 Po20('+(z.paStackMembers.length&&z.stackFunctional?'SU':'SD')+
      ') LACP '+m.PORTS.distribution.map(p=>port(p)+'('+(z.paStackMembers.includes(p.id)&&!down?'P':'D')+')').join(' ')+
      '<br>StackWise ring is NOT a Port-channel.';
  }
  if(cmd==='show switch'||cmd==='show stack'||cmd==='show switch stack-ports'){
    const role=id=>!z.activeStackMembers.includes(id)?'Down':
      id===z.activeStackMembers[0]?'Active/Ready':'Standby/Ready';
    return prefix+'Switch# Role State Model<br>1 '+role(1)+
      ' C9200L-48T-4G<br>2 '+role(2)+
      ' C9200L-48T-4G<br>StackWise cables: '+m.PORTS.stack.map(id=>id+':'+(rawSite(s.id).links[id]?'up':'down')).join(' ')+
      '<br>'+(z.stackPartitioned?'PARTITION: forwarding across stack not guaranteed':'Single logical stack (model)');
  }
  if(cmd==='show spanning-tree'||cmd==='show spanning-tree brief')
    return prefix+'VLAN0010 rapid-pvst<br>Logical bridge: STACK-'+s.code+
      '<br>Po20 Desg '+(z.stackFunctional&&z.paStackMembers.length?'FWD':'BLK')+' 4x1G distributed uplink<br>'+
      'StackWise links are internal fabric, not STP ports';
  if(cmd==='show interfaces trunk'){
    return prefix+'Port Mode Status Native VLAN Allowed<br>'+
      'Po20 trunk '+(z.stackFunctional&&z.paStackMembers.length?'trunking':'down')+' 999 10,20,30,40<br>'+
      [1,2].flatMap(sw=>[33,34].map(p=>{
        const name='Gi'+sw+'/0/'+p;
        const up=l2Local(s.id,sw)&&!isDeviceInterfaceAdminDown(s.id,'sw'+sw,name);
        return name+' trunk '+(up?'trunking':'down')+' 999 10,40';
      })).join('<br>');
  }
  if(cmd==='show ip interface brief'){
    return prefix+'Vlan30 10.70.'+n+'.162 YES manual '+(z.stackFunctional?'up up':'down down')+
      '<br>Port-channel20 unassigned YES unset '+(z.stackFunctional&&z.paStackMembers.length?'up up':'down down')+'<br>'+
      m.PORTS.distribution.map(p=>p.switch+' unassigned YES unset '+(z.paStackMembers.includes(p.id)?'up up':'down down')).join('<br>');
  }
  if(cmd==='show ip route')
    return prefix+'Default Gateway is 10.70.'+n+'.161; ip routing disabled (L2 stack)';
  if(cmd==='show interfaces status'||cmd==='show interfaces description'){
    for(const memberId of [1,2]){
      const pcs=getSwitchPCPorts(s,memberId);
      for(const {pc,port:pt} of pcs){
        rows.push('Gi'+memberId+'/0/'+pt+' '+pc.id+' '+(isSwitchPCPortAvailable(s.id,pc)?'connected':'disabled')+' '+
          (getSwitchPCPortSettings(s.id,pc)?.switchportMode==='trunk'?'trunk':getSwitchPCVlan(s.id,pc)));
      }
      for(const portNo of [33,34]){
        const name='Gi'+memberId+'/0/'+portNo;
        const up=l2Local(s.id,memberId)&&!isDeviceInterfaceAdminDown(s.id,'sw'+memberId,name);
        rows.push(name+' AP-WIFI-'+portNo+' '+(up?'connected':'disabled')+' trunk');
      }
    }
    for(const p of m.PORTS.distribution)rows.push(port(p)+' '+p.id+' '+(z.paStackMembers.includes(p.id)?'connected':'notconnect')+' trunk');
    return prefix+'Port Name Status VLAN<br>'+rows.join('<br>');
  }
  if(cmd==='show mac address-table'||cmd==='show mac address-table dynamic'){
    const rows=getPCs(s).filter(pc=>isSwitchPCPortAvailable(s.id,pc)&&getSwitchPCPortSettings(s.id,pc)?.switchportMode!=='trunk').map(pc=>{
      const num=getSwitchPCPorts(s,pc.sw).find(p=>p.pc.idx===pc.idx)?.port;
      return getSwitchPCVlan(s.id,pc)+' '+pc.mac.replace(/:/g,'').toLowerCase().match(/.{1,4}/g).join('.')+' DYNAMIC Gi'+pc.sw+'/0/'+num;
    });
    return prefix+'Vlan MAC Type Port<br>'+rows.join('<br>');
  }
  if(cmd==='show vlan brief'){
    const userPorts=getPCs(s).filter(pc=>getSwitchPCVlan(s.id,pc)===10&&getSwitchPCPortSettings(s.id,pc)?.switchportMode!=='trunk').length;
    return prefix+'10 USERS active '+userPorts+' access ports<br>20 VOICE active<br>'+
      '30 MGMT active (SVI .162)<br>40 GUESTS active (AP trunks)<br>999 NATIVE-ISOLATED active';
  }
  if(cmd==='show cdp neighbors'||cmd==='show lldp neighbors')
    return prefix+'PA-'+s.code+' via Po20 (LACP model)<br>Physical CDP/LLDP state not measured';
  return null;
}
function routerDetail(s,cmd){
  const n=s.num,z=status(s.id),p='RTR-'+s.code+'> <span class="ios-cmd">'+escapeCLI(cmd)+'</span><br><br>';
  if(cmd==='show ip route')return activeRoute(s);
  if(cmd==='show standby'||cmd==='show standby brief')
    return p+'HSRP no configurado: C8300 único. Failover WAN por selección de proveedor; gateways VLAN en Palo Alto.';
  if(cmd==='show ip interface brief'){
    const ports=Object.keys(mapPort).map(key=>mapPort[key]+' '+wanIp(n,key)+' YES manual '+
      (rawSite(s.id).wan[reverseWan[key]]?'up up':'down down'));
    return p+'Port-channel10 10.72.'+n+'.1 YES manual '+(z.transitUp?'up up':'down down')+
      '<br>TenGigabitEthernet0/0/4 member Po10<br>TenGigabitEthernet0/0/5 member Po10<br>'+
      ports.join('<br>')+'<br>Loopback0 '+routerIdentity(s).loopback+' YES manual up up';
  }
  if(cmd==='show ip ospf interface brief')
    return p+'Loopback0 Router-ID '+routerIdentity(s).loopback+'/32 passive<br>'+
      'Tunnel100/200/300/400 conditional OSPF interfaces; no VLAN subinterfaces on C8300';
  if(cmd==='show ip protocols')
    return p+'Routing protocol OSPF 1 overlay; VLAN10/20/30 redistributed as static via route-map; VLAN40 excluded. Actual adjacency not verified.';
  if(cmd==='show ip ospf neighbor'||cmd==='show ip ospf neighbor detail')
    return p+'No physical OSPF FULL neighbors asserted. Overlay candidate via '+(selectedWan(s.id)||'none')+'.';
  if(cmd==='show vlan brief')
    return p+'No router-on-a-stick VLAN interfaces. Gateways VLAN10/20/30/40 terminate on PA ae2 subinterfaces.';
  if(cmd==='show track'||cmd==='show ip sla configuration'||cmd==='show ip sla statistics')
    return p+'Logical ISP availability: '+Object.keys(reverseWan).map(k=>desc[k]+': '+(rawSite(s.id).wan[reverseWan[k]]?'candidate up':'down')).join('; ')+
      '<br>Two remote probes per ISP require provider-approved addresses; no real IP SLA results collected.';
  if(cmd==='show crypto ikev2 sa'||cmd==='show crypto ipsec sa'||cmd==='show crypto session')
    return p+'IPsec/IKEv2/OSPF overlay design pending real peers, authentication and RTT/CGNAT tests; no established SA claimed.';
  if(cmd==='show arp')
    return p+'Router ARP on L3 transit Po10 10.72.'+n+'.0/30. Physical ARP entries not measured.';
  if(cmd==='show ip cef')
    return p+'10.70.'+n+'.0/25 via 10.72.'+n+'.2 Port-channel10<br>'+
      '10.70.'+n+'.128/27, .160/28, .176/28 via 10.72.'+n+'.2; WAN '+(selectedWan(s.id)||'none');
  if(cmd==='show interfaces description'||cmd==='show interfaces'||cmd==='show interfaces counters errors')
    return p+'WAN Gi0/0/0..Gi0/0/3; Transit Po10 2x10G Te0/0/4-5 to PA ae1<br>'+
      'Counter metrics are not measured in hardware.';
  return null;
}
root.ActiveProfile=Object.freeze({
  enabled,status,rawSite,linkMembers,selectedWan,hasMember,path,directLink,l2Stack,l2Local,siteReady,
  routerConfig:runningRouter,switchConfig:runningSwitch,firewallCommand,switchCommand,
  routerDetail,activeRoute,overlayInterfaceUp,wanPort:mapPort
});
})(window);
