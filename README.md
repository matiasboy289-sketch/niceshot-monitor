# NICE SHOT | L4D2 Monitor

Monitor público de Left 4 Dead 2 con Flask y consultas UDP A2S_INFO / A2S_PLAYER.

## Publicar
1. Subir los archivos del proyecto a la raíz del repositorio.
2. En Render: New > Blueprint, seleccionar este repositorio y desplegar con `render.yaml`.
3. Visitar la URL pública que proporcione Render.

## Probar localmente
`pip install -r requirements.txt` y `python app.py`, luego `http://localhost:5000`.

## Importante
- Dirección: 38.7.197.74:25579, suponiendo que es el puerto A2S.
- Render necesita salida UDP hacia el servidor; el firewall debe permitir consultas y respuestas.
- El modo competitivo exacto no puede inferirse de forma fiable solo con A2S_INFO.
- La imagen de portada es ilustrativa; el nombre del mapa se obtiene en vivo.
- Un plan gratuito puede suspenderse tras inactividad.
