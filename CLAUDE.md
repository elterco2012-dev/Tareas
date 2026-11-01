# Mis tareas — guía para Claude

App personal de tareas, recordatorios y notas del dueño, en español rioplatense (vos, tipo oración, nunca en MAYÚSCULAS).
Respondé siempre en español rioplatense, claro y sin jerga técnica innecesaria. El dueño no es programador.

## Los repositorios
- **elterco2012-dev/Tareas** (este, público): la app. Se publica sola con GitHub Pages en
  https://elterco2012-dev.github.io/Tareas/ al unir a `main`.
- **elterco2012-dev/Mis-tareas** (privado): los datos (`tareas.json`, `ajustes.json`) y los workflows que mandan los
  avisos por Telegram (`recordatorios.yml`, `resumen.yml`) y la copia diaria (`respaldo.yml`, a otro repositorio
  privado, Mis-tareas-respaldo). Los dispara cron-job.org.
- `repo-datos/` de este repo tiene la **plantilla** de esos workflows y la guía de instalación (`INSTRUCCIONES.md`).
  La versión instalada en Mis-tareas difiere a propósito: sin el horario de GitHub y con el `APP_URL` puesto. Si cambiás un
  texto o una lógica de un workflow, cambialo en los dos lugares y corré `node tests/workflows/workflows.mjs`.

## Reglas del dueño (siempre)
- No reescribas la aplicación desde cero si no es necesario.
- No cambies la arquitectura ni incorpores servicios externos sin justificarlo y pedir aprobación.
- No elimines funcionalidades existentes, ni las dejes a más toques que antes.
- No comprometas los datos guardados ni las credenciales. No sacrifiques estabilidad por mejoras visuales.
- Cuando apruebe algo, implementalo de a poco, verificá que funcione y explicá qué modificaste.
- Usá las pruebas automáticas. No digas que algo está probado si no lo pudiste verificar.
- **Nunca leas ni muestres el contenido de `tareas.json`** (en Mis-tareas): son datos personales. Para trabajar en
  Mis-tareas, tocá solo los workflows y la documentación. Antes de subir algo ahí, traé lo último (`git pull`): la app
  sube cambios a `tareas.json` todo el tiempo.
- Nunca muestres, copies ni subas tokens o credenciales, ni a este repositorio público ni a un chat.
- Si algo nuevo choca con algo que ya existe y no está decidido, **preguntá antes de decidir**: ofrecé opciones, con
  la recomendada primero.

## Cómo está hecha
- **Un solo `index.html`** con el CSS y el JS adentro, JS sin frameworks y sin build. Además: `sync-core.js` (aplica
  los cambios sobre la última versión de GitHub y resuelve los cambios cruzados: no se toca su lógica), `sw.js`
  (service worker con caché por versión), `manifest.webmanifest` e `icons/`.
- Los datos van en `tareas.json` del repositorio privado, por la API de GitHub, con el token que carga el dueño en
  Ajustes › Cuenta. Primero se guardan en el dispositivo (localStorage) y se suben solos.
- `tareas.json` **solo puede ganar campos opcionales**: una versión vieja de la app tiene que seguir leyéndolo. No
  cambies las claves de localStorage existentes.
- Las notas son ítems con `kind:'nota'`, sin fecha ni hora. Pueden tener `idea`, `pinned` y `color` (`''`,
  `amarillo`, `verde`, `azul`, `rosa` o `lila`).
- **CSP**: los `<script>` de la página van por hash. Al cambiar el JS, `npm run csp` recalcula los hashes sin
  cambiar la versión, y así la app arranca para probar. Sin eso, la página no corre el script.
- **Versión**: antes de publicar, `npm run nueva-version` sube la versión en `sw.js`, `index.html` y
  `sync-core.js` y recalcula la huella y la CSP. `tests/suites/version.js` falla si te olvidaste. Si no la subís, los
  dispositivos se quedan con la versión vieja en caché.
- Textos de la app y comentarios en español. Los comentarios explican el porqué, como el resto del código.

## Mapa del código (index.html)
- **Pantallas**: `scr` (`hoy`, `tareas`, `notas`, `buscar`, `ajustes`), `goScreen()` y `applyScreen()`.
  - En el celular hay una barra abajo; desde 900 px, una barra lateral (`SIDEBAR`). Desde 1200 px (`WIDE`), una
    columna derecha `#side` con Esperando y Sin fecha.
  - Buscar y Ajustes son pantallas que se cierran (a la pantalla de antes) y que el botón Atrás deja en Hoy.
- **Botón Atrás**: `syncBack()` y `backClose()`, con entradas `{pantalla}` y la guarda `{tareas:'atras'}` mientras
  hay algo abierto (`BACKABLE`).
  - Chrome saltea las entradas creadas sin un toque: por eso existen `gestured` y `waitTap`. Con el dedo, el toque
    cuenta al levantarlo.
