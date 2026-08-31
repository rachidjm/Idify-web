(function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);

  /* Debe coincidir con PLANES en netlify/functions/_usuarios.mjs */
  const PLANES = {
    gratis: { nombre: "Gratis", creditos: 10, precio: 0 },
    pro: { nombre: "Pro", creditos: 200, precio: 19 },
    empresa: { nombre: "Empresa", creditos: 1000, precio: 59 },
  };

  const ACCION_LABEL = {
    registro: "Registro de cuenta",
    "generar-prompt": "Generación — Prompt",
    "generar-skill": "Generación — Skill",
    "corregir-prompt": "Corrección de sección",
    "corregir-skill": "Corrección de sección",
    renovacion: "Renovación de plan",
  };

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

  function fmtFecha(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  }

  function accionLabel(accion) {
    if (ACCION_LABEL[accion]) return ACCION_LABEL[accion];
    if (accion.startsWith("checkout-")) return "Cambio de plan (simulado)";
    if (accion.startsWith("cancelar")) return "Cancelación de plan";
    return accion;
  }

  function render(session) {
    $("#creditsCount").textContent = session.creditos;
    $("#accountEmail").textContent = session.email;
    $("#accountHeaderEmail").textContent = session.email;

    const plan = PLANES[session.plan] || PLANES.gratis;
    $("#planName").textContent = plan.nombre;
    $("#planPrice").textContent = plan.precio === 0 ? "0 €/mes" : plan.precio + " €/mes";
    $("#planRenewal").textContent = session.renovacion ? fmtFecha(session.renovacion) : "—";

    $("#creditsLabel").textContent = session.creditos + " / " + plan.creditos;
    const pct = Math.max(0, Math.min(100, (session.creditos / plan.creditos) * 100));
    $("#creditsBarFill").style.width = pct + "%";

    $("#cancelPlanBtn").hidden = session.plan === "gratis";

    const body = $("#historyBody");
    body.innerHTML = (session.historial || []).map((h) => (
      "<tr><td class=\"mono-cell\">" + fmtFecha(h.fecha) + "</td><td>" + accionLabel(h.accion) +
      "</td><td class=\"mono-cell\">" + (h.coste > 0 ? "-" + h.coste + " crédito" + (h.coste > 1 ? "s" : "") : "gratis") + "</td></tr>"
    )).join("") || "<tr><td colspan=\"3\" style=\"color:var(--text-faint);\">Todavía no hay actividad.</td></tr>";
  }

  async function boot() {
    const { ok, data } = await api("yo", { method: "GET" });
    if (!ok) { location.href = "app.html"; return; }
    render(data);

    $("#accountMenuBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      $("#accountDrop").classList.toggle("show");
    });
    document.addEventListener("click", () => $("#accountDrop").classList.remove("show"));
    $("#logoutBtn").addEventListener("click", async () => {
      await api("logout", { method: "POST" });
      location.href = "app.html";
    });

    $("#cancelPlanBtn").addEventListener("click", async () => {
      if (!window.confirm("¿Cancelar la suscripción? Volverás al plan gratis.")) return;
      const { ok: ok2, data: data2 } = await api("cancelar", { method: "POST" });
      if (!ok2) return;
      render(data2);
      $("#cancelNote").hidden = false;
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
