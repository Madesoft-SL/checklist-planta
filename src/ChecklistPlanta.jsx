import { useState, useEffect, useRef } from "react";

const QUESTIONS = [
  "¿Sabes cuántas horas de parada no planificada tuvo tu línea principal la última semana?",
  "¿Puedes comparar producción real vs. potencial sin recopilar datos manualmente?",
  "¿Mides defectos y retrabajos por turno, no solo al cierre del mes?",
  "¿Tienes identificado el cuello de botella principal de la planta?",
  "¿Tu equipo detecta incidencias en tiempo real, no cuando ya han afectado la producción?",
  "¿Puedes relacionar una caída de rendimiento con su causa en menos de 15 min?",
  "¿Usáis un KPI común entre producción, calidad y operaciones?",
  "¿Revisáis OEE o indicador equivalente con frecuencia operativa (turno o diaria)?",
  "¿Las decisiones se toman con datos consolidados, no con Excel dispersos?",
  "¿Tenéis una forma clara de priorizar mejoras según su impacto económico?",
];

const KPIS = [
  {
    id: "eficiencia",
    name: "Eficiencia de planta",
    formula: "Real / Potencial × 100",
    fields: [
      { key: "a", label: "Producción real (uds)" },
      { key: "b", label: "Producción potencial (uds)" },
    ],
    calc: (a, b) => (b > 0 ? (a / b) * 100 : null),
    target: "≥ 85%",
    bad: (v) => v < 70,
    ok: (v) => v >= 70 && v < 85,
    good: (v) => v >= 85,
  },
  {
    id: "oee",
    name: "OEE",
    formula: "Disp × Rend × Cal / 10000",
    fields: [
      { key: "a", label: "Disponibilidad (%)" },
      { key: "b", label: "Rendimiento (%)" },
      { key: "c", label: "Calidad (%)" },
    ],
    calc: (a, b, c) => (a * b * c) / 10000,
    target: "≥ 85%",
    bad: (v) => v < 55,
    ok: (v) => v >= 55 && v < 85,
    good: (v) => v >= 85,
  },
  {
    id: "defectos",
    name: "Tasa de defectos",
    formula: "Defectuosas / Total × 100",
    fields: [
      { key: "a", label: "Piezas defectuosas" },
      { key: "b", label: "Total producido" },
    ],
    calc: (a, b) => (b > 0 ? (a / b) * 100 : null),
    target: "< 2%",
    bad: (v) => v > 5,
    ok: (v) => v >= 2 && v <= 5,
    good: (v) => v < 2,
  },
  {
    id: "ciclo",
    name: "Desviación de ciclo",
    formula: "(Real − Estándar) / Estándar × 100",
    fields: [
      { key: "a", label: "Ciclo real (seg)" },
      { key: "b", label: "Ciclo estándar (seg)" },
    ],
    calc: (a, b) => (b > 0 ? ((a - b) / b) * 100 : null),
    target: "0%",
    bad: (v) => v > 10,
    ok: (v) => v > 0 && v <= 10,
    good: (v) => v <= 0,
  },
  {
    id: "inactividad",
    name: "Tiempo de inactividad",
    formula: "Parado / Disponibles × 100",
    fields: [
      { key: "a", label: "Minutos parado" },
      { key: "b", label: "Minutos disponibles" },
    ],
    calc: (a, b) => (b > 0 ? (a / b) * 100 : null),
    target: "< 5%",
    bad: (v) => v > 15,
    ok: (v) => v >= 5 && v <= 15,
    good: (v) => v < 5,
  },
];

const PROFILES = [
  {
    range: [0, 3],
    name: "Planta Reactiva",
    color: "#D94F3B",
    desc: "El problema principal es visibilidad. Consolida datos antes de intentar mejorar. Sin datos fiables no hay mejora sostenible.",
    icon: "⚠",
  },
  {
    range: [4, 6],
    name: "Planta Consciente",
    color: "#D4920B",
    desc: "Conecta KPIs entre áreas y automatiza la captura de datos. El siguiente paso es reducir el tiempo entre incidencia y acción.",
    icon: "◐",
  },
  {
    range: [7, 10],
    name: "Planta Controlada",
    color: "#2D8A4E",
    desc: "Foco en mejora continua con datos fiables. Optimiza procesos, reduce variabilidad y trabaja en OEE.",
    icon: "●",
  },
];