- **Alta** (`#addForm`): en el celular es una hoja desde abajo (`capOpen`, `openCap()`/`closeCap()`); en la compu, arriba.
  - `capInfo()` decide el tipo, la fecha y la hora, con `capKind`, `capTime`, `asNote` y `capIdea`.
  - El intérprete de lenguaje natural es `parse()`.
  - Hay borrador local (`K_DRAFT`), dictado con guardado a los 3 s, compartir desde otras apps y pegar varias líneas.
- **Detalle** (`#editOv`/`#editForm`): es una hoja en el celular, un panel en `#side` en la compu ancha y una ventana
  en la compu angosta.
  - `openEdit()` lo abre, `placeEdit()` decide dónde va, `commitEdit()` guarda solo lo cambiado y `editThen()` corre
    las acciones del pie.
  - Se guarda al cerrar; Descartar no guarda. El borrador local es `K_DDRAFT`.
- **Fila**: `taskRow()` y `noteRow()`. Las notas van en grilla (`.ngrid`, Fijadas/Otras/Recientes) con el filtro `noteFilter`.
- **Posponer**: `openPos()`, desde la hora de la fila o desde el aviso de Telegram (`?tarea=`).
- **Otras ventanas**: el menú ⋯ (`openMenu`), Ordenar (`openProc`, tecla P), el Informe y la ayuda de atajos
  (`openHelp`, tecla ?).
- **Direcciones** que tienen que seguir andando: `?tarea=…`, `?revisar=1`, `?nueva=1`, `?voz=1` y lo compartido.

## Pruebas
- `npm test` corre todas las baterías (`tests/suites/*.js` y `tests/workflows/workflows.mjs`) con Playwright y
  Chromium, contra un GitHub falso. Ver `tests/README.md`: ahí está el reloj fijo (miércoles 14/10/2026 10:00
  de Buenos Aires) y cómo correr una sola (`node tests/suites/<nombre>.js`).
- En las sesiones en la nube, Chromium ya está instalado. Si falta `node_modules`, `npm ci`.
- Se mantienen los ids y clases que usan las pruebas (`#addForm`, `#title`, `.task`, `.ghead`, `#menu`, etc.). Si una
  prueba tiene que cambiar, se cambia cómo encuentra el elemento, no lo que controla. Si deja de tener sentido, el PR
  dice cuál y por qué.
- Cada cambio nuevo lleva su prueba, en una batería del tema o en una nueva.
- CI (`.github/workflows/test.yml`) corre `npm test` en cada PR y en cada push a `main`.

## Cómo se trabaja una entrega
1. Rama de trabajo desde `main`.
2. Implementar de a poco y correr las baterías del tema.
3. Escribir pruebas para lo nuevo.
4. Pedir una revisión independiente: un agente que busque defectos reales y los pruebe con Playwright. Corregir lo
   que encuentre, con prueba.
5. Actualizar `INSTRUCCIONES.txt`: es la ayuda del dueño y se actualiza en cada entrega.
6. `npm run nueva-version` y después `npm test`, todo en verde.
7. PR con la descripción en español: qué cambia, pruebas y qué no se pudo verificar.
8. Esperar CI en verde, unir (squash) y confirmar con la API de Actions que terminó el despliegue
   "pages build and deployment".
9. Contarle al dueño qué cambió y **qué probar en el celular y en la compu**, con la versión publicada.

## Historia y estado (noviembre 2026)
- Fases 1 a 6: pruebas y CI, intérprete de fechas, actualizaciones por versión, recordatorios confiables,
  protección de datos (detecta un `tareas.json` vacío o borrado, repositorio privado, copia diaria),
  celular a una mano y notas.
- Rediseño "dirección C v2" (de Claude Design), terminado:
  - 1a: pantallas Hoy, Tareas, Notas y Buscar.
  - 1b: hoja para anotar.
  - 1c: detalle y Posponer desde la hora.
  - Fase 2: fila nueva, notas en grilla y Ajustes como pantalla.
  - Fase 3: ayuda de atajos, letra grande (rem) y contraste.
- Después: botón Idea en el alta (Tarea · Recordatorio · Nota · Idea).
- Sin verificar en un celular real:
  - que la hoja para anotar y el detalle queden arriba del teclado;
  - que el primer Atrás después de abrir con "Nueva tarea" cierre la hoja;
  - la letra al 130 % con el ajuste de Chrome del celular;
  - que la barra de desplazamiento de Windows no cierre el panel del detalle.
- Mejoras chicas posibles, no pedidas todavía:
  - algunos botones de menos de 44 px (por ejemplo, el nombre de la persona en la fila);
  - que el Tab quede atrapado dentro de las ventanas abiertas.
- Pendiente del lado del dueño: probar el workflow de respaldo, activar la verificación en dos pasos y la regla de
  protección de la rama.
