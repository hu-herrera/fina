# Financiera Pacífico - simulador web

Aplicación estática del caso ficticio Financiera Pacífico. Este repositorio contiene la página y sus archivos de ejecución.

- [Abrir simulador](https://hu-herrera.github.io/fina/)
- [Entrega docente pública](https://github.com/hu-herrera/financiera-pacifico-entrega-docente)

Los datos sintéticos necesarios para mostrar topologías, direcciones y presupuestos son públicos en el navegador. Los documentos fuente, guiones y materiales de trabajo se administran por separado y no forman parte de esta web.

Para ejecutar localmente, servir esta carpeta con un servidor HTTP estático o abrir index.html. No requiere credenciales.

**Alcance:** los equipos, enlaces, direcciones y pruebas corresponden a un laboratorio académico simulado; no prueban disponibilidad real, RTO ni certificación de hardware.

**Seguridad:** no subir credenciales, contraseñas, certificados, claves privadas, capturas sensibles ni archivos reales de clientes. Los valores `LAB-ONLY` son marcadores ficticios de demostración y no deben utilizarse en producción.

## Pruebas del diseño

En cada sede, la pestaña **QoS / VPN / HA** permite explorar congestión con cinco clases, revisar identidades y parámetros del contrato VPN y ejecutar ocho escenarios aislados de recuperación de servicios. También está accesible desde la presentación.

La clasificación financiera usa los flujos HTTPS hacia la aplicación del caso; la prioridad no modifica las ACL. Las reservas 20/40/10/5/25 % y el margen de 10 % son decisiones del modelo. Los enlaces móviles requieren ingresar una subida para la simulación; la velocidad máxima publicada no se usa como capacidad garantizada.

Los TXT y JSON incluyen esta política, las identidades IKE exactas y los objetivos RTO/RPO. La entrega académica valida la coherencia del diseño y el funcionamiento del prototipo mediante escenarios y pruebas de software. El aprovisionamiento de certificados operativos, la homologación de hardware y las mediciones en una red de producción quedan fuera del alcance académico: no son tareas pendientes para aprobar o completar este prototipo. Los campos de medición real nulos expresan ese alcance; los resultados obtenidos en el simulador se identifican como simulados.
