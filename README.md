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

## Presentación con ejemplos automáticos

Abrir **Presentar**, elegir la alternativa y pulsar **Reproducir recorrido** para ejecutar las doce escenas de principio a fin mientras narras. El ritmo puede ser Pausado, Normal o Ágil. **Pausar recorrido** detiene también el paquete; **Repetir escena** reinicia la escena actual y **Modo manual** devuelve el control individual. Cambiar de pestaña o abrir herramientas técnicas pausa el recorrido. La escena final permanece visible. El simulador no graba audio ni video y no se sincroniza con la voz: ensayar antes de grabar.

También se puede avanzar con Siguiente diapositiva. Cada ejemplo recorre situación inicial, fallo, respuesta y conclusión. El inicio automático puede desactivarse para usar Empezar ejemplo. Pausar/Continuar detiene la secuencia y el paquete; Repetir restaura una escena limpia. Avanzar etapa es opcional. Explorar detalles reúne topología y herramientas técnicas.

Se comparan conexiones, routers, acceso Wi-Fi, permisos y recuperación de servicios. La propuesta incluye el ejemplo de reparto QoS por clases con valores didácticos. La escena final resume conectividad, seguridad y recuperación, y permanece visible para preguntas y pruebas técnicas. El ejemplo consulta el motor del modelo: no representa una transacción bancaria real. Salir restaura la red previa y cancela las acciones pendientes.

## Continuidad de extremo a extremo

Todas las sedes, incluida Casa Matriz, tienen Starlink, Leo, Entel y WOM en el modelo. E6 conserva camino por móvil. El ejemplo WAN muestra la pérdida sucesiva hasta el último acceso y solo pierde camino al agotar los cuatro. Las nuevas comunicaciones requieren un acceso utilizable en cada extremo, un túnel candidato coincidente, políticas y servicios disponibles. Los móviles centrales requieren una entrega alcanzable bajo los supuestos académicos; conservar camino no equivale a capacidad plena de toda la operación.

## Recuperación central - 26 de octubre de 2026

La escena 10 de Presentar añade operaciones ficticias para explicar el punto recuperable de la réplica, la conciliación y los controles previos a reabrir. El explorador QoS/VPN/HA permite revisar escenarios aislados. [Procedimiento de entrega técnica](https://github.com/hu-herrera/financiera-pacifico-entrega-docente/blob/main/Anexos/Operacion_Recuperacion_Datacenter_C5.md).

## Verificación pública del cierre

La entrega docente publica [comandos, alcance y evidencia por corte](https://github.com/hu-herrera/financiera-pacifico-entrega-docente/blob/main/Anexos/Evidencia_Pruebas_27_oct_2026.md). Los conteos históricos no sustituyen los logs de una ejecución sobre este corte. E4 representa una sede completa caída; la escena 10 distingue el relevo del firewall de la recuperación de aplicación y datos.
