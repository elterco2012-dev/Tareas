# Resumen diario por Telegram

De lunes a viernes, a las 7 de la mañana, te llega un mensaje de Telegram como este:

```
Buen día. 2 vencidas, 3 para hoy, 1 esperando respuesta

Vencidas
• Enviar cotización (ALTA) · @Martín · venció hace 2 días
• Pagar luz · venció ayer

Para hoy
• Responder reclamo
• Mandar remitos · @Laura

Esperando respuesta
• Llamar proveedor · Juan, hace 5 días
```

En "Esperando respuesta" aparece lo que espera hace 3 días o más (desde que lo pusiste en espera o desde el último reclamo), o lo que tiene para hoy la fecha de "Volver a mirar el…".

Si un día no hay nada vencido, nada para hoy y nada esperando respuesta, no te llega nada (salvo que haya un aviso con ⚠, como el de un recordatorio que no salió: ver "Recordatorios a la hora").

Las notas de la app no aparecen ni se cuentan: ni en este resumen, ni en la revisión de los viernes, ni en los recordatorios. **Si ya tenías el resumen o los recordatorios** de antes de las notas, reemplazá `resumen.yml` y `recordatorios.yml` por los de esta carpeta (como en "0. Actualizar los dos archivos", más abajo); si no, el resumen de los viernes cuenta las notas como "sin fecha".

Lo hace GitHub solo, con tu repositorio **privado de datos** (el de `tareas.json`). No hace falta tener la compu prendida. Es gratis: usa alrededor de 1 minuto por día de los 2000 minutos por mes que GitHub da gratis para repositorios privados.

Se configura una sola vez y lleva unos 10 minutos.

---

## 1. Crear el bot de Telegram

1. En Telegram, buscá **@BotFather** (tiene una tilde azul de verificado) y abrí el chat.
2. Escribile `/newbot`.
3. Te pide un nombre: escribí, por ejemplo, `Mis tareas`.
4. Te pide un nombre de usuario, que tiene que terminar en `bot`. Por ejemplo: `mis_tareas_2026_bot`. Si ya existe, probá con otro.
5. Te responde con un mensaje que incluye el **token**, algo así:
   `7123456789:AAH...`
   Copialo y guardalo: es como una contraseña del bot. No lo compartas.

## 2. Averiguar tu chat_id

1. En Telegram, buscá el bot que creaste (por el nombre de usuario) y tocá **Iniciar**. Después mandale cualquier mensaje, por ejemplo `hola`.
2. En el navegador, abrí esta dirección, reemplazando `TU_TOKEN` por el token del paso 1:
   `https://api.telegram.org/botTU_TOKEN/getUpdates`
3. En el texto que aparece, buscá `"chat":{"id":` seguido de un número, por ejemplo `"chat":{"id":123456789`. Ese número es tu **chat_id**.
   - Si dice `"result":[]`, mandale otro mensaje al bot y recargá la página.

## 3. Copiar el archivo a tu repositorio de datos

