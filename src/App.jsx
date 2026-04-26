import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const USERS = {
  louis: { name: 'Louis', color: '#0071e3', avatar: 'L', profile: 'Musculation 3 ans, régulier 1 an (4x/sem). Bonne base de force. Ne court pas. Sait nager.' },
  romain: { name: 'Romain', color: '#ff6b35', avatar: 'R', profile: 'Reprend le sport de zéro. Ne court pas. Sait nager. A un VTT.' },
}

const DISCIPLINES = ['Natation', 'Vélo', 'Course à pied', 'Musculation', 'Brick', 'Récupération']
const ICONS = { Natation: '🏊', Vélo: '🚴', 'Course à pied': '🏃', Musculation: '💪', Brick: '⚡', Récupération: '🧘' }
const RACE_DATE = new Date('2026-12-15')

const PLAN = {
  louis: [
    { phase: 'Fondation', weeks: 'Juin – Août', desc: '3 séances/sem · Musculation gainage 2x · RPE 5–6' },
    { phase: 'Développement', weeks: 'Sept – Oct', desc: '4 séances/sem · Bricks introduits · +10% volume/sem' },
    { phase: 'Spécifique', weeks: 'Novembre', desc: '5 séances/sem · Allures cibles · Gainage uniquement' },
    { phase: 'Affûtage', weeks: 'Décembre', desc: 'Volume −40% · Simulation course semaine 3' },
  ],
  romain: [
    { phase: 'Fondation', weeks: 'Juin – Août', desc: '2 séances/sem · Courir 20min + nager 200m · RPE 4–5' },
    { phase: 'Développement', weeks: 'Sept – Oct', desc: '3 séances/sem · Vélo introduit · Premiers bricks' },
    { phase: 'Spécifique', weeks: 'Novembre', desc: '4 séances/sem · Distances cibles atteintes' },
    { phase: 'Affûtage', weeks: 'Décembre', desc: 'Volume réduit · Confiance · Simulation course' },
  ],
}

// ─── AI ───────────────────────────────────────────────────────────────────────
async function callClaude(system, userMsg, history = []) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: [...history, { role: 'user', content: userMsg }],
    }),
  })
  const data = await res.json()
  return data.content?.map(b => b.text || '').join('') || 'Erreur de connexion.'
}

function buildSystem(uid, sessions, wellness) {
  const s = sessions.filter(x => x.user_id === uid).slice(-15)
  const w = wellness.filter(x => x.user_id === uid).slice(-7)
  return `Tu es le coach personnel de ${USERS[uid].name}, expert en triathlon Sprint, préparation physique et nutrition sportive.

PROFIL : ${USERS[uid].profile}
OBJECTIF : Triathlon Sprint (750m nat / 20km vélo / 5km CAP) — Décembre 2026.

SÉANCES RÉCENTES :
${s.map(x => `• ${x.date} | ${x.discipline} | ${x.duration}min${x.distance ? ` | ${x.distance}${x.distance_unit}` : ''} | RPE ${x.rpe}/10`).join('\n') || 'Aucune séance encore.'}

BIEN-ÊTRE RÉCENT :
${w.map(x => `• ${x.date} | Sommeil ${x.sleep}/5 | Fatigue ${x.fatigue}/5 | Humeur ${x.mood}/5`).join('\n') || 'Aucune donnée.'}

Réponds en français. Sois direct, bienveillant, précis. Donne des conseils concrets adaptés à son historique.`
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10)
const daysLeft = () => Math.max(0, Math.ceil((RACE_DATE - new Date()) / 86400000))
const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d }

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const T = {
  bg: '#ffffff',
  bgSecondary: '#f5f5f7',
  bgTertiary: '#e8e8ed',
  text: '#1d1d1f',
  textSecondary: '#6e6e73',
  textTertiary: '#aeaeb2',
  border: '#d2d2d7',
  borderLight: '#e8e8ed',
  radius: 14,
  radiusSm: 10,
  shadow: '0 2px 20px rgba(0,0,0,0.08)',
  shadowSm: '0 1px 8px rgba(0,0,0,0.06)',
}

// ─── ATOMS ───────────────────────────────────────────────────────────────────
function Chip({ children, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
      background: active ? color : T.bgSecondary,
      color: active ? '#fff' : T.textSecondary,
      fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
      transition: 'all 0.15s ease',
    }}>{children}</button>
  )
}

