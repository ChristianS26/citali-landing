/**
 * CITALI — Receptor de registros con verificación por WhatsApp
 * ---------------------------------------------------------------------------
 * Pega este código en Extensiones → Apps Script de tu Google Sheet,
 * impleméntalo como aplicación web y copia la URL en CONFIG.SHEETS_ENDPOINT
 * del archivo empezar.html. Los pasos completos están en README.md.
 *
 * El token de WhatsApp NO va aquí: se guarda en Propiedades del script
 * (Configuración del proyecto → Propiedades del script). Ver README.md.
 * ---------------------------------------------------------------------------
 */

// ─── Ajustes ────────────────────────────────────────────────────────────────
const HOJA = 'Pre-registros';        // Nombre de la pestaña donde caen los datos
const NOTIFICAR = false;             // Ponlo en true para recibir un correo por registro
const CORREO_AVISO = 'tu-correo@ejemplo.com';
const ZONA = 'America/Mexico_City';

// Verificación del número por WhatsApp
const VERIFICAR = true;              // false = se guarda sin pedir código

const WABA = {
  VERSION:   'v21.0',
  PHONE_ID:  '',                     // Phone Number ID del número emisor
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

const COLUMNAS = [
  'Fecha', 'Nombre', 'Negocio', 'WhatsApp', 'Verificado', 'Ciudad', 'Giro', 'Tamaño',
  'Agenda hoy', 'Citas/semana', 'Precio sesión', 'Citas fantasma', 'Cobra anticipo',
  'Repetido', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'Referencia', 'Página', 'Dispositivo'
];

const COL_WHATSAPP = 4;              // Posición de la columna WhatsApp en COLUMNAS

// ─── Entrada ────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const datos = leerDatos_(e);
    const accion = String(datos.accion || 'registro');

    if (accion === 'enviarCodigo')  return responder_(enviarCodigo_(datos));
    if (accion === 'validarCodigo') return responder_(validarCodigo_(datos));

    // Alta directa. Solo se acepta cuando la verificación está apagada:
    // si no, sería una puerta para saltarse el código.
    if (VERIFICAR) return responder_({ ok: false, motivo: 'verificacion_requerida' });
    return responder_(guardar_(datos));

  } catch (err) {
    console.error(err);
    return responder_({ ok: false, motivo: 'error', detalle: String(err) });
  }
}

// Prueba rápida: abre la URL /exec en el navegador y debe decir ok
function doGet() {
  return responder_({
    ok: true,
    mensaje: 'Citali: receptor de registros activo',
    verificacion: VERIFICAR ? (tieneCredenciales_() ? 'lista' : 'sin credenciales') : 'apagada'
  });
}

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

// ─── Alta en la hoja ────────────────────────────────────────────────────────
function guardar_(datos, verificado) {
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(25000);
  } catch (err) {
    return { ok: false, motivo: 'ocupado' };
  }

  try {
    // Descarta envíos vacíos o de robots (la trampa del formulario)
    if (!datos.nombre || !datos.whatsapp || datos.sitio) {
      return { ok: false, motivo: 'datos_incompletos' };
    }

    const hoja = obtenerHoja_();
    const repetido = yaExiste_(hoja, datos.whatsapp) ? 'sí' : '';

    hoja.appendRow([
      Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm:ss'),
      datos.nombre || '',
      datos.negocio || '',
      "'" + (datos.whatsapp || ''),   // el apóstrofo evita que Sheets lo lea como número
      verificado ? 'sí' : '',
      datos.ciudad || '',
      datos.giro || '',
      datos.tamano || '',
      datos.herramienta || '',
      datos.volumen || '',
      datos.precio || '',
      datos.fantasma || '',
      datos.anticipo || '',
      repetido,
      datos.utm_source || '',
      datos.utm_medium || '',
      datos.utm_campaign || '',
      datos.utm_content || '',
      datos.utm_term || '',
      datos.referencia || '',
      datos.pagina || '',
      datos.dispositivo || ''
    ]);

    if (NOTIFICAR && !repetido) avisar_(datos);

    return { ok: true };

  } catch (err) {
    console.error(err);
    return { ok: false, motivo: 'error', detalle: String(err) };
  } finally {
    candado.releaseLock();
  }
}

// ─── Apoyo ──────────────────────────────────────────────────────────────────
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

