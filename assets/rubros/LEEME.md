# Fotos de los giros

Las tarjetas de la sección "A quién le sirve" funcionan hoy con ilustración
y color. Están listas para recibir fotos: basta con meter un `<img>` dentro
del `<span class="rb-lienzo">` y el icono desaparece solo.

```html
<span class="rb-lienzo">
  <img src="assets/rubros/fisioterapia.jpg" alt="" loading="lazy" width="800" height="550">
  <svg class="rb-ico" ...>…</svg>   <!-- se queda de respaldo; el CSS lo oculta -->
</span>
```

Se pueden sustituir de una en una: las que no tengan foto siguen con su icono.

## Formato

- 800×550 px basta (las tarjetas son 16:11 y nunca se muestran más grandes).
- WebP si se puede; JPG al 80% si no.
- Menos de 120 KB cada una. Dieciocho fotos pesadas arruinan la carga en celular.
- `loading="lazy"` en todas menos las tres primeras.
- `alt=""` cuando la foto es decorativa y el nombre del giro ya está en el texto.

## Antes de subir una foto con gente

Ni Unsplash, ni Pexels, ni Pixabay verifican que exista autorización de la
persona retratada: sus términos trasladan esa responsabilidad a quien la usa,
y los tres piden expresamente no dar a entender que alguien respalda tu
producto. Una cara desconocida bajo el rótulo "Odontología" en una página
comercial cae justo en esa zona.

Lo que sí es seguro sin trámite:

- Espacios y equipo: la camilla, el consultorio, la sala de espera, el sillón
  dental, el aparato de ultrasonido.
- Manos trabajando, sin rostro reconocible.
- Detalle y materiales: agujas de acupuntura, gel, vendas, alimentos.

Y lo mejor cuando existan: **fotos de los propios consultorios de la beta**.
Son las únicas que además prueban que el producto es real.
