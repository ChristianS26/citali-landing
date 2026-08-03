# Citali — Landing de pre-registro

Sitio de dos páginas para captar registros y medir el alcance de la publicidad
en redes. No necesita servidor, base de datos ni proceso de construcción: son
archivos HTML sueltos.

```
citali-landing/
├─ index.html              ← el landing (secciones, carrusel, giros, precios, FAQ)
├─ empezar.html            ← el alta en 5 pasos (aquí vive el formulario)
├─ assets/                 ← logo y las fotos de los giros
├─ apps-script.gs          ← código para pegar en Google Sheets (recibe los registros)
├─ og-image.html           ← plantilla para generar la imagen de redes (og.jpg)
└─ README.md               ← esto
```

Todos los botones del landing llevan a `empezar.html`. Las tarjetas de giros
además preseleccionan el giro: `empezar.html?giro=Fisioterapia`.

---

## Paso 1 · Que los registros caigan en tu Google Sheet

1. Entra a [sheets.new](https://sheets.new) y crea una hoja. Nómbrala **Citali — Pre-registros**.
2. Menú **Extensiones → Apps Script**.
3. Borra lo que haya en el editor y pega **todo** el contenido de `apps-script.gs`.
4. (Opcional) Si quieres un correo por cada registro, cambia arriba del archivo:
   `const NOTIFICAR = true;` y pon tu correo en `CORREO_AVISO`.
5. Guarda (💾) y haz clic en **Implementar → Nueva implementación**.
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario** ← *importante, si no, no entra nada*
6. Acepta los permisos. Google te va a advertir que la app "no está verificada":
   entra a **Configuración avanzada → Ir a (nombre del proyecto)**. Es tu propio
   script, es seguro.
7. Copia la **URL de la aplicación web**. Termina en `/exec`.
8. Pruébala: pégala en el navegador. Debe responder
   `{"ok":true,"mensaje":"Citali: receptor de pre-registros activo"}`.

Ahora abre **`empezar.html`** (ahí vive el formulario), busca el bloque
`const CONFIG` y pega la URL:

```js
SHEETS_ENDPOINT: "https://script.google.com/macros/s/AKfy..../exec",
```

Aprovecha y llena también:

| Campo | Dónde | Para qué sirve |
|---|---|---|
| `SHEETS_ENDPOINT` | `empezar.html` | La URL del Apps Script. Solo se configura aquí. |
| `WHATSAPP` | ambos | Plan B si falla el envío. Formato `52` + 10 dígitos, sin `+` ni espacios. |
| `EMAIL` | `index.html` | Aparece en el aviso de privacidad y en el pie. |
| `META_PIXEL_ID` | ambos | Píxel de Meta (paso 4). Déjalo vacío mientras no lo tengas. |
| `GA4_ID` | ambos | Google Analytics, opcional. |
| `SHARE_TEXT` | `empezar.html` | Texto que se comparte por WhatsApp desde la pantalla final. |

> Los identificadores de medición van en las dos páginas para que el píxel
> cuente la visita al landing **y** la del alta.

> **Cada vez que edites el código del Apps Script**, tienes que hacer
> *Implementar → Administrar implementaciones → ✏️ → Versión: Nueva → Implementar*.
> Si solo guardas, sigue corriendo la versión vieja.

---

## Paso 2 · La imagen para redes (og.png)

Cuando alguien comparta el enlace en WhatsApp, Facebook o Instagram, se ve esta imagen.
Vale la pena y toma dos minutos:

1. Abre `og-image.html` en Chrome.
2. `F12` → `Ctrl+Shift+M` → pon el tamaño **1200 × 630**.
3. `Ctrl+Shift+P` → escribe `screenshot` → **Capture node screenshot** sobre el recuadro.
4. Guarda el archivo como **`og.png`** junto a `index.html`.

---

## Paso 3 · Comprar el dominio y publicar

### El dominio
`citali.mx` estaba libre en julio de 2026 (verificado en la propuesta). Se compra en
registradores mexicanos como **Akky**, **Neubox**, **Hostinger** o **GoDaddy**
(un `.mx` ronda los $500–$900 MXN al año). Cómpralo antes de lanzar los anuncios —
el nombre en el anuncio no sirve de nada si el dominio se lo lleva alguien más.

> Si quieres pagar menos mientras validas, `citali.com.mx` o un `.com` alterno también
> funcionan; solo actualiza las líneas `<link rel="canonical">` y `og:url` del `index.html`.

### Publicar (la forma más rápida, y gratis)

**Opción A — Vercel (recomendada)**

1. Entra a [vercel.com](https://vercel.com) y crea una cuenta.
2. En el panel: **Add New → Project → Deploy a folder** y arrastra la carpeta
   `citali-landing` completa (con `index.html` y `og.png`).
3. Cuando termine, ve a **Settings → Domains → Add** y escribe `citali.mx`.
4. Vercel te da dos registros DNS. Entra al panel de tu registrador y crea:
   - Registro **A** de `@` → la IP que te indique Vercel
   - Registro **CNAME** de `www` → `cname.vercel-dns.com`
5. Espera de 10 minutos a unas horas. El certificado HTTPS se genera solo.

**Opción B — Netlify Drop**: arrastra la carpeta a [app.netlify.com/drop](https://app.netlify.com/drop)
y conecta el dominio en *Domain settings*. Igual de rápido.

**Opción C — tu hosting de siempre**: sube `index.html` y `og.png` por FTP a la raíz.
No necesita nada más (ni PHP, ni base de datos).

---

## Paso 4 · Medir la publicidad

### Píxel de Meta (Facebook / Instagram)

1. [business.facebook.com](https://business.facebook.com) → **Administrador de eventos**
   → **Conectar orígenes de datos** → **Web** → dale un nombre.
2. Copia el **ID del píxel** (15–16 dígitos) y pégalo en `META_PIXEL_ID` dentro del `index.html`.
3. Vuelve a publicar el archivo.

La página ya dispara dos eventos sola:

| Evento | Cuándo | Para qué |
|---|---|---|
| `PageView` | Al cargar | Mide el tráfico que traen tus anuncios |
| `InitiateCheckout` | Al hacer clic en cualquier botón de "apartar lugar" | Mide interés real |
| `Lead` | Al enviarse el formulario | **Esta es tu conversión** — optimiza los anuncios hacia aquí |

En el Administrador de anuncios, configura la campaña con objetivo **Clientes potenciales**
y elige el evento **Lead** de tu píxel.

### Etiquetas UTM (para saber qué anuncio funcionó)

La página guarda automáticamente en tu hoja de cálculo de dónde vino cada registro.
Solo tienes que usar enlaces así en cada anuncio:

```
https://citali.mx/?utm_source=instagram&utm_medium=cpc&utm_campaign=beta-fisio&utm_content=video-anticipo
https://citali.mx/?utm_source=facebook&utm_medium=cpc&utm_campaign=beta-fisio&utm_content=carrusel-agenda
```

Después, en la hoja, filtra por `utm_content` y vas a ver **qué creativo trajo más registros**,
no solo más clics.

---

## Paso 5 · Cómo leer los resultados

Números que de verdad importan durante la prueba:

- **Registros ÷ visitas** = tasa de conversión. En una landing de lista de espera,
  entre **3 % y 8 %** es normal; arriba de 10 % significa que diste con el mensaje correcto.
- **Costo por registro** = lo que gastaste ÷ registros. Es tu primer dato real de
  cuánto cuesta conseguir un cliente.
- **Giro y ciudad** (columnas de la hoja): te dicen a quién le duele más y por dónde
  arrancar. Si el 60 % son de un solo giro, ese es tu nicho, sin discusión.

> La hoja trae columnas de *Negocio*, *Correo* y *Tamaño* que la versión simple del
> formulario ya no pide: quedan vacías. Si algún día quieres esos datos, solo agregas
> el campo al `index.html` con el mismo nombre y se llenan solas.

---

## Qué ya trae la página (para que no la busques)

- **Una sola pantalla**: gancho, la conversación de WhatsApp y el formulario. Sin secciones
  que haya que scrollear ni preguntas frecuentes.
- La conversación se escribe sola al cargar — explica el producto en tres segundos,
  que es todo el tiempo que te da alguien que venía de un anuncio.
- Cuatro campos: nombre, WhatsApp, giro y ciudad. Con validación en español,
  formato automático del teléfono y trampa anti-spam (campo oculto + tiempo mínimo).
- Pantalla de gracias con botón de "pásale la voz" por WhatsApp — alcance gratis.
- Aviso de privacidad incluido — **Meta lo exige** para anuncios que captan datos,
  y la ley mexicana (LFPDPPP) también.
- Rápida: sin librerías externas, solo la tipografía de Google Fonts.

## Lo que falta y es tuyo decidir

- **Número de WhatsApp real** en `CONFIG.WHATSAPP` (hoy trae ceros de relleno).
- **Correo de contacto**: hoy dice `hola@citali.mx`; hay que crearlo o cambiarlo.
- Revisar el aviso de privacidad con quien lleve lo legal antes de meterle dinero
  a los anuncios, y decidir si registras la marca ante el IMPI (la propuesta lo tenía pendiente).

---

## El logo

Vive en `assets/`. El SVG es la fuente de verdad: escala a cualquier tamaño,
pesa 1.4 KB y no necesita versiones @2x.

| Archivo | Cuándo usarlo |
|---|---|
| `logo.svg` | Uso general. Gradiente cian → morado, fondo transparente. Es también el favicon. |
| `logo-mono.svg` | Cuando el gradiente no cabe: hereda el color del texto con `currentColor`, así que se pinta con CSS (`color: #fff`). Útil sobre fondos de color, en impresión o en un solo tono. |
| `apple-touch-icon.png` | Icono al guardar el sitio en la pantalla de inicio de iOS. 180×180 sobre el morado oscuro de marca. |
| `logo-original.png` | El PNG original tal cual llegó, 1254×1254. No se usa en el sitio; queda como respaldo. |

En `index.html` el logo va **incrustado** en la barra superior, no como `<img>`:
así se pinta al instante y se puede animar o recolorear desde CSS.

Si cambias el SVG, acuérdate de regenerar `apple-touch-icon.png`.

> El gradiente del logo (cian → morado) y el violeta de la interfaz
> (`--violet: #6D4AE0`) conviven pero no son el mismo color. Si en algún
> momento quieren unificar la identidad, ese es el punto a decidir.
