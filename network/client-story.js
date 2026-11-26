window.ClientStory={
  "version": 5,
  "demoRoute": {
    "source": "s06",
    "destination": "cm"
  },
  "title": "Financiera Pacífico",
  "scope": {
    "sites": 23,
    "workers": 780,
    "workstations": 650,
    "phones": 650,
    "future": [
      "San Pedro de Atacama",
      "Ovalle",
      "Los Andes",
      "Los Ángeles",
      "Osorno",
      "Castro"
    ],
    "futureNetworkA": 179239981,
    // Seis sucursales estándar. Partidas comunes de future_six de A y precios unitarios brutos del presupuesto C5 B.
    "futureNetworkB": Math.round((39859840 + 12 * (553350 + 646990 + 281459 + 37271)) * 1.15),
    "futureWanMonthly": 2602206
  },
  "budget": {
    "currency": "CLP",
    "vatIncluded": true,
    "assumed": true,
    "formalQuote": false,
    "original": 160000000,
    "wan60": 660607380,
    "scopeMonths": 60,
    "A": {
      "initial": 750859610,
      "monthly": 11010123,
      "period": 1461466990,
      "operations60": 50000000
    },
    "B": {
      "initial": 291623397,
      "monthly": 11010123,
      "period": 977230777,
      "operations60": 25000000
    }
  },
  "scenes": [
    {
      "id": "context",
      "title": "22 sucursales dependen de los servicios de Santiago",
      "mode": "antes",
      "visual": "map",
      "message": "Las 22 sucursales trabajan con aplicaciones y telefonía de Casa Matriz. La conexión entre ambas sostiene la operación diaria.",
      "points": [
        "La financiera prepara seis aperturas. El diseño debe servir tanto a las oficinas actuales como a las que vienen."
      ],
      "expected": "La vista muestra el alcance actual y las seis sedes de expansión.",
      "section": "La empresa"
    },
    {
      "id": "before-cut",
      "title": "¿Qué ocurre cuando Arica consulta el sistema?",
      "mode": "antes",
      "visual": "short",
      "demo": "before-cut",
      "expectedOk": false,
      "message": "En Arica, un ejecutivo está atendiendo a una persona y necesita consultar el sistema.",
      "points": [
        "Cada sucursal tiene un MPLS. Casa Matriz tiene dos, pero ambos pasan por el mismo poste. El caso registra una caída nacional de MPLS de tres horas."
      ],
      "expected": "La sucursal no tiene una ruta alternativa en la situación actual. El ping animado sólo ilustra conectividad.",
      "section": "El problema"
    },
    {
      "id": "proposal",
      "title": "Elegí cuatro accesos inalámbricos por sede",
      "mode": "despues",
      "visual": "topology",
      "message": "Un robo de cable o un accidente en el poste puede dejar a las oficinas esperando la reparación. Elegí reemplazar los enlaces MPLS por accesos satelitales y móviles. Así, la conexión con Casa Matriz deja de depender de ese poste.",
      "points": [
        "Con la propuesta, la sucursal puede llegar a Casa Matriz por Starlink, Leo, Entel 5G o WOM 4G.",
        "Cada sucursal se comunica con Casa Matriz por un túnel VPN cifrado con IPsec."
      ],
      "expected": "La topología muestra la alternativa elegida y los cuatro enlaces WAN de Casa Matriz y la sucursal.",
      "section": "La propuesta"
    },
    {
      "id": "wan-cascade",
      "title": "La misma consulta con la nueva red inalámbrica",
      "mode": "despues",
      "visual": "map",
      "demo": "wan-cascade",
      "expectedOk": true,
      "expectedWan": "starlink",
      "message": "Ahora hacemos la misma consulta con la nueva red. Si falla Starlink, el ejecutivo vuelve a consultar por Leo. El objetivo es recuperar el acceso al sistema en cinco minutos como máximo.",
      "points": [
        "La nube representa la red del operador. Con 5G o 4G, cada sede se conecta a través de una antena terrestre. El ping muestra el viaje de ida y vuelta. La aplicación y la telefonía tienen sus propias pruebas de acceso.",
        "Con WOM 4G se priorizan el sistema y las llamadas. La meta por sucursal es un 99,95 % de disponibilidad anual."
      ],
      "expected": "El recorrido automático termina con la ida y vuelta por WOM 4G.",
      "section": "La solución en operación"
    },
    {
      "id": "investment",
      "title": "Qué cuesta conectar las 23 sedes",
      "mode": "despues",
      "visual": "budget",
      "message": "A y B contratan los mismos cuatro proveedores de internet. La diferencia de inversión está en los equipos, suscripciones y soporte.",
      "points": [
        "A incorpora Cisco y Palo Alto. B usa MikroTik y OPNsense.",
        "El despliegue contempla 12 semanas y ambas alternativas incluyen $25 millones para logística. Ambas superan la referencia inicial de $160 millones. B requiere aproximadamente $131,6 millones adicionales frente a esa referencia."
      ],
      "expected": "La tabla compara inversión inicial, WAN mensual y total a 60 meses.",
      "section": "La inversión"
    },
    {
      "id": "expansion",
      "title": "Seis aperturas amplían la cobertura nacional",
      "mode": "despues",
      "visual": "summary",
      "message": "Cada nueva sucursal se conecta por IPsec a Casa Matriz. Al completar las aperturas, Santiago atenderá a 28 sucursales.",
      "points": [],
      "section": "La expansión"
    },
    {
      "id": "decision",
      "title": "Por qué elegí la propuesta B",
      "mode": "despues",
      "visual": "summary",
      "message": "Las dos propuestas permiten cifrar la comunicación y usar un respaldo si falla un enlace. La diferencia está en cuánto cuesta hacerlo.",
      "points": [
        "B es la opción más cercana a los $160 millones de referencia. Con MikroTik y OPNsense, el equipo de TI puede administrar el cifrado, los respaldos de conexión y el acceso al sistema."
      ],
      "section": "La decisión"
    },
    {
      "id": "closing",
      "title": "Que la sucursal pueda seguir atendiendo",
      "mode": "despues",
      "visual": "map",
      "message": "Si falla un enlace, entra el siguiente. Y si ese respaldo también falla, todavía queda otro para mantener la operación activa.",
      "points": [],
      "section": "Para finalizar"
    }
  ],
  "wanCascade": [
    {
      "label": "Ruta inicial",
      "failed": null,
      "expectedBranchWan": "starlink",
      "expectedCentralWan": "starlink",
      "expectedPing": true,
      "capacity": "Starlink: referencia Arica 100/100 Mbps y Casa Matriz 1.000/1.000 Mbps."
    },
    {
      "label": "Starlink fuera",
      "failed": "starlink",
      "expectedBranchWan": "leo",
      "expectedCentralWan": "leo",
      "expectedPing": true,
      "capacity": "Leo: terminal de hasta 1.000/400 Mbps; referencia de aceptación Arica 10/10 Mbps."
    },
    {
      "label": "Leo fuera",
      "failed": "leo",
      "expectedBranchWan": "entel5g",
      "expectedCentralWan": "entel5g",
      "expectedPing": true,
      "capacity": "Entel 5G: hasta 300 Mbps de bajada; la subida depende de la capacidad efectiva."
    },
    {
      "label": "Entel 5G fuera",
      "failed": "entel5g",
      "expectedBranchWan": "wom4g",
      "expectedCentralWan": "wom4g",
      "expectedPing": true,
      "capacity": "WOM 4G: hasta 20/5 Mbps y bolsa de 360 GB; se priorizan aplicación y voz."
    },
    {
      "label": "WOM 4G fuera",
      "failed": "wom4g",
      "expectedBranchWan": null,
      "expectedCentralWan": null,
      "expectedPing": false,
      "capacity": "Sin ruta disponible entre la sucursal y Casa Matriz."
    }
  ]
};
