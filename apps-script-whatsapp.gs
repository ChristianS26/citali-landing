/**
 * CITALI — Verificación del número por WhatsApp
 * ---------------------------------------------------------------------------
 * NO está pegado en el proyecto todavía. Es la segunda mitad de apps-script.gs,
 * separada porque usa UrlFetchApp y eso hace que Google pida un permiso extra
 * ("conectarse a un servicio externo") aunque la función esté apagada.
 *
 * Para encenderla, cuando ya tengas WhatsApp Business API:
 *   1. En Apps Script, Archivos → + → Secuencia de comandos → pega esto.
 *   2. En apps-script.gs, pon VERIFICAR en true y llena WABA.PHONE_ID
 *      y WABA.CUENTA_ID.
 *   3. Cambia las dos ramas de doPost por las llamadas reales:
 *        if (accion === 'enviarCodigo')  return responder_(enviarCodigo_(datos));
 *        if (accion === 'validarCodigo') return responder_(validarCodigo_(datos));
 *   4. Vuelve a poner el paso 6 en empezar.html (git, commit 0b99f66).
 *   5. Implementa una versión nueva. Ahí sí va a pedir autorizar de nuevo.
 * ---------------------------------------------------------------------------
 */

const VERIFICAR = true;      // reemplaza el de apps-script.gs

const WABA = {
  VERSION:   'v21.0',
  PHONE_ID:  '',                     // Phone Number ID del número emisor
  CUENTA_ID: '',                     // WhatsApp Business Account ID
  PLANTILLA: 'citali_codigo',        // Nombre de tu plantilla de AUTENTICACIÓN
  IDIOMA:    'es_MX',                // Debe coincidir con el idioma de la plantilla
  BOTON_COPIAR: true                 // true si la plantilla trae botón "Copiar código"
  // El token va en Propiedades del script, con la clave WABA_TOKEN
};

const OTP = {
  DIGITOS:        6,
  VIGENCIA_MIN:   10,                // Cuánto vive el código
  MAX_INTENTOS:   5,                 // Intentos por código antes de invalidarlo
  MAX_ENVIOS_HORA: 4,                // Códigos que puede pedir un número por hora
  ESPERA_REENVIO:  45                // Segundos entre un envío y el siguiente
};

// ─── Envío del código ───────────────────────────────────────────────────────
function enviarCodigo_(datos) {
  const tel = normaliza_(datos.whatsapp);
  if (!tel) return { ok: false, motivo: 'telefono_invalido' };
  if (!tieneCredenciales_()) return { ok: false, motivo: 'sin_config' };

  const cache = CacheService.getScriptCache();

  // Un envío cada ESPERA_REENVIO segundos
  if (cache.get('frio:' + tel)) return { ok: false, motivo: 'muy_seguido' };

  // Tope de códigos por hora
  const envios = Number(cache.get('envios:' + tel) || 0);
  if (envios >= OTP.MAX_ENVIOS_HORA) return { ok: false, motivo: 'limite' };

  const codigo = generaCodigo_();
  const salida = mandaPlantilla_(tel, codigo);
  if (!salida.ok) {
    console.error('WhatsApp rechazó el envío: ' + salida.detalle);
    return { ok: false, motivo: 'no_enviado' };
  }

  cache.put('otp:' + tel, JSON.stringify({ codigo: codigo, intentos: 0 }), OTP.VIGENCIA_MIN * 60);
  cache.put('frio:' + tel, '1', OTP.ESPERA_REENVIO);
  cache.put('envios:' + tel, String(envios + 1), 3600);

  return { ok: true, espera: OTP.ESPERA_REENVIO, vigencia: OTP.VIGENCIA_MIN };
}

function mandaPlantilla_(tel, codigo) {
  const componentes = [
    { type: 'body', parameters: [{ type: 'text', text: codigo }] }
  ];
  // Las plantillas de autenticación con botón "Copiar código" repiten el código
  // en el botón. Si tu plantilla no lo trae, pon WABA.BOTON_COPIAR en false.
  if (WABA.BOTON_COPIAR) {
    componentes.push({
      type: 'button', sub_type: 'url', index: '0',
      parameters: [{ type: 'text', text: codigo }]
    });
  }

  const cuerpo = {
    messaging_product: 'whatsapp',
    to: tel,
    type: 'template',
    template: {
      name: WABA.PLANTILLA,
      language: { code: WABA.IDIOMA },
      components: componentes
    }
  };

  try {
    const r = UrlFetchApp.fetch(
      'https://graph.facebook.com/' + WABA.VERSION + '/' + WABA.PHONE_ID + '/messages',
      {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token_() },
        payload: JSON.stringify(cuerpo),
        muteHttpExceptions: true
      }
    );
    const codigoHttp = r.getResponseCode();
    if (codigoHttp >= 200 && codigoHttp < 300) return { ok: true };
    return { ok: false, detalle: codigoHttp + ' ' + r.getContentText().slice(0, 300) };
  } catch (err) {
    return { ok: false, detalle: String(err) };
  }
}

