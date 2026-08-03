/**
 * CITALI — Receptor de pre-registros
 * ---------------------------------------------------------------------------
 * Pega este código en Extensiones → Apps Script de tu Google Sheet,
 * impleméntalo como aplicación web y copia la URL en CONFIG.SHEETS_ENDPOINT
 * del archivo index.html. Los pasos completos están en README-despliegue.md.
 * ---------------------------------------------------------------------------
 */

// ─── Ajustes ────────────────────────────────────────────────────────────────
const HOJA = 'Pre-registros';        // Nombre de la pestaña donde caen los datos
const NOTIFICAR = false;             // Ponlo en true para recibir un correo por registro
const CORREO_AVISO = 'tu-correo@ejemplo.com';
const ZONA = 'America/Mexico_City';

const COLUMNAS = [
  'Fecha', 'Nombre', 'Negocio', 'WhatsApp', 'Correo', 'Giro', 'Ciudad', 'Tamaño',
  'Repetido', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'Referencia', 'Página', 'Dispositivo'
];

// ─── Recepción del formulario ───────────────────────────────────────────────
function doPost(e) {
  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(25000);
  } catch (err) {
    return responder_({ ok: false, error: 'ocupado' });
  }

  try {
    const datos = leerDatos_(e);

    // Descarta envíos vacíos o de robots (la trampa del formulario)
    if (!datos.nombre || !datos.whatsapp || datos.sitio) {
      return responder_({ ok: false, error: 'datos incompletos' });
    }

    const hoja = obtenerHoja_();
    const repetido = yaExiste_(hoja, datos.whatsapp) ? 'sí' : '';

    hoja.appendRow([
      Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm:ss'),
      datos.nombre || '',
      datos.negocio || '',
      "'" + (datos.whatsapp || ''),   // el apóstrofo evita que Sheets lo lea como número
      datos.correo || '',
      datos.giro || '',
      datos.ciudad || '',
      datos.tamano || '',
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

    return responder_({ ok: true });

  } catch (err) {
    console.error(err);
    return responder_({ ok: false, error: String(err) });
  } finally {
    candado.releaseLock();
  }
}

// Prueba rápida: abre la URL /exec en el navegador y debe decir ok
function doGet() {
  return responder_({ ok: true, mensaje: 'Citali: receptor de pre-registros activo' });
}

// ─── Apoyo ──────────────────────────────────────────────────────────────────
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

  if (!hoja) {
    hoja = libro.insertSheet(HOJA);
  }
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length)
        .setFontWeight('bold')
        .setBackground('#EFE9FC')
        .setFontColor('#4E2FB8');
    hoja.setFrozenRows(1);
    hoja.setColumnWidth(1, 145);
    hoja.setColumnWidth(2, 165);
  }
  return hoja;
}

function yaExiste_(hoja, whatsapp) {
  const filas = hoja.getLastRow();
  if (filas < 2) return false;
  const columna = hoja.getRange(2, 4, filas - 1, 1).getValues();
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
      subject: '✶ Nuevo pre-registro Citali: ' + d.nombre,
      htmlBody:
        '<div style="font-family:Georgia,serif;font-size:15px;color:#241B31">' +
        '<h2 style="color:#4E2FB8;margin:0 0 12px">Nuevo pre-registro</h2>' +
        '<p><b>' + (d.nombre || '') + '</b>' + (d.negocio ? ' — ' + d.negocio : '') + '</p>' +
        '<p>WhatsApp: <b>' + (d.whatsapp || '') + '</b><br>' +
        'Correo: ' + (d.correo || '—') + '<br>' +
        'Giro: ' + (d.giro || '—') + '<br>' +
        'Ciudad: ' + (d.ciudad || '—') + '<br>' +
        'Tamaño: ' + (d.tamano || '—') + '</p>' +
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
