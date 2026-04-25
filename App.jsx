import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const USERS = {
  louis: { name: 'Louis', accent: '#0066cc', avatar: 'L', profile: 'Musculation 3 ans, régulier 1 an (4x/sem). Bonne base de force. Ne court pas. Sait nager.' },
  romain: { name: 'Romain', accent: '#cc3300', avatar: 'R', profile: 'Reprend le sport de zéro. Ne court pas. Sait nager. A un VTT.' },
}
const DISCIPLINES = ['Natation', 'Vélo', 'Course à pied', 'Musculation', 'Brick', 'Récupération']
const ICONS = { Natation: '🏊', Vélo: '🚴', 'Course à pied': '🏃', Musculation: '💪', Brick: '⚡', Récupération: '🧘' }
const RACE_DATE = new Date('2026-12-15')
const PLAN = {
  louis: [
    { phase: 'Fondation', period: 'Juin – Août', detail: '3 séances / semaine · Musculation gainage 2× · RPE 5–6' },
    { phase: 'Développement', period: 'Septembre – Octobre', detail: '4 séances / semaine · Bricks introduits · +10% volume/sem' },
    { phase: 'Spécifique', period: 'Novembre', detail: '5 séances / semaine · Allures cibles · Gainage uniquement' },
    { phase: 'Affûtage', period: 'Décembre', detail: 'Volume −40% · Simulation course · Récupération active' },
  ],
  romain: [
    { phase: 'Fondation', period: 'Juin – Août', detail: '2 séances / semaine · Courir 20min + nager 200m · RPE 4–5' },
    { phase: 'Développement', period: 'Septembre – Octobre', detail: '3 séances / semaine · Vélo introduit · Premiers bricks' },
    { phase: 'Spécifique', period: 'Novembre', detail: '4 séances / semaine · Distances cibles sur chaque discipline' },
    { phase: 'Affûtage', period: 'Décembre', detail: 'Volume réduit · Confiance · Simulation course complète' },
  ],
}

// ─── API PROXY ────────────────────────────────────────────────────────────────
async function askCoach(system, messages) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.content?.map(b => b.text || '').join('') || ''
}

function buildSystem(uid, sessions, wellness) {
  const s = sessions.filter(x => x.user_id === uid).slice(-15)
  const w = wellness.filter(x => x.user_id === uid).slice(-7)
  return `Tu es le coach personnel de ${USERS[uid].name}, expert triathlon Sprint, préparation physique et nutrition sportive.
PROFIL : ${USERS[uid].profile}
OBJECTIF : Triathlon Sprint (750m nat / 20km vélo / 5km CAP) — Décembre 2026.
SÉANCES RÉCENTES :
${s.map(x => `• ${x.date} | ${x.discipline} | ${x.duration}min${x.distance ? ` | ${x.distance}${x.distance_unit}` : ''} | RPE ${x.rpe}/10`).join('\n') || 'Aucune séance encore.'}
BIEN-ÊTRE :
${w.map(x => `• ${x.date} | Sommeil ${x.sleep}/5 | Fatigue ${x.fatigue}/5 | Humeur ${x.mood}/5`).join('\n') || 'Aucune donnée.'}
Réponds en français, de façon directe, bienveillante et concrète.`
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10)
const daysLeft = () => Math.max(0, Math.ceil((RACE_DATE - new Date()) / 86400000))
const sevenDaysAgo = () => { const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0,0,0,0); return d }

// ─── COLORS ──────────────────────────────────────────────────────────────────
const C = {
  white: '#ffffff', bg: '#f7f7f7',
  gray100: '#efefef', gray200: '#e0e0e0', gray300: '#cccccc',
  gray400: '#aaaaaa', gray500: '#888888', gray600: '#666666',
  gray800: '#333333', black: '#111111',
}

// ─── ATOMS ───────────────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: C.gray400, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{children}</div>
)

const Tag = ({ children, color }) => (
  <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 6, background: `${color}15`, color, fontSize: 12, fontWeight: 600 }}>{children}</span>
)

const Divider = () => <div style={{ height: 1, background: C.gray100, margin: '28px 0' }} />

