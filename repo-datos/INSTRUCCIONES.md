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
- Para que el aviso suene aunque el celular esté en otra cosa: en Telegram, abrí el chat del bot → nombre arriba → **Notificaciones** → elegí un sonido (o "Personalizar"). En el Samsung también podés ir a Ajustes → Notificaciones → Telegram y dejar ese chat con sonido y ventana emergente.

## Opcional: cambiar el horario de los recordatorios

En `.github/workflows/recordatorios.yml`, la línea `cron: "20,50 9-23 * * *"` usa la hora universal (UTC, 3 horas adelante de Argentina). `9-23` son las horas en UTC: de 6 a 20 en Argentina. Por ejemplo, para que también avise a la noche, para tareas hasta las 23:30 de Argentina, poné `"20,50 9-23,0-1 * * *"` (usa unos 120 minutos más por mes).
