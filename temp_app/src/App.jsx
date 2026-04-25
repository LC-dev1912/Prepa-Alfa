import { useState, useEffect, useRef } from "react";

// ─── ANTHROPIC API ───────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userMessage, history = []) {
  const messages = [...history, { role: "user", content: userMessage }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.map((b) => b.text || "").join("") || "Erreur IA.";
}

// ─── DATA ─────────────────────────────────────────────────────────────────────
const USERS = {
  louis: {
    name: "Louis",
    color: "#00d4ff",
    avatar: "L",
    profile: "Pratique la musculation depuis 3 ans, régulier depuis 1 an (4x/sem min). Bonne base de force. Ne court pas. Sait nager. Prévoit d'acheter un vélo de route.",
  },
  romain: {
    name: "Romain",
    color: "#ff6b35",
    avatar: "R",
    profile: "Reprend le sport de zéro. Ne court pas. Sait nager. A un VTT, prévoit d'acheter un vélo de route.",
  },
};

const RACE_DATE = new Date("2026-12-15");

const DISCIPLINES = ["Natation", "Vélo", "Course à pied", "Musculation", "Brick", "Récupération active"];
const DISC_ICONS = {
  Natation: "🏊",
  Vélo: "🚴",
  "Course à pied": "🏃",
  Musculation: "💪",
  Brick: "⚡",
  "Récupération active": "🧘",
};

const MILESTONES = {
  Natation: { label: "Nager 750m sans s'arrêter", target: 750, unit: "m", icon: "🏊" },
  Vélo: { label: "Tenir 20km à rythme soutenu", target: 20, unit: "km", icon: "🚴" },
  "Course à pied": { label: "Courir 5km sans marcher", target: 5, unit: "km", icon: "🏃" },
};

const EXERCISE_SUGGESTIONS = [
  "Squat", "Front squat", "Squat bulgare", "Fentes", "Presse à cuisses",
  "Leg curl", "Leg extension", "Hip thrust", "Deadlift", "Soulevé de terre roumain",
  "Développé couché", "Développé incliné", "Développé militaire", "Pompes",
  "Tractions", "Rowing barre", "Rowing haltère", "Tirage vertical",
  "Gainage frontal", "Gainage latéral", "Russian twist", "Crunch",
  "Curl biceps", "Extensions triceps", "Élévations latérales",
  "Mollets debout", "Mollets assis", "Step-ups", "Box jumps",
];

function useStorage(key, init) {
  const [val, setVal] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? init; } catch { return init; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(val)); }, [key, val]);
  return [val, setVal];
}

function daysUntilRace() {
  return Math.max(0, Math.ceil((RACE_DATE - new Date()) / 86400000));
}

function weekKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}

// ─── COACH SYSTEM PROMPT ─────────────────────────────────────────────────────
function buildCoachPrompt(user, sessions, wellness) {
  const uid = user === "louis" ? "louis" : "romain";
  const otherUid = uid === "louis" ? "romain" : "louis";
  const userSessions = sessions.filter(s => s.user === uid).sort((a, b) => new Date(b.date) - new Date(a.date));
  const otherSessions = sessions.filter(s => s.user === otherUid).sort((a, b) => new Date(b.date) - new Date(a.date));
  const userWellness = wellness.filter(w => w.user === uid).sort((a, b) => b.date.localeCompare(a.date));
  const otherWellness = wellness.filter(w => w.user === otherUid).sort((a, b) => b.date.localeCompare(a.date));

  // Compute weekly stats
  const weekStats = (sess) => {
    const now = new Date();
    const weeks = [{}, {}]; // current week, last week
    for (let w = 0; w < 2; w++) {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 1 - w * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const wSess = sess.filter(s => { const d = new Date(s.date); return d >= start && d < end; });
      weeks[w] = {
        count: wSess.length,
        totalMin: wSess.reduce((a, s) => a + (+s.duration || 0), 0),
        avgRpe: wSess.length ? (wSess.reduce((a, s) => a + (+s.rpe || 0), 0) / wSess.length).toFixed(1) : "—",
        byDisc: DISCIPLINES.map(d => {
          const ds = wSess.filter(s => s.discipline === d);
          return ds.length ? `${d}:${ds.length}x/${ds.reduce((a, s) => a + (+s.duration || 0), 0)}min` : null;
        }).filter(Boolean).join(", "),
      };
    }
    return weeks;
  };

  const [thisWeek, lastWeek] = weekStats(userSessions);
  const [otherThisWeek] = weekStats(otherSessions);

  // Format session line
  const fmtSession = (s) => {
    let line = `- ${s.date} | ${s.discipline} | ${s.duration}min | RPE ${s.rpe}/10`;
    if (s.distance) line += ` | ${s.distance}${s.distanceUnit || ''}`;
    if (s.allure) line += ` | Allure: ${s.allure}`;
    if (s.vitesse) line += ` | ${s.vitesse}km/h`;
    if (s.denivele) line += ` | D+${s.denivele}m`;
    if (s.nageType) line += ` | ${s.nageType}`;
    if (s.veloType) line += ` | ${s.veloType}`;
    if (s.capType) line += ` | ${s.capType}`;
    if (s.muscuFocus) line += ` | Focus: ${s.muscuFocus}`;
    if (s.exercises && s.exercises.length) line += ` | Exos: ${s.exercises.map(e => `${e.name}(${e.sets?.map(st => `${st.weight}kg×${st.reps}`).join(',')})`).join('; ')}`;
    if (s.conditions) line += ` | Conditions: ${s.conditions}`;
    if (s.notes) line += ` | Notes: ${s.notes}`;
    return line;
  };

  // Wellness averages
  const wellAvg = (wArr) => {
    if (!wArr.length) return "Aucune donnée";
    const n = Math.min(wArr.length, 7);
    const recent = wArr.slice(0, n);
    const avg = (k) => (recent.reduce((a, w) => a + (w[k] || 0), 0) / n).toFixed(1);
    return `Moy 7j: Sommeil ${avg("sleep")}/5 | Fatigue ${avg("fatigue")}/5 | Humeur ${avg("mood")}/5`;
  };

  return `Tu es un coach expert en triathlon, préparation physique et nutrition sportive. Tu coaches deux athlètes : Louis et Romain.

═══ UTILISATEUR ACTUEL : ${USERS[uid].name} ═══
${USERS[uid].profile}

═══ OBJECTIF COMMUN ═══
Triathlon Sprint (750m natation / 20km vélo / 5km CAP) — Décembre 2026
Début préparation structurée : Juin 2026. Nous sommes le ${new Date().toLocaleDateString('fr-FR')}.
Jours restants avant la course : ${daysUntilRace()}

═══ CHARGE D'ENTRAÎNEMENT — ${USERS[uid].name} ═══
Cette semaine : ${thisWeek.count} séances | ${thisWeek.totalMin}min | RPE moy ${thisWeek.avgRpe} | ${thisWeek.byDisc || "rien"}
Semaine dernière : ${lastWeek.count} séances | ${lastWeek.totalMin}min | RPE moy ${lastWeek.avgRpe} | ${lastWeek.byDisc || "rien"}
Évolution volume : ${lastWeek.totalMin ? ((thisWeek.totalMin - lastWeek.totalMin) / lastWeek.totalMin * 100).toFixed(0) : 0}%

═══ 30 DERNIÈRES SÉANCES — ${USERS[uid].name} ═══
${userSessions.slice(0, 30).map(fmtSession).join('\n') || 'Aucune séance'}

═══ BIEN-ÊTRE — ${USERS[uid].name} ═══
${wellAvg(userWellness)}
Détail récent :
${userWellness.slice(0, 14).map(w => `- ${w.date} | Sommeil:${w.sleep}/5 Fatigue:${w.fatigue}/5 Humeur:${w.mood}/5`).join('\n') || 'Aucune donnée'}

═══ AUTRE ATHLÈTE : ${USERS[otherUid].name} (pour comparaison si demandé) ═══
${USERS[otherUid].profile}
Cette semaine : ${otherThisWeek.count} séances | ${otherThisWeek.totalMin}min | RPE moy ${otherThisWeek.avgRpe}
Dernières séances :
${otherSessions.slice(0, 10).map(fmtSession).join('\n') || 'Aucune séance'}
Bien-être : ${wellAvg(otherWellness)}

═══ TES DIRECTIVES ═══
1. ANALYSE DE CHARGE : Compare le volume semaine actuelle vs précédente. Alerter si augmentation > 10% ou RPE moyen > 7.
2. FATIGUE & RÉCUPÉRATION : Croise les données bien-être (sommeil, fatigue, humeur) avec la charge. Si fatigue élevée + mauvais sommeil → recommander allègement.
3. PROGRESSION : Identifie les tendances (distances, allures, charges muscu) et donne un feedback sur la progression.
4. ADAPTATION : Propose des ajustements concrets si besoin (réduire volume, changer intensité, ajouter récup, modifier répartition).
5. ÉQUILIBRE DES DISCIPLINES : Vérifie que les 3 disciplines du tri sont travaillées. Signaler si une est négligée.
6. MUSCULATION : Analyser les exercices, les charges, le volume (séries × reps). Vérifier la cohérence avec l'objectif tri.
7. NUTRITION : Si demandé, donner des conseils macros et timing nutritionnel adaptés à la charge.
8. BLESSURES : Si les notes mentionnent une douleur ou gêne, en tenir compte immédiatement.
9. COMPARAISON : Si demandé, comparer objectivement les deux athlètes sur les mêmes métriques.
10. Répondre en français, de façon directe, concrète et motivante. Pas de blabla.`;
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Countdown() {
  const days = daysUntilRace();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 18px",
    }}>
      <span style={{ fontSize: 22 }}>🏁</span>
      <div>
        <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase" }}>Jour J</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#00d4ff", fontFamily: "monospace" }}>
          J-{days}
        </div>
      </div>
    </div>
  );
}

