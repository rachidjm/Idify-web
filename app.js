(function () {
  "use strict";

  const $ = (sel, scope) => (scope || document).querySelector(sel);
  const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
  const escHTML = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pad2 = (n) => String(n).padStart(2, "0");
  function safe(fn, name) { try { return fn(); } catch (e) { console.warn("[" + name + "]", e); } }

  const STEP_ORDER = ["entender", "redactar"];
  const STEP_LABELS = { entender: "Entendiendo tu idea", redactar: "Redactando el resultado" };

  const state = {
    session: null,
    preset: "prompt",
    secciones: [],
    recognition: null,
    recording: false,
    liveTranscript: "",
    timerId: null,
    timerSecs: 0,
    pendingPlan: null,
    annotatedRanges: [],
    showLiveCaption: false,
    previewMode: false,
    currentMeta: null,
    plantillaActual: null,
  };

  let popoverContext = null;

  /* Nivel de dificultad de una skill (Capa 1) -> coste en créditos, etiqueta y
     posición aproximada en el medidor visual de 5 segmentos. */
  const NIVEL_COSTE_CLIENTE = { facil: 1, media: 2, dificil: 5 };

  /* Categoría detectada por la Capa 1 para el preset Skill — el usuario nunca la
     elige, solo se muestra el resultado de la clasificación como texto legible. */
  const CATEGORIA_LABEL = {
    automatizacion_servicio: "Automatización de servicio",
    creacion_pagina_producto: "Creación de página de producto",
    automatizacion_meta_ads: "Automatización de Meta Ads",
    personalizado: "Personalizado",
  };

  /* Planes de ejemplo para simular en la vista previa el modal de "sin créditos
     suficientes" sin llamar al servidor — mismo shape que PLANES en _usuarios.js. */
  const FAKE_PLANES_DEMO = {
    pro: { nombre: "Pro", creditos: 200, precio: 19 },
    empresa: { nombre: "Empresa", creditos: 1000, precio: 59 },
  };

  /* ---------- Plantillas de partida para el preset Skill — se eligen ANTES de
     hablar. Al elegir una, se precargan estas secciones; si el usuario habla
     después, la Capa 1 las ajusta/completa con lo que diga (ver _prompts.js,
     conPlantillaDePartida) sin perder lo que no contradiga explícitamente. ---------- */
  const PLANTILLAS_SKILL = {
    afiliados_amazon: {
      titulo: "Afiliados Amazon",
      secciones: [
        { id: "nombre", titulo: "Nombre de la skill", contenido: "Constructor de webs de afiliados de Amazon" },
        { id: "activacion", titulo: "Cuándo se activa", contenido: "Cuando el usuario quiera crear una web de comparativas de productos con enlaces de afiliado de Amazon para un nicho concreto." },
        { id: "pasos", titulo: "Pasos a seguir", contenido: "1. Fijar el nicho de producto y los datos que se van a comparar entre ellos (características técnicas, puntuaciones).\n2. Definir las páginas necesarias: ficha completa por producto, comparador lado a lado, categorías y alguna guía de compra.\n3. Integrar en cada botón de compra el enlace de afiliado exacto que dé el usuario.\n4. Dejar la web preparada para poblarse con más productos según lleguen más enlaces." },
        { id: "restricciones", titulo: "Restricciones", contenido: "Nunca inventar especificaciones, precios o reseñas que no vengan de una fuente real. El enlace de afiliado del usuario no se modifica ni se sustituye nunca. El aviso legal de afiliados es obligatorio en cada página." },
        { id: "formato", titulo: "Formato de salida", contenido: "Estructura de páginas y secciones necesarias, lista para iniciar la construcción real de la web." },
      ],
    },
    web_cliente: {
      titulo: "Web para cliente",
      secciones: [
        { id: "nombre", titulo: "Nombre de la skill", contenido: "Constructor de webs premium para clientes" },
        { id: "activacion", titulo: "Cuándo se activa", contenido: "Cuando el usuario quiera crear una web de aspecto profesional para vendérsela a una empresa o negocio de un sector concreto." },
        { id: "pasos", titulo: "Pasos a seguir", contenido: "1. Identificar el negocio, su sector y a qué tipo de visitante se dirige la web.\n2. Definir las secciones clave (presentación, ventajas, cómo funciona, opiniones, preguntas frecuentes, contacto) con un tono y colores acordes al sector.\n3. Decidir si conviene alguna función de inteligencia artificial que la haga más vendible (chat de dudas, calculadora, lector de documentos).\n4. Dejarla lista para publicar con su propio dominio." },
        { id: "restricciones", titulo: "Restricciones", contenido: "No presentar opiniones o testimonios inventados como si fueran reales — deben marcarse claramente como ejemplo hasta que el cliente los sustituya. Ninguna función de inteligencia artificial debe fallar en silencio: si no responde, debe decirlo con claridad." },
        { id: "formato", titulo: "Formato de salida", contenido: "Brief de diseño y funcionalidades por sección, listo para iniciar la construcción real de la web." },
      ],
    },
    micro_saas: {
      titulo: "Herramienta web",
      secciones: [
        { id: "nombre", titulo: "Nombre de la skill", contenido: "Constructor de herramientas web (micro-SaaS)" },
        { id: "activacion", titulo: "Cuándo se activa", contenido: "Cuando el usuario quiera crear una web-herramienta de un único propósito (generador, conversor, calculadora…) que funcione sin necesidad de registrarse." },
        { id: "pasos", titulo: "Pasos a seguir", contenido: "1. Definir con precisión qué hace la herramienta y qué formatos de entrada y salida acepta.\n2. La herramienta debe poder usarse nada más entrar en la web, sin cuenta ni registro.\n3. Fijar los límites honestos de la herramienta (tamaños de archivo, formatos soportados) para mostrarlos en la propia web.\n4. Añadir debajo contenido de apoyo (cómo funciona, casos de uso, preguntas frecuentes) para que la encuentren en buscadores." },
        { id: "restricciones", titulo: "Restricciones", contenido: "Todo debe funcionar en el propio navegador del visitante — nada de cuentas, base de datos ni claves de pago. Los huecos de publicidad son solo marcadores de posición, nunca anuncios reales." },
        { id: "formato", titulo: "Formato de salida", contenido: "Descripción de la herramienta, su funcionamiento y sus límites, lista para iniciar la construcción real de la web." },
      ],
    },
    portfolio: {
      titulo: "Portfolio",
      secciones: [
        { id: "nombre", titulo: "Nombre de la skill", contenido: "Constructor de portfolios personales" },
        { id: "activacion", titulo: "Cuándo se activa", contenido: "Cuando el usuario quiera una web personal que muestre su trabajo, su trayectoria o sus logros para conseguir clientes o que le contraten." },
        { id: "pasos", titulo: "Pasos a seguir", contenido: "1. Identificar el campo de la persona (ilustrador, desarrollador, músico, fotógrafo, marca personal…) para elegir la estructura adecuada.\n2. Reunir el material real: nombre, trabajos o proyectos, hitos, y una llamada a la acción clara (contratar, contactar, encargar).\n3. Construir una única página con un diseño coherente con su campo, donde el trabajo sea el protagonista." },
        { id: "restricciones", titulo: "Restricciones", contenido: "Nunca inventar proyectos, cifras, premios o menciones de prensa que la persona no haya dado — toda cifra debe venir de lo que cuente el usuario. Tiene que existir siempre una única llamada a la acción clara." },
        { id: "formato", titulo: "Formato de salida", contenido: "Estructura de secciones adaptada al perfil de la persona, lista para iniciar la construcción real de la web." },
      ],
    },
    saas_suscripcion: {
      titulo: "SaaS con suscripción",
      secciones: [
        { id: "nombre", titulo: "Nombre de la skill", contenido: "Constructor de SaaS con IA y suscripción" },
        { id: "activacion", titulo: "Cuándo se activa", contenido: "Cuando el usuario quiera crear una aplicación web de pago que use inteligencia artificial, con cuentas, créditos y planes de suscripción." },
        { id: "pasos", titulo: "Pasos a seguir", contenido: "1. Definir qué hace exactamente el producto de inteligencia artificial y con qué tipo de archivo o dato trabaja.\n2. Definir el plan gratuito y los planes de pago: precio, créditos al mes, y qué consume un crédito.\n3. La inteligencia artificial debe funcionar de verdad desde el primer momento — solo el cobro se simula al principio, y de forma bien visible.\n4. Dejar preparada una cuenta de prueba para comprobar el recorrido completo, de principio a fin." },
        { id: "restricciones", titulo: "Restricciones", contenido: "La clave de la inteligencia artificial nunca debe llegar al navegador del usuario. Los créditos se comprueban y se descuentan siempre en el servidor, nunca solo en pantalla. Ningún documento subido por el usuario se guarda más tiempo del necesario." },
        { id: "formato", titulo: "Formato de salida", contenido: "Definición del producto, de los planes y del recorrido de prueba, lista para iniciar la construcción real de la app." },
      ],
    },
  };

  /* ---------- Datos de ejemplo — solo para revisar el diseño de las dos
     funciones nuevas (texto anotado + ficha de skill) sin gastar cuota de
     IA. No llama nunca a /api/generar ni /api/corregir mientras está activa. ---------- */
  const MOCK = {
    prompt: {
      secciones: [
        { id: "rol", titulo: "Rol", contenido: "Actúas como un diseñador de producto UX/UI especializado en comparadores online de bicicletas eléctricas." },
        { id: "contexto", titulo: "Contexto", contenido: "Se pide una aplicación web que permita comparar bicicletas por autonomía, tipo de ruta y precio, con una paleta de blanco, verde y gris oscuro." },
        { id: "tarea", titulo: "Tarea principal", contenido: "Diseñar la estructura, las funcionalidades clave y la línea visual del comparador, detallando cada ficha de producto y su capacidad/autonomía." },
        { id: "restricciones", titulo: "Restricciones", contenido: "La paleta de la interfaz debe limitarse a blanco, verde y tonos oscuros. El tono debe transmitir profesionalismo y un enfoque deportivo." },
        { id: "formato", titulo: "Formato de salida", contenido: "Documento de especificación estructurado, listo para entregar a un equipo de desarrollo." },
      ],
      resultado: [
        "Actúa como un diseñador de producto UX/UI especializado en comparadores online de bicicletas eléctricas.",
        "### Contexto",
        "Se pide una aplicación web que permita comparar bicicletas por autonomía, tipo de ruta y precio, con una paleta de blanco, verde y gris oscuro.",
        "### Tarea principal",
        "Diseña la estructura, las funcionalidades clave y la línea visual del comparador, detallando cada ficha de producto y su capacidad o autonomía.",
        "### Restricciones",
        "- La paleta de la interfaz debe limitarse a: blanco, verde y tonos oscuros.\n- El tono debe transmitir profesionalismo y un enfoque deportivo.",
        "### Formato de salida",
        "Genera un documento de especificación estructurado, listo para entregar a un equipo de desarrollo.",
      ].join("\n\n"),
    },
    skillNiveles: {
      facil: {
        secciones: [
          { id: "nombre", titulo: "Nombre de la skill", contenido: "resumen-de-reunion" },
          { id: "activacion", titulo: "Cuándo se activa", contenido: "Cuando el usuario pega la transcripción de una reunión y pide un resumen con los puntos clave." },
          { id: "pasos", titulo: "Pasos a seguir", contenido: "1. Leer la transcripción completa.\n2. Extraer decisiones y tareas asignadas.\n3. Redactar un resumen breve." },
          { id: "restricciones", titulo: "Restricciones", contenido: "No inventar decisiones que no aparezcan en el texto." },
          { id: "formato", titulo: "Formato de salida", contenido: "Lista de decisiones, lista de tareas con responsable, resumen de 3 líneas." },
        ],
        resultado: [
          "---",
          "name: resumen-de-reunion",
          "description: Cuando el usuario pega la transcripción de una reunión y pide un resumen con los puntos clave.",
          "---",
          "",
          "## Pasos",
          "1. Leer la transcripción completa.\n2. Extraer decisiones y tareas asignadas.\n3. Redactar un resumen breve.",
          "## Restricciones",
          "No inventar decisiones que no aparezcan en el texto.",
          "## Formato de salida",
          "Lista de decisiones, lista de tareas con responsable, resumen de 3 líneas.",
        ].join("\n\n"),
        categoria: "personalizado",
      },
      media: {
        secciones: [
          { id: "nombre", titulo: "Nombre de la skill", contenido: "asistente-soporte-nivel1" },
          { id: "activacion", titulo: "Cuándo se activa", contenido: "Cuando un cliente escribe al chat de soporte preguntando por el estado de su pedido o pidiendo ayuda con un problema común." },
          { id: "pasos", titulo: "Pasos a seguir", contenido: "1. Identificar si la consulta es sobre estado de pedido, devolución o incidencia técnica.\n2. Responder con un tono cercano y profesional, citando la política correspondiente.\n3. Si el cliente muestra frustración o el problema no tiene solución estándar, escalar a un humano de inmediato." },
          { id: "restricciones", titulo: "Restricciones", contenido: "Nunca prometer reembolsos ni plazos que no estén confirmados en la política oficial. No inventar números de seguimiento." },
          { id: "formato", titulo: "Formato de salida", contenido: "Respuesta breve en el mismo canal del cliente, con un cierre que ofrezca ayuda adicional." },
        ],
        resultado: [
          "---",
          "name: asistente-soporte-nivel1",
          "description: Cuando un cliente escribe al chat de soporte preguntando por el estado de su pedido o pidiendo ayuda con un problema común.",
          "---",
          "",
          "## Pasos",
          "1. Identificar si la consulta es sobre estado de pedido, devolución o incidencia técnica.\n2. Responder con un tono cercano y profesional, citando la política correspondiente.\n3. Si el cliente muestra frustración o el problema no tiene solución estándar, escalar a un humano de inmediato.",
          "## Restricciones",
          "Nunca prometer reembolsos ni plazos que no estén confirmados en la política oficial. No inventar números de seguimiento.",
          "## Ejemplo",
          "Cliente: \"llevo una semana esperando mi pedido\" -> Responder con el estado si se conoce, disculpa breve, y ofrecer escalar si supera el plazo de la política.",
          "## Formato de salida",
          "Respuesta breve en el mismo canal del cliente, con un cierre que ofrezca ayuda adicional.",
        ].join("\n\n"),
        categoria: "automatizacion_servicio",
      },
      dificil: {
        secciones: [
          { id: "nombre", titulo: "Nombre de la skill", contenido: "gestor-campanas-meta-ads" },
          { id: "activacion", titulo: "Cuándo se activa", contenido: "Cuando el usuario pide crear o ajustar una campaña de anuncios en Meta (Facebook/Instagram) a partir de un objetivo de negocio." },
          { id: "pasos", titulo: "Pasos a seguir", contenido: "1. Definir el objetivo de la campaña (tráfico, conversiones o reconocimiento de marca).\n2. Construir la segmentación de audiencia siguiendo reference/segmentos.md.\n3. Elegir el formato de anuncio más adecuado con templates/formatos-anuncio.md.\n4. Calcular el presupuesto mínimo de prueba con scripts/calculadora_presupuesto.py." },
          { id: "restricciones", titulo: "Restricciones", contenido: "No prometer resultados de conversión garantizados. Siempre proponer primero un presupuesto de prueba antes de escalar el gasto." },
          { id: "formato", titulo: "Formato de salida", contenido: "Brief de campaña en Markdown con objetivo, audiencia, formato de anuncio elegido, presupuesto sugerido y métricas a vigilar según el objetivo." },
        ],
        resultado: [
          "---",
          "name: gestor-campanas-meta-ads",
          "description: Cuando el usuario pide crear o ajustar una campaña de anuncios en Meta (Facebook/Instagram) a partir de un objetivo de negocio.",
          "---",
          "",
          "## Pasos",
          "1. Definir el objetivo de la campaña (tráfico, conversiones o reconocimiento de marca).\n2. Construir la segmentación de audiencia siguiendo reference/segmentos.md.\n3. Elegir el formato de anuncio más adecuado con templates/formatos-anuncio.md.\n4. Calcular el presupuesto mínimo de prueba con scripts/calculadora_presupuesto.py.",
          "## Restricciones",
          "No prometer resultados de conversión garantizados. Siempre proponer primero un presupuesto de prueba antes de escalar el gasto.",
          "## Formato de salida",
          "Brief de campaña en Markdown con objetivo, audiencia, formato de anuncio elegido, presupuesto sugerido y métricas a vigilar según el objetivo.",
        ].join("\n\n"),
        categoria: "automatizacion_meta_ads",
        archivos: [
          { ruta: "reference/segmentos.md", contenido: "# Segmentos de audiencia\n\n- Intención de compra alta: visitó la web en los últimos 30 días\n- Similar a clientes: lookalike 1-3% sobre compradores\n- Reconocimiento: intereses amplios del sector, sin remarketing" },
          { ruta: "templates/formatos-anuncio.md", contenido: "# Formatos de anuncio\n\n- Imagen única: para reconocimiento de marca\n- Carrusel: para catálogo de varios productos\n- Video corto (<15s): para tráfico y conversiones" },
          { ruta: "scripts/calculadora_presupuesto.py", contenido: "# Ejemplo simulado — no se ejecuta de verdad en esta vista previa.\ndef presupuesto_prueba(objetivo, dias=7):\n    base = {'trafico': 5, 'conversiones': 10, 'reconocimiento': 3}\n    return base.get(objetivo, 5) * dias" },
        ],
      },
    },
  };

  /* ---------- API ---------- */
  async function api(path, options) {
    const res = await fetch("/api/" + path, {
      credentials: "include",
      headers: { "content-type": "application/json" },
      ...options,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
  }

  /* ---------- Sesión / topbar ---------- */
  async function refreshSession() {
    const { ok, data } = await api("yo", { method: "GET" });
    state.session = ok ? data : null;
    renderTopbar();
    return state.session;
  }

  function renderTopbar() {
    const loggedIn = $("#topbarLoggedIn");
    const loggedOut = $("#topbarLoggedOut");
    if (state.session) {
      loggedIn.hidden = false;
      loggedOut.hidden = true;
      $("#creditsCount").textContent = state.session.creditos;
      $("#accountEmail").textContent = state.session.email;
    } else {
      loggedIn.hidden = true;
      loggedOut.hidden = false;
    }
  }

  function showAuth() {
    $("#authWrap").hidden = false;
    $("#toolShell").classList.remove("show");
  }
  function showTool() {
    $("#authWrap").hidden = true;
    $("#toolShell").classList.add("show");
    // El indicador del preset se posiciona con JS (offsetLeft/offsetWidth) — solo es
    // preciso una vez el panel es visible, así que se recalcula justo al mostrarlo.
    actualizarIndicadorPreset();
  }

  /* ---------- Auth form ---------- */
  let authMode = "registro";
  function setAuthMode(mode) {
    authMode = mode;
    $("#authError").classList.remove("show");
    if (mode === "registro") {
      $("#authTitle").textContent = "Crea tu cuenta";
      $("#authSubmit").textContent = "Crear cuenta";
      $("#authSwitchLabel").textContent = "¿Ya tienes cuenta?";
      $("#authSwitchBtn").textContent = "Inicia sesión";
      $("#authPasswordHint").hidden = false;
    } else {
      $("#authTitle").textContent = "Inicia sesión";
      $("#authSubmit").textContent = "Entrar";
      $("#authSwitchLabel").textContent = "¿No tienes cuenta?";
      $("#authSwitchBtn").textContent = "Crea una";
      $("#authPasswordHint").hidden = true;
    }
  }

  async function handleAuthSubmit(ev) {
    ev.preventDefault();
    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;
    const btn = $("#authSubmit");
    btn.disabled = true;
    $("#authError").classList.remove("show");

    const { ok, data } = await api(authMode === "registro" ? "registro" : "login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    btn.disabled = false;
    if (!ok) {
      $("#authError").textContent = (data && data.error) || "Algo falló. Prueba de nuevo.";
      $("#authError").classList.add("show");
      return;
    }
    state.session = data;
    renderTopbar();
    showTool();
  }

  /* ---------- Preset ---------- */
  function actualizarIndicadorPreset() {
    const activo = $(".preset-seg button.active", $("#presetSeg"));
    const ind = $("#presetIndicator");
    if (!activo || !ind) return;
    ind.style.left = activo.offsetLeft + "px";
    ind.style.width = activo.offsetWidth + "px";
  }

  function setPreset(p) {
    state.preset = p;
    $$(".preset-seg button", $("#presetSeg")).forEach((b) => b.classList.toggle("active", b.dataset.preset === p));
    actualizarIndicadorPreset();

    $("#mockPreviewWrapPrompt").hidden = p !== "prompt";
    $("#mockPreviewWrapSkill").hidden = p !== "skill";
    $("#templateSection").hidden = p !== "skill";
  }

  /* ---------- Plantillas de partida (preset Skill) ---------- */
  function seleccionarPlantilla(key) {
    state.plantillaActual = key || null;
    $$(".template-card", $("#templateGrid")).forEach((el) => {
      el.classList.toggle("is-selected", (el.dataset.template || null) === state.plantillaActual);
    });
    const hint = $("#templateHint");
    if (state.plantillaActual) {
      hint.textContent = "Plantilla cargada: " + PLANTILLAS_SKILL[state.plantillaActual].titulo + " — habla para completarla o corregirla.";
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  function toggleFallback() { $("#fallbackBox").classList.toggle("show"); }
  function toggleTranscript() { $("#transcriptBox").classList.toggle("show"); }

  function toggleLiveCaption() {
    state.showLiveCaption = !state.showLiveCaption;
    $("#liveCaptionToggle").setAttribute("aria-pressed", String(state.showLiveCaption));
  }

  /* ---------- Voz a texto ---------- */
  const SR_SUPPORTED = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const RECOGNITION_ERROR_MESSAGES = {
    "not-allowed": "No pude acceder al micrófono — revisa los permisos del navegador.",
    "service-not-allowed": "No pude acceder al micrófono — revisa los permisos del navegador.",
    "audio-capture": "No encuentro un micrófono disponible.",
    "network": "Hubo un problema de red al reconocer tu voz.",
  };

  function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      $("#micDial").disabled = true;
      $("#micDial").title = "Tu navegador no soporta dictado por voz — escribe tu idea";
      $("#micLabel").textContent = "Tu navegador no soporta grabar — escribe tu idea";
      $("#liveCaptionToggle").disabled = true;
      $("#liveCaptionToggle").title = "No disponible sin reconocimiento de voz";
      $("#fallbackBox").classList.add("show");
      return false;
    }
    state.recognition = new SR();
    state.recognition.lang = navigator.language || "es-ES";
    state.recognition.interimResults = true;
    state.recognition.continuous = true;
    state.recognition.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk;
        else interimText += chunk;
      }
      if (finalText) state.liveTranscript = (state.liveTranscript + " " + finalText).trim();
      if (state.showLiveCaption) {
        $("#liveCaption").textContent = (state.liveTranscript + " " + interimText).trim();
      }
    };
    state.recognition.onerror = (e) => {
      if (!state.recording) return;
      const err = e && e.error;
      if (RECOGNITION_ERROR_MESSAGES[err]) {
        setStatus(RECOGNITION_ERROR_MESSAGES[err] + " Prueba a escribir tu idea.");
        cancelRecording();
        $("#fallbackBox").classList.add("show");
        return;
      }
      if (err === "no-speech" && !state.liveTranscript.trim()) {
        setStatus("No te escuché. Prueba de nuevo o escribe tu idea.");
        cancelRecording();
        return;
      }
      // Errores leves (p. ej. un corte de silencio en medio de una frase larga):
      // si ya hay algo dicho, se comporta como si hubieras tocado "terminar".
      finishRecording();
    };
    return true;
  }

  function toggleMic() {
    if (!state.recognition && !initRecognition()) return;
    if (state.recording) finishRecording();
    else startRecording();
  }

  function startRecording() {
    state.liveTranscript = "";
    state.recording = true;
    state.timerSecs = 0;
    $("#micDial").classList.add("is-live");
    $("#micDial").setAttribute("aria-pressed", "true");
    $("#recorder").classList.add("is-live");
    $("#micLabel").textContent = "Escuchando… toca para terminar";
    $("#micTime").textContent = "00:00";
    $("#fallbackToggle").hidden = true;
    $("#cancelRecordingBtn").hidden = false;
    if (state.showLiveCaption) {
      $("#liveCaption").hidden = false;
      $("#liveCaption").textContent = "";
    }
    state.timerId = setInterval(() => {
      state.timerSecs++;
      $("#micTime").textContent = pad2(Math.floor(state.timerSecs / 60)) + ":" + pad2(state.timerSecs % 60);
    }, 1000);
    safe(() => state.recognition.start(), "recognition.start");
  }

  function finishRecording() {
    state.recording = false;
    clearInterval(state.timerId);
    $("#micDial").classList.remove("is-live");
    $("#micDial").setAttribute("aria-pressed", "false");
    $("#recorder").classList.remove("is-live");
    $("#micLabel").textContent = "Toca para hablar";
    $("#liveCaption").hidden = true;
    $("#fallbackToggle").hidden = false;
    $("#cancelRecordingBtn").hidden = true;
    safe(() => state.recognition.stop(), "recognition.stop");
    setTimeout(() => {
      if (state.liveTranscript.trim()) procesarPipeline(state.liveTranscript.trim());
    }, 300);
  }

  function cancelRecording() {
    if (!state.recording) return;
    state.recording = false;
    state.liveTranscript = "";
    clearInterval(state.timerId);
    $("#micDial").classList.remove("is-live");
    $("#micDial").setAttribute("aria-pressed", "false");
    $("#recorder").classList.remove("is-live");
    $("#micLabel").textContent = "Toca para hablar";
    $("#liveCaption").hidden = true;
    $("#fallbackToggle").hidden = false;
    $("#cancelRecordingBtn").hidden = true;
    // abort() descarta el audio en curso — a diferencia de stop(), no dispara
    // un último resultado final, así que la idea cancelada nunca llega a procesarPipeline.
    safe(() => state.recognition.abort(), "recognition.abort");
  }

  /* ---------- Pasos ---------- */
  function renderSteps(activeKey, doneKeys) {
    const panel = $("#stepsPanel");
    panel.innerHTML = STEP_ORDER.map((key) => {
      const done = doneKeys.includes(key);
      const active = key === activeKey;
      const cls = done ? "is-done" : active ? "is-active" : "";
      const icon = done
        ? '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : active ? '<span class="step-spinner"></span>' : "";
      return '<div class="step-row ' + cls + '"><span class="icon">' + icon + "</span><span>" + STEP_LABELS[key] + "</span></div>";
    }).join("");
  }

  /* ---------- Pipeline principal ---------- */
  async function procesarPipeline(idea) {
    if (!idea) return;
    state.previewMode = false;
    $("#fallbackBox").classList.remove("show");
    $("#resultsGrid").classList.remove("show");
    $("#resultsDesktop").classList.remove("show");
    hidePopover();
    $("#stepsPanel").hidden = false;
    $("#stepsPanel").classList.add("show");
    $("#transcriptToggleWrap").hidden = false;
    $("#transcriptBox").textContent = idea;
    setStatus("");

    renderSteps("entender", []);

    const payload = { idea, preset: state.preset };
    if (state.preset === "skill" && state.plantillaActual) {
      payload.plantilla = PLANTILLAS_SKILL[state.plantillaActual].secciones;
      payload.plantillaId = state.plantillaActual;
    }
    const { ok, status, data } = await api("generar", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!ok) {
      $("#stepsPanel").classList.remove("show");
      $("#stepsPanel").hidden = true;
      if (status === 402) {
        openUpgradeModal(data.planes);
      } else if (status === 401) {
        showAuth();
      } else {
        setStatus((data && data.error) || "Algo falló. Prueba de nuevo.");
      }
      return;
    }

    renderSteps("redactar", ["entender"]);
    await new Promise((r) => setTimeout(r, 350)); // deja ver el paso 2 un instante, la llamada ya terminó
    renderSteps(null, ["entender", "redactar"]);

    const outputLabel = state.preset === "prompt" ? "Prompt final" : "SKILL.md";
    $("#outputLabel").textContent = outputLabel;
    $("#outputLabelDesktop").textContent = outputLabel;

    const meta = state.preset === "skill" && data.nivel
      ? { categoria: data.categoria, nivel: data.nivel, coste: data.coste, archivos: data.archivos || null, promptDeUso: data.promptDeUso || null }
      : null;
    actualizarResultado(data.secciones || [], data.resultado_final || "", meta);

    if (typeof data.creditos === "number" && state.session) {
      state.session.creditos = data.creditos;
      $("#creditsCount").textContent = data.creditos;
    }

    $("#stepsPanel").classList.remove("show");
    $("#stepsPanel").hidden = true;
    $("#resultsGrid").classList.add("show");
    $("#resultsDesktop").classList.add("show");
  }

  /* ---------- Vista previa con datos de ejemplo — no llama a ninguna IA.
     Para "skill" recibe el nivel elegido (facil/media/dificil) para poder
     revisar los 3 costes/resultados distintos del punto 1 sin gastar cuota. ---------- */
  async function mockPipeline(nivelSkill) {
    state.previewMode = true;
    $("#fallbackBox").classList.remove("show");
    $("#resultsGrid").classList.remove("show");
    $("#resultsDesktop").classList.remove("show");
    hidePopover();
    $("#transcriptToggleWrap").hidden = true;
    $("#stepsPanel").hidden = false;
    $("#stepsPanel").classList.add("show");
    setStatus("");

    renderSteps("entender", []);
    await new Promise((r) => setTimeout(r, 400));
    renderSteps("redactar", ["entender"]);
    await new Promise((r) => setTimeout(r, 400));
    renderSteps(null, ["entender", "redactar"]);

    const esSkill = state.preset === "skill";
    const nivel = esSkill ? (nivelSkill || "facil") : null;
    const mock = esSkill ? MOCK.skillNiveles[nivel] : MOCK.prompt;
    const outputLabel = state.preset === "prompt" ? "Prompt final" : "SKILL.md";
    $("#outputLabel").textContent = outputLabel;
    $("#outputLabelDesktop").textContent = outputLabel;

    const meta = esSkill
      ? { categoria: mock.categoria, nivel, coste: NIVEL_COSTE_CLIENTE[nivel], archivos: mock.archivos || null }
      : null;
    // Clonar las secciones para que corregirlas en la vista previa nunca mute el objeto MOCK original.
    actualizarResultado(JSON.parse(JSON.stringify(mock.secciones)), mock.resultado, meta);

    $("#stepsPanel").classList.remove("show");
    $("#stepsPanel").hidden = true;
    $("#resultsGrid").classList.add("show");
    $("#resultsDesktop").classList.add("show");
    setStatus("Datos de ejemplo — nada de esto ha llamado a Gemini ni a Claude.");
    setTimeout(() => setStatus(""), 3000);
  }

  /* ---------- Simula el modal de "sin créditos suficientes" sin llamar al servidor. ---------- */
  function mockSimularSinCreditos() {
    openUpgradeModal(FAKE_PLANES_DEMO);
    setStatus("Simulado — no ha llamado a ningún servidor.");
    setTimeout(() => setStatus(""), 2500);
  }

  /* ---------- Corrección simulada (vista previa) — nunca llama a la IA.
     Sustituye el contenido antiguo de la sección por el nuevo directamente
     en el texto final, para poder revisar el recoloreado sin gastar cuota. ---------- */
  function mockCorregir(id, correccion) {
    const sec = state.secciones.find((s) => s.id === id);
    if (!sec) return;
    const anterior = sec.contenido;
    sec.contenido = correccion;
    let nuevoResultado = $("#finalOutput").textContent;
    if (anterior && nuevoResultado.includes(anterior)) {
      nuevoResultado = nuevoResultado.replace(anterior, correccion);
    }
    // meta sin pasar (undefined) -> actualizarResultado reutiliza state.currentMeta tal cual.
    actualizarResultado(state.secciones, nuevoResultado);
    setStatus("Corrección simulada — no ha llamado a ninguna IA.");
    setTimeout(() => setStatus(""), 2200);
  }

  /* ---------- Secciones y corrección ---------- */
  function renderSecciones() {
    const list = $("#sectionsList");
    list.innerHTML = "";
    state.secciones.forEach((s, i) => {
      const card = document.createElement("div");
      card.className = "section-item";
      card.innerHTML =
        '<div class="section-head"><span class="section-tag"><b>' + pad2(i + 1) + "</b> / " + escHTML(s.titulo.toUpperCase()) + '</span>' +
        '<svg class="section-chevron" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
        '<div class="section-content">' + escHTML(s.contenido) + '</div>' +
        '<div class="correct-box" id="cbox-' + s.id + '">' +
        '<textarea id="ctext-' + s.id + '" placeholder="Explica (o dicta) qué está mal en esta sección…"></textarea>' +
        '<div class="row">' +
        '<button type="button" class="btn btn--ghost btn--sm mic-mini" data-mic-section="' + s.id + '"' + (SR_SUPPORTED ? "" : " disabled title=\"Tu navegador no soporta dictado por voz\"") + '>' +
        '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.75"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>' +
        "Hablar</button>" +
        '<button type="button" class="btn btn--primary btn--sm" data-apply-section="' + s.id + '">Aplicar corrección</button>' +
        "</div></div>";

      card.querySelector(".section-head").addEventListener("click", () => {
        $("#cbox-" + s.id).classList.toggle("show");
        card.classList.toggle("open");
      });
      list.appendChild(card);
    });

    list.querySelectorAll("[data-mic-section]").forEach((btn) => {
      btn.addEventListener("click", (ev) => { ev.stopPropagation(); micParaSeccion(btn.dataset.micSection, btn); });
    });
    list.querySelectorAll("[data-apply-section]").forEach((btn) => {
      btn.addEventListener("click", (ev) => { ev.stopPropagation(); corregirSeccion(btn.dataset.applySection); });
    });
  }

  function micParaSeccion(id, btn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = navigator.language || "es-ES";
    btn.classList.add("is-live");
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      const ta = $("#ctext-" + id);
      ta.value = (ta.value.trim() + " " + t).trim();
    };
    rec.onend = () => btn.classList.remove("is-live");
    rec.onerror = () => btn.classList.remove("is-live");
    safe(() => rec.start(), "recognition.start(seccion)");
  }

  async function corregirSeccion(id) {
    const correccion = $("#ctext-" + id).value.trim();
    if (!correccion) return;
    if (state.previewMode) { mockCorregir(id, correccion); return; }
    setStatus("Aplicando corrección…");

    const { ok, status, data } = await api("corregir", {
      method: "POST",
      body: JSON.stringify({ secciones: state.secciones, id, correccion, preset: state.preset }),
    });

    if (!ok) {
      if (status === 401) { showAuth(); return; }
      setStatus((data && data.error) || "No se pudo aplicar la corrección.");
      return;
    }

    actualizarResultado(data.secciones, data.resultado_final);
    setStatus("Corrección aplicada — resultado actualizado.");
    setTimeout(() => setStatus(""), 1800);
  }

  /* ---------- Resultado en escritorio: mismo dato, dos vistas siempre en sincronía.
     Si "meta" no se pasa (undefined), se reutiliza la meta ya guardada — así una
     corrección de sección no hace desaparecer la ficha de nivel/coste ni las cajas
     de uso/archivos, aunque corregir.js no devuelva esos campos. ---------- */
  function actualizarResultado(secciones, resultadoFinal, meta) {
    state.secciones = secciones;
    if (meta !== undefined) state.currentMeta = meta;
    const metaActual = state.currentMeta;

    $("#finalOutput").textContent = resultadoFinal;
    renderSecciones();
    renderAnnotatedOutput(secciones, resultadoFinal);
    renderSectionsListDesktopLegend(secciones);

    if (metaActual && metaActual.nivel) {
      mostrarFichaSkill(metaActual);
      mostrarUsoSkill(secciones, metaActual.promptDeUso);
      mostrarArchivosSkill(metaActual.archivos);
    } else {
      ocultarFichaSkill();
      ocultarUsoSkill();
      ocultarArchivosSkill();
    }
  }

  /* ---------- Ficha técnica de la Skill: categoría (chip) + coste real en créditos
     (puntos + texto). La dificultad (fácil/media/difícil) sigue detectándose por
     dentro — decide el coste — pero deliberadamente nunca se le muestra al usuario
     con esa etiqueta, solo el coste resultante. ---------- */
  function mostrarFichaSkill(meta) {
    $("#skillCategoryChip").hidden = false;
    $("#skillCategoryChip").textContent = CATEGORIA_LABEL[meta.categoria] || CATEGORIA_LABEL.personalizado;

    const coste = meta.coste || NIVEL_COSTE_CLIENTE[meta.nivel] || 1;
    dibujarPuntosCoste(coste);
    $("#creditGaugeLabel").textContent = coste + (coste === 1 ? " crédito" : " créditos");

    $("#skillInfoCard").hidden = false;
    $("#skillInfoCard").classList.add("show");
  }
  function ocultarFichaSkill() {
    $("#skillInfoCard").hidden = true;
    $("#skillInfoCard").classList.remove("show");
  }

  /* ---------- "Prompt para usar esta skill" — si se eligió una plantilla, el servidor
     ya la redactó con IA (Capa 3, ver generar.js) usando el Prompt.txt de esa skill como
     referencia de estructura. Si no hay plantilla (o la IA falló), se construye sin IA
     con datos que ya existen en las secciones, como antes. ---------- */
  function construirPromptDeUso(secciones) {
    const nombre = ((secciones.find((s) => s.id === "nombre") || {}).contenido || "").trim();
    let tarea = ((secciones.find((s) => s.id === "activacion") || {}).contenido || "").trim();
    if (tarea.endsWith(".")) tarea = tarea.slice(0, -1);
    return 'Usa la skill "' + nombre + '" para lo siguiente: ' + tarea + '.' +
      '\n\nSi no la tienes instalada todavía, instala primero el SKILL.md que acabas de descargar.';
  }
  function mostrarUsoSkill(secciones, promptDeUso) {
    $("#usoSkillOutput").textContent = promptDeUso || construirPromptDeUso(secciones);
    $("#usoSkillCard").hidden = false;
  }
  function ocultarUsoSkill() { $("#usoSkillCard").hidden = true; }

  /* ---------- Archivos adicionales del paquete (nivel difícil) ---------- */
  function mostrarArchivosSkill(archivos) {
    const card = $("#archivosSkillCard");
    if (!archivos || !archivos.length) { card.hidden = true; state.currentArchivos = null; return; }
    state.currentArchivos = archivos;
    $("#archivosSkillList").innerHTML = archivos.map((a, i) =>
      '<div class="archivo-item"><span>' + escHTML(a.ruta) + '</span>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-download-archivo="' + i + '">Descargar</button></div>'
    ).join("");
    $$("[data-download-archivo]", card).forEach((btn) => {
      btn.addEventListener("click", () => descargarArchivo(archivos[Number(btn.dataset.downloadArchivo)]));
    });
    card.hidden = false;
  }
  function ocultarArchivosSkill() { $("#archivosSkillCard").hidden = true; state.currentArchivos = null; }

  function descargarArchivo(archivo) {
    const blob = new Blob([archivo.contenido || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = archivo.ruta.split("/").pop();
    a.click();
    URL.revokeObjectURL(url);
  }

  function descargarZipSkillActual() {
    if (!state.currentArchivos || !state.currentArchivos.length) return;
    const filename = state.preset === "prompt" ? "prompt.md" : "SKILL.md";
    const archivos = [{ ruta: filename, contenido: $("#finalOutput").textContent }, ...state.currentArchivos];
    descargarBlobComoArchivo(construirZip(archivos), "skill.zip");
  }

  /* ---------- ZIP mínimo (método STORE, sin compresión) para "Descargar todo (ZIP)".
     Sin dependencias — la app no usa bundler, así que se escribe a mano el formato
     ZIP local-header + central-directory + end-of-central-directory. ---------- */
  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      let c = (crc ^ bytes[i]) & 0xFF;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function u16(n) { return [n & 0xFF, (n >> 8) & 0xFF]; }
  function u32(n) { return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]; }

  function construirZip(archivos) {
    const encoder = new TextEncoder();
    const partesLocal = [];
    const partesCentral = [];
    let offset = 0;

    archivos.forEach((a) => {
      const nombre = encoder.encode(a.ruta);
      const datos = encoder.encode(a.contenido || "");
      const crc = crc32(datos);

      const local = new Uint8Array([
        0x50, 0x4B, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(datos.length), ...u32(datos.length),
        ...u16(nombre.length), ...u16(0),
      ]);
      partesLocal.push(local, nombre, datos);

      const central = new Uint8Array([
        0x50, 0x4B, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(crc), ...u32(datos.length), ...u32(datos.length),
        ...u16(nombre.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
        ...u32(0), ...u32(offset),
      ]);
      partesCentral.push(central, nombre);
      offset += local.length + nombre.length + datos.length;
    });

    const centralSize = partesCentral.reduce((s, p) => s + p.length, 0);
    const centralOffset = offset;
    const fin = new Uint8Array([
      0x50, 0x4B, 0x05, 0x06, ...u16(0), ...u16(0),
      ...u16(archivos.length), ...u16(archivos.length),
      ...u32(centralSize), ...u32(centralOffset), ...u16(0),
    ]);

    return new Blob([...partesLocal, ...partesCentral, fin], { type: "application/zip" });
  }

  function descargarBlobComoArchivo(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function dibujarPuntosCoste(coste) {
    const nivelVisual = Math.max(1, Math.min(5, coste));
    $$(".credit-dot", $("#creditDots")).forEach((dot, i) => {
      dot.classList.toggle("is-filled", i < nivelVisual);
    });
    $("#creditGauge").title = "Coste de esta generación: " + coste + (coste === 1 ? " crédito" : " créditos");
  }

  /* ---------- Detección aproximada de a qué sección pertenece cada trozo del texto final.
     Heurística por solapamiento de palabras — no hay marcadores exactos porque el motor
     de redacción (06-recipe-voz-a-prompt.md) no se toca ni se le pide que los emita. ---------- */
  const STOPWORDS = new Set(["que","para","con","los","las","del","una","uno","por","como","este","esta","estos",
    "estas","sus","tus","mis","pero","sin","sobre","entre","desde","hasta","cuando","donde","cual","cuales",
    "muy","mas","más","menos","todo","toda","todos","todas","otro","otra","the","and","for","with","tu","su","al","lo"]);

  function normalizarPalabras(texto) {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  }

  function mapearSeccionesATexto(secciones, texto) {
    const bloques = [];
    const re = /\n{2,}/g;
    let last = 0, m;
    while ((m = re.exec(texto))) {
      bloques.push({ start: last, end: m.index });
      bloques.push({ start: m.index, end: m.index + m[0].length, gap: true });
      last = m.index + m[0].length;
    }
    bloques.push({ start: last, end: texto.length });

    const seccionPalabras = secciones.map((s) => new Set(normalizarPalabras(s.titulo + " " + s.contenido)));

    const asignados = bloques.map((b) => {
      if (b.gap) return { start: b.start, end: b.end, sectionIdx: -1 };
      const palabrasBloque = normalizarPalabras(texto.slice(b.start, b.end));
      if (!palabrasBloque.length) return { start: b.start, end: b.end, sectionIdx: -1 };
      let mejorIdx = -1, mejorScore = 0;
      seccionPalabras.forEach((set, idx) => {
        let coincidencias = 0;
        palabrasBloque.forEach((w) => { if (set.has(w)) coincidencias++; });
        const score = coincidencias / palabrasBloque.length;
        if (score > mejorScore) { mejorScore = score; mejorIdx = idx; }
      });
      return { start: b.start, end: b.end, sectionIdx: mejorScore >= 0.12 ? mejorIdx : -1 };
    });

    const rangos = [];
    asignados.forEach((b) => {
      const prev = rangos[rangos.length - 1];
      if (prev && prev.sectionIdx === b.sectionIdx && b.start === prev.end) prev.end = b.end;
      else rangos.push({ start: b.start, end: b.end, sectionIdx: b.sectionIdx });
    });
    return rangos;
  }

  function renderAnnotatedOutput(secciones, texto) {
    const rangos = mapearSeccionesATexto(secciones, texto);
    state.annotatedRanges = rangos.map((r) => ({ ...r }));
    $("#annotatedOutput").innerHTML = rangos.map((r) => {
      const trozo = escHTML(texto.slice(r.start, r.end));
      if (r.sectionIdx === -1 || !secciones[r.sectionIdx]) return trozo;
      return '<span data-sec="' + escHTML(secciones[r.sectionIdx].id) + '" style="background:var(--tint-' + (r.sectionIdx + 1) + ')">' + trozo + "</span>";
    }).join("");

    $("#sectionLegend").innerHTML = secciones.map((s, i) =>
      '<span class="legend-item"><span class="legend-swatch" style="background:var(--tint-' + (i + 1) + ')"></span>' + escHTML(s.titulo) + "</span>"
    ).join("");
  }

  function renderSectionsListDesktopLegend(secciones) {
    $("#sectionsListDesktopLegend").innerHTML = secciones.map((s, i) =>
      '<div class="section-item"><div class="section-head" style="cursor:default;"><span class="section-tag"><b>' + pad2(i + 1) + "</b> / " + escHTML(s.titulo.toUpperCase()) + '</span></div>' +
      '<div class="section-content">' + escHTML(s.contenido) + "</div></div>"
    ).join("");
  }

  /* ---------- Popover de corrección por selección de texto (solo escritorio) ---------- */
  function offsetDentroDe(container, node, offset) {
    const r = document.createRange();
    r.selectNodeContents(container);
    r.setEnd(node, offset);
    return r.toString().length;
  }

  function hidePopover() {
    $("#selectionPopover").hidden = true;
    popoverContext = null;
  }

  function showPopover(range, ctx) {
    const rect = range.getBoundingClientRect();
    const pop = $("#selectionPopover");
    $("#popoverSection").textContent = "Corrigiendo: " + (ctx.sectionTitulo || "").toUpperCase();
    $("#popoverQuote").textContent = '"' + ctx.fragmento.slice(0, 220) + (ctx.fragmento.length > 220 ? "…" : "") + '"';
    $("#popoverInput").value = "";
    pop.hidden = false;

    let left = Math.max(16, Math.min(rect.left, document.documentElement.clientWidth - 316));
    let top = rect.bottom + 10;
    if (top > window.innerHeight - 220) top = Math.max(16, rect.top - 210);
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function initSelectionPopover() {
    const output = $("#annotatedOutput");
    if (!output) return;
    document.addEventListener("mouseup", (e) => {
      if (e.target.closest("#selectionPopover")) return;
      const sel = window.getSelection();
      const texto = sel && sel.toString().trim();
      if (!texto || sel.rangeCount === 0 || !output.contains(sel.anchorNode)) {
        hidePopover();
        return;
      }
      const range = sel.getRangeAt(0);
      const startOffset = offsetDentroDe(output, range.startContainer, range.startOffset);
      const rango = state.annotatedRanges.find((r) => startOffset >= r.start && startOffset < r.end);
      const seccion = rango && rango.sectionIdx >= 0 ? state.secciones[rango.sectionIdx] : state.secciones[0];
      if (!seccion) return;
      popoverContext = { sectionId: seccion.id, sectionTitulo: seccion.titulo, fragmento: texto };
      showPopover(range, popoverContext);
    });
  }

  function micParaPopover(btn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = navigator.language || "es-ES";
    rec.interimResults = true;
    rec.continuous = true;
    const label = $("#popoverMicLabel");
    const ta = $("#popoverInput");
    const base = ta.value.trim();
    let finalText = "";
    btn.classList.add("is-live");
    if (label) label.textContent = "Escuchando…";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = (finalText + " " + t).trim();
        else interim += t;
      }
      const acumulado = [base, finalText].filter(Boolean).join(" ");
      ta.value = [acumulado, interim.trim()].filter(Boolean).join(" ");
    };
    const parar = () => {
      btn.classList.remove("is-live");
      if (label) label.textContent = "Hablar";
    };
    rec.onend = parar;
    rec.onerror = parar;
    safe(() => rec.start(), "recognition.start(popover)");
  }

  async function aplicarCorreccionPopover() {
    if (!popoverContext) return;
    const correccion = $("#popoverInput").value.trim();
    if (!correccion) return;
    if (state.previewMode) {
      mockCorregir(popoverContext.sectionId, correccion);
      hidePopover();
      return;
    }
    setStatus("Aplicando corrección…");

    const { ok, status, data } = await api("corregir", {
      method: "POST",
      body: JSON.stringify({
        secciones: state.secciones,
        id: popoverContext.sectionId,
        correccion,
        fragmento: popoverContext.fragmento,
        preset: state.preset,
      }),
    });

    if (!ok) {
      if (status === 401) { showAuth(); return; }
      setStatus((data && data.error) || "No se pudo aplicar la corrección.");
      return;
    }

    actualizarResultado(data.secciones, data.resultado_final);
    hidePopover();
    setStatus("Corrección aplicada — resultado actualizado.");
    setTimeout(() => setStatus(""), 1800);
  }

  /* ---------- Utilidades de resultado ---------- */
  function setStatus(msg) { $("#statusMsg").textContent = msg; }

  function copiarResultado() {
    navigator.clipboard.writeText($("#finalOutput").textContent).then(() => {
      setStatus("Copiado."); setTimeout(() => setStatus(""), 1200);
    }).catch(() => setStatus("No se pudo copiar."));
  }

  function descargarResultado() {
    const text = $("#finalOutput").textContent;
    const filename = state.preset === "prompt" ? "prompt.md" : "SKILL.md";
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function reiniciar() {
    $("#resultsGrid").classList.remove("show");
    $("#resultsDesktop").classList.remove("show");
    ocultarFichaSkill();
    ocultarUsoSkill();
    ocultarArchivosSkill();
    hidePopover();
    $("#transcriptToggleWrap").hidden = true;
    $("#transcriptBox").classList.remove("show");
    $("#fallbackBox").classList.remove("show");
    $("#ideaInput").value = "";
    state.secciones = [];
    state.currentMeta = null;
    state.previewMode = false;
    seleccionarPlantilla(null);
    setStatus("");
  }

  function copiarTexto(texto) {
    navigator.clipboard.writeText(texto || "").then(() => {
      setStatus("Copiado."); setTimeout(() => setStatus(""), 1200);
    }).catch(() => setStatus("No se pudo copiar."));
  }

  /* ---------- Modal: sin créditos → elegir plan ---------- */
  function openUpgradeModal(planes) {
    const wrap = $("#upgradePlanPick");
    wrap.innerHTML = "";
    Object.keys(planes || {}).forEach((key) => {
      if (key === "gratis") return;
      const plan = planes[key];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = "<span>" + escHTML(plan.nombre) + " — " + plan.creditos + " créditos/mes</span><span class=\"price\">" + plan.precio + " €/mes</span>";
      btn.addEventListener("click", () => openCheckoutModal(key, plan));
      wrap.appendChild(btn);
    });
    $("#upgradeModal").hidden = false;
  }
  function closeUpgradeModal() { $("#upgradeModal").hidden = true; }

  /* ---------- Modal: checkout simulado ---------- */
  function openCheckoutModal(planKey, plan) {
    state.pendingPlan = planKey;
    $("#checkoutTitle").textContent = "Confirmar plan " + plan.nombre;
    $("#checkoutDesc").textContent = plan.precio + " €/mes · " + plan.creditos + " créditos/mes. Pago simulado — no se cobra nada de verdad.";
    $("#checkoutModal").hidden = false;
  }
  function closeCheckoutModal() { $("#checkoutModal").hidden = true; }

  async function confirmarCheckout() {
    if (!state.pendingPlan) return;
    const btn = $("#checkoutConfirm");
    btn.disabled = true;
    const { ok, data } = await api("checkout", {
      method: "POST",
      body: JSON.stringify({ plan: state.pendingPlan }),
    });
    btn.disabled = false;
    if (!ok) { setStatus((data && data.error) || "No se pudo simular el pago."); return; }

    state.session = data;
    renderTopbar();
    closeCheckoutModal();
    closeUpgradeModal();
    setStatus("Plan actualizado — ya puedes generar de nuevo.");
    setTimeout(() => setStatus(""), 2500);
  }

  /* ---------- Boot ---------- */
  function boot() {
    setAuthMode("registro");
    $("#authForm").addEventListener("submit", handleAuthSubmit);
    $("#authSwitchBtn").addEventListener("click", () => setAuthMode(authMode === "registro" ? "login" : "registro"));

    $("#accountMenuBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      $("#accountDrop").classList.toggle("show");
    });
    document.addEventListener("click", () => $("#accountDrop").classList.remove("show"));
    $("#logoutBtn").addEventListener("click", async () => {
      await api("logout", { method: "POST" });
      state.session = null;
      renderTopbar();
      showAuth();
    });

    $$(".preset-seg button", $("#presetSeg")).forEach((btn) => {
      btn.addEventListener("click", () => setPreset(btn.dataset.preset));
    });
    $$(".template-card", $("#templateGrid")).forEach((btn) => {
      btn.addEventListener("click", () => seleccionarPlantilla(btn.dataset.template));
    });

    safe(initRecognition, "initRecognition");
    $("#micDial").addEventListener("click", toggleMic);
    $("#cancelRecordingBtn").addEventListener("click", cancelRecording);
    buildMeter($("#micMeterLeft"), 5, 0);
    buildMeter($("#micMeterRight"), 5, 0.25);

    $("#liveCaptionToggle").addEventListener("click", toggleLiveCaption);
    $("#mockPreviewBtn").addEventListener("click", () => mockPipeline());
    $("#mockSinCreditosBtn").addEventListener("click", mockSimularSinCreditos);
    $("#copyUsoSkillBtn").addEventListener("click", () => copiarTexto($("#usoSkillOutput").textContent));
    $("#downloadZipBtn").addEventListener("click", descargarZipSkillActual);
    $("#fallbackToggle").addEventListener("click", toggleFallback);
    $("#transcriptToggleBtn").addEventListener("click", toggleTranscript);
    $("#fallbackGenerate").addEventListener("click", () => procesarPipeline($("#ideaInput").value.trim()));
    $("#copyBtn").addEventListener("click", copiarResultado);
    $("#downloadBtn").addEventListener("click", descargarResultado);
    $("#restartBtn").addEventListener("click", reiniciar);
    $("#copyBtnDesktop").addEventListener("click", copiarResultado);
    $("#downloadBtnDesktop").addEventListener("click", descargarResultado);
    $("#restartBtnDesktop").addEventListener("click", reiniciar);

    window.addEventListener("resize", actualizarIndicadorPreset);

    initSelectionPopover();
    if (!SR_SUPPORTED) {
      $("#popoverMic").disabled = true;
      $("#popoverMic").title = "Tu navegador no soporta dictado por voz";
    }
    $("#popoverMic").addEventListener("click", () => micParaPopover($("#popoverMic")));
    $("#popoverApply").addEventListener("click", aplicarCorreccionPopover);

    $("#upgradeClose").addEventListener("click", closeUpgradeModal);
    $("#upgradeModal").addEventListener("click", (e) => { if (e.target.id === "upgradeModal") closeUpgradeModal(); });
    $("#checkoutClose").addEventListener("click", closeCheckoutModal);
    $("#checkoutModal").addEventListener("click", (e) => { if (e.target.id === "checkoutModal") closeCheckoutModal(); });
    $("#checkoutConfirm").addEventListener("click", confirmarCheckout);
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!$("#checkoutModal").hidden) closeCheckoutModal();
      else if (!$("#upgradeModal").hidden) closeUpgradeModal();
      else if (!$("#selectionPopover").hidden) hidePopover();
    });

    refreshSession().then((session) => { session ? showTool() : showAuth(); });
  }

  function buildMeter(el, count, baseDelay) {
    if (!el) return;
    for (let i = 0; i < count; i++) {
      const bar = document.createElement("i");
      bar.style.animationDelay = baseDelay + i * 0.11 + "s";
      el.appendChild(bar);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