const KPI_INSIGHTS = [
  { id: "eficiencia", threshold: (v) => v < 70, text: "Revisa el balance entre capacidad instalada y producción real. Busca el cuello de botella principal." },
  { id: "oee", threshold: (v) => v < 55, text: "Prioriza disponibilidad (paradas) o calidad según dónde esté la mayor pérdida. El OEE bajo casi siempre tiene una causa dominante." },
  { id: "defectos", threshold: (v) => v > 5, text: "Analiza los 2-3 tipos de defecto más frecuentes. El 80% del problema suele estar en el 20% de las causas." },
  { id: "ciclo", threshold: (v) => v > 10, text: "Revisa si hay variación en el proceso, cuellos de botella o maquinaria degradada." },
  { id: "inactividad", threshold: (v) => v > 15, text: "Clasifica las paradas por tipo (averías, cambios, falta de material) y ataca la categoría más frecuente." },
];

const COMBOS = [
  {
    check: (r) => r.eficiencia !== null && r.eficiencia < 70 && r.oee !== null && r.oee < 55,
    title: "Eficiencia baja + OEE bajo",
    text: "Hay pérdidas en múltiples frentes. Prioriza disponibilidad (paradas no planificadas) antes que calidad.",
  },
  {
    check: (r) => r.defectos !== null && r.defectos > 5 && r.ciclo !== null && r.ciclo > 10,
    title: "Alta tasa de defectos + ciclo largo",
    text: "Tienes un problema de proceso, no de máquina. Revisa método de trabajo y formación del operario.",
  },
  {
    check: (r) => r.eficiencia !== null && r.eficiencia < 70 && r.inactividad !== null && r.inactividad < 5,
    title: "Baja eficiencia + buena disponibilidad",
    text: "El cuello de botella no son las paradas, es el ritmo. Revisa el balance de línea y la secuencia de operaciones.",
  },
];

const STEPS = ["intro", "diagnostico", "kpis", "resultado"];

