# Desplegar el Apps Script — guía para ejecutar

> Esta guía está escrita para que la siga un agente (Claude Code o similar)
> junto con la persona dueña del proyecto. Los pasos son manuales en el
> navegador; el agente puede conducirlos, pero hay un punto donde tiene que
> parar y dejar que la persona decida. Está marcado.

## Por qué hay que hacer esto

El formulario de alta se movió a `empezar.html` y ahora pregunta cinco cosas
más para calificar al consultorio:

- Con qué lleva sus citas hoy
- Cuántas citas atiende por semana
- Cuánto cobra por sesión
- Cuántos pacientes no llegaron el mes pasado
- Si cobra anticipo hoy

El Apps Script que está desplegado es anterior a ese cambio: recibe esas cinco
respuestas y **las descarta en silencio**. La fila sí se guarda, con nombre,
WhatsApp, ciudad, giro y UTMs, pero las cinco respuestas nunca llegan a la
hoja y no se pueden recuperar después.

Además cambiaron los encabezados: se fue la columna `Correo` (el formulario ya
no pide correo), entró `Verificado`, y `Giro` y `Ciudad` cambiaron de orden.

## Antes de empezar

| Requisito | Cómo saber si se cumple |
|---|---|
| Sesión iniciada con la cuenta **dueña** del proyecto de Apps Script | Al abrir el editor, el aviso de "app sin verificar" no debería aparecer, o aparece señalándote a ti como desarrollador |
| Acceso de edición a la hoja `Citali — Pre-registros` | Puedes escribir en una celda |
| El repo a la mano | `github.com/ChristianS26/citali-landing`, rama `main` |

Si al desplegar sale **"Google hasn't verified this app"** señalando a otra
cuenta como desarrollador, estás en la cuenta equivocada. Cierra sesión y
entra con la dueña del proyecto.

## Los pasos

Hazlos de corrido, sin dejar horas entre uno y otro: entre el paso 1 y el 3
hay una ventana en la que un registro nuevo podría caer en la pestaña
equivocada.

### 1. Renombrar la pestaña de la hoja

Abre `Citali — Pre-registros`. Clic derecho en la pestaña **Pre-registros**
(abajo a la izquierda) → **Cambiar nombre** → ponle `Pre-registros viejos`.

Esto no borra nada. El script crea una pestaña `Pre-registros` nueva, ya con
los encabezados correctos, la próxima vez que llegue un registro. Lo que había
se queda en la pestaña renombrada.

> Si no lo haces, los datos nuevos se escriben con el orden nuevo debajo de los
> encabezados viejos, y todo queda recorrido una columna a partir de la quinta.

### 2. Reemplazar el código

En la misma hoja: **Extensiones → Apps Script**.

1. En el editor, selecciona todo el contenido de `Code.gs` y bórralo.
2. Pega el contenido de **`apps-script.gs`** de la rama `main` del repo.
3. Guarda con `Cmd+S` / `Ctrl+S`. Arriba debe decir "Guardado en Drive".

Vale la pena verificar que el pegado quedó completo antes de seguir. En la
consola del navegador, con el editor abierto:

```js
const v = monaco.editor.getModels()[0].getValue();
console.log(v.length, v.includes("'Verificado'"), v.includes("'Correo'"));
// esperado: un número > 6000, true, false
```

> El repo trae un segundo archivo, `apps-script-whatsapp.gs`. **No lo pegues
> todavía.** Es la verificación del número por WhatsApp, que hoy está apagada
> porque no hay cuenta de WhatsApp Business API. Pegarlo hace que Google pida
> dos permisos más ("conectarse a un servicio externo" y "enviar correo como
> tú") para funciones que no se usan. Sus instrucciones para encenderlo están
> en su propio encabezado.

### 3. Publicar una versión nueva

Botón **Implementar** (arriba a la derecha) → **Gestionar implementaciones**.

> ⚠️ **No elijas "Nueva implementación".** Eso crea un endpoint con una URL
> distinta, y el formulario del sitio seguiría apuntando al viejo. El sitio
> dejaría de guardar registros sin ningún error visible.

En el panel que abre:

1. Ícono del **lápiz** (arriba a la derecha del panel) para poder editar.
2. **Versión** → elige **Versión nueva**.
3. Descripción: algo como `Columnas de calificacion`.
4. Deja **Ejecutar como** y **Quién tiene acceso** exactamente como están.
   "Cualquier usuario" es lo correcto: es un endpoint público que recibe el
   formulario de una página web.
5. **Implementar**.

#### 🛑 Aquí para si aparece una pantalla de permisos

Google va a pedir autorizar el acceso. Si eres un agente: **no hagas clic en
"Autorizar acceso" ni pases una advertencia de seguridad por la persona.**
Muéstrale la pantalla, dile qué permiso se está concediendo y por qué, y deja
que ella decida y haga el clic.

El permiso que pide este archivo es uno solo: **ver y editar hojas de cálculo**.
Es lo que necesita para escribir los registros. Si aparece alguno más, algo se
pegó de más — probablemente `apps-script-whatsapp.gs`.

## Comprobar que quedó

### a) El endpoint responde la versión nueva

```bash
curl -sL "https://script.google.com/macros/s/AKfycbzV_c_CxlgcGxKRfIQY2PJfdLcVmn_rizf2WepBRLExYqN37bLrPJAMcFDMZdAfSCMx/exec"
```

| Respuesta | Qué significa |
|---|---|
| `{"ok":true,"mensaje":"Citali: receptor de registros activo","columnas":22}` | ✅ Listo |
| `{"ok":true,"mensaje":"Citali: receptor de pre-registros activo"}` | ❌ Se quedó en la versión vieja. Repite el paso 3 y asegúrate de elegir "Versión nueva" |

Fíjate en la diferencia: dice **registros**, no **pre-registros**.

### b) Una alta real de punta a punta

Entra a <https://citali.mx/empezar.html>, llena los 6 pasos con datos de
prueba (pon el nombre `PRUEBA - borrar` para reconocerla) y envía.

En la hoja debe aparecer una pestaña `Pre-registros` nueva con 22 columnas, y
la fila debe traer llenas **Agenda hoy**, **Citas/semana**, **Precio sesión**,
**Citas fantasma** y **Cobra anticipo**. Si esas cinco salen vacías, el
despliegue no se actualizó.

## Si algo sale mal

**Volver a la versión anterior:** Implementar → Gestionar implementaciones →
lápiz → Versión → elige la versión anterior de la lista → Implementar. La URL
no cambia, así que el sitio vuelve a funcionar como antes de inmediato.

**El formulario dice "No pudimos guardar tu registro":** el endpoint no está
respondiendo. Revisa en Apps Script → **Ejecuciones** si hay errores, y
confirma que "Quién tiene acceso" siga en "Cualquier usuario".

**Los datos caen recorridos:** faltó el paso 1. Renombra la pestaña
`Pre-registros` y deja que el script cree una nueva.

## Qué reportar de vuelta

- Qué respondió el `curl` del endpoint
- Si la fila de prueba trajo las cinco columnas de calificación llenas
- Qué permisos pidió Google, si pidió alguno