1. Abrí este archivo y copiá todo su contenido:
   [repo-datos/.github/workflows/resumen.yml](https://github.com/elterco2012-dev/Tareas/blob/main/repo-datos/.github/workflows/resumen.yml)
   (en esa página, el botón "Copy raw file" lo copia entero).
2. En GitHub, entrá a tu repositorio **privado de datos** (por ejemplo `mis-tareas-datos`).
3. Tocá **Add file → Create new file**.
4. En el nombre del archivo escribí exactamente:
   `.github/workflows/resumen.yml`
   (al escribir las barras `/` GitHub va creando las carpetas solo).
5. Pegá el contenido que copiaste.
6. Tocá **Commit changes…** y después **Commit changes** otra vez.

## 4. Cargar el token y el chat_id como secretos

Los secretos quedan guardados en GitHub sin que nadie pueda verlos, ni siquiera vos después de cargarlos.

1. En el repositorio de datos, entrá a **Settings** (la rueda dentada de arriba).
2. En el menú de la izquierda: **Secrets and variables → Actions**.
3. Tocá **New repository secret** y cargá:
   - Name: `TELEGRAM_TOKEN` — Secret: el token del paso 1. Tocá **Add secret**.
4. Otra vez **New repository secret**:
   - Name: `TELEGRAM_CHAT_ID` — Secret: el número del paso 2. Tocá **Add secret**.

Los nombres tienen que ser exactamente esos, en mayúsculas.

Mientras no estén cargados, las corridas automáticas no envían nada ni fallan: esperan a que los cargues.

## 5. Probarlo

1. Asegurate de tener alguna tarea vencida o para hoy en la app (si no, no se envía nada).
2. En el repositorio de datos, entrá a la pestaña **Actions**.
   - Si aparece un aviso para habilitar los workflows, tocá el botón verde para habilitarlos.
3. A la izquierda, tocá **Resumen diario**.
4. Tocá **Run workflow** y después el botón verde **Run workflow**.
5. En unos segundos aparece una ejecución. Cuando termina con un tilde verde, revisá Telegram: tendría que haberte llegado el mensaje.

Si termina con una cruz roja, tocala y abrí el paso **Enviar resumen**: el error explica qué falta. Lo más común:

- **"Falta configurar los secretos…"**: revisá el paso 4 (nombres exactos).
- **"chat not found"**: el chat_id está mal o no le mandaste un mensaje al bot (paso 2).
- **"Unauthorized"**: el token está mal copiado (paso 1).

Desde ese momento se envía solo, de lunes a viernes a las 7. GitHub a veces lo demora unos minutos.

---

## Opcional: cambiar el horario

En `.github/workflows/resumen.yml`, la línea `cron: "0 10 * * 1-5"` usa la hora universal (UTC), que está 3 horas adelante de Argentina: las 10 UTC son las 7 en Argentina. Algunos ejemplos:

| Querés que llegue | Poné |
|---|---|
| 7:00 de lunes a viernes | `"0 10 * * 1-5"` |
| 8:30 de lunes a viernes | `"30 11 * * 1-5"` |
| 7:00 todos los días | `"0 10 * * *"` |

Si llega de lunes a viernes, el de los lunes cuenta los avisos que no salieron desde el viernes; si llega todos los días, cada uno cuenta solo los del día anterior.

## Opcional: recibirlo también por mail

Además de Telegram (o en lugar de Telegram), puede llegarte por mail. Cargá estos secretos, igual que en el paso 4:

| Nombre | Qué poner |
|---|---|
| `SMTP_HOST` | El servidor de salida. Gmail: `smtp.gmail.com` |
| `SMTP_PORT` | `465` (Gmail) o `587` (otros servidores; en Outlook / Office 365 depende de que tu empresa lo permita) |
| `SMTP_USER` | Tu dirección de mail |
| `SMTP_PASS` | La contraseña. En Gmail tiene que ser una **contraseña de aplicación** (Cuenta de Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones) |
| `SMTP_TO` | A qué dirección enviarlo (si no lo cargás, se envía a `SMTP_USER`) |

Revisá que tu empresa permita usar el mail de esta forma antes de cargar una cuenta del trabajo.

## Opcional: revisión de los viernes

Los viernes a las 15:45 te llega otro mensaje, solo si hay algo para revisar:

```
Revisión de la semana: 14 sin fecha (5 con más de un mes), 3 esperando respuesta, 2 pateadas 3 veces o más.
Esta semana terminaste 23 tareas.
Revisalas en 2 minutos: https://TU_USUARIO.github.io/organizador-web/?revisar=1
```

El enlace abre la app directamente en "Revisión de la semana": de a una tarea, decidís con un toque (hoy, mañana, otra fecha, esperando, terminada, borrar o "Sigue así").

Viene en la versión nueva de `resumen.yml`. **Si ya tenías el resumen diario configurado, reemplazalo** (si no, no llegan la revisión de los viernes ni el aviso de vencimiento del token, y los reclamos y las pateadas no se tienen en cuenta):

1. En tu repositorio **privado de datos**, abrí `.github/workflows/resumen.yml` y tocá el lápiz (**Edit this file**).
2. Borrá todo y pegá el contenido nuevo de [repo-datos/.github/workflows/resumen.yml](https://github.com/elterco2012-dev/Tareas/blob/main/repo-datos/.github/workflows/resumen.yml).
3. Si le habías cambiado el horario, volvé a cambiar la primera línea `cron` (la segunda, `45 18 * * 5`, es la de los viernes: dejala así).
4. Tocá **Commit changes…** y después **Commit changes**.

Para que el mensaje traiga el enlace, cargá la dirección de la app una vez:

1. En el repositorio de datos: **Settings** → **Secrets and variables** → **Actions**.
2. Pestaña **Variables** → **New repository variable**.
3. Name: `APP_URL` — Value: la dirección de la app, por ejemplo `https://TU_USUARIO.github.io/organizador-web/`. Tocá **Add variable**.

Sin esa variable, el mensaje llega igual y dice que abras la app y toques "Revisión de la semana" (en Ajustes › Herramientas, o en Tareas, abajo, junto a Terminadas): es la misma revisión, en el celular o en la compu.

---

# Recordatorios a la hora

Si una tarea tiene hora ("llamar al banco mañana a las 3"), ese día te llega un mensaje de Telegram cerca de esa hora:

```
⏰ 15:00 · Llamar al banco · @Laura
[ Posponer o hecha · 15:00 Llamar al banco ]
```

Lo de abajo, entre corchetes, es un botón: ver [El botón "Posponer o hecha"](#el-botón-posponer-o-hecha), más abajo.

Usa el mismo bot y los mismos secretos del resumen diario: si ya hiciste los pasos 1 a 4, solo falta un archivo más.

0. **Si ya tenías el resumen diario configurado, primero actualizalo** (si no, va a mostrar las tareas que están en la papelera y no va a mostrar la hora):
   en tu repositorio **privado de datos** abrí `.github/workflows/resumen.yml`, tocá el lápiz (**Edit this file**), borrá todo, pegá el contenido nuevo de
   [repo-datos/.github/workflows/resumen.yml](https://github.com/elterco2012-dev/Tareas/blob/main/repo-datos/.github/workflows/resumen.yml)
   y tocá **Commit changes…** y después **Commit changes**.
1. Abrí este archivo y copiá todo su contenido:
   [repo-datos/.github/workflows/recordatorios.yml](https://github.com/elterco2012-dev/Tareas/blob/main/repo-datos/.github/workflows/recordatorios.yml)
2. En tu repositorio **privado de datos**, tocá **Add file → Create new file**.
3. En el nombre del archivo escribí exactamente:
   `.github/workflows/recordatorios.yml`
4. Pegá el contenido y tocá **Commit changes…** y después **Commit changes**.
5. Para probarlo: pestaña **Actions** → a la izquierda **Recordatorios a la hora** → **Run workflow** → botón verde **Run workflow**. Te llega un mensaje "✅ Los recordatorios funcionan" (o el recordatorio, si hay una tarea con hora justo ahora).

Cómo funciona:

- GitHub lo revisa cada media hora, entre las 6:20 y las 22:50. Avisan las tareas con hora entre las 6:30 y las 23:29; las de más tarde no.
- El aviso llega entre 10 y 40 minutos antes de la hora (si es en punto o y media, unos 10 minutos antes). GitHub a veces demora sus tareas programadas: si se atrasa, el aviso llega igual (hasta 3 horas tarde) y no se repite.
- Las tareas que cargaste antes de esta versión tenían la hora dentro del texto: la app la pasa sola a su lugar la próxima vez que la abrís con conexión, así que también avisan.
- Para recordar qué ya avisó, guarda el archivo `recordatorios-enviados.json` en tu repositorio de datos. No hace falta tocarlo. Si dejás de usar los recordatorios, el resumen deja de reclamar avisos que no salieron a los 30 días del último (o enseguida, si borrás ese archivo).
- Usa unos 1050 de los 2000 minutos por mes que GitHub da gratis para repositorios privados (cada revisión cuenta como 1 minuto, aunque tarde segundos). Junto con el resumen diario quedan unos 900 libres.
- Si una tarea no tiene hora, no hay aviso: aparece en el resumen de la mañana.
- Si un recordatorio no salió (por ejemplo, porque GitHub o cron-job.org no corrieron), el resumen de las 7 del día siguiente empieza con un aviso, aunque no haya nada más para contarte:
  ```
  ⚠ Ayer no salieron 2 avisos por Telegram (revisá cron-job.org y que Actions esté activo).
  ```
  Los lunes dice "Desde el viernes" y cuenta viernes, sábado y domingo. Solo dice cuántos, sin los títulos. No cuenta las tareas que cargaste después de la hora en que tenía que salir el aviso, las que terminaste antes ni las que quedan fuera del horario (de 6:20 a 22:50). Necesita la versión nueva de `resumen.yml` y de `recordatorios.yml` (ver [Si ya tenías los recordatorios](#si-ya-tenías-los-recordatorios), más abajo).
- Para que el aviso suene fuerte como una alarma, aunque estés durmiendo o con el celular en No molestar: ver la sección [Que el recordatorio suene como alarma (Samsung)](#que-el-recordatorio-suene-como-alarma-samsung), más abajo.

## El botón "Posponer o hecha"

Debajo de cada recordatorio aparece un botón **Posponer o hecha** con la hora y el título de la tarea (si en un mismo mensaje hay más de 8 recordatorios, solo los primeros 8 traen botón). Al tocarlo se abre la app directamente en esa tarea: desde ahí la posponés o la marcás hecha, sin buscarla.

El texto del recordatorio no cambia, así que la alarma de MacroDroid suena igual. El mensaje de prueba ("✅ Los recordatorios funcionan") no trae botón.

Para que aparezca:

1. Cargá la dirección de la app en la variable `APP_URL` del repositorio de datos (es la misma de la revisión de los viernes; si ya la cargaste, no hace falta otra vez): **Settings** → **Secrets and variables** → **Actions** → pestaña **Variables** → **New repository variable** → Name: `APP_URL` — Value: la dirección de la app, por ejemplo `https://TU_USUARIO.github.io/organizador-web/`. Tocá **Add variable**. Sin esa variable, el recordatorio llega igual, sin botón.
2. Para que el botón abra la app instalada en el celular (y no una página dentro de Telegram), desactivá el navegador de Telegram: en Telegram, **Ajustes** → **Ajustes de chat** → **Navegador integrado** (en inglés *In-App Browser*): desactivado. Si no lo encontrás, buscá `navegador` con la lupa de **Ajustes** de Telegram. Si queda activado, el enlace se abre en una ventana de Telegram y no en la app instalada: ahí la app puede no tener tus tareas.

Si la dirección de `APP_URL` está mal escrita, Telegram no acepta el botón: el recordatorio sale igual, sin botón, y en el registro de la corrida aparece "se prueba sin botones".

## Si ya tenías los recordatorios

Para el horario hasta las 22:50, el botón "Posponer o hecha" y el aviso ⚠ del resumen, reemplazá los dos archivos por la versión nueva. En tu repositorio **privado de datos**:

1. Abrí `.github/workflows/recordatorios.yml`, tocá el lápiz (**Edit this file**), borrá todo, pegá el contenido nuevo de [repo-datos/.github/workflows/recordatorios.yml](https://github.com/elterco2012-dev/Tareas/blob/main/repo-datos/.github/workflows/recordatorios.yml) y tocá **Commit changes…** → **Commit changes**.
2. Lo mismo con `.github/workflows/resumen.yml` y [repo-datos/.github/workflows/resumen.yml](https://github.com/elterco2012-dev/Tareas/blob/main/repo-datos/.github/workflows/resumen.yml).
3. Si usás cron-job.org: en los dos archivos, volvé a hacer el [paso 4 de cron-job.org](#4-cambiar-el-horario-de-github) (en `recordatorios.yml`, el horario de respaldo) y cambiá el horario del trabajo **Recordatorios** a `20,50 6-22 * * *` (ver [Si ya tenías cron-job.org](#si-ya-tenías-cron-joborg)).

## Opcional: cambiar el horario de los recordatorios

En `.github/workflows/recordatorios.yml`, la línea `cron: "20,50 9-23,0-1 * * *"` usa la hora universal (UTC, 3 horas adelante de Argentina). `9-23,0-1` son las horas en UTC (de 9 a 23 y de 0 a 1): de 6 a 22 en Argentina. Por ejemplo, para que no avise a la noche (solo tareas hasta las 21:30), poné `"20,50 9-23 * * *"` (usa unos 120 minutos menos por mes). Si usás cron-job.org, el horario se cambia allá, en la hora de Argentina: `20,50 6-20 * * *`, y también la línea de respaldo de `recordatorios.yml`, para que no avise a la noche: `"37 9-23 * * *"` (de 6:37 a 20:37).

Ojo: el aviso ⚠ del resumen de las 7 y el de la app cuentan el horario completo, hasta las 22:50. Si lo acortás, las tareas con hora de la noche van a aparecer como avisos que no salieron.

---

# Que llegue a horario (cron-job.org)

El horario de GitHub es "lo antes que se pueda": a veces el resumen de las 7 llega a media mañana y algunos recordatorios se saltean. Para que sea puntual, un servicio gratis, **cron-job.org**, le avisa a GitHub "corré ahora" a cada hora exacta. Se configura una vez y lleva unos 15 minutos. Conviene hacerlo en la compu.

## 0. Actualizar los dos archivos

Si ya tenías el resumen o los recordatorios, primero reemplazá los dos archivos por la versión nueva (la de antes no acepta lo que manda cron-job.org y responde con un error 422). En tu repositorio **privado de datos**:

1. Abrí `.github/workflows/resumen.yml`, tocá el lápiz (**Edit this file**), borrá todo, pegá el contenido nuevo de [repo-datos/.github/workflows/resumen.yml](https://github.com/elterco2012-dev/Tareas/blob/main/repo-datos/.github/workflows/resumen.yml) y tocá **Commit changes…** → **Commit changes**.
2. Lo mismo con `.github/workflows/recordatorios.yml` y [repo-datos/.github/workflows/recordatorios.yml](https://github.com/elterco2012-dev/Tareas/blob/main/repo-datos/.github/workflows/recordatorios.yml).

Si les habías cambiado el horario no importa: en el paso 4 se cambian esas líneas.

## 1. Un token de GitHub solo para esto

Es otro token, distinto del de la app: solo sirve para disparar los workflows del repositorio de datos. No puede abrir `tareas.json`; lo único que deja ver de tus tareas es el mensaje de la última subida de la app en cada corrida, que suele tener el título de una tarea ("+ Llamar al banco · cel").

1. Abrí este link, que deja el token casi armado (nombre, permiso de Actions y sin vencimiento): [crear el token](https://github.com/settings/personal-access-tokens/new?name=cron-job-tareas&actions=write&expires_in=none).
2. En **Repository access**, elegí **Only select repositories** y marcá tu repositorio **privado de datos**.
3. Fijate que en **Permissions** diga **Actions: Read and write** (lo pone el link).
4. Tocá **Generate token** y copiá el token. GitHub lo muestra **una sola vez**: dejá esa pestaña abierta hasta terminar el paso 3.

## 2. Crear la cuenta en cron-job.org

1. Entrá a [cron-job.org](https://cron-job.org), tocá **Sign up** y completá nombre, mail y contraseña. Es gratis.
2. Abrí el mail que te mandan y confirmá la cuenta.
3. Si querés, en **Settings** podés cambiar el idioma a español (abajo se usan los nombres en inglés).

## 3. Crear los tres trabajos

Para cada uno de los tres de la tabla:

1. **Cronjobs** → **Create cronjob**.
2. Abajo, tocá **Import from cURL**, pegá el comando de ese trabajo (reemplazá `TU_USUARIO` y `TU_REPO` por tu usuario y tu repositorio de datos) y confirmá. Se completan solos la dirección, el método, los encabezados y el cuerpo.
3. Arriba, en **Title**, poné el nombre de la tabla.
4. En **Execution schedule** elegí **Custom** y, en **Crontab expression**, escribí el horario de la tabla.
5. Pestaña **Advanced**:
   - **Time zone**: `America/Argentina/Buenos_Aires`.
   - En **Headers**, en el valor de `Authorization`, reemplazá `TU_TOKEN` por el token del paso 1 (tiene que quedar `Bearer ` y el token).
6. Tocá **Test run**: tiene que decir que salió bien (código **204**). Después tocá **Create**.
   - **401**: el token quedó mal pegado en `Authorization`.
   - **404**: el token no tiene elegido tu repositorio de datos, o el usuario o el repositorio del comando están mal escritos.
   - **422** ("Unexpected inputs provided"): falta el paso 0.

| Title | Crontab expression | Qué hace |
|---|---|---|
| Recordatorios | `20,50 6-22 * * *` | Cada media hora, de 6:20 a 22:50 |
| Resumen de la mañana | `0 7 * * 1-5` | 7:00, de lunes a viernes |
| Revisión de los viernes | `45 15 * * 5` | Viernes 15:45 |

Comandos para **Import from cURL**:

Recordatorios:
```
curl -X POST https://api.github.com/repos/TU_USUARIO/TU_REPO/actions/workflows/recordatorios.yml/dispatches -H "Authorization: Bearer TU_TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" -H "Content-Type: application/json" -d '{"ref":"main","inputs":{"automatico":"true"}}'
```

Resumen de la mañana:
```
curl -X POST https://api.github.com/repos/TU_USUARIO/TU_REPO/actions/workflows/resumen.yml/dispatches -H "Authorization: Bearer TU_TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" -H "Content-Type: application/json" -d '{"ref":"main","inputs":{"programa":"diario"}}'
```

Revisión de los viernes:
```
curl -X POST https://api.github.com/repos/TU_USUARIO/TU_REPO/actions/workflows/resumen.yml/dispatches -H "Authorization: Bearer TU_TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" -H "Content-Type: application/json" -d '{"ref":"main","inputs":{"programa":"semanal"}}'
```

Si **Import from cURL** no completa todo, cargalo a mano: en **URL**, la dirección que empieza con `https://api.github.com/`; en **Advanced**, **Request method** `POST`, en **Headers** los cuatro encabezados (`Authorization`, `Accept`, `X-GitHub-Api-Version` y `Content-Type`, cada uno con lo que va después de los dos puntos) y en **Request body** lo que está entre las comillas simples.

## 4. Cambiar el horario de GitHub

En tu repositorio de datos:

1. En `.github/workflows/resumen.yml`, borrá las líneas de `schedule:` y sus dos `- cron:` (dejá `workflow_dispatch:` y lo que sigue). Si no, el resumen llega dos veces (el de cron-job.org y el atrasado de GitHub). Tocá **Commit changes…** → **Commit changes**.
2. En `.github/workflows/recordatorios.yml`, dejá `schedule:` y cambiá su línea `- cron:` por la de **respaldo** (también está en un comentario, arriba en el mismo archivo). Tiene que quedar así:
   ```
     schedule:
       - cron: "37 9-23,0-1 * * *"   # respaldo: cada hora a los 37 minutos, de 6:37 a 22:37 en Argentina
   ```
   Tocá **Commit changes…** → **Commit changes**.

Con el respaldo, si un día cron-job.org falla (o se desactiva), los recordatorios salen igual por el horario de GitHub (cada hora, entre 40 minutos antes y unos 20 después de la hora). Mientras cron-job.org anda, el respaldo solo manda lo que tendría que haber salido y no salió: no adelanta ningún aviso (el de las 15:00 sigue llegando a las 14:50). El último respaldo es a las 22:37: las tareas de las 23:17 a las 23:29 dependen solo de la corrida de cron-job.org de las 22:50. Las corridas de cron-job.org aparecen en **Actions** como "Recordatorios (cron-job.org)"; los "Run workflow" de prueba, como "Recordatorios a la hora". Si corren los dos, el aviso no se repite: lo que ya salió queda anotado en `recordatorios-enviados.json`.

Minutos de GitHub (cada corrida cuenta como 1 minuto): cron-job.org dispara 34 recordatorios por día (unos 1050 por mes), el respaldo 17 (unos 530) y los resúmenes unos 25. En total, unos 1600 de los 2000 minutos por mes que GitHub da gratis para repositorios privados; con la [copia de seguridad diaria](#copia-de-seguridad-diaria), unos 31 más (unos 1630). No los pongas más seguido (por ejemplo, cada 15 minutos): se pasaría de los 2000 y GitHub dejaría de correrlos hasta el mes siguiente. Si preferís no gastar esos minutos, borrá también las líneas de `schedule:` de `recordatorios.yml`, como en el resumen: sin respaldo usa unos 1080.

## Cómo saber si anda

- En el repositorio de datos, pestaña **Actions**: tiene que aparecer una corrida de **Recordatorios a la hora** cada media hora, con tilde verde (más la del respaldo, cada hora a los 37 minutos o cuando GitHub pueda).
- En cron-job.org, cada trabajo muestra sus últimas ejecuciones. Si falla 25 veces seguidas (por ejemplo, si borraste el token), lo desactiva y te avisa por mail.
- Si un recordatorio no salió, el resumen de las 7 del día siguiente empieza con "⚠ Ayer no salieron 2 avisos por Telegram (revisá cron-job.org y que Actions esté activo)." (los lunes, "Desde el viernes"). Fijate en cron-job.org que el trabajo **Recordatorios** siga activo y en **Actions** que las corridas tengan tilde verde. Si aparece por tareas de la noche (de 21:30 en adelante), el trabajo de cron-job.org sigue con el horario viejo: ver [Si ya tenías cron-job.org](#si-ya-tenías-cron-joborg).
- Con el respaldo usa unos 1600 de los 2000 minutos por mes que GitHub da gratis para repositorios privados (unos 1080 sin el respaldo). La copia de seguridad diaria suma unos 31.
- Los registros de cada corrida ya no muestran los títulos de las tareas, solo cuántas son. Con este token, cron-job.org sí podría ver el mensaje de la última subida de la app (y los registros de corridas anteriores a esta versión, que tenían los títulos). Si eso te preocupa, en **Actions** podés borrar las corridas viejas (en cada una, **⋯** → **Delete workflow run**). Comprobá las políticas de tu empresa antes de usar un servicio externo con información del trabajo.

## Si ya tenías cron-job.org

Los recordatorios ahora llegan hasta las 22:50 (antes, hasta las 20:50). Si ya tenías los trabajos creados:

1. En cron-job.org, **Cronjobs** → tocá **Recordatorios** → **Edit**. En **Crontab expression**, cambiá `20,50 6-20 * * *` por `20,50 6-22 * * *`. En **Advanced**, fijate que **Time zone** siga en `America/Argentina/Buenos_Aires`. Tocá **Save**. El comando de **Import from cURL** no cambia.
2. Reemplazá `recordatorios.yml` y `resumen.yml` por la versión nueva (como en el paso 0) y volvé a hacer el paso 4: en `resumen.yml`, borrar el horario; en `recordatorios.yml`, poner el de respaldo.

---

# Que el recordatorio suene como alarma (Samsung)

Con esto, cuando llega un recordatorio ⏰ el celular suena como un despertador: fuerte, aunque esté bloqueado, en silencio, en **No molestar** o en modo para dormir. Deja de sonar cuando desbloqueás el celular (o cuando lo sacudís, si ya lo estabas usando), y el aviso de Telegram se borra de la barra; el mensaje queda en el chat del bot. Si no hacés nada, se corta solo a los pocos minutos: en ese caso, cuando lo veas, abrí el chat del bot o deslizá el aviso para borrarlo (si queda en la barra, puede volver a sonar).

Solo suenan los mensajes con ⏰. El resumen de las 7 ("Buen día.") y el mensaje de prueba ("✅ Los recordatorios funcionan") llegan como siempre, sin alarma.

Una página web no puede poner alarmas en el celular. Por eso se usa **MacroDroid**, una app gratis que lee las notificaciones de Telegram y, cuando ve un ⏰, hace sonar el celular. Como el aviso llega por Telegram, el celular tiene que tener internet (datos o Wi-Fi).

Se configura una sola vez y lleva unos 20 minutos. Antes de confiar en él, probalo (sección 6).

Para encontrar los menús:

- En el Samsung, la app de ajustes (el engranaje) puede llamarse **Ajustes** o **Configuración**. Los nombres cambian un poco según la versión: si algo no aparece igual, buscalo con la lupa de arriba.
- En MacroDroid, entre paréntesis va el nombre en inglés. Si no encontrás algo en la lista para elegir, tocá la lupa de arriba y escribí una parte del nombre (por ejemplo `sonido`).

---

## 1. Instalar MacroDroid

1. En **Play Store**, buscá **MacroDroid** (de ArloSoft) e instalala. Tiene que ser desde Play Store: si la bajás de otra página, Android bloquea el permiso que necesita.
2. Abrila y pasá las pantallas de bienvenida.

La versión gratis alcanza: permite hasta 5 macros (acá usamos 2) y muestra publicidad.

## 2. La macro que hace sonar la alarma

Primero copiá el ⏰: en Telegram, en el chat del bot, mantené apretado un recordatorio y elegí **Copiar**. Si todavía no te llegó ninguno, copiá este: ⏰

Así queda exactamente el mismo ⏰ que manda el bot (el del teclado de emojis puede no coincidir).

1. En MacroDroid, tocá **Añadir macro** (*Add Macro*) o el **+**. Arriba, poné de nombre `Alarma tareas`.
2. En **Disparadores** (*Triggers*), tocá **+** → **Eventos de dispositivo** (*Device Events*) → **Notificación** (*Notification*) → **Notificación recibida** (*Notification Received*).
3. Te va a pedir acceso a las notificaciones. Con ese permiso MacroDroid puede leer todas las notificaciones del celular (WhatsApp, mails, códigos del banco); lo necesita para ver el ⏰. Aceptá: se abre una pantalla de Ajustes, activá **MacroDroid** (puede decir **Permitir acceso a las notificaciones**), confirmá con **Permitir** y volvé a MacroDroid con la flecha atrás.
4. Elegí **Seleccionar aplicación** (*Select Applications*) → marcá **Telegram** → **OK**.
5. En el texto elegí **Contiene** (*Contains*). Pegá lo que copiaste y borrá todo menos el ⏰ del principio (sin el espacio). Tocá **OK**. Las demás opciones dejalas como vienen.
6. En **Acciones** (*Actions*), tocá **+** → **Cambio de volumen** (*Volume Change*) → marcá solo **Alarma** (*Alarm*), llevala al máximo y tocá **OK**.
7. **+** → **Repetir acciones** (*Repeat Actions*):
   - Si te deja repetir por un tiempo, poné **3 minutos**.
   - Si no, elegí una cantidad fija de veces (*Fixed number*) y poné **60**. Cada vuelta dura lo que dura el sonido (1 a 3 segundos), así que suena entre 1 y 3 minutos.

   Abajo aparece solo **Fin del bucle** (*End Loop*): no hace falta agregarlo.
8. Ahora el sonido, adentro de la repetición: tocá **Repetir acciones** y elegí la opción de agregar una acción adentro (*Add child action*). Si no la encontrás, usá el **+** de siempre y después lo acomodás (paso 10). Elegí **Reproducir/detener sonido** (*Play/Stop Sound*):
   - En la lista, los dos primeros renglones no son sonidos (elegir archivo y detener sonido): elegí uno de los de abajo, uno fuerte.
   - En la lista desplegable del canal de audio (viene en *MacroDroid default*, que se silencia en No molestar), elegí **Alarma** (*Alarm*). Es lo más importante: por eso suena aunque el celular esté en silencio o en No molestar.
   - Marcá la casilla de esperar a que termine el sonido (*Block next actions until complete*). Si no, se escucha una sola vez.
   - Tocá **OK**.
9. Opcional, para que también vibre: igual que en el paso 8, agregá **Vibrar** (*Vibrate*) → el zumbido largo (*Long Buzz*).
10. El sonido (y la vibración) tienen que quedar entre **Repetir** y **Fin del bucle**. Si quedaron abajo, mantenelos apretados y arrastralos. Tiene que quedar así:
    ```
    Cambio de volumen: Alarma al máximo
    Repetir (3 minutos o 60 veces)
        Reproducir sonido (Alarma)
        Vibrar (opcional)
    Fin del bucle
    ```
11. Guardá la macro con el botón de guardar.

Si MacroDroid te pide otro permiso al agregar algo, aceptalo.

Ojo: esto deja el volumen de alarma al máximo, también para las alarmas del Reloj.

## 3. La macro que la apaga

1. **Añadir macro** → de nombre poné `Detener alarma`.
2. En **Disparadores**: **+** → **Eventos de dispositivo** (*Device Events*) → **Dispositivo desbloqueado** (*Device Unlocked*).
3. Otra vez **+** → **Sensores** (*Sensors*) → **Agitar dispositivo** (*Shake Device*). Sirve para cuando ya estás usando el celular: funciona con la pantalla prendida.
4. En **Acciones**: **+** → **Cancelar acciones de macro** (*Cancel Macro Actions*) → elegí **Alarma tareas**.
5. **+** → **Reproducir/detener sonido** (*Play/Stop Sound*) → el segundo renglón, el de detener el sonido (*Stop Existing Sound*).
6. **+** → **Borrar notificaciones** (*Clear Notifications*) → **Seleccionar aplicación** (*Select Applications*) → marcá **Telegram** → **OK** → en el texto elegí **Contiene** (*Contains*), pegá el ⏰ y tocá **OK**. Así se borra de la barra el aviso del recordatorio (el mensaje sigue en el chat). Si quedara, la alarma podría volver a sonar cuando te escriben por otro chat de Telegram.
7. Guardá la macro.

En la lista de macros de MacroDroid, las dos tienen que estar activadas.

## 4. Ajustes del Samsung

Para que el Samsung no "duerma" a MacroDroid ni a Telegram (si los duerme, no suena):

1. **Ajustes** → **Aplicaciones** → **MacroDroid** → **Batería** → **Sin restricciones** (puede decir "No restringido"; si primero aparece **Permitir uso en segundo plano**, activalo y después elegí **Sin restricciones**).
2. En esa misma pantalla de MacroDroid, desactivá **Pausar actividad en la app si no se usa** (puede decir "Quitar permisos si no se usa").
3. Repetí los pasos 1 y 2 con **Telegram**.
4. **Ajustes** → **Batería** → **Límites de uso en segundo plano** (en algunas versiones está dentro de **Cuidado del dispositivo**):
   - Entrá a **Aplicaciones sin autosuspensión** (puede llamarse parecido, con "nunca" en el nombre; en inglés *Never sleeping apps*), tocá **+** y agregá **MacroDroid** y **Telegram**.
   - Fijate que no estén en las listas de apps en suspensión ni en suspensión profunda.

Para que suene en No molestar (normalmente ya viene así, pero conviene revisarlo):

5. **Ajustes** → **Notificaciones** → **No molestar** → **Alarmas y sonidos** → **Alarmas** activado.
6. Si usás el modo para dormir: **Ajustes** → **Modos y rutinas** → **Dormir** (puede decir "Sueño") → en lo permitido de No molestar, **Alarmas** activado.

## 5. Ajustes de Telegram

MacroDroid ve el ⏰ en la notificación de Telegram. Si la notificación no aparece o no muestra el texto, no suena.

1. El chat del bot no tiene que estar silenciado. En la lista de chats, si al lado del nombre del bot hay un parlante tachado, está silenciado. Para activarlo: abrí el chat → tocá el nombre arriba → debajo de la foto, tocá el botón que vuelve a activar el sonido (en inglés *Unmute*). Si ese botón ofrece silenciar (*Mute*), ya está bien: no lo toques.
2. En Telegram: **Ajustes** → **Notificaciones y sonidos**. **Chats privados** tiene que estar activado. Entrá a **Chats privados**: el interruptor de arriba (en inglés *New Messages in Private Chats*) activado, y **Mostrar vistas previas** activado.
3. Si le pusiste código a Telegram (**Privacidad y seguridad** → bloqueo con código; en inglés *Passcode Lock*): mientras Telegram está bloqueado, la notificación solo dice que tenés un mensaje nuevo, sin el ⏰, y no suena. Para que funcione siempre, sacá el código (cualquiera que use tu celular desbloqueado va a poder abrir Telegram). Si preferís dejarlo, va a sonar solo cuando Telegram no esté bloqueado.
4. En el Samsung: **Ajustes** → **Notificaciones** → **Notificaciones de aplicaciones** → **Telegram** → **Permitir notificaciones** activado. Si en esa pantalla aparecen categorías de Telegram, fijate que **Chats privados** esté activada.

El sonido propio de Telegram podés dejarlo como está: el de alarma lo pone MacroDroid.

## 6. Probarlo

Primero, solo el sonido:

1. En MacroDroid, abrí la macro **Alarma tareas** → **⋮** (arriba a la derecha) → **Probar acciones** (*Test actions*). Tiene que sonar fuerte.
2. Bloqueá y desbloqueá el celular: tiene que dejar de sonar. Probá otra vez y sacudilo con la pantalla prendida: también tiene que cortarse.

Después, la prueba de verdad, en este orden:

1. En la app de tareas, creá una tarea para hoy con hora de acá a 5 minutos (por ejemplo, si son las 15:00: `probar alarma hoy a las 15:05`). Esperá un minuto a que se guarde.
2. Activá **No molestar**: **Ajustes** → **Notificaciones** → **No molestar** (o con el botón **No molestar** del panel que se abre deslizando desde arriba a la derecha).
3. En GitHub, en el repositorio de datos: pestaña **Actions** → **Recordatorios a la hora** → **Run workflow** → botón verde **Run workflow**. Enseguida bloqueá el celular.
4. En uno o dos minutos llega el ⏰ y tiene que sonar como alarma. Desbloquealo: tiene que cortarse, y el aviso de Telegram tiene que desaparecer de la barra.
5. Hacé otra vez **Run workflow**: tiene que llegar "✅ Los recordatorios funcionan" **sin** que suene.
6. Borrá la tarea de prueba y sacá No molestar.

Prueba larga, para saber que suena aunque el celular esté "dormido": creá una tarea para dentro de 2 o 3 horas (entre las 6:30 y las 23) y dejá el celular bloqueado, quieto y desenchufado. El aviso llega entre 10 y 40 minutos antes de esa hora y tiene que sonar igual.

## Si no suena

- **No llegó el mensaje de Telegram:** el problema está antes de MacroDroid. Fijate que el celular tenga internet (datos o Wi-Fi, sin modo avión): sin conexión no llega nada, y cuando vuelve, los recordatorios atrasados llegan (y suenan) todos juntos. GitHub también puede demorarlos. Si no es eso, revisá la sección "Recordatorios a la hora".
- **Llegó el ⏰ pero no sonó:**
  - Mirá la notificación de Telegram: si en lugar del texto dice solo "Mensaje" o "Mensaje nuevo", revisá los pasos 2 y 3 de la sección 5. Si no apareció ninguna notificación, revisá los pasos 1 y 4.
  - Si tenías abierto el chat del bot en pantalla, Telegram no muestra notificación y no suena. Es normal: ya lo estás viendo.
  - Revisá el acceso a las notificaciones: en **Ajustes**, buscá con la lupa `notificaciones` y entrá a la opción de acceso a las notificaciones (puede decir "Acceso a notificaciones" o "Control, respuesta y lectura de notificaciones"). **MacroDroid** tiene que estar activado.
  - Si no te deja activarlo y dice **Configuración restringida**: **Ajustes** → **Aplicaciones** → **MacroDroid** → **⋮** → **Permitir configuración restringida**, y probá de nuevo.
  - Volvé a copiar el ⏰ desde Telegram y pegalo en el disparador (sección 2, paso 5).
- **Sonó bajito, o no sonó en No molestar o mientras dormías:** revisá que el sonido use el canal **Alarma** (sección 2, paso 8) y que las alarmas estén permitidas (sección 4, pasos 5 y 6).
- **Andaba y dejó de andar después de unos días:** repasá la sección 4 y el acceso a las notificaciones. Abrir MacroDroid de vez en cuando también ayuda.
- **Se cortó apenas empezó a sonar:** pasa si el celular no tiene bloqueo de pantalla (patrón, PIN o huella): para MacroDroid, prender la pantalla ya es "desbloquear". Ponele un bloqueo en **Ajustes** → **Pantalla de bloqueo**, o sacá el disparador **Dispositivo desbloqueado** de la macro **Detener alarma** y cortala sacudiendo el celular.
- **No se cortó al desbloquear:** se corta solo cuando termina la repetición. Revisá que la macro **Detener alarma** esté activada y que en **Cancelar acciones de macro** esté elegida **Alarma tareas**.
- **Volvió a sonar sin un recordatorio nuevo (por ejemplo, cuando te escribió alguien por Telegram):** pasa si el aviso del ⏰ quedó en la barra, por ejemplo cuando la alarma se cortó sola. Abrí el chat del bot o deslizá el aviso para borrarlo.
- **Sonó por un ⏰ que te mandó otra persona:** si en el disparador de **Alarma tareas** aparece la opción de separar título y mensaje (*Separate title and message*), activala: en el título elegí **Coincide** (*Matches*) y escribí el nombre del bot tal como aparece en Telegram (por ejemplo `Mis tareas`); en el mensaje, **Contiene** y el ⏰. Si no aparece esa opción, no hay un ajuste simple.

## Para una alarma suelta

Si solo querés una alarma para algo puntual, no hace falta nada de esto: decí **"Ok Google, poné una alarma a las 15"** o **"Hola Bixby, poné una alarma a las 15"**, o ponela en la app **Reloj**.

---

# Copia de seguridad diaria

Todas tus tareas están en `tareas.json`, en el repositorio privado de datos. Si un día ese archivo se borra o se vacía (por un error, por una falla de la app o porque alguien consiguió el token de la app), con esto queda una copia por día en **otro** repositorio privado, que la app no puede tocar.

Todas las noches, a las 3:17, GitHub copia al repositorio de respaldo `tareas.json`, la carpeta `archivo/` (las terminadas hace más de un mes), `ajustes.json` y `recordatorios-enviados.json`. Cada copia queda guardada con su fecha ("Copia del 2026-10-21"), así que podés volver a cómo estaban tus tareas cualquier día. Si nada cambió desde la copia anterior, ese día no se guarda otra.

La copia se escribe con un token propio, que solo tiene acceso al repositorio de respaldo. El token de la app no puede abrir ese repositorio, ni cambiarlo, ni borrarlo.

Si `tareas.json` no está o está roto, o si quedó vacío de golpe (cuando la última copia tenía 5 tareas o más), no se copia nada: queda la última copia buena, la corrida termina con una cruz roja y GitHub te manda un mail avisando que falló.

Usa 1 minuto por día (unos 31 por mes) de los 2000 minutos por mes que GitHub da gratis para repositorios privados.

Se configura una sola vez y lleva unos 10 minutos. Conviene hacerlo en la compu.

## 1. Crear el repositorio de respaldo

1. En GitHub, arriba a la derecha, tocá **+** → **New repository**.
2. En **Repository name** escribí `mis-tareas-respaldo`.
3. Elegí **Private**. Es importante: si queda público, la copia no se hace.
4. No marques nada más (ni README, ni .gitignore, ni licencia) y tocá **Create repository**.

## 2. Un token solo para la copia

Es otro token, distinto del de la app (y del de cron-job.org, si lo usás): solo puede escribir en el repositorio de respaldo.

1. En GitHub, tocá tu foto (arriba a la derecha) → **Settings** → abajo de todo en el menú de la izquierda, **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name**: `Respaldo de tareas`.
3. **Expiration**: un año (si no aparece en la lista, elegí **Custom** y una fecha de acá a un año). Anotá esa fecha: ver [Cuando vence el token de la copia](#cuando-vence-el-token-de-la-copia), más abajo.
4. **Repository access**: elegí **Only select repositories** y marcá solo `mis-tareas-respaldo` (el de datos no).
5. **Permissions** → **Repository permissions** → **Contents**: **Read and write**. Nada más (**Metadata: Read-only** lo agrega GitHub solo).
6. Tocá **Generate token** y copiá el token. GitHub lo muestra **una sola vez**: dejá esa pestaña abierta hasta terminar el paso 3.

## 3. Cargar el token y el nombre del repositorio

En tu repositorio **privado de datos** (no en el de respaldo):

1. Entrá a **Settings** → **Secrets and variables** → **Actions**.
2. Tocá **New repository secret** y cargá:
   - Name: `RESPALDO_TOKEN` — Secret: el token del paso 2. Tocá **Add secret**.
3. Pestaña **Variables** → **New repository variable**:
   - Name: `RESPALDO_REPO` — Value: tu usuario, una barra y el nombre del repositorio de respaldo, por ejemplo `elterco2012-dev/mis-tareas-respaldo`. Tocá **Add variable**.

Los nombres tienen que ser exactamente esos, en mayúsculas.

Mientras no cargues ninguno de los dos, la corrida de cada noche no copia nada ni falla. Si cargás uno solo, falla: así no pasan días sin copia sin que te enteres.

## 4. Copiar el archivo a tu repositorio de datos

Igual que con los otros archivos:

1. Abrí este archivo y copiá todo su contenido (en esa página, el botón "Copy raw file" lo copia entero):
   [repo-datos/.github/workflows/respaldo.yml](https://github.com/elterco2012-dev/Tareas/blob/main/repo-datos/.github/workflows/respaldo.yml)
2. En tu repositorio **privado de datos**, tocá **Add file → Create new file**.
3. En el nombre del archivo escribí exactamente:
   `.github/workflows/respaldo.yml`
4. Pegá el contenido y tocá **Commit changes…** y después **Commit changes**.

## 5. Probarlo

1. En el repositorio de datos, entrá a la pestaña **Actions**.
2. A la izquierda, tocá **Copia de seguridad diaria**.
3. Tocá **Run workflow** y después el botón verde **Run workflow**.
4. En unos segundos aparece una ejecución. Tiene que terminar con un tilde verde.
5. Abrí el repositorio de respaldo: tienen que estar `tareas.json` y los demás archivos, con el mensaje "Copia del" y la fecha de hoy.

Si termina con una cruz roja, tocala y abrí el paso **Copiar al repositorio de respaldo**: el error explica qué falta. Lo más común:

- **"Falta configurar…"**: revisá el paso 3 (nombres exactos, cargados en el repositorio de datos).
- **"GitHub no acepta el token RESPALDO_TOKEN"**: el token está mal copiado o venció. Hacé uno nuevo (paso 2) y cargalo otra vez (ver [Cuando vence el token de la copia](#cuando-vence-el-token-de-la-copia)).
- **"No encuentro el repositorio…"**: `RESPALDO_REPO` está mal escrito, o el token no tiene elegido el repositorio de respaldo (paso 2, punto 4).
- **"El repositorio de respaldo es público"**: hacelo privado. En el repositorio de respaldo: **Settings** → abajo de todo, en **Danger Zone**, **Change visibility** → **Make private**.
- **"RESPALDO_REPO es este mismo repositorio de datos"**: en `RESPALDO_REPO` va el repositorio de respaldo, no el de datos.
- **"No se pudo guardar la copia…"**: al token le falta **Contents: Read and write** (paso 2, punto 5).

Desde ese momento se copia sola todas las noches. GitHub a veces la demora un rato.

## Cómo recuperar las tareas

**Primero, desde la app.** Si `tareas.json` desapareció, quedó vacío o se dañó, la app lo avisa arriba en rojo y deja de sincronizar en ese dispositivo para no perder nada. Abrí la app en el dispositivo que tenga las tareas más al día y, en **Ajustes › Sincronización**, tocá **Volver a subir la copia de este dispositivo**: usa la última versión buena de GitHub (si el otro dispositivo subió algo después) o la copia del dispositivo, con lo que falte subir. Así no se pierde nada de lo que hiciste después de la última copia de la noche.

**Si no se puede desde la app** (por ejemplo, ningún dispositivo tiene las tareas), usá la copia de la noche. Ojo: vuelve a como estaba a las 3:17 de ese día; lo que cargaste o cambiaste después se pierde.

1. Abrí el repositorio de respaldo y tocá `tareas.json`.
2. Arriba a la derecha, tocá **History**: aparece una copia por día ("Copia del 2026-10-20", "Copia del 2026-10-19"…).
3. En la del día que querés, tocá el botón `<>` (*Browse repository at this point in the history*) y después `tareas.json`: es el archivo como estaba ese día.
4. Si solo querés guardarlo, tocá **Download raw file** (la flecha hacia abajo) y queda en la compu.
5. Para volver a ponerlo en la app, tocá **Copy raw file** (los dos cuadraditos). Después, en tu repositorio **privado de datos**, abrí `tareas.json` y tocá el lápiz (**Edit this file**); si ya no está, tocá **Add file → Create new file** y escribí `tareas.json` como nombre.
6. Borrá todo, pegá lo que copiaste y tocá **Commit changes…** y después **Commit changes**.

La app trae la lista recuperada sola la próxima vez que se sincroniza (si está abierta, en unos segundos). Si también falta algo del archivo (las terminadas hace más de un mes), hacé lo mismo con `archivo/2026.json` (o el año que corresponda).

## Que el token de la app no pueda tocar la copia

La copia sirve si quien tenga el token de la app (por ejemplo, si te lo roban) no puede borrarla. Para eso, revisá el token de la app: en GitHub, tu foto → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → tocá el de la app.

- En **Repository access** tiene que tener elegido **solo** el repositorio de datos: ni el de respaldo, ni **All repositories**.
- En **Permissions** tiene que tener solo **Contents: Read and write** (y Metadata, que va solo). **No** le des el permiso **Workflows**: con ese permiso, quien tenga el token podría cambiar o borrar `respaldo.yml` (y los otros archivos de `.github/workflows`).

El token de la copia (`RESPALDO_TOKEN`) queda guardado como secreto: nadie puede verlo, tampoco con el token de la app.

## Cuando vence el token de la copia

- Vence al año. Anotá la fecha en tu calendario, con un aviso una semana antes. La app y el Telegram de la mañana avisan solo del token de la app, no de este.
- Si vence, la corrida de cada noche falla y GitHub te manda un mail. Las copias que ya estaban no se pierden.
- Para renovarlo: en la lista de tokens (como en el paso 2), tocá **Respaldo de tareas** → **Regenerate token**, elegí otra vez un año y copiá el token nuevo (o hacé uno nuevo con el paso 2). Después, en el repositorio de datos: **Settings** → **Secrets and variables** → **Actions** → al lado de `RESPALDO_TOKEN`, el lápiz → pegá el token nuevo → **Update secret**. Para probarlo, hacé el paso 5.