function Pill({ children, color = T.textSecondary }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      background: `${color}15`, color,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
    }}>{children}</span>
  )
}

function Section({ title, children, action }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: T.text, margin: 0 }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.bg, borderRadius: T.radius,
      border: `1px solid ${T.borderLight}`,
      boxShadow: T.shadowSm,
      padding: 20, ...style,
      cursor: onClick ? 'pointer' : 'default',
    }}>{children}</div>
  )
}

function Bar({ value, max, color, height = 4 }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0)
  return (
    <div style={{ background: T.bgTertiary, borderRadius: 99, height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function Avatar({ uid, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: USERS[uid].color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, flexShrink: 0,
    }}>{USERS[uid].avatar}</div>
  )
}

function Btn({ children, onClick, disabled, variant = 'primary', color, style }) {
  const c = color || USERS.louis.color
  const styles = {
    primary: { background: disabled ? T.bgTertiary : c, color: disabled ? T.textTertiary : '#fff', border: 'none' },
    secondary: { background: T.bgSecondary, color: T.text, border: 'none' },
    ghost: { background: 'transparent', color: c, border: `1px solid ${T.border}` },
  }
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 20px', borderRadius: T.radiusSm,
      fontSize: 14, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', transition: 'all 0.15s ease',
      ...styles[variant], ...style,
    }}>{children}</button>
  )
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <Card style={{ textAlign: 'center', padding: '20px 12px' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || T.text, letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 13, color: T.text, fontWeight: 500, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4 }}>{sub}</div>}
    </Card>
  )
}

// ─── WELLNESS ────────────────────────────────────────────────────────────────
function WellnessForm({ uid, wellness, onSave }) {
  const t = today()
  const ex = wellness.find(w => w.user_id === uid && w.date === t)
  const [sleep, setSleep] = useState(ex?.sleep || 3)
  const [fatigue, setFatigue] = useState(ex?.fatigue || 3)
  const [mood, setMood] = useState(ex?.mood || 3)
  const [saved, setSaved] = useState(!!ex)
  const [loading, setLoading] = useState(false)

  const score = Math.round(((sleep + (6 - fatigue) + mood) / 13) * 100)
  const scoreColor = score >= 70 ? '#34c759' : score >= 40 ? '#ff9500' : '#ff3b30'
  const emojis = [['😴','😞','😐','😊','🤩'], ['🤩','😊','😐','😞','😴'], ['😞','😐','😊','😄','🤩']]

  async function save() {
    setLoading(true)
    await supabase.from('wellness').upsert({ user_id: uid, date: t, sleep, fatigue, mood }, { onConflict: 'user_id,date' })
    await onSave()
    setSaved(true)
    setLoading(false)
  }

  const labels = ['Sommeil', 'Énergie', 'Humeur']
  const vals = [sleep, 6 - fatigue, mood]
  const sets = [(v) => { setSleep(v); setSaved(false) }, (v) => { setFatigue(6 - v); setSaved(false) }, (v) => { setMood(v); setSaved(false) }]

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Check-in du matin</div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>Comment tu te sens aujourd'hui ?</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor }}>{score}%</div>
          <div style={{ fontSize: 10, color: T.textTertiary }}>bien-être</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
        {labels.map((label, i) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: T.textSecondary }}>{label}</span>
              <span style={{ fontSize: 18 }}>{emojis[i][vals[i] - 1]}</span>
            </div>
            <input type="range" min="1" max="5" value={vals[i]}
              onChange={e => sets[i](+e.target.value)}
              style={{ width: '100%', accentColor: USERS[uid].color, cursor: 'pointer' }} />
          </div>
        ))}
      </div>
      <Btn onClick={save} disabled={saved || loading} color={USERS[uid].color} style={{ width: '100%' }}>
        {loading ? 'Enregistrement...' : saved ? '✓ Check-in enregistré' : 'Enregistrer'}
      </Btn>
    </Card>
  )
}

