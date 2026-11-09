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
  - Hoy (`renderHoy()`): sin nada vencido, para reclamar ni para hoy (`!main`), `#empty.clear` (renglón con ✓),
    "Lo que sigue" (2 con la barra abajo, `BOTTOMNAV`; 3 desde 900 px), Próximos avisos sin repetir y la tarjeta
    `#hoyLinks.entries` (Mañana, Sin fecha y Esperando). Con algo para hoy, los links de siempre.
  - Tareas: filtro `taskFilter` (Todas · Con hora · Alta · Esperando, `#taskFilter`), que no se guarda. `tfPasses()`
    dice qué pasa; `showInTasks()` vuelve a Todas si lo agregado, lo que vuelve o lo de "Ver" no pasaría (como
    `showInNotes()`). Con un filtro, `body.tfon` esconde Terminadas y la Papelera.
  - Buscar vacío: "Quién te lo pidió" (`#searchPeople`, con inicial) y "Atajos" (`#searchQuick`, abren Tareas filtrado).
- **Botón Atrás**: `syncBack()` y `backClose()`, con entradas `{pantalla}` y la guarda `{tareas:'atras'}` mientras
  hay algo abierto (`BACKABLE`).
  - Chrome saltea las entradas creadas sin un toque: por eso existen `gestured` y `waitTap`. Con el dedo, el toque
    cuenta al levantarlo.
- **Alta** (`#addForm`): en el celular es una hoja desde abajo (`capOpen`, `openCap()`/`closeCap()`); en la compu, arriba.
  - `capInfo()` decide el tipo, la fecha y la hora, con `capKind`, `capTime`, `asNote` y `capIdea` (`capIdea` es solo
    lo elegido a mano; la Idea que propone Notas con el filtro Ideas la calcula `ideaHere()` en el momento).
  - Los chips de fecha (alta y detalle) marcan uno solo con `dueChip()`: el domingo, Mañana y Lunes son el mismo día.
  - El intérprete de lenguaje natural es `parse()`.
  - Hay borrador local (`K_DRAFT`), dictado con guardado a los 3 s, compartir desde otras apps y pegar varias líneas.
- **Detalle** (`#editOv`/`#editForm`): es una hoja en el celular, un panel en `#side` en la compu ancha y una ventana
  en la compu angosta.
  - `openEdit()` lo abre, `placeEdit()` decide dónde va, `commitEdit()` guarda solo lo cambiado y `editThen()` corre
    las acciones del pie.
  - Se guarda al cerrar; Descartar no guarda. El borrador local es `K_DDRAFT`.
  - Lo de adentro no se achica (`#editForm .dbody>*{flex-shrink:0}`): se desliza. `fitTitle()` mide dos veces (por las
    barras de Windows) y un `ResizeObserver` lo vuelve a acomodar si cambia el ancho.
  - El panel de la compu ancha mide desde donde empieza (debajo del alta) hasta abajo: `fitPanel()` pone `--pmax` al
    abrir, al desplazar y si cambia lo de arriba de las columnas. En la compu, la ventana deja libre abajo el lugar del
    aviso (arriba taparía Descartar); en el celular, con una hoja abierta, el aviso va arriba.
- **Fila**: `taskRow()` y `noteRow()`.
  - En `.meta`, la persona (`.person .nm`) se acorta con "…" hasta unas 6 letras y lo que no entra baja de renglón:
    **nunca se esconde nada** (sobre todo "sin subir"). Hasta 520 px (`NARROW`) la fecha va corta. ⋯ de 44 px.
  - Las notas van en grilla (`.ngrid`, Fijadas/Otras/Recientes) con el filtro `noteFilter`, guardado por dispositivo
    (`K_NOTES_FILTER`, `checkNoteFilter()`). `showInNotes()` pasa a Todas lo que se agrega y el filtro no muestra.
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
- Playwright oculta las barras de desplazamiento. Para probar con barras como las de Windows (ocupan lugar), un
  navegador aparte con `L.launch({ignoreDefaultArgs:['--hide-scrollbars']})` (ver el final de `detalle.js`).
- En un contexto de celular, una captura de página entera (`fullPage`) puede apagar después `pointer:coarse`: medir
  antes de esa captura.

## Cómo se trabaja una entrega
1. Rama de trabajo desde `main`. Si la rama asignada ya tuvo un PR unido, se rehace desde `main`
   (`git checkout -B <rama> origin/main`). El push forzado está bloqueado: antes de subir, se une la rama remota vieja
   (`git merge origin/<rama>`) quedándose con lo propio (`git checkout --ours` en los conflictos de versión) y se
   comprueba que el árbol quedó igual al commit propio. Conviene hacerlo antes de largar `npm test`.
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
- 1/11/2026, versión 2026.11.1-9:
  - Workflows (plantilla y Mis-tareas): Node 24 y `actions/checkout@v7` y `actions/setup-node@v7` (PR #25). La copia
    diaria anda (GitHub la corre entre las 9 y las 10, no a las 3:17).
  - Mejoras de Claude Design, con ajustes (PRs #26 a #29):
    - Domingo con un solo chip de fecha y el título del detalle entero.
    - Filas compactas sin esconder nada.
    - Hoy nunca vacío, sin el acceso "Todas las tareas" y sin sacar Próximos avisos ni Mañana.
    - Notas recuerda el filtro, con números en Todas e Ideas.
  - Las propuestas de Design no conocen el código: antes de implementar, verificar el problema y la causa en la app
    (con una sonda de Playwright) y avisar al dueño lo que no conviene. No se hicieron los chips "Otra fecha…" y "Otra
    hora…" del detalle: poco beneficio y, en la compu, la fecha se escribiría sin verla.
- 9/11/2026 (PRs #31 y #32):
  - Lo que faltaba de la 1a: filtros de Tareas (no se recuerdan, por decisión del dueño) y Buscar con personas e
    iniciales y atajos. "Ordenar por" no se hace: choca con el orden a mano.
  - El pie del detalle siempre a la vista: el panel de la compu ancha entra entero (sin pasar del final de la lista) y
    el aviso no tapa la ventana. Un clic en la barra de desplazamiento de la página ya no cierra el panel (pasaba en
    Chromium con barras visibles; probado así).
  - El nombre de la persona en la fila queda en 26 px de alto para el dedo (decisión del dueño): para 44 px había que
    agrandar las filas o pisar el título. Para filtrar con botones grandes está Buscar › "Quién te lo pidió".
- Sin verificar en un celular real:
  - que la hoja para anotar y el detalle queden arriba del teclado;
  - que el primer Atrás después de abrir con "Nueva tarea" cierre la hoja;
  - la letra al 130 % con el ajuste de Chrome del celular (también las filas compactas);
  - el panel del detalle con las barras de Windows (con barras visibles, en Chromium sobre Linux, el título se ve
    entero y la barra de la página ya no lo cierra);
  - Hoy sin nada para hoy, deslizar en "Lo que sigue" y el filtro de Notas recordado al reabrir la app.
- Mejoras chicas posibles, no pedidas todavía:
  - que el Tab quede atrapado dentro de las ventanas abiertas (aprobada como entrega 3);
  - en la compu, el nombre a veces se acorta aunque la fila igual ocupe dos renglones;
  - el CI de la app (`test.yml`) sigue con `checkout` y `setup-node` v4 (aviso de Node 20; aprobada como entrega 4).
- Pendiente del lado del dueño: activar la verificación en dos pasos y la regla de protección de la rama.
