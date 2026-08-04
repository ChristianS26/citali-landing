/**
 * CITALI — Receptor de registros
 * ---------------------------------------------------------------------------
 * Pega este código en Extensiones → Apps Script de tu Google Sheet,
 * impleméntalo como aplicación web y copia la URL en CONFIG.SHEETS_ENDPOINT
 * del archivo empezar.html. Los pasos completos están en README.md.
 *
 * Este archivo solo toca la hoja de cálculo, y eso es a propósito: así el
 * único permiso que Google pide es el de hojas. El código de verificación por
 * WhatsApp está aparte, en apps-script-whatsapp.gs, porque necesita permiso
 * para conectarse a servicios externos y Google lo pide aunque la función
 * esté apagada. Ver README.md, paso 1.5.
 * ---------------------------------------------------------------------------
 */

// ─── Ajustes ────────────────────────────────────────────────────────────────
const HOJA = 'Pre-registros';        // Nombre de la pestaña donde caen los datos
const ZONA = 'America/Mexico_City';

const COLUMNAS = [
  // 'Verificado' queda vacía mientras VERIFICAR esté apagado. Se deja puesta
  // para no volver a mover los encabezados cuando se encienda.
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

    // Las acciones del código por WhatsApp viven en apps-script-whatsapp.gs,
    // que no está pegado en el proyecto. Pegarlo enciende estas dos ramas.
    if (accion === 'enviarCodigo' || accion === 'validarCodigo') {
      return responder_({ ok: false, motivo: 'verificacion_no_instalada' });
    }
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
    columnas: COLUMNAS.length
  });
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
      verificado ? 'sí' : '',   // solo se llena con el código por WhatsApp
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

    return { ok: true };

  } catch (err) {
    console.error(err);
    return { ok: false, motivo: 'error', detalle: String(err) };
  } finally {
    candado.releaseLock();
  }
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

function responder_(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

