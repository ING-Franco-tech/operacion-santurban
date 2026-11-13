# Operación Santurbán: Cero Tolerancia

Videojuego 3D en primera persona para navegador, hecho con Three.js. Proyecto de la materia de Programación.

Eres «Cóndor», un soldado de fuerzas especiales que debe desmantelar un campamento de minería ilegal de oro en el páramo de Santurbán (Colombia), rescatar a una ingeniera química y evitar una fuga de ácido cianhídrico.

Todos los personajes y nombres son ficticios.

## Cómo jugar

Abre la página publicada con GitHub Pages (Chrome o Edge, en PC, con audífonos).

Para probarlo en tu computador, sirve la carpeta con un servidor local, porque los audios no cargan con efectos si abres `index.html` con doble clic:

```bash
python -m http.server 8000
```

Luego entra a `http://localhost:8000`.

## Controles

| Tecla | Acción |
|---|---|
| W A S D | Moverse |
| Shift | Correr / contener la respiración con la mira |
| Espacio | Saltar |
| C / Z | Agacharse / cuerpo a tierra |
| Ctrl | Caminar sigiloso |
| Q / E | Inclinarse |
| Clic izquierdo / derecho | Disparar / apuntar |
| 1, 2, 3 o rueda | Cambiar arma / zoom |
| R / 4 | Recargar / botiquín |
| F | Interactuar |
| G | Detonar el C4 desde la extracción |
| Esc | Pausa |

## Misión

1. **Reconocimiento:** observa con binoculares la llegada de alias Deivis en su Kia rojo y su discusión con el Chamo.
2. **Infiltración:** neutraliza a los 8 hostiles sin que te detecten.
3. **Pruebas y rescate:** analiza el agua, asegura el oro, copia los datos y libera a la ingeniera.
4. **Química:** estabiliza el pH del tanque 2 entre 10,5 y 11,5 para que el cianuro no se libere como HCN.
5. **Sabotaje:** coloca 3 cargas de C4 y corre a la bengala verde.

## Química que aparece en el juego

- Ecuación de Elsner: `4 Au + 8 NaCN + O2 + 2 H2O → 4 Na[Au(CN)2] + 4 NaOH`
- Equilibrio del cianuro: `HCN ⇌ H+ + CN-`, pKa = 9,2. Fracción como gas: `1 / (1 + 10^(pH − 9,2))`
- Amalgamación con mercurio y formación de metilmercurio
- Límites de agua potable de la Resolución 2115 de 2007

Las lecturas del río, las cifras del computador y la dosis de reactivo son simuladas.

## Estructura

```
index.html          Página y estilos del HUD
js/personajes.js    Nombres y aspecto de los personajes
js/game.js          Motor: terreno, armas, enemigos, misión
js/audio.js         Clips grabados (sin procesar) y voces sintetizadas
js/modelos.js       Formas orgánicas y aspecto de cada personaje
js/realismo.js      Colisiones, navegación, animación corporal, posproceso y ambientación
js/diseno.js        Vehículos de carrocería curva, personajes, vertimiento al río, lluvia y truenos
js/historia.js      Cinemática, misión del pH y guía de objetivos
js/main.js          Arranque y bucle principal
audio/              Voces grabadas por el equipo
vendor/             Three.js r147 (licencia MIT)
```