const PBar = ({ pct, color }) => (
  <div style={{ height: 3, background: C.gray100, borderRadius: 99, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
  </div>
)

const Avatar = ({ uid, size = 34 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: USERS[uid].accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
    {USERS[uid].avatar}
  </div>
)

const inputStyle = (extra = {}) => ({
  width: '100%', padding: '11px 13px', fontSize: 15,
  background: C.bg, border: `1px solid ${C.gray200}`, borderRadius: 10,
  color: C.black, outline: 'none', fontFamily: 'inherit', ...extra,
})

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function StatRow({ label, value, sub, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderBottom: `1px solid ${C.gray100}` }}>
      <div>
        <div style={{ fontSize: 15, color: C.black, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: C.gray400, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || C.black, letterSpacing: -0.5 }}>{value}</div>
    </div>
  )
}

function WellnessCheck({ uid, wellness, onSave }) {
  const t = todayStr()
  const ex = wellness.find(w => w.user_id === uid && w.date === t)
  const [vals, setVals] = useState({ sleep: ex?.sleep || 3, fatigue: ex?.fatigue || 3, mood: ex?.mood || 3 })
  const [saved, setSaved] = useState(!!ex)
  const [saving, setSaving] = useState(false)

  const score = Math.round(((vals.sleep + (6 - vals.fatigue) + vals.mood) / 13) * 100)
  const scoreColor = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'

  const items = [
    { key: 'sleep', label: 'Sommeil', emojis: ['😴','😞','😐','😊','🤩'], display: vals.sleep },
    { key: 'fatigue', label: 'Énergie', emojis: ['🤩','😊','😐','😞','😴'], display: 6 - vals.fatigue },
    { key: 'mood', label: 'Humeur', emojis: ['😞','😐','😊','😄','🤩'], display: vals.mood },
  ]

  const onChange = (key, displayVal) => {
    const actual = key === 'fatigue' ? 6 - displayVal : displayVal
    setVals(p => ({ ...p, [key]: actual }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from('wellness').upsert({ user_id: uid, date: t, ...vals }, { onConflict: 'user_id,date' })
    await onSave(); setSaved(true); setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 14, color: C.gray500 }}>Comment tu te sens aujourd'hui ?</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor }}>{score}<span style={{ fontSize: 12, color: C.gray400, fontWeight: 400 }}>%</span></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 22 }}>
        {items.map(item => (
          <div key={item.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: C.black }}>{item.label}</span>
              <span style={{ fontSize: 18 }}>{item.emojis[item.display - 1]}</span>
            </div>
            <input type="range" min="1" max="5" value={item.display}
              onChange={e => onChange(item.key, +e.target.value)}
              style={{ width: '100%', accentColor: USERS[uid].accent, cursor: 'pointer' }} />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saved || saving} style={{
        width: '100%', padding: 13, borderRadius: 10, border: 'none',
        background: saved ? C.gray100 : USERS[uid].accent,
        color: saved ? C.gray400 : '#fff',
        fontSize: 14, fontWeight: 600, cursor: saved ? 'default' : 'pointer', fontFamily: 'inherit',
      }}>
        {saving ? 'Enregistrement...' : saved ? '✓ Check-in enregistré' : 'Enregistrer le check-in'}
      </button>
    </div>
  )
}

function MilestoneList({ uid, sessions }) {
  const targets = [
    { disc: 'Natation', label: '750m sans s\'arrêter', target: 750, toM: s => s.distance_unit === 'm' ? +s.distance : +s.distance * 1000 },
    { disc: 'Vélo', label: '20km à rythme soutenu', target: 20000, toM: s => s.distance_unit === 'km' ? +s.distance * 1000 : +s.distance },
    { disc: 'Course à pied', label: '5km sans marcher', target: 5000, toM: s => s.distance_unit === 'km' ? +s.distance * 1000 : +s.distance },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {targets.map(m => {
        const best = sessions.filter(s => s.user_id === uid && s.discipline === m.disc && s.distance).reduce((mx, s) => Math.max(mx, m.toM(s)), 0)
        const pct = (best / m.target) * 100
        const done = pct >= 100
        return (
          <div key={m.disc}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{ICONS[m.disc]} {m.disc}</div>
                <div style={{ fontSize: 12, color: C.gray400, marginTop: 1 }}>{m.label}</div>
              </div>
              {done ? <Tag color="#22c55e">Atteint 🏆</Tag> : <span style={{ fontSize: 13, fontWeight: 600, color: USERS[uid].accent }}>{Math.round(pct)}%</span>}
            </div>
            <PBar pct={pct} color={done ? '#22c55e' : USERS[uid].accent} />
          </div>
        )
      })}
    </div>
  )
}

function SessionList({ uid, sessions }) {
  const list = sessions.filter(s => s.user_id === uid).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)
  if (!list.length) return <div style={{ fontSize: 14, color: C.gray400, padding: '20px 0' }}>Aucune séance encore. Lance-toi !</div>
  return (
    <div>
      {list.map((s, i) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 0', borderBottom: i < list.length - 1 ? `1px solid ${C.gray100}` : 'none' }}>
          <div style={{ fontSize: 22, width: 32, textAlign: 'center', flexShrink: 0 }}>{ICONS[s.discipline]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{s.discipline}</div>
            <div style={{ fontSize: 12, color: C.gray400, marginTop: 1 }}>{s.date}</div>
          </div>
          <div style={{ textAlign: 'right', marginRight: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{s.duration}min</div>
            {s.distance && <div style={{ fontSize: 12, color: C.gray400 }}>{s.distance}{s.distance_unit}</div>}
          </div>
          <Tag color={USERS[uid].accent}>RPE {s.rpe}</Tag>
        </div>
      ))}
    </div>
  )
}

function SessionForm({ uid, sessions, onSave, onAnalyze }) {
  const [f, setF] = useState({ date: todayStr(), discipline: 'Course à pied', duration: '', distance: '', distance_unit: 'km', pace: '', hr_avg: '', hr_max: '', rpe: '6', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const last = sessions.filter(s => s.user_id === uid && s.discipline === f.discipline).sort((a, b) => new Date(b.date) - new Date(a.date))[0]
  const delta = last && f.distance && last.distance ? ((+f.distance - +last.distance) / +last.distance * 100).toFixed(1) : null

  async function submit() {
    if (!f.duration) return
    setSaving(true)
    const session = { ...f, user_id: uid, duration: +f.duration, distance: f.distance ? +f.distance : null, hr_avg: f.hr_avg ? +f.hr_avg : null, hr_max: f.hr_max ? +f.hr_max : null, rpe: +f.rpe }
    await supabase.from('sessions').insert(session)
    await onSave()
    onAnalyze(session, last)
    setF(p => ({ ...p, duration: '', distance: '', pace: '', notes: '', rpe: '6' }))
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <Label>Discipline</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DISCIPLINES.map(d => (
            <button key={d} onClick={() => set('discipline', d)} style={{
              padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
              border: `1.5px solid ${f.discipline === d ? USERS[uid].accent : C.gray200}`,
              background: f.discipline === d ? `${USERS[uid].accent}12` : C.white,
              color: f.discipline === d ? USERS[uid].accent : C.gray600,
              fontWeight: f.discipline === d ? 600 : 400, transition: 'all 0.12s',
            }}>{ICONS[d]} {d}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[['Date','date','date',''], ['Durée (min)','duration','number','45'], ['Allure','pace','text','5:30/km'], ['FC Moy (bpm)','hr_avg','number','145'], ['FC Max (bpm)','hr_max','number','172']].map(([label, key, type, ph]) => (
          <div key={key}>
            <Label>{label}</Label>
            <input type={type} value={f[key]} placeholder={ph} onChange={e => set(key, e.target.value)} style={inputStyle()} />
          </div>
        ))}
        <div>
          <Label>Distance</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={f.distance} placeholder="5" onChange={e => set('distance', e.target.value)} style={inputStyle({ flex: 1, width: 'auto' })} />
            <select value={f.distance_unit} onChange={e => set('distance_unit', e.target.value)} style={inputStyle({ width: 62 })}><option>km</option><option>m</option></select>
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <Label>Effort perçu (RPE)</Label>
          <span style={{ fontSize: 15, fontWeight: 700, color: USERS[uid].accent }}>{f.rpe}<span style={{ fontSize: 12, color: C.gray400, fontWeight: 400 }}>/10</span></span>
        </div>
        <input type="range" min="1" max="10" value={f.rpe} onChange={e => set('rpe', e.target.value)} style={{ width: '100%', accentColor: USERS[uid].accent }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray400, marginTop: 5 }}>
          <span>Très facile</span><span>Modéré</span><span>Maximum</span>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <textarea value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Ressenti, observations..." rows={3} style={{ ...inputStyle(), resize: 'vertical' }} />
      </div>

      {last && (
        <div style={{ padding: '14px 16px', background: C.bg, borderRadius: 10, border: `1px solid ${C.gray100}` }}>
          <Label>Dernière {f.discipline} — {last.date}</Label>
          <div style={{ display: 'flex', gap: 20, fontSize: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span><span style={{ color: C.gray400 }}>Durée </span><strong>{last.duration}min</strong></span>
            {last.distance && <span><span style={{ color: C.gray400 }}>Distance </span><strong>{last.distance}{last.distance_unit}</strong></span>}
            {delta !== null && <span style={{ fontWeight: 700, color: +delta >= 0 ? '#22c55e' : '#ef4444' }}>{+delta >= 0 ? '+' : ''}{delta}%</span>}
          </div>
        </div>
      )}

      <button onClick={submit} disabled={saving || !f.duration} style={{
        width: '100%', padding: 14, borderRadius: 12, border: 'none',
        background: saving || !f.duration ? C.gray100 : USERS[uid].accent,
        color: saving || !f.duration ? C.gray400 : '#fff',
        fontSize: 15, fontWeight: 600, cursor: saving || !f.duration ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      }}>
        {saving ? 'Enregistrement...' : 'Enregistrer la séance'}
      </button>
    </div>
  )
}

function DuelView({ sessions }) {
  const cutoff = sevenDaysAgo()
  const week = sessions.filter(s => new Date(s.date) >= cutoff)
  const stat = uid => {
    const u = week.filter(s => s.user_id === uid)
    return { count: u.length, minutes: u.reduce((a, s) => a + (s.duration || 0), 0), byDisc: DISCIPLINES.reduce((acc, d) => { acc[d] = u.filter(s => s.discipline === d).reduce((a, s) => a + (s.duration || 0), 0); return acc }, {}) }
  }
  const ls = stat('louis'), rs = stat('romain')
  const activeDiscs = DISCIPLINES.filter(d => ls.byDisc[d] + rs.byDisc[d] > 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        {['louis', 'romain'].map(uid => {
          const st = uid === 'louis' ? ls : rs
          const winning = st.minutes > (uid === 'louis' ? rs : ls).minutes
          return (
            <div key={uid} style={{ padding: '20px 16px', background: winning ? `${USERS[uid].accent}08` : C.bg, borderRadius: 14, border: `1.5px solid ${winning ? USERS[uid].accent + '44' : C.gray200}`, textAlign: 'center' }}>
              <Avatar uid={uid} size={42} />
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{USERS[uid].name}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: USERS[uid].accent, marginTop: 6, letterSpacing: -1 }}>{st.count}</div>
              <div style={{ fontSize: 11, color: C.gray400, marginBottom: 8 }}>séances</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{Math.floor(st.minutes / 60)}h{String(st.minutes % 60).padStart(2, '0')}</div>
              {winning && st.minutes > 0 && <div style={{ marginTop: 8 }}><Tag color={USERS[uid].accent}>En tête</Tag></div>}
            </div>
          )
        })}
      </div>
      {activeDiscs.length > 0 ? (
        <div>
          <Label>Par discipline — 7 derniers jours</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
            {activeDiscs.map(d => {
              const lm = ls.byDisc[d], rm = rs.byDisc[d], tot = lm + rm
              const lpct = tot ? (lm / tot) * 100 : 50
              return (
                <div key={d}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: USERS.louis.accent, fontWeight: 600 }}>{lm}min</span>
                    <span style={{ color: C.gray500 }}>{ICONS[d]} {d}</span>
                    <span style={{ color: USERS.romain.accent, fontWeight: 600 }}>{rm}min</span>
                  </div>
                  <div style={{ height: 5, background: C.gray100, borderRadius: 99, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${lpct}%`, background: USERS.louis.accent }} />
                    <div style={{ flex: 1, background: USERS.romain.accent }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: C.gray400, fontSize: 14, padding: '20px 0' }}>Aucune séance cette semaine</div>
      )}
    </div>
  )
}

function PlanView({ uid }) {
  return (
    <div>
      {PLAN[uid].map((p, i) => (
        <div key={p.phase} style={{ display: 'flex', gap: 16, padding: '20px 0', borderBottom: i < PLAN[uid].length - 1 ? `1px solid ${C.gray100}` : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: USERS[uid].accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
            {i < PLAN[uid].length - 1 && <div style={{ width: 1, flex: 1, background: C.gray100, marginTop: 8 }} />}
          </div>
          <div style={{ flex: 1, paddingBottom: i < PLAN[uid].length - 1 ? 8 : 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{p.phase}</div>
            <div style={{ fontSize: 12, color: USERS[uid].accent, fontWeight: 500, marginTop: 2 }}>{p.period}</div>
            <div style={{ fontSize: 13, color: C.gray500, marginTop: 6, lineHeight: 1.6 }}>{p.detail}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── CHAT ────────────────────────────────────────────────────────────────────
function ChatView({ uid, sessions, wellness }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: `Bonjour ${USERS[uid].name} 👋\n\nJe suis ton coach. Pose-moi n'importe quelle question sur ton entraînement, ta nutrition ou ta récupération.` }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef()
  const inputRef = useRef()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send(text) {
    const txt = (text || input).trim()
    if (!txt || loading) return
    setInput(''); setError(null)
    setMsgs(p => [...p, { role: 'user', content: txt }])
    setLoading(true)
    try {
      const history = msgs.map(m => ({ role: m.role, content: m.content }))
      const reply = await askCoach(buildSystem(uid, sessions, wellness), [...history, { role: 'user', content: txt }])
      setMsgs(p => [...p, { role: 'assistant', content: reply }])
    } catch (e) {
      setError('Impossible de contacter le coach. Vérifie ta connexion.')
      setMsgs(p => p.slice(0, -1))
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const suggestions = ['Analyse ma semaine', 'Que manger demain ?', 'Je suis épuisé', 'Programme du jour']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 158px)', minHeight: 400 }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'assistant'
              ? <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🤖</div>
              : <Avatar uid={uid} size={30} />}
            <div style={{
              maxWidth: '78%', padding: '12px 15px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? USERS[uid].accent : C.bg,
              color: m.role === 'user' ? '#fff' : C.black,
              borderRadius: m.role === 'user' ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
            <div style={{ padding: '12px 16px', background: C.bg, borderRadius: '4px 18px 18px 18px', display: 'flex', gap: 5 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: C.gray400, animation: `pulse 1.4s ${i * 0.18}s ease-in-out infinite` }} />)}
            </div>
          </div>
        )}
        {error && <div style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', padding: '8px 0' }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      {msgs.length === 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => send(s)} style={{ padding: '8px 14px', borderRadius: 99, border: `1px solid ${C.gray200}`, background: C.white, color: C.gray800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: C.bg, borderRadius: 14, border: `1px solid ${C.gray200}` }}>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Message..." style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: C.black, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
          background: !input.trim() || loading ? C.gray200 : USERS[uid].accent,
          color: !input.trim() || loading ? C.gray400 : '#fff',
          cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.15s',
        }}>↑</button>
      </div>
    </div>
  )
}

function AnalysisSheet({ text, onClose }) {
  if (!text) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: '20px 20px 0 0', padding: '24px 24px 40px', width: '100%', maxWidth: 680, maxHeight: '75vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: C.gray200, borderRadius: 99, margin: '0 auto 22px' }} />
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Analyse de ta séance</div>
        <div style={{ fontSize: 14, lineHeight: 1.75, color: C.gray800, whiteSpace: 'pre-wrap' }}>{text}</div>
        <button onClick={onClose} style={{ marginTop: 22, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: C.bg, color: C.gray800, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Fermer</button>
      </div>
    </div>
  )
}

function DashboardView({ uid, sessions, wellness, onSave }) {
  const cutoff = sevenDaysAgo()
  const week = sessions.filter(s => s.user_id === uid && new Date(s.date) >= cutoff)
  const totalMin = week.reduce((a, s) => a + (s.duration || 0), 0)
  const lastWell = wellness.filter(w => w.user_id === uid).sort((a, b) => b.date.localeCompare(a.date))[0]
  const wellScore = lastWell ? Math.round(((lastWell.sleep + (6 - lastWell.fatigue) + lastWell.mood) / 13) * 100) : null
  const scoreColor = wellScore >= 70 ? '#22c55e' : wellScore >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div>
      <StatRow label="Séances" value={week.length} sub="cette semaine" color={USERS[uid].accent} />
      <StatRow label="Volume" value={`${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}`} sub="cette semaine" />
      <StatRow label="Bien-être" value={wellScore !== null ? `${wellScore}%` : '—'} sub="aujourd'hui" color={wellScore ? scoreColor : C.gray400} />
      <Divider />
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Check-in du matin</div>
      <WellnessCheck uid={uid} wellness={wellness} onSave={onSave} />
      <Divider />
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Jalons</div>
      <MilestoneList uid={uid} sessions={sessions} />
      <Divider />
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Historique</div>
      <SessionList uid={uid} sessions={sessions} />
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [uid, setUid] = useState('louis')
  const [tab, setTab] = useState('home')
  const [sessions, setSessions] = useState([])
  const [wellness, setWellness] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [booting, setBooting] = useState(true)

  const load = useCallback(async () => {
    const [{ data: s }, { data: w }] = await Promise.all([
      supabase.from('sessions').select('*').order('date', { ascending: false }),
      supabase.from('wellness').select('*').order('date', { ascending: false }),
    ])
    setSessions(s || []); setWellness(w || []); setBooting(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAnalyze(session, last) {
    try {
      const msg = `Séance : ${session.discipline}, ${session.duration}min${session.distance ? `, ${session.distance}${session.distance_unit}` : ''}, RPE ${session.rpe}/10.${session.notes ? ` Notes : ${session.notes}.` : ''}${last ? ` Dernière ${session.discipline} (${last.date}) : ${last.duration}min, RPE ${last.rpe}/10.` : ' Première séance de ce type.'} Donne une analyse en 4 lignes.`
      const reply = await askCoach(buildSystem(uid, sessions, wellness), [{ role: 'user', content: msg }])
      setAnalysis(reply)
    } catch { /* silent fail */ }
  }

  const tabs = [
    { id: 'home', label: 'Accueil', icon: '⌂' },
    { id: 'session', label: 'Séance', icon: '+' },
    { id: 'coach', label: 'Coach', icon: '💬' },
    { id: 'plan', label: 'Plan', icon: '◎' },
    { id: 'duel', label: 'Duel', icon: '⚡' },
  ]

  const titles = { home: null, session: 'Nouvelle séance', coach: 'Coach IA', plan: 'Plan d\'entraînement', duel: 'Duel' }

  return (
    <div style={{ background: C.white, minHeight: '100vh', fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", sans-serif', color: C.black }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
        @keyframes pulse { 0%,60%,100% { opacity:0.3; transform:scale(0.8) } 30% { opacity:1; transform:scale(1) } }
        button { -webkit-tap-highlight-color: transparent; }
        input:focus, textarea:focus, select:focus { border-color: #999 !important; }
      `}</style>

      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.gray100}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {tab === 'home'
              ? <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Bonjour, <span style={{ color: USERS[uid].accent }}>{USERS[uid].name}</span> 👋</div>
              : <div style={{ fontSize: 18, fontWeight: 600 }}>{titles[tab]}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: '5px 11px', background: C.bg, borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: USERS[uid].accent }}>J‑{daysLeft()}</div>
              <div style={{ fontSize: 9, color: C.gray400, letterSpacing: '0.06em', textAlign: 'center' }}>COURSE</div>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {['louis', 'romain'].map(u => (
                <button key={u} onClick={() => setUid(u)} style={{
                  width: 32, height: 32, borderRadius: '50%', border: `2px solid ${uid === u ? USERS[u].accent : 'transparent'}`,
                  background: uid === u ? USERS[u].accent : C.gray100,
                  color: uid === u ? '#fff' : C.gray500,
                  fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: uid === u ? 1 : 0.5, transition: 'all 0.15s',
                }}>{USERS[u].avatar}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 100px' }}>
        {booting
          ? <div style={{ textAlign: 'center', padding: 60, color: C.gray400 }}>Chargement...</div>
          : <>
            {tab === 'home' && <DashboardView uid={uid} sessions={sessions} wellness={wellness} onSave={load} />}
            {tab === 'session' && <SessionForm uid={uid} sessions={sessions} onSave={load} onAnalyze={handleAnalyze} />}
            {tab === 'coach' && <ChatView uid={uid} sessions={sessions} wellness={wellness} />}
            {tab === 'plan' && <PlanView uid={uid} />}
            {tab === 'duel' && <DuelView sessions={sessions} />}
          </>}
      </div>

      {/* NAV */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${C.gray100}`, display: 'flex', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 4px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: tab === t.id ? USERS[uid].accent : C.gray400, transition: 'color 0.12s',
          }}>
            <span style={{ fontSize: t.id === 'session' ? 22 : 18 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <AnalysisSheet text={analysis} onClose={() => setAnalysis(null)} />
    </div>
  )
}