// ─── Validación del código y alta ───────────────────────────────────────────
function validarCodigo_(datos) {
  const tel = normaliza_(datos.whatsapp);
  if (!tel) return { ok: false, motivo: 'telefono_invalido' };

  const escrito = String(datos.codigo || '').replace(/\D/g, '');
  if (escrito.length !== OTP.DIGITOS) return { ok: false, motivo: 'incompleto' };

  const cache = CacheService.getScriptCache();
  const guardado = cache.get('otp:' + tel);
  if (!guardado) return { ok: false, motivo: 'vencido' };

  const estado = JSON.parse(guardado);
  estado.intentos = (estado.intentos || 0) + 1;

  if (estado.intentos > OTP.MAX_INTENTOS) {
    cache.remove('otp:' + tel);
    return { ok: false, motivo: 'intentos' };
  }

  if (estado.codigo !== escrito) {
    // Se conserva lo que queda de vigencia, no se reinicia el reloj
    cache.put('otp:' + tel, JSON.stringify(estado), OTP.VIGENCIA_MIN * 60);
    return { ok: false, motivo: 'no_coincide', restantes: OTP.MAX_INTENTOS - estado.intentos };
  }

  cache.remove('otp:' + tel);
  cache.remove('envios:' + tel);
  return guardar_(datos, true);
}


// ─── Apoyo del código ───────────────────────────────────────────────────────
function token_() {
  return PropertiesService.getScriptProperties().getProperty('WABA_TOKEN') || '';
}

function tieneCredenciales_() {
  return !!(token_() && WABA.PHONE_ID);
}

/** Deja el número como lo quiere Meta: solo dígitos, con lada de país. */
function normaliza_(bruto) {
  let d = String(bruto || '').replace(/\D/g, '');
  if (d.length === 10) d = '52' + d;              // vino sin lada de país
  if (d.length === 13 && d.indexOf('521') === 0) d = '52' + d.slice(3);  // quita el 1 viejo
  if (d.length !== 12 || d.indexOf('52') !== 0) return '';
  return d;
}

function generaCodigo_() {
  // Se mezclan dos fuentes para no depender solo de Math.random
  const delUuid = Utilities.getUuid().replace(/\D/g, '');
  let d = '';
  for (let i = 0; i < OTP.DIGITOS; i++) {
    const a = i < delUuid.length ? Number(delUuid.charAt(i)) : 0;
    const b = Math.floor(Math.random() * 10);
    d += String((a + b) % 10);
  }
  return d;
}

// ═══════════════════════════════════════════════════════════════════════════
//  PUESTA A PUNTO — se corren a mano desde el editor, una sola vez
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 1) Guarda el token sin dejarlo escrito en el código.
 *    Pega el token, ejecuta, y luego borra el valor de aquí.
 */
function guardaToken() {
  const TOKEN = 'PEGA_AQUI_TU_TOKEN_PERMANENTE';
  if (TOKEN.indexOf('PEGA_AQUI') === 0) throw new Error('Pega tu token antes de ejecutar.');
  PropertiesService.getScriptProperties().setProperty('WABA_TOKEN', TOKEN);
  console.log('Token guardado. Ya puedes borrar el valor de esta función.');
}

/**
 * 2) Crea la plantilla de autenticación. Es lo mismo que armarla en WhatsApp
 *    Manager, pero sin buscar dónde va cada casilla.
 *
 *    El texto del cuerpo NO se escribe: en las plantillas de autenticación lo
 *    pone Meta y lo traduce según el idioma. Lo único que mandamos es qué
 *    partes queremos (recomendación de seguridad, aviso de vencimiento, botón).
 */