// ─── SESSION FORM ─────────────────────────────────────────────────────────────
function SessionForm({ uid, sessions, onSave, onAnalyze }) {
  const [f, setF] = useState({ date: today(), discipline: 'Course à pied', duration: '', distance: '', distance_unit: 'km', pace: '', hr_avg: '', hr_max: '', rpe: '6', notes: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const last = sessions.filter(s => s.user_id === uid && s.discipline === f.discipline)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0]

  const delta = last && f.distance && last.distance
    ? ((+f.distance - +last.distance) / +last.distance * 100).toFixed(1) : null

  const inp = { style: { background: T.bgSecondary, border: 'none', borderRadius: T.radiusSm, color: T.text, padding: '10px 14px', fontSize: 14, width: '100%', outline: 'none', fontFamily: 'inherit' } }

  async function submit() {
    if (!f.duration) return
    setLoading(true)
    const session = { ...f, user_id: uid, duration: +f.duration, distance: f.distance ? +f.distance : null, hr_avg: f.hr_avg ? +f.hr_avg : null, hr_max: f.hr_max ? +f.hr_max : null, rpe: +f.rpe }
    await supabase.from('sessions').insert(session)
    await onSave()
    onAnalyze(session, last)
    setF(p => ({ ...p, duration: '', distance: '', pace: '', notes: '', rpe: '6' }))
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Discipline selector */}
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 10, fontWeight: 500 }}>DISCIPLINE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DISCIPLINES.map(d => (
            <Chip key={d} active={f.discipline === d} color={USERS[uid].color} onClick={() => set('discipline', d)}>
              {ICONS[d]} {d}
            </Chip>
          ))}
        </div>
      </Card>

      {/* Main fields */}
      <Card style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6, fontWeight: 500 }}>DATE</div>
            <input type="date" value={f.date} onChange={e => set('date', e.target.value)} {...inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6, fontWeight: 500 }}>DURÉE (min)</div>
            <input type="number" value={f.duration} onChange={e => set('duration', e.target.value)} placeholder="45" {...inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6, fontWeight: 500 }}>DISTANCE</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" value={f.distance} onChange={e => set('distance', e.target.value)} placeholder="5" style={{ ...inp.style, flex: 1, width: 'auto' }} />
              <select value={f.distance_unit} onChange={e => set('distance_unit', e.target.value)} style={{ ...inp.style, width: 60 }}>
                <option>km</option><option>m</option>
              </select>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6, fontWeight: 500 }}>ALLURE</div>
            <input value={f.pace} onChange={e => set('pace', e.target.value)} placeholder="5:30/km" {...inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6, fontWeight: 500 }}>FC MOY</div>
            <input type="number" value={f.hr_avg} onChange={e => set('hr_avg', e.target.value)} placeholder="145" {...inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6, fontWeight: 500 }}>FC MAX</div>
            <input type="number" value={f.hr_max} onChange={e => set('hr_max', e.target.value)} placeholder="172" {...inp} />
          </div>
        </div>

        {/* RPE */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: T.textSecondary, fontWeight: 500 }}>EFFORT PERÇU (RPE)</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: USERS[uid].color }}>{f.rpe}/10</span>
          </div>
          <input type="range" min="1" max="10" value={f.rpe} onChange={e => set('rpe', e.target.value)}
            style={{ width: '100%', accentColor: USERS[uid].color }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textTertiary, marginTop: 4 }}>
            <span>Facile</span><span>Modéré</span><span>Maximum</span>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 6, fontWeight: 500 }}>NOTES</div>
          <textarea value={f.notes} onChange={e => set('notes', e.target.value)}
            placeholder="Ressenti, observations..."
            rows={3} style={{ ...inp.style, resize: 'vertical' }} />
        </div>
      </Card>

      {/* Comparison */}
      {last && (
        <Card style={{ padding: 14, background: T.bgSecondary, boxShadow: 'none', border: 'none' }}>
          <div style={{ fontSize: 11, color: T.textSecondary, fontWeight: 500, marginBottom: 8 }}>DERNIÈRE {f.discipline.toUpperCase()}</div>
          <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
            <span style={{ color: T.text }}><span style={{ color: T.textSecondary }}>Durée </span>{last.duration}min</span>
            {last.distance && <span><span style={{ color: T.textSecondary }}>Distance </span>{last.distance}{last.distance_unit}</span>}
            {delta !== null && (
              <span style={{ fontWeight: 600, color: +delta >= 0 ? '#34c759' : '#ff3b30' }}>
                {+delta >= 0 ? '+' : ''}{delta}%
              </span>
            )}
          </div>
        </Card>
      )}

      <Btn onClick={submit} disabled={loading || !f.duration} color={USERS[uid].color} style={{ width: '100%', padding: '13px 0', fontSize: 15 }}>
        {loading ? 'Enregistrement...' : 'Enregistrer la séance'}
      </Btn>
    </div>
  )
}