function StatusDot({ kpi, value }) {
  if (value === null) return <span style={{ color: "#888", fontSize: 13 }}>—</span>;
  const bad = kpi.bad(value);
  const good = kpi.good(value);
  const color = bad ? "#D94F3B" : good ? "#2D8A4E" : "#D4920B";
  const label = bad ? "Atención" : good ? "Bien" : "Mejorable";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: color + "18", color, padding: "3px 10px",
      borderRadius: 4, fontSize: 13, fontWeight: 600, letterSpacing: 0.2,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

export default function ChecklistPlanta() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(Array(10).fill(null));
  const [kpiData, setKpiData] = useState({});
  const [formData, setFormData] = useState({ nombre: "", email: "", empresa: "" });
  const [formStatus, setFormStatus] = useState("idle"); // idle | sending | sent | error
  const resultsRef = useRef(null);

  const totalSi = answers.filter((a) => a === true).length;
  const profile = PROFILES.find((p) => totalSi >= p.range[0] && totalSi <= p.range[1]);

  const kpiResults = {};
  KPIS.forEach((kpi) => {
    const vals = kpi.fields.map((f) => {
      const raw = kpiData[kpi.id + "_" + f.key];
      return raw !== undefined && raw !== "" ? parseFloat(raw) : NaN;
    });
    if (vals.every((v) => !isNaN(v))) {
      kpiResults[kpi.id] = kpi.calc(...vals);
    } else {
      kpiResults[kpi.id] = null;
    }
  });

  const allAnswered = answers.every((a) => a !== null);
  const anyKpi = Object.values(kpiResults).some((v) => v !== null);

  useEffect(() => {
    if (step === 3 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step]);

  const font = `"DM Sans", "Segoe UI", system-ui, sans-serif`;
  const monoFont = `"JetBrains Mono", "Fira Code", "SF Mono", monospace`;

  const bg = "#FAFAF8";
  const cardBg = "#FFFFFF";
  const border = "#E8E6E1";
  const textPrimary = "#1A1917";
  const textSecondary = "#6B6860";
  const accent = "#2563EB";
  const accentLight = "#EFF6FF";

  const containerStyle = {
    fontFamily: font,
    background: bg,
    minHeight: "100vh",
    color: textPrimary,
    lineHeight: 1.55,
    padding: "0 0 60px 0",
  };

  const headerStyle = {
    background: "#1A1917",
    color: "#fff",
    padding: "36px 24px 32px",
    textAlign: "center",
  };

  const cardStyle = {
    background: cardBg,
    border: `1px solid ${border}`,
    borderRadius: 10,
    padding: "28px 24px",
    marginBottom: 16,
  };

  const btnPrimary = {
    background: accent,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "13px 32px",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: font,
    cursor: "pointer",
    letterSpacing: 0.2,
    transition: "background 0.15s",
  };

  const btnOutline = {
    background: "transparent",
    color: accent,
    border: `1.5px solid ${accent}`,
    borderRadius: 6,
    padding: "12px 28px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: font,
    cursor: "pointer",
    letterSpacing: 0.2,
  };

  const progressDots = (
    <div style={{ display: "flex", justifyContent: "center", gap: 8, margin: "24px 0 8px" }}>
      {STEPS.map((s, i) => (
        <div
          key={s}
          style={{
            width: i <= step ? 28 : 10,
            height: 10,
            borderRadius: 5,
            background: i <= step ? accent : border,
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );

  const stepLabels = ["Inicio", "Autodiagnóstico", "KPIs", "Resultado"];

  const renderIntro = () => (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px" }}>
      <div style={{ ...cardStyle, textAlign: "center", padding: "36px 28px" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
        <h2 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 12px", letterSpacing: -0.3 }}>
          ¿Cómo de eficiente es tu planta?
        </h2>
        <p style={{ color: textSecondary, fontSize: 15, margin: "0 0 28px", lineHeight: 1.6 }}>
          10 preguntas rápidas + tus datos de producción. En 5 minutos sabrás dónde estás y por dónde empezar.
        </p>
        <div style={{
          background: "#F5F5F0", borderRadius: 8, padding: "18px 20px",
          textAlign: "left", marginBottom: 28, fontSize: 14, color: textSecondary, lineHeight: 1.7,
        }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: textPrimary, marginRight: 8 }}>Paso 1</span>
            Responde 10 preguntas sobre tu operativa
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: textPrimary, marginRight: 8 }}>Paso 2</span>
            Introduce tus datos de planta (opcional)
          </div>
          <div>
            <span style={{ fontWeight: 700, color: textPrimary, marginRight: 8 }}>Paso 3</span>
            Recibe tu diagnóstico con recomendaciones
          </div>
        </div>
        <button style={btnPrimary} onClick={() => setStep(1)}>
          Empezar diagnóstico →
        </button>
      </div>
    </div>
  );

  const renderDiagnostico = () => (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 6px" }}>Autodiagnóstico rápido</h2>
        <p style={{ color: textSecondary, fontSize: 14, margin: 0 }}>
          Responde Sí o No a cada pregunta. No hace falta precisión milimétrica.
        </p>
      </div>
      {QUESTIONS.map((q, i) => {
        const answered = answers[i];
        return (
          <div
            key={i}
            style={{
              ...cardStyle,
              padding: "18px 20px",
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              borderColor: answered !== null ? (answered ? "#2D8A4E44" : border) : border,
              transition: "border-color 0.2s",
            }}
          >
            <span style={{
              fontFamily: monoFont,
              fontSize: 12,
              fontWeight: 700,
              color: textSecondary,
              background: "#F5F5F0",
              borderRadius: 4,
              padding: "3px 7px",
              minWidth: 28,
              textAlign: "center",
              flexShrink: 0,
              marginTop: 2,
            }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, lineHeight: 1.55, marginBottom: 12, color: textPrimary }}>
                {q}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => {
                      const next = [...answers];
                      next[i] = val;
                      setAnswers(next);
                    }}
                    style={{
                      padding: "7px 20px",
                      borderRadius: 5,
                      border: `1.5px solid ${answered === val ? (val ? "#2D8A4E" : "#D94F3B") : border}`,
                      background: answered === val ? (val ? "#2D8A4E12" : "#D94F3B12") : "transparent",
                      color: answered === val ? (val ? "#2D8A4E" : "#D94F3B") : textSecondary,
                      fontWeight: answered === val ? 700 : 500,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: font,
                      transition: "all 0.15s",
                    }}
                  >
                    {val ? "Sí" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 20, padding: "0 4px",
      }}>
        <button style={btnOutline} onClick={() => setStep(0)}>← Atrás</button>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: textSecondary, marginBottom: 6 }}>
            {answers.filter((a) => a !== null).length} / 10 respondidas
          </div>
          <button
            style={{ ...btnPrimary, opacity: allAnswered ? 1 : 0.45, pointerEvents: allAnswered ? "auto" : "none" }}
            onClick={() => setStep(2)}
          >
            Siguiente: KPIs →
          </button>
        </div>
      </div>
    </div>
  );

  const renderKpis = () => (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 6px" }}>Indicadores de planta</h2>
        <p style={{ color: textSecondary, fontSize: 14, margin: 0 }}>
          Introduce tus datos reales. Si no tienes alguno, déjalo en blanco y pasa al resultado.
        </p>
      </div>

      {KPIS.map((kpi) => {
        const result = kpiResults[kpi.id];
        return (
          <div key={kpi.id} style={{ ...cardStyle, padding: "22px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{kpi.name}</div>
                <div style={{ fontFamily: monoFont, fontSize: 12, color: textSecondary, marginTop: 3 }}>
                  {kpi.formula}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {result !== null ? (
                  <div>
                    <div style={{ fontFamily: monoFont, fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
                      {result.toFixed(1)}%
                    </div>
                    <StatusDot kpi={kpi} value={result} />
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: "#aaa" }}>Sin datos</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {kpi.fields.map((f) => (
                <div key={f.key} style={{ flex: "1 1 140px" }}>
                  <label style={{ fontSize: 12, color: textSecondary, display: "block", marginBottom: 4, fontWeight: 500 }}>
                    {f.label}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={kpiData[kpi.id + "_" + f.key] || ""}
                    onChange={(e) => setKpiData({ ...kpiData, [kpi.id + "_" + f.key]: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      border: `1.5px solid ${border}`,
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: monoFont,
                      background: "#FAFAF8",
                      outline: "none",
                      boxSizing: "border-box",
                      transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = accent)}
                    onBlur={(e) => (e.target.style.borderColor = border)}
                    placeholder="—"
                  />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "#aaa", marginTop: 8 }}>
              Objetivo: {kpi.target}
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <button style={btnOutline} onClick={() => setStep(1)}>← Atrás</button>
        <button style={btnPrimary} onClick={() => setStep(3)}>
          Ver resultado →
        </button>
      </div>
    </div>
  );

  const renderResultado = () => {
    const activeInsights = KPI_INSIGHTS.filter((ins) => {
      const v = kpiResults[ins.id];
      return v !== null && ins.threshold(v);
    });
    const activeCombos = COMBOS.filter((c) => c.check(kpiResults));

    return (
      <div ref={resultsRef} style={{ maxWidth: 600, margin: "0 auto", padding: "0 20px" }}>
        {/* Profile card */}
        <div style={{
          ...cardStyle,
          borderLeft: `4px solid ${profile.color}`,
          padding: "28px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <span style={{
              fontSize: 32, width: 52, height: 52, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: profile.color + "14", borderRadius: 10,
            }}>
              {profile.icon}
            </span>
            <div>
              <div style={{ fontSize: 13, color: textSecondary, fontWeight: 500 }}>Tu perfil de planta</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: profile.color, letterSpacing: -0.5 }}>
                {profile.name}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: textPrimary, margin: 0 }}>
            {profile.desc}
          </p>
          <div style={{
            marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8,
            background: profile.color + "14", padding: "8px 16px", borderRadius: 6,
          }}>
            <span style={{ fontFamily: monoFont, fontSize: 22, fontWeight: 800, color: profile.color }}>
              {totalSi}
            </span>
            <span style={{ fontSize: 13, color: profile.color, fontWeight: 500 }}> / 10 respuestas positivas</span>
          </div>
        </div>

        {/* Answers breakdown */}
        <div style={{ ...cardStyle, padding: "22px 20px" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>Tus respuestas</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
            {QUESTIONS.map((q, i) => (
              <div key={i} style={{
                fontSize: 13, padding: "6px 0", display: "flex", alignItems: "center", gap: 8,
                borderBottom: `1px solid ${border}`,
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 4, display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
                  background: answers[i] ? "#2D8A4E14" : "#D94F3B14",
                  color: answers[i] ? "#2D8A4E" : "#D94F3B",
                }}>
                  {answers[i] ? "✓" : "✗"}
                </span>
                <span style={{ color: textSecondary, lineHeight: 1.4, fontSize: 12 }}>
                  P{i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* KPI results */}
        {anyKpi && (
          <div style={{ ...cardStyle, padding: "22px 20px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>Tus indicadores</h3>
            {KPIS.map((kpi) => {
              const v = kpiResults[kpi.id];
              if (v === null) return null;
              return (
                <div key={kpi.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: `1px solid ${border}`,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{kpi.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 700 }}>
                      {v.toFixed(1)}%
                    </span>
                    <StatusDot kpi={kpi} value={v} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Insights */}
        {(activeInsights.length > 0 || activeCombos.length > 0) && (
          <div style={{ ...cardStyle, padding: "22px 20px", borderLeft: `4px solid ${accent}` }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>Qué indican tus datos</h3>
            {activeInsights.map((ins) => (
              <div key={ins.id} style={{
                padding: "12px 14px", background: "#FFF8F0", borderRadius: 6,
                marginBottom: 10, fontSize: 14, lineHeight: 1.6, color: textPrimary,
              }}>
                <span style={{ fontWeight: 700 }}>
                  {KPIS.find((k) => k.id === ins.id).name}:
                </span>{" "}
                {ins.text}
              </div>
            ))}
            {activeCombos.map((c, i) => (
              <div key={i} style={{
                padding: "12px 14px", background: "#FEF2F2", borderRadius: 6,
                marginBottom: 10, fontSize: 14, lineHeight: 1.6,
              }}>
                <span style={{ fontWeight: 700, color: "#D94F3B" }}>{c.title}:</span>{" "}
                {c.text}
              </div>
            ))}
          </div>
        )}

        {/* Formulario de contacto */}
        <div style={{
          ...cardStyle,
          padding: "32px 24px",
          background: "#1A1917",
          color: "#fff",
          border: "none",
        }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, letterSpacing: -0.3 }}>
              ¿Quieres una lectura personalizada?
            </div>
            <p style={{ fontSize: 14, color: "#A8A69E", margin: 0, lineHeight: 1.6 }}>
              Déjanos tus datos y te enviamos un análisis de tus resultados con recomendaciones concretas.
            </p>
          </div>

          {formStatus === "sent" ? (
            <div style={{
              background: "#2D8A4E18", border: "1.5px solid #2D8A4E44", borderRadius: 8,
              padding: "24px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#2D8A4E", marginBottom: 6 }}>
                Recibido
              </div>
              <div style={{ fontSize: 14, color: "#A8A69E", lineHeight: 1.6 }}>
                Te contactamos pronto con una lectura de tus datos.
              </div>
            </div>
          ) : (
            <div>
              {[
                { key: "nombre", label: "Nombre", placeholder: "Tu nombre", type: "text" },
                { key: "email", label: "Email", placeholder: "tu@empresa.com", type: "email" },
                { key: "empresa", label: "Empresa", placeholder: "Nombre de la empresa", type: "text" },
              ].map((field) => (
                <div key={field.key} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: "#A8A69E", fontWeight: 500, display: "block", marginBottom: 5 }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={formData[field.key]}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    style={{
                      width: "100%", padding: "11px 14px", border: "1.5px solid #3A3835",
                      borderRadius: 6, fontSize: 14, fontFamily: font,
                      background: "#2A2926", color: "#fff", outline: "none",
                      boxSizing: "border-box", transition: "border-color 0.15s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#60A5FA")}
                    onBlur={(e) => (e.target.style.borderColor = "#3A3835")}
                  />
                </div>
              ))}

              {formStatus === "error" && (
                <div style={{ fontSize: 13, color: "#D94F3B", marginBottom: 12, textAlign: "center" }}>
                  Algo ha fallado. Inténtalo de nuevo o escríbenos a contacto@madesoft.es
                </div>
              )}

              <button
                disabled={formStatus === "sending" || !formData.nombre.trim() || !formData.email.trim()}
                onClick={async () => {
                  setFormStatus("sending");
                  try {
                    const kpiSummary = {};
                    KPIS.forEach((kpi) => {
                      if (kpiResults[kpi.id] !== null) {
                        kpiSummary[kpi.id] = kpiResults[kpi.id].toFixed(1) + "%";
                      }
                    });
                    await fetch(import.meta.env.VITE_ZAPIER_WEBHOOK, {
                      method: "POST",
                      body: JSON.stringify({
                        nombre: formData.nombre,
                        email: formData.email,
                        empresa: formData.empresa,
                        perfil: profile.name,
                        puntuacion: totalSi + "/10",
                        kpis: JSON.stringify(kpiSummary),
                        origen: "checklist-eficiencia-planta",
                      }),
                    });
                    setFormStatus("sent");
                  } catch (err) {
                    setFormStatus("error");
                  }
                }}
                style={{
                  ...btnPrimary,
                  width: "100%",
                  background: "#fff",
                  color: "#1A1917",
                  fontSize: 15,
                  marginTop: 6,
                  opacity: (!formData.nombre.trim() || !formData.email.trim() || formStatus === "sending") ? 0.5 : 1,
                  cursor: (!formData.nombre.trim() || !formData.email.trim() || formStatus === "sending") ? "not-allowed" : "pointer",
                }}
              >
                {formStatus === "sending" ? "Enviando..." : "Quiero mi lectura personalizada"}
              </button>
            </div>
          )}
        </div>

        {/* Restart */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            style={{ ...btnOutline, fontSize: 13, padding: "10px 24px" }}
            onClick={() => { setStep(0); setAnswers(Array(10).fill(null)); setKpiData({}); setFormData({ nombre: "", email: "", empresa: "" }); setFormStatus("idle"); }}
          >
            Reiniciar checklist
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: "#888", marginBottom: 10, fontWeight: 600 }}>
          Madesoft
        </div>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: "0 0 6px", letterSpacing: -0.5 }}>
          Checklist Express de Eficiencia de Planta
        </h1>
        <p style={{ fontSize: 14, color: "#A8A69E", margin: 0 }}>
          Autodiagnóstico operativo en 5 minutos
        </p>
      </div>

      {progressDots}
      <div style={{
        display: "flex", justifyContent: "center", gap: 20, marginBottom: 28,
        fontSize: 12, color: textSecondary,
      }}>
        {stepLabels.map((label, i) => (
          <span key={label} style={{ fontWeight: i === step ? 700 : 400, color: i === step ? textPrimary : textSecondary }}>
            {label}
          </span>
        ))}
      </div>

      {step === 0 && renderIntro()}
      {step === 1 && renderDiagnostico()}
      {step === 2 && renderKpis()}
      {step === 3 && renderResultado()}
    </div>
  );
}