function leerDatos_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      // Se limpia el BOM y los espacios que meten algunos clientes HTTP
      const crudo = String(e.postData.contents).replace(/^﻿/, '').trim();
      return JSON.parse(crudo);
    } catch (err) {
      // Si no vino como JSON, usa los parámetros del formulario
    }
  }
  return (e && e.parameter) ? e.parameter : {};
}

function obtenerHoja_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = libro.getSheetByName(HOJA);

  if (!hoja) hoja = libro.insertSheet(HOJA);

  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length)
        .setFontWeight('bold')
        .setBackground('#EFE9FC')
        .setFontColor('#4E2FB8');
    hoja.setFrozenRows(1);
    hoja.setColumnWidth(1, 145);
    hoja.setColumnWidth(2, 165);
  } else {
    avisaEncabezado_(hoja);
  }
  return hoja;
}

/**
 * Si la hoja quedó con los encabezados viejos, las columnas nuevas caerían
 * sin título y "Verificado" desalinearía todo lo que va después. Mejor
 * enterarse en el registro que descubrirlo revisando la hoja.
 */
function avisaEncabezado_(hoja) {
  const actual = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  if (actual.length === COLUMNAS.length && actual[4] === 'Verificado') return;
  console.warn(
    'Los encabezados de la hoja no coinciden con COLUMNAS. ' +
    'Renombra la pestaña "' + HOJA + '" (o borra la fila 1 y sus datos) ' +
    'para que se generen de nuevo. Encabezados actuales: ' + actual.join(' | ')
  );
}

function yaExiste_(hoja, whatsapp) {
  const filas = hoja.getLastRow();
  if (filas < 2) return false;
  const columna = hoja.getRange(2, COL_WHATSAPP, filas - 1, 1).getValues();
  const buscado = String(whatsapp).replace(/\D/g, '');
  for (let i = 0; i < columna.length; i++) {
    if (String(columna[i][0]).replace(/\D/g, '') === buscado) return true;
  }
  return false;
}

function avisar_(d) {
  try {
    MailApp.sendEmail({
      to: CORREO_AVISO,
      subject: '✶ Nuevo registro Citali: ' + d.nombre,
      htmlBody:
        '<div style="font-family:Georgia,serif;font-size:15px;color:#241B31">' +
        '<h2 style="color:#4E2FB8;margin:0 0 12px">Nuevo registro</h2>' +
        '<p><b>' + (d.nombre || '') + '</b>' + (d.negocio ? ' — ' + d.negocio : '') + '</p>' +
        '<p>WhatsApp: <b>' + (d.whatsapp || '') + '</b><br>' +
        'Giro: ' + (d.giro || '—') + '<br>' +
        'Ciudad: ' + (d.ciudad || '—') + '<br>' +
        'Terapeutas: ' + (d.tamano || '—') + '</p>' +
        '<p style="background:#EFE9FC;padding:10px;border-radius:8px">' +
        'Agenda hoy con: <b>' + (d.herramienta || '—') + '</b><br>' +
        'Citas por semana: <b>' + (d.volumen || '—') + '</b><br>' +
        'Precio por sesión: <b>' + (d.precio || '—') + '</b><br>' +
        'Citas fantasma el mes pasado: <b>' + (d.fantasma || '—') + '</b><br>' +
        'Cobra anticipo hoy: <b>' + (d.anticipo || '—') + '</b></p>' +
        '<p style="color:#6E6480;font-size:13px">Campaña: ' +
        [d.utm_source, d.utm_medium, d.utm_campaign, d.utm_content].filter(String).join(' · ') +
        '</p></div>'
    });
  } catch (err) {
    console.error('No se pudo enviar el aviso: ' + err);
  }
}

function responder_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Corre esto una vez desde el editor para guardar el token sin dejarlo escrito
 * en el código. Pega el token, ejecuta, y luego borra el valor de aquí.
 */
function guardaToken() {
  const TOKEN = 'PEGA_AQUI_TU_TOKEN_PERMANENTE';
  if (TOKEN.indexOf('PEGA_AQUI') === 0) throw new Error('Pega tu token antes de ejecutar.');
  PropertiesService.getScriptProperties().setProperty('WABA_TOKEN', TOKEN);
  console.log('Token guardado. Ya puedes borrar el valor de esta función.');
}