function crearPlantilla() {
  if (!WABA.CUENTA_ID) throw new Error('Falta WABA.CUENTA_ID (WhatsApp Business Account ID).');
  if (!token_())       throw new Error('Falta el token. Corre guardaToken() primero.');

  const componentes = [
    { type: 'body',   add_security_recommendation: true },
    { type: 'footer', code_expiration_minutes: OTP.VIGENCIA_MIN }
  ];
  if (WABA.BOTON_COPIAR) {
    componentes.push({
      type: 'buttons',
      buttons: [{ type: 'otp', otp_type: 'copy_code', text: 'Copiar código' }]
    });
  }

  const cuerpo = {
    name: WABA.PLANTILLA,
    language: WABA.IDIOMA,
    category: 'authentication',
    // Si el mensaje no se entregó en este rato, mejor que no llegue: un código
    // que aparece cuando ya venció solo confunde.
    message_send_ttl_seconds: OTP.VIGENCIA_MIN * 60,
    components: componentes
  };

  const r = UrlFetchApp.fetch(
    'https://graph.facebook.com/' + WABA.VERSION + '/' + WABA.CUENTA_ID + '/message_templates',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token_() },
      payload: JSON.stringify(cuerpo),
      muteHttpExceptions: true
    }
  );

  const texto = r.getContentText();
  if (r.getResponseCode() >= 300) {
    console.error('Meta rechazó la plantilla:\n' + texto);
    if (texto.indexOf('already exists') >= 0) {
      console.log('Ya existía. Corre revisarPlantilla() para ver si está aprobada.');
    }
    return;
  }
  console.log('Plantilla enviada a revisión:\n' + texto);
  console.log('Las de autenticación suelen aprobarse en minutos. ' +
              'Corre revisarPlantilla() para ver cómo va.');
}

/** 3) ¿Ya quedó aprobada? */
function revisarPlantilla() {
  if (!WABA.CUENTA_ID) throw new Error('Falta WABA.CUENTA_ID.');

  const r = UrlFetchApp.fetch(
    'https://graph.facebook.com/' + WABA.VERSION + '/' + WABA.CUENTA_ID +
    '/message_templates?name=' + encodeURIComponent(WABA.PLANTILLA),
    { headers: { Authorization: 'Bearer ' + token_() }, muteHttpExceptions: true }
  );

  const salida = JSON.parse(r.getContentText());
  if (!salida.data || !salida.data.length) {
    console.log('No hay ninguna plantilla llamada "' + WABA.PLANTILLA + '". ' +
                'Corre crearPlantilla().');
    return;
  }

  salida.data.forEach(function(p) {
    console.log(
      p.name + ' · ' + p.language + ' · ' + p.category + ' → ' + p.status +
      (p.status === 'REJECTED' ? '  (motivo: ' + (p.rejected_reason || '?') + ')' : '')
    );
    if (p.language === WABA.IDIOMA && p.status !== 'APPROVED') {
      console.warn('Todavía no se puede usar: el estado tiene que ser APPROVED.');
    }
  });
}

/**
 * 4) Prueba de punta a punta: manda un código de verdad a tu propio número.
 *    Ojo: es un mensaje real y se cobra como conversación de autenticación.
 */
function probarEnvio() {
  const MI_NUMERO = 'PEGA_AQUI_TU_NUMERO';   // 10 dígitos, o con 52 al frente
  if (MI_NUMERO.indexOf('PEGA_AQUI') === 0) throw new Error('Pon tu número antes de ejecutar.');

  const tel = normaliza_(MI_NUMERO);
  if (!tel) throw new Error('Ese número no quedó bien. Deben ser 10 dígitos.');

  const codigo = generaCodigo_();
  const salida = mandaPlantilla_(tel, codigo);
  console.log(salida.ok
    ? 'Enviado a ' + tel + '. Debe llegarte el código ' + codigo
    : 'No salió: ' + salida.detalle);
}

/** 5) Revisa que no falte nada antes de abrir el registro. */
function diagnostico() {
  const filas = [
    ['Token guardado',        !!token_()],
    ['Phone Number ID',       !!WABA.PHONE_ID],
    ['WhatsApp Account ID',   !!WABA.CUENTA_ID],
    ['Verificación encendida', VERIFICAR]
  ];
  filas.forEach(function(f) { console.log((f[1] ? '✓ ' : '✗ ') + f[0]); });

  if (!token_() || !WABA.CUENTA_ID) {
    console.log('Completa lo de arriba y vuelve a correr diagnostico().');
    return;
  }
  revisarPlantilla();
}
