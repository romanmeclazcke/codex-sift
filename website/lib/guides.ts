export const guides = {
  en: {
    title: "How to reduce token usage in Codex CLI",
    description: "Use the right model for each task, keep context focused, and compare manual model selection with Codex Sift.",
    intro: "Start by matching the model and reasoning effort to the task. A file explanation, a small rename, and a cross-repo migration have different requirements. Keep the stronger model for tasks where additional reasoning is worth the usage.",
    sections: [
      ["Choose a model by task", "For a lookup or a small edit, try a lighter model first. For routine implementation, use a model that can finish the change and run its tests. For difficult debugging or a migration with production risk, choose a stronger model. In a native Codex CLI session, use /model to choose among the available options."],
      ["Keep the request focused", "Point Codex to the files and acceptance criteria that matter. Start a fresh session when the task changes substantially, and carry over a short summary of decisions and relevant paths. Check your usage in Codex before and after comparable tasks. Track subscription quota separately from API charges."],
      ["Measure before you change the defaults", "Pick a small set of tasks you repeat: a file explanation, a bounded edit, and a harder debugging task. Run each in a fresh session against the same starting state. Record the model, reasoning effort, reported usage, elapsed time, and whether the answer or diff passed your check. Repeat runs when you can, because cached input and model responses can vary."],
      ["Choose automatically with Codex Sift", "Sift classifies each turn with TypeSafe Jev, then maps it to a model and reasoning effort using a YAML policy. You keep the native Codex CLI. Install Node.js 20+ and the Codex CLI, have your TypeSafe API key ready, then run setup. Use npx codex-sift to start a routed session. Run a lookup and a routine edit, then use npx codex-sift explain to inspect a routing decision."],
    ],
    result: "In a 12-request routing test, Codex Sift used 48.8% less estimated Codex quota than always using the forge lane. The estimate uses the policy’s model and reasoning-effort weights. A separate live test measured 54,458 input tokens with Sift-selected models versus 59,654 with the fixed model across three short questions, with 3/3 correct in both cases.",
    benchmark: "See the routing benchmark and its methodology",
  },
  es: {
    title: "Cómo reducir el consumo de tokens en Codex CLI",
    description: "Elegí el modelo según la tarea, acotá el contexto y compará la selección manual con Codex Sift.",
    intro: "Empezá por ajustar el modelo y el esfuerzo de razonamiento a la tarea. Explicar un archivo, renombrar una función y migrar varios repos requieren distintos niveles de razonamiento. Reservá el modelo más potente para las tareas que lo justifican.",
    sections: [
      ["Elegí el modelo según la tarea", "Para una consulta o un cambio chico, probá primero un modelo liviano. Para una implementación habitual, elegí uno que pueda completar el cambio y correr las pruebas. Para un diagnóstico difícil o una migración con riesgo en producción, elegí un modelo más potente. En la CLI nativa, usá /model para ver las opciones disponibles."],
      ["Acotá el contexto", "Pasale a Codex los archivos relevantes y definí cómo comprobar que terminó la tarea. Cuando cambies de tema, iniciá una sesión nueva con un resumen corto de decisiones y rutas relevantes. Revisá el consumo antes y después de tareas comparables. Medí por separado el cupo del plan y los cargos de API."],
      ["Medí antes de cambiar tus valores por defecto", "Elegí tareas que repetís, como explicar un archivo, hacer un cambio acotado y diagnosticar un problema difícil. Corré cada una en una sesión nueva y desde el mismo estado inicial. Anotá el modelo, esfuerzo, consumo, tiempo y si la respuesta o el cambio pasó tu verificación. Repetí las pruebas cuando puedas, porque la caché y las respuestas pueden variar."],
      ["Automatizá la elección con Codex Sift", "Sift clasifica cada turno con TypeSafe Jev y elige el modelo y el esfuerzo según una política YAML. Seguís usando la CLI nativa de Codex. Instalá Node.js 20+ y Codex CLI, tené a mano tu clave de TypeSafe y ejecutá la configuración. Usá npx codex-sift para iniciar la sesión. Después de una consulta o un cambio chico, probá npx codex-sift explain para ver por qué eligió ese modelo."],
    ],
    result: "En una prueba de routing con 12 solicitudes, Codex Sift usó un 48,8% menos de cuota estimada de Codex frente a usar siempre la vía forge. La estimación usa los pesos de modelo y esfuerzo de razonamiento de la política. En una prueba real separada, los modelos elegidos por Sift usaron 54.458 tokens de entrada frente a 59.654 con el modelo fijo en tres preguntas cortas, con 3/3 aciertos en ambos casos.",
    benchmark: "Ver el benchmark de routing y su metodología",
  },
} as const;
