# Resumen diario por Telegram

De lunes a viernes, a las 7 de la mañana, te llega un mensaje de Telegram como este:

```
Buen día. 2 vencidas, 3 para hoy, 1 esperando hace +3 días

Vencidas
• Enviar cotización (ALTA) · @Martín · venció hace 2 días
• Pagar luz · venció ayer

Para hoy
• Responder reclamo
• Mandar remitos · @Laura

Esperando hace +3 días
• Llamar proveedor · Juan, hace 5 días
```

Si un día no hay nada vencido, nada para hoy y nada esperando hace más de 3 días, no te llega nada.

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

Viene incluido en `resumen.yml`: si ya lo copiaste (o lo actualizaste), no hay que hacer nada más. Para que el mensaje traiga el enlace, cargá la dirección de la app una vez:

1. En el repositorio de datos: **Settings** → **Secrets and variables** → **Actions**.
2. Pestaña **Variables** → **New repository variable**.
3. Name: `APP_URL` — Value: la dirección de la app, por ejemplo `https://TU_USUARIO.github.io/organizador-web/`. Tocá **Add variable**.

Sin esa variable, el mensaje llega igual y dice "Abrí la app y tocá Procesar".

---

# Recordatorios a la hora

Si una tarea tiene hora ("llamar al banco mañana a las 3"), ese día te llega un mensaje de Telegram cerca de esa hora:

```
⏰ 15:00 · Llamar al banco · @Laura
```

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

- GitHub lo revisa cada media hora, entre las 6:20 y las 20:50. Avisan las tareas con hora entre las 6:30 y las 21:30; las de más tarde no.
- El aviso llega entre 10 y 40 minutos antes de la hora (si es en punto o y media, unos 10 minutos antes). GitHub a veces demora sus tareas programadas: si se atrasa, el aviso llega igual (hasta 3 horas tarde) y no se repite.
- Las tareas que cargaste antes de esta versión tenían la hora dentro del texto: la app la pasa sola a su lugar la próxima vez que la abrís con conexión, así que también avisan.
- Para recordar qué ya avisó, guarda el archivo `recordatorios-enviados.json` en tu repositorio de datos. No hace falta tocarlo.
- Usa unos 900 de los 2000 minutos por mes que GitHub da gratis para repositorios privados (cada revisión cuenta como 1 minuto, aunque tarde segundos). Junto con el resumen diario quedan unos 1000 libres.
- Si una tarea no tiene hora, no hay aviso: aparece en el resumen de la mañana.
- Para que el aviso suene fuerte como una alarma, aunque estés durmiendo o con el celular en No molestar: ver la sección [Que el recordatorio suene como alarma (Samsung)](#que-el-recordatorio-suene-como-alarma-samsung), más abajo.

## Opcional: cambiar el horario de los recordatorios

En `.github/workflows/recordatorios.yml`, la línea `cron: "20,50 9-23 * * *"` usa la hora universal (UTC, 3 horas adelante de Argentina). `9-23` son las horas en UTC: de 6 a 20 en Argentina. Por ejemplo, para que también avise a la noche, para tareas hasta las 23:30 de Argentina, poné `"20,50 9-23,0-1 * * *"` (usa unos 120 minutos más por mes).

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

Prueba larga, para saber que suena aunque el celular esté "dormido": creá una tarea para dentro de 2 o 3 horas (entre las 6:30 y las 21:30) y dejá el celular bloqueado, quieto y desenchufado. El aviso llega entre 10 y 40 minutos antes de esa hora y tiene que sonar igual.

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