// ─── HISTORY ─────────────────────────────────────────────────────────────────
function History({ uid, sessions }) {
  const list = sessions.filter(s => s.user_id === uid).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)
  if (list.length === 0) return (
    <Card style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🏁</div>
      <div style={{ fontSize: 15, color: T.text, fontWeight: 500 }}>Aucune séance encore</div>
      <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>Enregistre ta première séance</div>
    </Card>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {list.map(s => (
        <Card key={s.id} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: T.bgSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {ICONS[s.discipline]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{s.discipline}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{s.date}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{s.duration} min</div>
            {s.distance && <div style={{ fontSize: 12, color: T.textSecondary }}>{s.distance}{s.distance_unit}</div>}
          </div>
          <Pill color={USERS[uid].color}>RPE {s.rpe}</Pill>
        </Card>
      ))}
    </div>
  )
}

// ─── MILESTONES ───────────────────────────────────────────────────────────────
function Milestones({ uid, sessions }) {
  const ms = [
    { disc: 'Natation', label: '750m sans s\'arrêter', target: 750, unit: 'm', conv: s => s.distance_unit === 'm' ? +s.distance : +s.distance * 1000 },
    { disc: 'Vélo', label: '20km à rythme soutenu', target: 20, unit: 'km', conv: s => s.distance_unit === 'km' ? +s.distance : +s.distance / 1000 },
    { disc: 'Course à pied', label: '5km sans marcher', target: 5, unit: 'km', conv: s => s.distance_unit === 'km' ? +s.distance : +s.distance / 1000 },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ms.map(m => {
        const best = sessions.filter(s => s.user_id === uid && s.discipline === m.disc && s.distance).reduce((max, s) => Math.max(max, m.conv(s)), 0)
        const pct = Math.min(100, (best / m.target) * 100)
        const done = pct >= 100
        return (
          <Card key={m.disc} style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{ICONS[m.disc]} {m.disc}</div>
                <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{m.label}</div>
              </div>
              {done
                ? <Pill color="#34c759">Atteint 🏆</Pill>
                : <span style={{ fontSize: 13, fontWeight: 600, color: USERS[uid].color }}>{Math.round(pct)}%</span>
              }
            </div>
            <Bar value={pct} max={100} color={done ? '#34c759' : USERS[uid].color} height={5} />
          </Card>
        )
      })}
    </div>
  )
}

