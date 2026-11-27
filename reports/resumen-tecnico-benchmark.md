# Codex Sift redujo un 28,3 % el tiempo medio para resolver las tareas del benchmark

**Benchmark del 27 de noviembre de 2026.** Codex Sift elige el modelo y el nivel de razonamiento para cada pedido de programación. En tres tareas de repositorio, repetidas tres veces cada una, Sift resolvió las nueve ejecuciones al primer intento. Usar siempre `gpt-5.6-sol` con razonamiento alto también resolvió las nueve, con un reintento. El tiempo medio hasta pasar las pruebas de aceptación bajó de **70,8 a 50,8 segundos**. En el conjunto de las nueve ejecuciones, la diferencia fue de **3 minutos**.

## Resultados medidos

| Métrica | Modelo fijo | Codex Sift | Cambio frente al modelo fijo |
|---|---:|---:|---:|
| Ejecuciones que pasaron las pruebas | 9/9 | 9/9 | Igual |
| Ejecuciones que pasaron al primer intento | 8/9 | 9/9 | Un reintento menos |
| Tiempo medio hasta pasar las pruebas | 70,8 s | 50,8 s | −28,3 % |
| Tokens de entrada, incluida la caché | 1.322.554 | 636.865 | −51,8 % |
| Tokens de entrada sin caché | 106.426 | 155.073 | +45,7 % |
| Tokens de salida | 27.432 | 15.633 | −43,0 % |
| Total de entrada y salida | 1.349.986 | 652.498 | −51,7 % |

La reducción del **51,7 %** corresponde al volumen de tokens reportado por Codex. La fila de entrada sin caché es un subconjunto de la entrada total. El modelo fijo reutilizó más contexto en caché, por lo que una estimación económica requeriría valorar por separado la entrada en caché, la entrada sin caché y la salida de cada modelo, además del consumo de Jev. La cuota facturada quedó fuera de la medición.

## Dónde se ganó tiempo

| Tarea | Modelo elegido por Sift | Tiempo medio con modelo fijo | Tiempo medio con Sift |
|---|---|---:|---:|
| Renombrar una función exportada y actualizar su consumidor | `gpt-5.6-terra` · medio | 28,2 s | 25,0 s |
| Corregir un parser CSV para comillas y campos con comas | `gpt-5.6-luna` · bajo | 48,0 s | 39,9 s |
| Hacer atómicas las transferencias concurrentes de inventario | `gpt-5.6-terra` · medio | 136,2 s | 87,5 s |

Inventario concentró la mayor diferencia: **48,7 segundos menos por ejecución**. Las pruebas verificaron que las transferencias superpuestas conservaran el stock y que un fallo de escritura dejara intactos ambos saldos. Sift pasó las tres repeticiones al primer intento. El modelo fijo necesitó un segundo intento en una de ellas. Las nueve decisiones de Sift usaron el clasificador Jev en vivo.

## Cómo se hizo la comparación

Cada par de ejecuciones partió del mismo commit de un repositorio de prueba, con el mismo pedido y los mismos límites. Se alternó el orden de las estrategias y se permitieron hasta dos intentos. Un evaluador independiente ejecutó las pruebas originales y las de aceptación sobre los archivos modificados. El tiempo incluye arranque, clasificación cuando corresponde, edición, evaluación y reintentos.

El resultado describe tres tareas sintéticas con Codex CLI 0.172.0 y Node.js 24.21.0 en macOS ARM64. Las repeticiones permiten observar variación dentro de esas tareas. Para estimar el beneficio en otro equipo o producto habría que medir su propia mezcla de trabajo.

[Datos por ejecución](task-completion.json) · [Metodología y comando de reproducción](../benchmarks/task-completion/README.md)