function Avatar({ user, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${USERS[user].color}44, ${USERS[user].color}22)`,
      border: `2px solid ${USERS[user].color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.45, fontWeight: 800, color: USERS[user].color,
    }}>{USERS[user].avatar}</div>
  );
}

function ProgressBar({ value, max, color = "#00d4ff", height = 6 }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 99, height, overflow: "hidden" }}>
      <div style={{
        width: `${pct}%`, height: "100%", borderRadius: 99,
        background: `linear-gradient(90deg, ${color}99, ${color})`,
        transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: 20, ...style,
    }}>{children}</div>
  );
}

function Badge({ children, color = "#00d4ff" }) {
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700,
      fontFamily: "monospace", letterSpacing: 1,
    }}>{children}</span>
  );
}

// ─── SESSION FORM ─────────────────────────────────────────────────────────────
function SessionForm({ user, sessions, setSessions, onAnalyze }) {
  const [form, setForm] = useState({
    discipline: "Course à pied", date: new Date().toISOString().slice(0, 10),
    duration: "", rpe: "6", conditions: "", notes: "",
    distance: "", allure: "", hrAvg: "", hrMax: "",
    nageType: "Crawl", veloType: "Route", vitesse: "", denivele: "",
    capType: "Footing", muscuFocus: "Full body",
    exercises: [{ name: "", sets: [{ weight: "", reps: "" }] }],
    brick1: "Vélo", brick2: "Course à pied", transition: "", distance1: "", distance2: "",
    recupType: "Yoga",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateExercise = (idx, name) => {
    const exs = [...form.exercises]; exs[idx] = { ...exs[idx], name }; set("exercises", exs);
  };
  const addExercise = () => set("exercises", [...form.exercises, { name: "", sets: [{ weight: "", reps: "" }] }]);
  const removeExercise = (idx) => set("exercises", form.exercises.filter((_, i) => i !== idx));
  const addSet = (ei) => {
    const exs = [...form.exercises];
    const last = exs[ei].sets[exs[ei].sets.length - 1];
    exs[ei] = { ...exs[ei], sets: [...exs[ei].sets, { weight: last?.weight || "", reps: last?.reps || "" }] };
    set("exercises", exs);
  };
  const removeSet = (ei, si) => {
    const exs = [...form.exercises];
    exs[ei] = { ...exs[ei], sets: exs[ei].sets.filter((_, i) => i !== si) };
    set("exercises", exs);
  };
  const updateSet = (ei, si, field, val) => {
    const exs = [...form.exercises];
    const sets = [...exs[ei].sets]; sets[si] = { ...sets[si], [field]: val };
    exs[ei] = { ...exs[ei], sets }; set("exercises", exs);
  };

  const lastSame = sessions
    .filter(s => s.user === user && s.discipline === form.discipline)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  async function handleSubmit() {
    if (!form.duration) return;
    setSaving(true);
    const session = { ...form, user, id: Date.now(), timestamp: new Date().toISOString() };
    if (form.discipline === "Natation") session.distanceUnit = "m";
    else if (["Vélo", "Course à pied"].includes(form.discipline)) session.distanceUnit = "km";
    setSessions([...sessions, session]);
    await onAnalyze(session, lastSame);
    setSaving(false);
    setForm(f => ({ ...f, duration: "", distance: "", allure: "", hrAvg: "", hrMax: "",
      vitesse: "", denivele: "", notes: "", rpe: "6", conditions: "",
      transition: "", distance1: "", distance2: "",
      exercises: [{ name: "", sets: [{ weight: "", reps: "" }] }],
    }));
  }

  const inp = (extra = {}) => ({
    style: {
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8, color: "#fff", padding: "10px 14px", fontSize: 14, width: "100%",
      outline: "none", fontFamily: "inherit", ...extra.style,
    }, ...extra,
  });
  const label = (txt) => (
    <div style={{ fontSize: 11, color: "#888", marginBottom: 6, letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>{txt}</div>
  );

  const disc = form.discipline;
  const isEndurance = ["Natation", "Vélo", "Course à pied"].includes(disc);

  const compDelta = lastSame && form.distance && lastSame.distance
    ? ((parseFloat(form.distance) - parseFloat(lastSame.distance)) / parseFloat(lastSame.distance) * 100).toFixed(1)
    : null;

  return (
    <Card>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
        <span>📝</span> Nouvelle séance — <span style={{ color: USERS[user].color }}>{USERS[user].name}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          {label("Date")}
          <input type="date" value={form.date} onChange={e => set("date", e.target.value)} {...inp()} />
        </div>
        <div>
          {label("Discipline")}
          <select value={disc} onChange={e => set("discipline", e.target.value)} {...inp()}>
            {DISCIPLINES.map(d => <option key={d} value={d}>{DISC_ICONS[d]} {d}</option>)}
          </select>
        </div>
        <div>
          {label("Durée (min)")}
          <input type="number" value={form.duration} onChange={e => set("duration", e.target.value)} placeholder="45" {...inp()} />
        </div>

        {/* ── NATATION ── */}
        {disc === "Natation" && <>
          <div>
            {label("Distance (m)")}
            <input type="number" value={form.distance} onChange={e => set("distance", e.target.value)} placeholder="750" {...inp()} />
          </div>
          <div>
            {label("Allure (/100m)")}
            <input value={form.allure} onChange={e => set("allure", e.target.value)} placeholder="2:00" {...inp()} />
          </div>
          <div>
            {label("Type de nage")}
            <select value={form.nageType} onChange={e => set("nageType", e.target.value)} {...inp()}>
              {["Crawl", "Brasse", "Dos", "Papillon", "Mixte"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </>}

        {/* ── VÉLO ── */}
        {disc === "Vélo" && <>
          <div>
            {label("Distance (km)")}
            <input type="number" value={form.distance} onChange={e => set("distance", e.target.value)} placeholder="20" {...inp()} />
          </div>
          <div>
            {label("Vitesse moy (km/h)")}
            <input type="number" value={form.vitesse} onChange={e => set("vitesse", e.target.value)} placeholder="25" {...inp()} />
          </div>
          <div>
            {label("Dénivelé+ (m)")}
            <input type="number" value={form.denivele} onChange={e => set("denivele", e.target.value)} placeholder="300" {...inp()} />
          </div>
          <div>
            {label("Type")}
            <select value={form.veloType} onChange={e => set("veloType", e.target.value)} {...inp()}>
              {["Route", "VTT", "Home trainer", "Gravel"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </>}

        {/* ── COURSE À PIED ── */}
        {disc === "Course à pied" && <>
          <div>
            {label("Distance (km)")}
            <input type="number" value={form.distance} onChange={e => set("distance", e.target.value)} placeholder="5" {...inp()} />
          </div>
          <div>
            {label("Allure (/km)")}
            <input value={form.allure} onChange={e => set("allure", e.target.value)} placeholder="5:30" {...inp()} />
          </div>
          <div>
            {label("Type de sortie")}
            <select value={form.capType} onChange={e => set("capType", e.target.value)} {...inp()}>
              {["Footing", "Fractionné", "Sortie longue", "Côtes", "Tempo", "Récup"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </>}

        {/* ── FC (endurance only) ── */}
        {isEndurance && <>
          <div>
            {label("FC Moy (bpm)")}
            <input type="number" value={form.hrAvg} onChange={e => set("hrAvg", e.target.value)} placeholder="145" {...inp()} />
          </div>
          <div>
            {label("FC Max (bpm)")}
            <input type="number" value={form.hrMax} onChange={e => set("hrMax", e.target.value)} placeholder="172" {...inp()} />
          </div>
        </>}

        {/* ── MUSCULATION FOCUS ── */}
        {disc === "Musculation" && <div>
          {label("Focus")}
          <select value={form.muscuFocus} onChange={e => set("muscuFocus", e.target.value)} {...inp()}>
            {["Haut du corps", "Bas du corps", "Full body", "Core / Gainage"].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>}

        {/* ── BRICK ── */}
        {disc === "Brick" && <>
          <div>
            {label("Discipline 1")}
            <select value={form.brick1} onChange={e => set("brick1", e.target.value)} {...inp()}>
              {["Natation", "Vélo", "Course à pied"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            {label("Discipline 2")}
            <select value={form.brick2} onChange={e => set("brick2", e.target.value)} {...inp()}>
              {["Natation", "Vélo", "Course à pied"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            {label("Distance 1")}
            <input type="number" value={form.distance1} onChange={e => set("distance1", e.target.value)} placeholder="20" {...inp()} />
          </div>
          <div>
            {label("Distance 2")}
            <input type="number" value={form.distance2} onChange={e => set("distance2", e.target.value)} placeholder="5" {...inp()} />
          </div>
          <div>
            {label("Transition (sec)")}
            <input type="number" value={form.transition} onChange={e => set("transition", e.target.value)} placeholder="60" {...inp()} />
          </div>
        </>}

        {/* ── RÉCUP ── */}
        {disc === "Récupération active" && <div>
          {label("Type d'activité")}
          <select value={form.recupType} onChange={e => set("recupType", e.target.value)} {...inp()}>
            {["Yoga", "Marche", "Étirements", "Foam rolling", "Mobilité", "Natation légère"].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>}

        {/* ── RPE (always) ── */}
        <div>
          {label("RPE (1–10)")}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="range" min="1" max="10" value={form.rpe} onChange={e => set("rpe", e.target.value)}
              style={{ flex: 1, accentColor: USERS[user].color }} />
            <span style={{ color: USERS[user].color, fontWeight: 800, width: 20 }}>{form.rpe}</span>
          </div>
        </div>

        <div style={{ gridColumn: "1/-1" }}>
          {label("Conditions")}
          <input value={form.conditions} onChange={e => set("conditions", e.target.value)} placeholder="Ex: piste, 18°C, vent faible" {...inp()} />
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          {label("Notes libres")}
          <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
            placeholder="Ressenti, points à améliorer..." rows={3}
            style={{ ...inp().style, resize: "vertical" }} />
        </div>
      </div>

      {/* ── MUSCULATION EXERCISES ── */}
      {disc === "Musculation" && (
        <div style={{ marginTop: 16 }}>
          <datalist id="exo-suggestions">
            {EXERCISE_SUGGESTIONS.map(e => <option key={e} value={e} />)}
          </datalist>
          {form.exercises.map((ex, ei) => (
            <div key={ei} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: 14, marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: USERS[user].color }}>💪 Exercice {ei + 1}</span>
                {form.exercises.length > 1 && (
                  <button onClick={() => removeExercise(ei)} style={{
                    background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)",
                    borderRadius: 6, color: "#f87171", cursor: "pointer", padding: "2px 8px", fontSize: 12, fontFamily: "inherit",
                  }}>✕</button>
                )}
              </div>
              <input list="exo-suggestions" value={ex.name} onChange={e => updateExercise(ei, e.target.value)}
                placeholder="Nom de l'exercice" {...inp({ style: { marginBottom: 10, width: "100%" } })} />
              {ex.sets.map((s, si) => (
                <div key={si} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#666", fontFamily: "monospace", minWidth: 24 }}>S{si + 1}</span>
                  <input type="number" value={s.weight} onChange={e => updateSet(ei, si, "weight", e.target.value)}
                    placeholder="kg" {...inp({ style: { width: 70, padding: "7px 10px", fontSize: 13 } })} />
                  <span style={{ color: "#555", fontSize: 13 }}>kg ×</span>
                  <input type="number" value={s.reps} onChange={e => updateSet(ei, si, "reps", e.target.value)}
                    placeholder="reps" {...inp({ style: { width: 70, padding: "7px 10px", fontSize: 13 } })} />
                  <span style={{ color: "#555", fontSize: 13 }}>reps</span>
                  {ex.sets.length > 1 && (
                    <button onClick={() => removeSet(ei, si)} style={{
                      background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, padding: "0 4px",
                    }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => addSet(ei)} style={{
                background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.15)",
                borderRadius: 6, color: "#888", cursor: "pointer", padding: "5px 12px", fontSize: 12,
                fontFamily: "inherit", marginTop: 4, width: "100%",
              }}>+ Série</button>
            </div>
          ))}
          <button onClick={addExercise} style={{
            background: `${USERS[user].color}15`, border: `1px dashed ${USERS[user].color}44`,
            borderRadius: 10, color: USERS[user].color, cursor: "pointer", padding: "10px 0", fontSize: 13,
            fontWeight: 600, fontFamily: "inherit", width: "100%",
          }}>+ Ajouter un exercice</button>
        </div>
      )}

      {lastSame && (
        <div style={{
          marginTop: 14, padding: "12px 16px", background: "rgba(255,255,255,0.04)",
          borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
          display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13,
        }}>
          <span style={{ color: "#888" }}>Dernière {form.discipline} :</span>
          <span>⏱ {lastSame.duration} min</span>
          {lastSame.distance && <span>📏 {lastSame.distance}{lastSame.distanceUnit}</span>}
          {lastSame.allure && <span>⚡ {lastSame.allure}</span>}
          {lastSame.exercises && <span>💪 {lastSame.exercises.length} exos</span>}
          {compDelta !== null && (
            <span style={{ color: parseFloat(compDelta) >= 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>
              {parseFloat(compDelta) >= 0 ? "▲" : "▼"} {Math.abs(compDelta)}%
            </span>
          )}
        </div>
      )}

      <button onClick={handleSubmit} disabled={saving || !form.duration}
        style={{
          marginTop: 16, width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
          background: saving ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${USERS[user].color}cc, ${USERS[user].color})`,
          color: saving ? "#888" : "#000", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer",
          fontFamily: "inherit", transition: "all 0.2s",
        }}>
        {saving ? "⏳ Analyse en cours..." : "✅ Enregistrer la séance"}
      </button>
    </Card>
  );
}

// ─── WELLNESS FORM ────────────────────────────────────────────────────────────
function WellnessForm({ user, wellness, setWellness }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayEntry = wellness.find(w => w.user === user && w.date === today);
  const [sleep, setSleep] = useState(todayEntry?.sleep || 3);
  const [fatigue, setFatigue] = useState(todayEntry?.fatigue || 3);
  const [mood, setMood] = useState(todayEntry?.mood || 3);
  const [saved, setSaved] = useState(!!todayEntry);

  function save() {
    const entry = { user, date: today, sleep, fatigue, mood };
    setWellness(prev => [...prev.filter(w => !(w.user === user && w.date === today)), entry]);
    setSaved(true);
  }

  const emoji = (v) => ["😴", "😞", "😐", "😊", "🤩"][v - 1];
  const Slider = ({ label, val, setVal, key2 }) => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#888", letterSpacing: 1, textTransform: "uppercase", fontFamily: "monospace" }}>{label}</span>
        <span style={{ fontSize: 18 }}>{emoji(val)}</span>
      </div>
      <input type="range" min="1" max="5" value={val} onChange={e => { setVal(+e.target.value); setSaved(false); }}
        style={{ width: "100%", accentColor: USERS[user].color }} />
    </div>
  );

  const score = ((sleep + (6 - fatigue) + mood) / 13 * 100).toFixed(0);

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>🌙 Check-in du matin — <span style={{ color: USERS[user].color }}>{USERS[user].name}</span></span>
        <Badge color={score >= 70 ? "#4ade80" : score >= 40 ? "#fbbf24" : "#f87171"}>Score {score}%</Badge>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Slider label="Sommeil" val={sleep} setVal={setSleep} />
        <Slider label="Fatigue" val={6 - fatigue} setVal={v => setFatigue(6 - v)} />
        <Slider label="Humeur" val={mood} setVal={setMood} />
      </div>
      <button onClick={save} disabled={saved}
        style={{
          marginTop: 14, width: "100%", padding: "11px 0", borderRadius: 8, border: "none",
          background: saved ? "rgba(74,222,128,0.15)" : `linear-gradient(135deg, ${USERS[user].color}99, ${USERS[user].color})`,
          color: saved ? "#4ade80" : "#000", fontWeight: 700, cursor: saved ? "default" : "pointer",
          fontFamily: "inherit", fontSize: 14,
        }}>
        {saved ? "✅ Check-in enregistré" : "Enregistrer"}
      </button>
    </Card>
  );
}

// ─── MILESTONES ───────────────────────────────────────────────────────────────
function Milestones({ user, sessions }) {
  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>🎯 Jalons — <span style={{ color: USERS[user].color }}>{USERS[user].name}</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {Object.entries(MILESTONES).map(([disc, m]) => {
          const best = sessions
            .filter(s => s.user === user && s.discipline === disc && s.distance)
            .reduce((max, s) => Math.max(max, parseFloat(s.distance) * (s.distanceUnit === "m" ? 0.001 : 1)), 0);
          const pct = Math.min(100, (best / m.target) * 100);
          const done = pct >= 100;
          return (
            <div key={disc}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span>{m.icon} {m.label}</span>
                <span style={{ color: done ? "#4ade80" : USERS[user].color, fontWeight: 700 }}>
                  {done ? "🏆 Atteint !" : `${best.toFixed(1)}/${m.target}${m.unit}`}
                </span>
              </div>
              <ProgressBar value={best} max={m.target} color={done ? "#4ade80" : USERS[user].color} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── DUEL DASHBOARD ───────────────────────────────────────────────────────────
function DuelDashboard({ sessions, wellness }) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const weekSessions = sessions.filter(s => new Date(s.date) >= weekStart);

  const stats = (uid) => {
    const userW = weekSessions.filter(s => s.user === uid);
    const byDisc = {};
    DISCIPLINES.forEach(d => {
      const disc = userW.filter(s => s.discipline === d);
      byDisc[d] = { count: disc.length, minutes: disc.reduce((a, s) => a + (+s.duration || 0), 0) };
    });
    return byDisc;
  };

  const ls = stats("louis");
  const rs = stats("romain");

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
        <Avatar user="louis" size={28} />
        <span style={{ color: USERS.louis.color }}>Louis</span>
        <span style={{ flex: 1, textAlign: "center", color: "#555" }}>VS</span>
        <span style={{ color: USERS.romain.color }}>Romain</span>
        <Avatar user="romain" size={28} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {DISCIPLINES.slice(0, 4).map(d => {
          const lm = ls[d].minutes, rm = rs[d].minutes;
          const total = lm + rm;
          const lpct = total ? (lm / total) * 100 : 50;
          const winner = lm > rm ? "louis" : rm > lm ? "romain" : null;
          return (
            <div key={d}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "#aaa" }}>
                <span style={{ color: USERS.louis.color }}>{lm}min</span>
                <span>{DISC_ICONS[d]} {d} {winner && <span style={{ color: USERS[winner].color }}>←</span>}</span>
                <span style={{ color: USERS.romain.color }}>{rm}min</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", display: "flex" }}>
                <div style={{ width: `${lpct}%`, background: USERS.louis.color, transition: "width 0.5s" }} />
                <div style={{ flex: 1, background: USERS.romain.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {["louis", "romain"].map(uid => {
          const total = weekSessions.filter(s => s.user === uid).length;
          const avgRpe = weekSessions.filter(s => s.user === uid && s.rpe).reduce((a, s, _, arr) => a + +s.rpe / arr.length, 0);
          return (
            <div key={uid} style={{
              padding: "12px", background: `${USERS[uid].color}0a`,
              border: `1px solid ${USERS[uid].color}22`, borderRadius: 10, textAlign: "center",
            }}>
              <Avatar user={uid} size={32} />
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: USERS[uid].color }}>{total}</div>
              <div style={{ fontSize: 11, color: "#888" }}>séances cette semaine</div>
              {avgRpe > 0 && <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>RPE moyen {avgRpe.toFixed(1)}</div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── SESSION HISTORY ─────────────────────────────────────────────────────────
function SessionHistory({ user, sessions, setSessions }) {
  const userSessions = sessions.filter(s => s.user === user).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const startEdit = (s) => { setEditForm({ ...s }); setEditing(s.id); };
  const saveEdit = () => {
    setSessions(sessions.map(s => s.id === editing ? { ...s, ...editForm } : s));
    setEditing(null);
  };
  const deleteSession = (id) => {
    if (window.confirm("Supprimer cette séance ?")) setSessions(sessions.filter(s => s.id !== id));
  };
  const ef = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const detail = (s) => {
    if (s.discipline === "Musculation" && s.exercises) {
      const totalSets = s.exercises.reduce((a, e) => a + (e.sets?.length || 0), 0);
      return `${s.exercises.filter(e => e.name).length} exos · ${totalSets} séries`;
    }
    if (s.discipline === "Vélo" && s.vitesse) return `${s.distance || "—"}km · ${s.vitesse}km/h`;
    if (s.distance) return `${s.distance}${s.distanceUnit || ""}${s.allure ? " · " + s.allure : ""}`;
    if (s.discipline === "Récupération active") return s.recupType || "";
    return "";
  };
  const subType = (s) => {
    if (s.nageType && s.discipline === "Natation") return s.nageType;
    if (s.veloType && s.discipline === "Vélo") return s.veloType;
    if (s.capType && s.discipline === "Course à pied") return s.capType;
    if (s.muscuFocus && s.discipline === "Musculation") return s.muscuFocus;
    if (s.discipline === "Brick") return `${s.brick1} + ${s.brick2}`;
    return null;
  };

  const inp = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit" };

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📋 Historique — <span style={{ color: USERS[user].color }}>{USERS[user].name}</span></div>
      {userSessions.length === 0 && <div style={{ color: "#555", fontSize: 14 }}>Aucune séance enregistrée.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {userSessions.map(s => (
          <div key={s.id} style={{
            display: "flex", gap: 10, alignItems: "center",
            padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 13,
          }}>
            <span style={{ fontSize: 20 }}>{DISC_ICONS[s.discipline]}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{s.discipline}</div>
              <div style={{ color: "#888", fontSize: 11 }}>{s.date}{subType(s) ? ` · ${subType(s)}` : ""}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 700 }}>{s.duration} min</div>
              {detail(s) && <div style={{ color: "#888", fontSize: 11 }}>{detail(s)}</div>}
            </div>
            <Badge color={USERS[user].color}>RPE {s.rpe}</Badge>
            <button onClick={() => startEdit(s)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 2 }}>✏️</button>
            <button onClick={() => deleteSession(s.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 2 }}>🗑️</button>
          </div>
        ))}
      </div>

      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20,
            padding: 24, maxWidth: 420, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>✏️ Modifier la séance</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontFamily: "monospace" }}>DATE</div>
                <input type="date" value={editForm.date || ""} onChange={e => ef("date", e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontFamily: "monospace" }}>DURÉE (MIN)</div>
                <input type="number" value={editForm.duration || ""} onChange={e => ef("duration", e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontFamily: "monospace" }}>DISTANCE</div>
                <input type="number" value={editForm.distance || ""} onChange={e => ef("distance", e.target.value)} style={inp} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontFamily: "monospace" }}>RPE</div>
                <input type="number" min="1" max="10" value={editForm.rpe || ""} onChange={e => ef("rpe", e.target.value)} style={inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontFamily: "monospace" }}>NOTES</div>
                <textarea value={editForm.notes || ""} onChange={e => ef("notes", e.target.value)} rows={2}
                  style={{ ...inp, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#888",
                cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Annuler</button>
              <button onClick={saveEdit} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                background: `linear-gradient(135deg, ${USERS[user].color}cc, ${USERS[user].color})`,
                color: "#000", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Sauvegarder</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── AI CHAT ─────────────────────────────────────────────────────────────────
function AIChat({ user, sessions, wellness }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: `Salut ${USERS[user].name} ! 👋 Je suis ton coach IA. J'ai accès à tout ton historique. Pose-moi n'importe quelle question : entraînement, nutrition, récupération, stratégie de course...`,
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const history = messages.slice(1).map(m => ({ role: m.role, content: m.content }));
    const sys = buildCoachPrompt(user, sessions, wellness);
    try {
      const reply = await callClaude(sys, userMsg, history);
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion à l'IA. Vérifie ta connexion." }]);
    }
    setLoading(false);
  }

  return (
    <Card style={{ display: "flex", flexDirection: "column", height: 480 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span>🤖</span> Coach IA — <span style={{ color: USERS[user].color }}>{USERS[user].name}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
            background: m.role === "user"
              ? `linear-gradient(135deg, ${USERS[user].color}33, ${USERS[user].color}22)`
              : "rgba(255,255,255,0.05)",
            border: `1px solid ${m.role === "user" ? USERS[user].color + "44" : "rgba(255,255,255,0.08)"}`,
            borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            padding: "10px 14px", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
          }}>
            {m.content}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", padding: "10px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 16, fontSize: 13, color: "#888" }}>
            ⏳ Le coach analyse...
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Pose ta question..."
          style={{
            flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, color: "#fff", padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit",
          }}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{
            padding: "10px 18px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14,
            background: loading || !input.trim() ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${USERS[user].color}99, ${USERS[user].color})`,
            color: loading || !input.trim() ? "#555" : "#000", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}>↑</button>
      </div>
    </Card>
  );
}

// ─── AI ANALYSIS POPUP ────────────────────────────────────────────────────────
function AIAnalysisPopup({ analysis, onClose }) {
  if (!analysis) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20,
        padding: 28, maxWidth: 500, width: "100%", position: "relative",
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          🤖 Analyse du coach IA
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: "#ddd", whiteSpace: "pre-wrap" }}>{analysis}</div>
        <button onClick={onClose} style={{
          marginTop: 20, width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
          background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>Fermer</button>
      </div>
    </div>
  );
}

// ─── MINI STATS ───────────────────────────────────────────────────────────────
function MiniStats({ user, sessions, wellness }) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const weekSess = sessions.filter(s => s.user === user && new Date(s.date) >= weekStart);
  const totalMin = weekSess.reduce((a, s) => a + (+s.duration || 0), 0);
  const todayWell = wellness.filter(w => w.user === user).sort((a, b) => b.date.localeCompare(a.date))[0];

  const wellScore = todayWell
    ? Math.round((todayWell.sleep + (6 - todayWell.fatigue) + todayWell.mood) / 13 * 100)
    : null;

  const stats = [
    { label: "Séances / semaine", val: weekSess.length, icon: "📅" },
    { label: "Volume semaine", val: `${Math.round(totalMin / 60)}h${totalMin % 60}`, icon: "⏱" },
    { label: "Score bien-être", val: wellScore !== null ? `${wellScore}%` : "—", icon: "💚" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, padding: "14px 10px", textAlign: "center",
        }}>
          <div style={{ fontSize: 22 }}>{s.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: USERS[user].color, marginTop: 4 }}>{s.val}</div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── TRAINING PLAN ────────────────────────────────────────────────────────────
const PLAN = {
  louis: [
    { phase: "Fondation", weeks: "1–4", desc: "3 séances/sem (Nat+Vélo+CAP). Musculation 2x/sem axée gainage et force fonctionnelle. Volumes bas, intensité basse. RPE 5–6." },
    { phase: "Développement", weeks: "5–12", desc: "4 séances/sem. Introduire les bricks. Musculation 1x/sem. Augmentation volume 10%/sem avec semaines de récup S4/S8." },
    { phase: "Spécifique", weeks: "13–20", desc: "5 séances/sem. Bricks réguliers. Musculation 0–1x/sem (gainage uniquement). Travailler aux allures cibles." },
    { phase: "Affûtage", weeks: "21–24", desc: "Réduction volume de 30–40%. Intensité maintenue. Focus récupération. Simulation de course en semaine 23." },
  ],
  romain: [
    { phase: "Fondation", weeks: "1–6", desc: "2 séances/sem (Nat+CAP ou Vélo). Volumes très bas. Priorité : courir 20min sans s'arrêter et nager 200m. RPE 4–5." },
    { phase: "Développement", weeks: "7–14", desc: "3 séances/sem. Introduire le vélo. Augmentation progressive. Premiers bricks courts en fin de bloc." },
    { phase: "Spécifique", weeks: "15–20", desc: "4 séances/sem. Bricks. Atteindre les distances cibles sur chaque discipline séparément." },
    { phase: "Affûtage", weeks: "21–24", desc: "Réduction volume. Confiance et récupération. Simulation de course complète en semaine 23." },
  ],
};

function TrainingPlan({ user, sessions, wellness }) {
  const plan = PLAN[user];
  const colors = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"];
  
  const [dynamicPlan, setDynamicPlan] = useStorage(`tri_dynamic_plan_${user}`, null);
  const [loading, setLoading] = useState(false);

  const generatePlan = async () => {
    setLoading(true);
    const sys = buildCoachPrompt(user, sessions, wellness);
    const msg = `Génère un plan d'entraînement d'UNE SEMAINE pour moi. 
Format exigé (Texte brut, un jour par ligne, sans markdown ni gras) :
Lundi : [Séance]
Mardi : [Séance]
etc.
Si repos, écris "Repos". Sois précis sur les durées et allures. Prends en compte ma fatigue actuelle.`;
    
    try {
      const reply = await callClaude(sys, msg);
      setDynamicPlan({ date: new Date().toLocaleDateString(), content: reply });
    } catch(e) {
      alert("Erreur de génération du plan");
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📅 Macro-Plan — <span style={{ color: USERS[user].color }}>{USERS[user].name}</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plan.map((p, i) => (
            <div key={p.phase} style={{
              padding: "12px 14px", background: `${colors[i]}0d`,
              border: `1px solid ${colors[i]}33`, borderRadius: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, color: colors[i] }}>{p.phase}</span>
                <Badge color={colors[i]}>Semaines {p.weeks}</Badge>
              </div>
              <div style={{ fontSize: 13, color: "#bbb", lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </Card>
      
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>🤖 Ma Semaine IA</div>
          <button onClick={generatePlan} disabled={loading} style={{
            background: `linear-gradient(135deg, ${USERS[user].color}cc, ${USERS[user].color})`,
            border: "none", borderRadius: 8, padding: "6px 12px", color: "#000", fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit"
          }}>
            {loading ? "Génération..." : "Générer ma semaine"}
          </button>
        </div>
        
        {dynamicPlan ? (
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>Généré le {dynamicPlan.date}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dynamicPlan.content.split('\n').filter(l => l.trim()).map((line, i) => {
                const parts = line.split(':');
                const day = parts[0];
                const rest = parts.slice(1).join(':');
                if (!rest) return <div key={i} style={{ color: "#ddd", fontSize: 13 }}>{line}</div>;
                return (
                  <div key={i} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 700, color: USERS[user].color, width: 70, display: "inline-block" }}>{day}</span>
                    <span style={{ color: "#ddd" }}>{rest}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ color: "#666", fontSize: 13, textAlign: "center", padding: "10px 0" }}>
            Aucun plan généré pour le moment.
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── PERSONAL RECORDS ────────────────────────────────────────────────────────
function PersonalRecords({ user, sessions }) {
  const us = sessions.filter(s => s.user === user);
  const bestDist = (disc, unit) => {
    const vals = us.filter(s => s.discipline === disc && s.distance).map(s => parseFloat(s.distance));
    return vals.length ? `${Math.max(...vals)}${unit}` : "—";
  };
  const bestAllure = (disc) => {
    const vals = us.filter(s => s.discipline === disc && s.allure).map(s => s.allure);
    return vals.length ? vals.sort()[0] : "—";
  };
  const bestVitesse = () => {
    const vals = us.filter(s => s.discipline === "Vélo" && s.vitesse).map(s => parseFloat(s.vitesse));
    return vals.length ? `${Math.max(...vals)} km/h` : "—";
  };
  // Max weight per exercise
  const muscuSessions = us.filter(s => s.discipline === "Musculation" && s.exercises);
  const maxWeights = {};
  muscuSessions.forEach(s => {
    s.exercises.forEach(e => {
      if (!e.name) return;
      const maxW = Math.max(...(e.sets || []).map(st => parseFloat(st.weight) || 0));
      if (maxW > (maxWeights[e.name] || 0)) maxWeights[e.name] = maxW;
    });
  });
  const topExos = Object.entries(maxWeights).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const records = [
    { icon: "🏊", label: "Natation", val: bestDist("Natation", "m"), sub: bestAllure("Natation") !== "—" ? `Allure: ${bestAllure("Natation")}` : "" },
    { icon: "🚴", label: "Vélo", val: bestDist("Vélo", "km"), sub: bestVitesse() !== "—" ? bestVitesse() : "" },
    { icon: "🏃", label: "Course", val: bestDist("Course à pied", "km"), sub: bestAllure("Course à pied") !== "—" ? `Allure: ${bestAllure("Course à pied")}` : "" },
  ];

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🏆 Records — <span style={{ color: USERS[user].color }}>{USERS[user].name}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {records.map(r => (
          <div key={r.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 20 }}>{r.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: USERS[user].color, marginTop: 4 }}>{r.val}</div>
            <div style={{ fontSize: 10, color: "#888" }}>{r.label}</div>
            {r.sub && <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{r.sub}</div>}
          </div>
        ))}
      </div>
      {topExos.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 6, fontFamily: "monospace", letterSpacing: 1 }}>💪 MAX CHARGES</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topExos.map(([name, w]) => (
              <span key={name} style={{ background: `${USERS[user].color}15`, border: `1px solid ${USERS[user].color}33`,
                borderRadius: 8, padding: "4px 10px", fontSize: 12 }}>
                {name}: <span style={{ fontWeight: 700, color: USERS[user].color }}>{w}kg</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── STREAKS & GAMIFICATION ──────────────────────────────────────────────────
function Streaks({ user, sessions }) {
  const us = sessions.filter(s => s.user === user).sort((a, b) => new Date(b.date) - new Date(a.date));
  const dates = [...new Set(us.map(s => s.date))].sort((a, b) => new Date(b) - new Date(a));

  // Current streak
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  let checkDate = new Date(today);
  for (let i = 0; i < 365; i++) {
    const d = checkDate.toISOString().slice(0, 10);
    if (dates.includes(d)) { streak++; checkDate.setDate(checkDate.getDate() - 1); }
    else if (i === 0) { checkDate.setDate(checkDate.getDate() - 1); } // allow today not done yet
    else break;
  }

  // Best streak ever
  let bestStreak = 0, cur = 0;
  const allDates = [...dates].sort();
  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) { cur = 1; } else {
      const diff = (new Date(allDates[i]) - new Date(allDates[i - 1])) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
    }
    bestStreak = Math.max(bestStreak, cur);
  }

  const total = us.length;
  const totalMin = us.reduce((a, s) => a + (+s.duration || 0), 0);

  // Badges
  const badges = [];
  if (streak >= 7) badges.push({ icon: "🔥", label: "7j streak" });
  if (streak >= 30) badges.push({ icon: "💎", label: "30j streak" });
  if (total >= 10) badges.push({ icon: "🎯", label: "10 séances" });
  if (total >= 50) badges.push({ icon: "⭐", label: "50 séances" });
  if (us.some(s => s.discipline === "Course à pied" && parseFloat(s.distance) >= 5)) badges.push({ icon: "🏃", label: "5km ✓" });
  if (us.some(s => s.discipline === "Natation" && parseFloat(s.distance) >= 750)) badges.push({ icon: "🏊", label: "750m ✓" });
  if (us.some(s => s.discipline === "Vélo" && parseFloat(s.distance) >= 20)) badges.push({ icon: "🚴", label: "20km ✓" });
  if (us.some(s => s.discipline === "Brick")) badges.push({ icon: "⚡", label: "1er Brick" });
  if (totalMin >= 1000) badges.push({ icon: "🕐", label: "+1000min" });

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🔥 Régularité — <span style={{ color: USERS[user].color }}>{USERS[user].name}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
        {[
          { val: streak, label: "Streak actuel", icon: "🔥" },
          { val: bestStreak, label: "Meilleur streak", icon: "💎" },
          { val: total, label: "Total séances", icon: "📊" },
          { val: `${Math.floor(totalMin / 60)}h`, label: "Total heures", icon: "⏱" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center", padding: "8px 4px", background: "rgba(255,255,255,0.04)", borderRadius: 8 }}>
            <div style={{ fontSize: 16 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: USERS[user].color }}>{s.val}</div>
            <div style={{ fontSize: 9, color: "#666" }}>{s.label}</div>
          </div>
        ))}
      </div>
      {badges.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {badges.map(b => (
            <span key={b.label} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 99, padding: "3px 10px", fontSize: 11 }}>
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      )}
      {badges.length === 0 && <div style={{ color: "#555", fontSize: 12 }}>Continue à t'entraîner pour débloquer des badges ! 💪</div>}
    </Card>
  );
}
// ─── WEEKLY GOALS ────────────────────────────────────────────────────────────
function WeeklyGoals({ user, goals, setGoals, sessions }) {
  const [editing, setEditing] = useState(false);
  const userGoals = goals[user] || { count: 3, distanceRun: 10, distanceSwim: 0, distanceBike: 0 };

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const weekSessions = sessions.filter(s => s.user === user && new Date(s.date) >= weekStart);

  const currentCount = weekSessions.length;
  const currentRun = weekSessions.filter(s => s.discipline === "Course à pied").reduce((a, s) => a + parseFloat(s.distance || 0), 0);
  const currentSwim = weekSessions.filter(s => s.discipline === "Natation").reduce((a, s) => a + parseFloat(s.distance || 0), 0);
  const currentBike = weekSessions.filter(s => s.discipline === "Vélo").reduce((a, s) => a + parseFloat(s.distance || 0), 0);

  const saveGoals = (g) => {
    setGoals({ ...goals, [user]: { ...userGoals, ...g } });
  };

  const pb = (curr, max, color) => {
    const pct = max ? Math.min((curr / max) * 100, 100) : 0;
    return (
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 99, marginTop: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width 0.5s" }} />
      </div>
    );
  };

  const inp = { width: 50, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "4px 8px", borderRadius: 4, textAlign: "right", fontFamily: "inherit" };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>🎯 Objectifs Hebdomadaires</div>
        <button onClick={() => setEditing(!editing)} style={{ background: "none", border: "none", color: USERS[user].color, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          {editing ? "OK" : "Modifier"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#bbb" }}>
            <span>Séances ({currentCount}/{userGoals.count})</span>
            {editing && <input type="number" style={inp} value={userGoals.count} onChange={e => saveGoals({ count: +e.target.value })} />}
          </div>
          {pb(currentCount, userGoals.count, USERS[user].color)}
        </div>
        
        {(userGoals.distanceRun > 0 || editing) && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#bbb" }}>
              <span>🏃 Course ({currentRun.toFixed(1)}/{userGoals.distanceRun} km)</span>
              {editing && <input type="number" style={inp} value={userGoals.distanceRun} onChange={e => saveGoals({ distanceRun: +e.target.value })} />}
            </div>
            {pb(currentRun, userGoals.distanceRun, "#ff6b35")}
          </div>
        )}

        {(userGoals.distanceBike > 0 || editing) && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#bbb" }}>
              <span>🚴 Vélo ({currentBike.toFixed(1)}/{userGoals.distanceBike} km)</span>
              {editing && <input type="number" style={inp} value={userGoals.distanceBike} onChange={e => saveGoals({ distanceBike: +e.target.value })} />}
            </div>
            {pb(currentBike, userGoals.distanceBike, "#3b82f6")}
          </div>
        )}

        {(userGoals.distanceSwim > 0 || editing) && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#bbb" }}>
              <span>🏊 Natation ({currentSwim.toFixed(0)}/{userGoals.distanceSwim} m)</span>
              {editing && <input type="number" style={inp} value={userGoals.distanceSwim} onChange={e => saveGoals({ distanceSwim: +e.target.value })} />}
            </div>
            {pb(currentSwim, userGoals.distanceSwim, "#00d4ff")}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── PROGRESS CHARTS ─────────────────────────────────────────────────────────
function ProgressCharts({ user, sessions }) {
  const us = sessions.filter(s => s.user === user);
  
  // Volume over last 8 weeks
  const weeks = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1 - i * 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    
    const ws = us.filter(s => { const d = new Date(s.date); return d >= start && d < end; });
    const dur = ws.reduce((a, s) => a + (+s.duration || 0), 0);
    const rpeAvg = ws.length ? ws.reduce((a, s) => a + (+s.rpe || 0), 0) / ws.length : 0;
    
    weeks.push({ weekStr: `${start.getDate()}/${start.getMonth()+1}`, dur, rpeAvg });
  }

  const maxDur = Math.max(...weeks.map(w => w.dur), 1);
  const chartH = 100;

  return (
    <Card>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📈 Volume & RPE — <span style={{ color: USERS[user].color }}>{USERS[user].name}</span></div>
      
      <div style={{ display: "flex", alignItems: "flex-end", height: chartH, gap: 4, paddingBottom: 20, position: "relative" }}>
        {weeks.map((w, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            <div style={{ width: "100%", background: `${USERS[user].color}40`, borderRadius: "4px 4px 0 0",
              height: `${(w.dur / maxDur) * chartH}px`, minHeight: w.dur > 0 ? 4 : 0, transition: "height 0.3s" }} />
            
            {/* RPE Dot */}
            {w.dur > 0 && (
              <div style={{ position: "absolute", bottom: `${(w.rpeAvg / 10) * chartH}px`, width: 6, height: 6, 
                borderRadius: "50%", background: "#ff4d4d", zIndex: 10, transform: "translateY(50%)" }} />
            )}

            <div style={{ position: "absolute", bottom: -18, fontSize: 9, color: "#888", whiteSpace: "nowrap", transform: "rotate(-45deg)", transformOrigin: "top left" }}>
              {w.weekStr}
            </div>
          </div>
        ))}
        {/* Legend */}
        <div style={{ position: "absolute", top: -10, right: 0, fontSize: 10, display: "flex", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, background: `${USERS[user].color}40`, borderRadius: 2 }} /> Volume</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff4d4d" }} /> RPE</span>
        </div>
      </div>
    </Card>
  );
}

// ─── PROFILE / SETTINGS ──────────────────────────────────────────────────────
function ProfileSettings({ user, weightData, setWeightData, hrZones, setHrZones }) {
  const [weight, setWeight] = useState("");
  const [fcMax, setFcMax] = useState(hrZones[user]?.max || 190);
  
  const addWeight = () => {
    if (!weight) return;
    const now = new Date().toISOString().slice(0, 10);
    const newEntry = { date: now, val: parseFloat(weight) };
    const userW = weightData[user] || [];
    const existing = userW.findIndex(w => w.date === now);
    let updated = [...userW];
    if (existing >= 0) updated[existing] = newEntry;
    else updated.push(newEntry);
    setWeightData({ ...weightData, [user]: updated.sort((a, b) => new Date(a.date) - new Date(b.date)) });
    setWeight("");
  };

  const saveHr = () => {
    const max = parseInt(fcMax);
    const z = { max, z1: Math.round(max * 0.6), z2: Math.round(max * 0.7), z3: Math.round(max * 0.8), z4: Math.round(max * 0.9) };
    setHrZones({ ...hrZones, [user]: z });
  };

  const userW = weightData[user] || [];
  const currZones = hrZones[user] || { max: 190, z1: 114, z2: 133, z3: 152, z4: 171 };

  const inp = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: 13, flex: 1, outline: "none", fontFamily: "inherit" };
  const btn = { background: `linear-gradient(135deg, ${USERS[user].color}cc, ${USERS[user].color})`, border: "none", 
    borderRadius: 8, padding: "8px 16px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Weight Tracker */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>⚖️ Suivi du poids</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input type="number" step="0.1" placeholder="Poids (kg)" value={weight} onChange={e => setWeight(e.target.value)} style={inp} />
          <button onClick={addWeight} style={btn}>Ajouter</button>
        </div>
        {userW.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "nowrap", overflowX: "auto", gap: 4, paddingBottom: 8 }}>
            {userW.slice(-10).map((w, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", padding: "6px 10px", borderRadius: 8, textAlign: "center", minWidth: 60 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: USERS[user].color }}>{w.val}</div>
                <div style={{ fontSize: 9, color: "#888" }}>{w.date.slice(5)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#666" }}>Aucune donnée.</div>
        )}
      </Card>

      {/* HR Zones */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>❤️ Zones de Fréquence Cardiaque</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#aaa" }}>FC Max</div>
          <input type="number" value={fcMax} onChange={e => setFcMax(e.target.value)} style={inp} />
          <button onClick={saveHr} style={btn}>Calculer</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: "rgba(255,255,255,0.03)", padding: "8px", borderRadius: 6 }}>
            <span style={{ color: "#aaa" }}>Zone 1 (Récup)</span><span>&lt; {currZones.z1} bpm</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: "rgba(59,130,246,0.1)", padding: "8px", borderRadius: 6 }}>
            <span style={{ color: "#3b82f6" }}>Zone 2 (Endurance)</span><span>{currZones.z1} - {currZones.z2} bpm</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: "rgba(16,185,129,0.1)", padding: "8px", borderRadius: 6 }}>
            <span style={{ color: "#10b981" }}>Zone 3 (Tempo)</span><span>{currZones.z2} - {currZones.z3} bpm</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: "rgba(245,158,11,0.1)", padding: "8px", borderRadius: 6 }}>
            <span style={{ color: "#f59e0b" }}>Zone 4 (Seuil)</span><span>{currZones.z3} - {currZones.z4} bpm</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, background: "rgba(239,68,68,0.1)", padding: "8px", borderRadius: 6 }}>
            <span style={{ color: "#ef4444" }}>Zone 5 (VMA)</span><span>&gt; {currZones.z4} bpm</span>
          </div>
        </div>
      </Card>
      {/* Export CSV */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📤 Données</div>
        <button onClick={() => {
          const us = JSON.parse(window.localStorage.getItem("tri_sessions") || "[]").filter(s => s.user === user);
          let csv = "Date,Discipline,Duree(min),RPE,Distance,Vitesse,Notes\n";
          us.forEach(s => {
            csv += `${s.date},${s.discipline},${s.duration},${s.rpe || ""},${s.distance || ""},${s.vitesse || s.allure || ""},"${(s.notes || "").replace(/"/g, '""')}"\n`;
          });
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `prepa_alfa_sessions_${user}.csv`;
          document.body.appendChild(link);
          link.click();
          link.remove();
        }} style={{ ...btn, width: "100%", background: "rgba(255,255,255,0.1)", color: "#fff" }}>
          Exporter l'historique (CSV)
        </button>
      </Card>
    </div>
  );
}

// ─── FITNESS TESTS ───────────────────────────────────────────────────────────
function FitnessTests({ user, tests, setTests }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ type: "VMA (km/h)", val: "", date: new Date().toISOString().slice(0, 10) });

  const userTests = tests[user] || [];

  const addTest = () => {
    if (!form.val) return;
    const newTests = [...userTests, { id: Date.now().toString(), ...form }];
    setTests({ ...tests, [user]: newTests.sort((a, b) => new Date(b.date) - new Date(a.date)) });
    setForm({ ...form, val: "" });
    setEditing(false);
  };

  const inp = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit" };
  const btn = { background: `linear-gradient(135deg, ${USERS[user].color}cc, ${USERS[user].color})`, border: "none", 
    borderRadius: 8, padding: "8px 16px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>🏋️ Tests Physiques</div>
        <button onClick={() => setEditing(!editing)} style={{ background: "none", border: "none", color: USERS[user].color, cursor: "pointer", fontSize: 20 }}>
          {editing ? "×" : "+"}
        </button>
      </div>

      {editing && (
        <div style={{ marginBottom: 16, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inp}>
              <option>VMA (km/h)</option>
              <option>Seuil FTP (W)</option>
              <option>Cooper (m)</option>
              <option>Test 400m Nat (min)</option>
              <option>1RM Squat (kg)</option>
              <option>1RM DC (kg)</option>
            </select>
            <input type="number" step="0.1" placeholder="Valeur" value={form.val} onChange={e => setForm({ ...form, val: e.target.value })} style={inp} />
          </div>
          <button onClick={addTest} style={btn}>Enregistrer</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {userTests.length === 0 ? <div style={{ fontSize: 13, color: "#666" }}>Aucun test enregistré.</div> : null}
        {userTests.map(t => (
          <div key={t.id} style={{ display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: 8 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{t.type}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{t.date}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: USERS[user].color }}>{t.val}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── PLANNED SESSIONS ────────────────────────────────────────────────────────
function PlannedSessions({ user, planned, setPlanned }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), discipline: "Course à pied", desc: "" });

  const userPlanned = planned[user] || [];

  const addPlan = () => {
    if (!form.desc) return;
    const newP = [...userPlanned, { id: Date.now().toString(), ...form }];
    setPlanned({ ...planned, [user]: newP.sort((a, b) => new Date(a.date) - new Date(b.date)) });
    setForm({ ...form, desc: "" });
    setEditing(false);
  };
  
  const deletePlan = (id) => {
    setPlanned({ ...planned, [user]: userPlanned.filter(p => p.id !== id) });
  };

  const inp = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, color: "#fff", padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit" };
  const btn = { background: `linear-gradient(135deg, ${USERS[user].color}cc, ${USERS[user].color})`, border: "none", 
    borderRadius: 8, padding: "8px 16px", color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" };

  const upcoming = userPlanned.filter(p => new Date(p.date) >= new Date(new Date().setHours(0,0,0,0)));

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>📆 Séances Planifiées</div>
        <button onClick={() => setEditing(!editing)} style={{ background: "none", border: "none", color: USERS[user].color, cursor: "pointer", fontSize: 20 }}>
          {editing ? "×" : "+"}
        </button>
      </div>

      {editing && (
        <div style={{ marginBottom: 16, padding: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inp} />
            <select value={form.discipline} onChange={e => setForm({ ...form, discipline: e.target.value })} style={inp}>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <input type="text" placeholder="Description courte (ex: 4x1000m R=1:30)" value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} style={{ ...inp, marginBottom: 8 }} />
          <button onClick={addPlan} style={btn}>Programmer</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {upcoming.length === 0 ? <div style={{ fontSize: 13, color: "#666" }}>Aucune séance prévue.</div> : null}
        {upcoming.map(p => (
          <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: 8 }}>
            <div style={{ fontSize: 20 }}>{DISC_ICONS[p.discipline]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.desc}</div>
              <div style={{ fontSize: 11, color: "#888" }}>{new Date(p.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            </div>
            <button onClick={() => deletePlan(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>🗑️</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeUser, setActiveUser] = useState("louis");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sessions, setSessions] = useStorage("tri_sessions", []);
  const [wellness, setWellness] = useStorage("tri_wellness", []);
  const [goals, setGoals] = useStorage("tri_goals", {});
  const [weightData, setWeightData] = useStorage("tri_weight", {});
  const [hrZones, setHrZones] = useStorage("tri_hr_zones", {});
  const [tests, setTests] = useStorage("tri_tests", {});
  const [planned, setPlanned] = useStorage("tri_planned", {});
  const [analysis, setAnalysis] = useState(null);

  async function handleAnalyze(session, lastSame) {
    const sys = buildCoachPrompt(activeUser, sessions, wellness);
    let detail = `Discipline : ${session.discipline}\nDurée : ${session.duration} min\nRPE : ${session.rpe}/10`;
    if (session.distance) detail += `\nDistance : ${session.distance}${session.distanceUnit || ''}`;
    if (session.allure) detail += `\nAllure : ${session.allure}`;
    if (session.vitesse) detail += `\nVitesse moy : ${session.vitesse} km/h`;
    if (session.denivele) detail += `\nDénivelé+ : ${session.denivele}m`;
    if (session.nageType) detail += `\nType de nage : ${session.nageType}`;
    if (session.veloType) detail += `\nType vélo : ${session.veloType}`;
    if (session.capType) detail += `\nType sortie : ${session.capType}`;
    if (session.muscuFocus) detail += `\nFocus : ${session.muscuFocus}`;
    if (session.exercises && session.exercises.length) {
      detail += `\nExercices :`;
      session.exercises.forEach(e => {
        if (e.name) detail += `\n  - ${e.name} : ${e.sets?.map(s => `${s.weight}kg × ${s.reps} reps`).join(' / ')}`;
      });
    }
    if (session.notes) detail += `\nNotes : ${session.notes}`;
    const msg = `Analyse cette séance que je viens d'enregistrer :\n${detail}
${lastSame ? `\nComparaison avec la dernière séance de même type (${lastSame.date}) :\n- Durée : ${lastSame.duration} min\n- RPE : ${lastSame.rpe}/10` : "\nC'est la première séance de ce type enregistrée."}

Donne-moi une analyse courte (4–6 lignes max) : feedback sur la séance, comparaison, conseil pour la prochaine.`;
    const reply = await callClaude(sys, msg);
    setAnalysis(reply);
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "session", label: "Séance", icon: "📝" },
    { id: "coach", label: "Coach IA", icon: "🤖" },
    { id: "plan", label: "Plan", icon: "📅" },
    { id: "duel", label: "Duel", icon: "⚡" },
    { id: "stats", label: "Stats", icon: "📈" },
    { id: "profil", label: "Profil", icon: "⚙️" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f", color: "#fff",
      fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 99px; }
        input, select, textarea { color-scheme: dark; }
        button:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>

      {/* HEADER */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.5, flex: 1, minWidth: 100 }}>
          <span style={{ color: "#00d4ff" }}>Prépa</span>
          <span style={{ color: "#ff6b35" }}>-Alfa</span>
        </div>

        {/* User switcher */}
        <div style={{ display: "flex", gap: 6 }}>
          {["louis", "romain"].map(uid => (
            <button key={uid} onClick={() => setActiveUser(uid)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                borderRadius: 99, border: `1px solid ${activeUser === uid ? USERS[uid].color : "rgba(255,255,255,0.1)"}`,
                background: activeUser === uid ? `${USERS[uid].color}22` : "transparent",
                color: activeUser === uid ? USERS[uid].color : "#888",
                cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", transition: "all 0.2s",
              }}>
              <Avatar user={uid} size={20} />
              {USERS[uid].name}
            </button>
          ))}
        </div>

        <Countdown />
      </div>

      {/* MAIN */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 100px" }}>
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <MiniStats user={activeUser} sessions={sessions} wellness={wellness} />
            <Streaks user={activeUser} sessions={sessions} />
            <WellnessForm user={activeUser} wellness={wellness} setWellness={setWellness} />
            <Milestones user={activeUser} sessions={sessions} />
            <PersonalRecords user={activeUser} sessions={sessions} />
            <SessionHistory user={activeUser} sessions={sessions} setSessions={setSessions} />
          </div>
        )}
        {activeTab === "session" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <WeeklyGoals user={activeUser} goals={goals} setGoals={setGoals} sessions={sessions} />
            <SessionForm user={activeUser} sessions={sessions} setSessions={setSessions} onAnalyze={handleAnalyze} />
          </div>
        )}
        {activeTab === "coach" && (
          <AIChat user={activeUser} sessions={sessions} wellness={wellness} />
        )}
        {activeTab === "plan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <PlannedSessions user={activeUser} planned={planned} setPlanned={setPlanned} />
            <TrainingPlan user={activeUser} sessions={sessions} wellness={wellness} />
          </div>
        )}
        {activeTab === "duel" && (
          <DuelDashboard sessions={sessions} wellness={wellness} />
        )}
        {activeTab === "stats" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <FitnessTests user={activeUser} tests={tests} setTests={setTests} />
            <ProgressCharts user={activeUser} sessions={sessions} />
          </div>
        )}
        {activeTab === "profil" && (
          <ProfileSettings user={activeUser} weightData={weightData} setWeightData={setWeightData} hrZones={hrZones} setHrZones={setHrZones} />
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(10,10,15,0.96)", backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        display: "flex", padding: "8px 0 max(8px, env(safe-area-inset-bottom))",
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: "none", border: "none", cursor: "pointer",
              color: activeTab === t.id ? USERS[activeUser].color : "#555",
              fontFamily: "inherit", transition: "color 0.2s",
            }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: activeTab === t.id ? 700 : 400 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <AIAnalysisPopup analysis={analysis} onClose={() => setAnalysis(null)} />
    </div>
  );
}
