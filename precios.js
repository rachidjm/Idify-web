(function () {
  "use strict";
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const PLAN_NOMBRES = { pro: "Pro", empresa: "Empresa" };
  let pendingPlan = null;
  let session = null;

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

  function posicionarIndicadorBilling(seg, indicator) {
    const activo = $("button.active", seg);
    if (!activo) return;
    indicator.style.left = activo.offsetLeft + "px";
    indicator.style.width = activo.offsetWidth + "px";
  }

  function initBillingToggle() {
    const seg = $("#billingSeg");
    const indicator = $("#billingIndicator");
    // El indicador se posiciona con el ancho/posición reales del botón activo — con un
    // cálculo fijo al 50% no cuadra porque "Mensual" y "Anual — 2 meses gratis" no miden
    // lo mismo.
    posicionarIndicadorBilling(seg, indicator);
    window.addEventListener("resize", () => posicionarIndicadorBilling(seg, indicator));

    $$("button", seg).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$("button", seg).forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        posicionarIndicadorBilling(seg, indicator);
        const annual = btn.dataset.period === "anual";
        $$("[data-monthly]").forEach((el) => {
          const price = annual ? el.dataset.annual : el.dataset.monthly;
          el.childNodes[0].nodeValue = price + " €";
        });
        $$("[data-period-label]").forEach((el) => {
          el.textContent = annual ? "/mes, facturado al año" : "/mes";
        });
      });
    });
  }

  function openCheckoutModal(planKey) {
    pendingPlan = planKey;
    $("#checkoutTitle").textContent = "Confirmar plan " + PLAN_NOMBRES[planKey];
    $("#checkoutDesc").textContent = "Pago simulado — no se cobra nada de verdad. Se activará al instante.";
    $("#checkoutModal").hidden = false;
  }
  function closeCheckoutModal() { $("#checkoutModal").hidden = true; }

  async function confirmarCheckout() {
    if (!pendingPlan) return;
    const btn = $("#checkoutConfirm");
    btn.disabled = true;
    const { ok } = await api("checkout", { method: "POST", body: JSON.stringify({ plan: pendingPlan }) });
    btn.disabled = false;
    if (!ok) return;
    location.href = "cuenta.html";
  }

  function initPlanButtons() {
    $$("[data-plan]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!session) { location.href = "app.html"; return; }
        openCheckoutModal(btn.dataset.plan);
      });
    });
  }

  async function boot() {
    initBillingToggle();
    initPlanButtons();
    $("#checkoutClose").addEventListener("click", closeCheckoutModal);
    $("#checkoutModal").addEventListener("click", (e) => { if (e.target.id === "checkoutModal") closeCheckoutModal(); });
    $("#checkoutConfirm").addEventListener("click", confirmarCheckout);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#checkoutModal").hidden) closeCheckoutModal(); });

    const { ok, data } = await api("yo", { method: "GET" });
    session = ok ? data : null;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
