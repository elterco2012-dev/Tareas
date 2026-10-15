# Pruebas

Pruebas de navegador de la app (Playwright + Chromium) y de la lógica de los workflows del repo de datos.
La app no tiene dependencias: `package.json` es solo para las pruebas.

## Correrlas en tu compu

```sh
npm ci
npx playwright install chromium   # la primera vez, si no tenés el Chromium de Playwright
npm test
```

- Una sola, con toda su salida: `node tests/suites/voz.js`
- Las que tengan algo en el nombre: `node --test --test-name-pattern=voz tests/run.test.mjs`
- De a una (por defecto corren varias a la vez, hasta 4 según los núcleos): `TEST_CONCURRENCY=1 npm test`

Si Playwright no encuentra su Chromium, usa el de `CHROMIUM_PATH` (o `/opt/pw-browsers/chromium` si existe).
Las capturas quedan en `tests/artifacts/` (git las ignora).

## Qué hay

- `suites/`: una por tema. Cada una es un script que imprime `OK …` o `FAIL …` por cada cosa que revisa.
- `workflows/`: saca el JS de `repo-datos/.github/workflows/*.yml` y lo corre contra un Telegram, un GitHub
  y un servidor de mail de mentira.
- `lib/`: el servidor de la app, el lanzador de Chromium, el reloj fijo (`harness.js`) y el GitHub falso (`gh.js`).
- `run.test.mjs`: corre todo con `node:test`. Una suite falla si termina con error, si imprime algún `FAIL`
  o si no imprime ningún `OK`.

La app se sirve con un servidor de Node en `http://127.0.0.1:<puerto libre>/Tareas/`, igual que en GitHub
Pages. El service worker está bloqueado salvo donde se prueba (`pwa.js`, `segundo-plano.js` y abrir sin
señal en `captura-celular.js`): así los pedidos a api.github.com siempre pasan por el GitHub falso.

## En GitHub (CI)

`.github/workflows/test.yml` corre en cada pull request y en cada push a `main`: `npm ci`, instala Chromium
con `npx playwright install --with-deps chromium` y corre `npm test`.

## La fecha: siempre la misma

Las pruebas no dependen del día en que se corren. Todo arranca el **miércoles 14/10/2026 a las 10:00 de
Buenos Aires** (13:00Z, `REF` en `lib/harness.js`):

- En la página, cada contexto trae el reloj de Playwright instalado en esa hora y el tiempo corre normal
  desde ahí. Para que pase el tiempo (12 h del borrador, 2 minutos afuera, un día más para el aviso del
  token) se adelanta el reloj con `page.clock.fastForward(…)`, sin esperar de verdad.
- Del lado de Node, nada de `new Date()` ni `Date.now()`: usá `day(n)` (AAAA-MM-DD de hoy + n días),
  `ago(n)` (ISO de hace n días), `now()` y `date()`.
- Las fechas escritas a mano en los casos (por ejemplo "el 15 de octubre" → `2026-10-15`) cuentan con esa
  referencia.
- Si un caso necesita otro día, crea su contexto con `clock:false` e instala su propio reloj
  (`page.clock.install`), como el cambio de año o el 31 de enero. `workflows.mjs` fija la hora de cada
  corrida con `FAKE_NOW`.
