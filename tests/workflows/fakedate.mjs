// Reloj fijo para las pruebas: FAKE_NOW (ISO)
const fixed=Date.parse(process.env.FAKE_NOW),R=Date;
class D extends R{constructor(...a){if(a.length===0)super(fixed);else super(...a)}static now(){return fixed}}
globalThis.Date=D;