// ─── DUEL ────────────────────────────────────────────────────────────────────
function Duel({ sessions }) {
  const ws = weekAgo()
  const weekS = sessions.filter(s => new Date(s.date) >= ws)

  const stats = uid => ({
    count: weekS.filter(s => s.user_id === uid).length,
    minutes: weekS.filter(s => s.user_id === uid).reduce((a, s) => a + (s.duration || 0), 0),
    byDisc: DISCIPLINES.reduce((acc, d) => {
      acc[d] = weekS.filter(s => s.user_id === uid && s.discipline === d).reduce((a, s) => a + (s.duration || 0), 0)
      return acc
    }, {}),
  })

  const ls = stats('louis')
  const rs = stats('romain')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Scores */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center' }}>
        {['louis', 'romain'].map((uid, i) => {
          const st = uid === 'louis' ? ls : rs
          return (
            <Card key={uid} style={{ padding: 20, textAlign: 'center', order: i === 1 ? 2 : 0 }}>
              <Avatar uid={uid} size={44} />
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginTop: 10 }}>{USERS[uid].name}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: USERS[uid].color, marginTop: 4 }}>{st.count}</div>
              <div style={{ fontSize: 11, color: T.textTertiary }}>séances</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginTop: 6 }}>
                {Math.floor(st.minutes / 60)}h{String(st.minutes % 60).padStart(2, '0')}
              </div>
            </Card>
          )
        })}
        <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: T.textTertiary, order: 1 }}>VS</div>
      </div>

      {/* By discipline */}
      <Card style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500, marginBottom: 14 }}>PAR DISCIPLINE — 7 DERNIERS JOURS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {DISCIPLINES.slice(0, 4).map(d => {
            const lm = ls.byDisc[d], rm = rs.byDisc[d], tot = lm + rm
            const lpct = tot ? (lm / tot) * 100 : 50
            if (lm === 0 && rm === 0) return null
            return (
              <div key={d}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: USERS.louis.color, fontWeight: 500 }}>{lm}min</span>
                  <span style={{ color: T.textSecondary }}>{ICONS[d]} {d}</span>
                  <span style={{ color: USERS.romain.color, fontWeight: 500 }}>{rm}min</span>
                </div>
                <div style={{ height: 6, background: T.bgTertiary, borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${lpct}%`, background: USERS.louis.color, transition: 'width 0.5s' }} />
                  <div style={{ flex: 1, background: USERS.romain.color }} />
                </div>
              </div>
            )
          })}
          {ls.minutes === 0 && rs.minutes === 0 && (
            <div style={{ textAlign: 'center', color: T.textTertiary, fontSize: 13, padding: 12 }}>
              Aucune séance cette semaine
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ─── PLAN ────────────────────────────────────────────────────────────────────
function Plan({ uid }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {PLAN[uid].map((p, i) => (
        <Card key={p.phase} style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: USERS[uid].color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{p.phase}</span>
              <Pill color={USERS[uid].color}>{p.weeks}</Pill>
            </div>
            <div style={{ fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>{p.desc}</div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── AI CHAT ─────────────────────────────────────────────────────────────────
function Chat({ uid, sessions, wellness }) {
  const [msgs, setMsgs] = useState([{
    role: 'assistant',
    content: `Bonjour ${USERS[uid].name} 👋\n\nJe suis ton coach personnel. J'ai accès à tout ton historique d'entraînement.\n\nPose-moi n'importe quelle question : entraînement, nutrition, récupération, matériel, stratégie de course...`,
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottom = useRef()
  const inputRef = useRef()

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!input.trim() || loading) return
    const txt = input.trim()
    setInput('')
    setMsgs(p => [...p, { role: 'user', content: txt }])
    setLoading(true)
    const history = msgs.slice(1).map(m => ({ role: m.role, content: m.content }))
    const reply = await callClaude(buildSystem(uid, sessions, wellness), txt, history)
    setMsgs(p => [...p, { role: 'assistant', content: reply }])
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const suggestions = [
    'Analyse ma semaine',
    'Conseils nutrition',
    'Programme du jour',
    'Je suis fatigué, que faire ?',
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 400 }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'assistant' && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.bgSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🤖</div>
            )}
            {m.role === 'user' && <Avatar uid={uid} size={32} />}
            <div style={{
              maxWidth: '75%',
              background: m.role === 'user' ? USERS[uid].color : T.bgSecondary,
              color: m.role === 'user' ? '#fff' : T.text,
              borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding: '12px 16px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.bgSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
            <div style={{ background: T.bgSecondary, borderRadius: '18px 18px 18px 4px', padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: T.textTertiary, animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {/* Suggestions */}
      {msgs.length <= 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
              style={{ padding: '8px 14px', borderRadius: 99, border: `1px solid ${T.border}`, background: T.bg, color: T.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 10, background: T.bgSecondary, borderRadius: 14, padding: '8px 8px 8px 16px', alignItems: 'center' }}>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Envoie un message..."
          style={{ flex: 1, border: 'none', background: 'transparent', color: T.text, fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: loading || !input.trim() ? T.bgTertiary : USERS[uid].color,
            color: loading || !input.trim() ? T.textTertiary : '#fff',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
          }}>↑</button>
      </div>
    </div>
  )
}

// ─── ANALYSIS MODAL ───────────────────────────────────────────────────────────
function Modal({ text, onClose }) {
  if (!text) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: T.bg, borderRadius: 20, padding: 28, maxWidth: 500, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Analyse du coach</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: T.bgSecondary, color: T.textSecondary, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: T.text, whiteSpace: 'pre-wrap' }}>{text}</div>
      </div>
    </div>
  )
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
function Dashboard({ uid, sessions, wellness, onSave }) {
  const ws = weekAgo()
  const weekS = sessions.filter(s => s.user_id === uid && new Date(s.date) >= ws)
  const totalMin = weekS.reduce((a, s) => a + (s.duration || 0), 0)
  const lastWell = wellness.filter(w => w.user_id === uid).sort((a, b) => b.date.localeCompare(a.date))[0]
  const wellScore = lastWell ? Math.round(((lastWell.sleep + (6 - lastWell.fatigue) + lastWell.mood) / 13) * 100) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <StatCard label="Séances" value={weekS.length} sub="cette semaine" color={USERS[uid].color} />
        <StatCard label="Volume" value={`${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}`} sub="cette semaine" />
        <StatCard label="Bien-être" value={wellScore !== null ? `${wellScore}%` : '—'} sub="aujourd'hui" color={wellScore >= 70 ? '#34c759' : wellScore >= 40 ? '#ff9500' : '#ff3b30'} />
      </div>

      <Section title="Check-in">
        <WellnessForm uid={uid} wellness={wellness} onSave={onSave} />
      </Section>

      <Section title="Jalons">
        <Milestones uid={uid} sessions={sessions} />
      </Section>

      <Section title="Historique">
        <History uid={uid} sessions={sessions} />
      </Section>
    </div>
  )
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [uid, setUid] = useState('louis')
  const [tab, setTab] = useState('home')
  const [sessions, setSessions] = useState([])
  const [wellness, setWellness] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    const [{ data: s }, { data: w }] = await Promise.all([
      supabase.from('sessions').select('*').order('date', { ascending: false }),
      supabase.from('wellness').select('*').order('date', { ascending: false }),
    ])
    setSessions(s || [])
    setWellness(w || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function handleAnalyze(session, last) {
    const msg = `Analyse cette séance :
Discipline : ${session.discipline} | Durée : ${session.duration}min | Distance : ${session.distance || 'N/A'}${session.distance_unit || ''} | RPE : ${session.rpe}/10
Notes : ${session.notes || 'aucune'}
${last ? `\nDernière ${session.discipline} (${last.date}) : ${last.duration}min, ${last.distance || 'N/A'}${last.distance_unit || ''}, RPE ${last.rpe}/10` : '\nPremière séance de ce type.'}
Donne une analyse en 4–5 lignes : feedback, progression, conseil.`
    const reply = await callClaude(buildSystem(uid, sessions, wellness), msg)
    setAnalysis(reply)
  }

  const tabs = [
    { id: 'home', label: 'Accueil', icon: '◉' },
    { id: 'session', label: 'Séance', icon: '+' },
    { id: 'coach', label: 'Coach', icon: '💬' },
    { id: 'plan', label: 'Plan', icon: '📅' },
    { id: 'duel', label: 'Duel', icon: '⚡' },
  ]

  const tabTitles = { home: 'Bonjour,', session: 'Nouvelle séance', coach: 'Coach IA', plan: 'Plan d\'entraînement', duel: 'Duel cette semaine' }

  return (
    <div style={{ background: T.bgSecondary, minHeight: '100vh', fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
        input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 99px; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: currentColor; cursor: pointer; }
        @keyframes bounce { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: T.bg, borderBottom: `1px solid ${T.borderLight}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 20px' }}>
          {/* User switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 2 }}>{tabTitles[tab]}</div>
              {tab === 'home' && <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.5 }}>{USERS[uid].name} 👋</div>}
              {tab !== 'home' && <div style={{ fontSize: 20, fontWeight: 600, color: T.text }}>{tabTitles[tab]}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Days left */}
              <div style={{ textAlign: 'center', padding: '6px 12px', background: T.bgSecondary, borderRadius: T.radiusSm, marginRight: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: USERS[uid].color }}>J-{daysLeft()}</div>
                <div style={{ fontSize: 9, color: T.textTertiary, letterSpacing: 0.5 }}>COURSE</div>
              </div>
              {['louis', 'romain'].map(u => (
                <button key={u} onClick={() => setUid(u)} style={{
                  width: 36, height: 36, borderRadius: '50%', border: uid === u ? `2px solid ${USERS[u].color}` : '2px solid transparent',
                  background: USERS[u].color, color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  opacity: uid === u ? 1 : 0.4,
                }}>{USERS[u].avatar}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: T.textTertiary }}>Chargement...</div>
        ) : (
          <>
            {tab === 'home' && <Dashboard uid={uid} sessions={sessions} wellness={wellness} onSave={fetch} />}
            {tab === 'session' && <SessionForm uid={uid} sessions={sessions} onSave={fetch} onAnalyze={handleAnalyze} />}
            {tab === 'coach' && <Chat uid={uid} sessions={sessions} wellness={wellness} />}
            {tab === 'plan' && <Plan uid={uid} />}
            {tab === 'duel' && <Duel sessions={sessions} />}
          </>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px) saturate(180%)',
        borderTop: `1px solid ${T.borderLight}`,
        display: 'flex', paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: tab === t.id ? USERS[uid].color : T.textTertiary,
          }}>
            <span style={{ fontSize: t.id === 'session' ? 22 : 18 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <Modal text={analysis} onClose={() => setAnalysis(null)} />
    </div>
  )
}
