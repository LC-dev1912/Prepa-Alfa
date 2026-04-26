import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase.js'
import {
  Waves, Bike, Footprints, Dumbbell, Zap, HeartPulse,
  Home, Plus, Bot, Calendar, Swords, Activity,
  Trophy, Clock, ChevronRight, Heart, X,
  Loader2, MessageSquare, User, Download, TrendingUp, Flame, Award
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

const ORANGE = '#FC4C02'
const BLUE = '#3B82F6'

const USERS = {
  louis: { name: 'Louis', accent: ORANGE, avatar: 'L', profile: 'Musculation 3 ans, régulier 1 an (4x/sem). Bonne base de force. Ne court pas. Sait nager.' },
  romain: { name: 'Romain', accent: BLUE, avatar: 'R', profile: 'Reprend le sport de zéro. Ne court pas. Sait nager. A un VTT.' },
}

const DISCIPLINES = ['Natation', 'Vélo', 'Course à pied', 'Musculation', 'Brick', 'Récupération']
const DISC_ICONS = { Natation: Waves, Vélo: Bike, 'Course à pied': Footprints, Musculation: Dumbbell, Brick: Zap, Récupération: HeartPulse }
const RACE_DATE = new Date('2026-12-15')

const EXERCISE_SUGGESTIONS = [
  'Squat', 'Front squat', 'Fentes', 'Presse à cuisses', 'Hip thrust', 'Deadlift',
  'Développé couché', 'Développé militaire', 'Pompes', 'Tractions', 'Rowing barre',
  'Tirage vertical', 'Gainage frontal', 'Curl biceps', 'Extensions triceps',
]

function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial } catch { return initial }
  })
  const update = useCallback((v) => {
    setVal(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      return next
    })
  }, [key])
  return [val, update]
}

async function askCoach(system, messages) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages }),
  })
  const data = await res.json()
  if (data.error) throw new Error(JSON.stringify(data.error))
  return data.content?.map(b => b.text || '').join('') || ''
}

const daysLeft = () => Math.max(0, Math.ceil((RACE_DATE - new Date()) / 86400000))
const todayStr = () => new Date().toISOString().slice(0, 10)
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0,0,0,0); return d }

function buildSystem(uid, sessions, wellness) {
  const s = sessions.filter(x => x.user_id === uid).slice(-20)
  const w = wellness.filter(x => x.user_id === uid).slice(-7)
  return `Tu es le coach personnel de ${USERS[uid].name}, expert triathlon Sprint, préparation physique et nutrition sportive.
PROFIL : ${USERS[uid].profile}
OBJECTIF : Triathlon Sprint (750m nat / 20km vélo / 5km CAP) — Décembre 2026. Jour J-${daysLeft()}.
SÉANCES RÉCENTES :
${s.map(x => `• ${x.date} | ${x.discipline} | ${x.duration}min${x.distance ? ` | ${x.distance}${x.distance_unit}` : ''} | RPE ${x.rpe}/10${x.notes ? ` | ${x.notes}` : ''}`).join('\n') || 'Aucune séance.'}
BIEN-ÊTRE :
${w.map(x => `• ${x.date} | Sommeil ${x.sleep}/5 | Fatigue ${x.fatigue}/5 | Humeur ${x.mood}/5`).join('\n') || 'Aucune donnée.'}
Réponds en français, direct, bienveillant et concret.`
}

const S = {
  bg: '#F2F2F7', card: '#FFFFFF', text: '#1C1C1E', textSec: '#8E8E93',
  textTer: '#AEAEB2', border: '#E5E5EA', green: '#34C759', red: '#FF3B30', yellow: '#FF9500',
  radius: 20, radiusSm: 12,
}

const discColor = (disc) => ({ Natation: '#007AFF', Vélo: '#FF9500', 'Course à pied': ORANGE, Musculation: '#AF52DE', Brick: '#FF3B30', Récupération: S.green })[disc] || S.textSec

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: S.card, borderRadius: S.radius, padding: '16px 18px', ...style, cursor: onClick ? 'pointer' : 'default' }}>{children}</div>
)

const Label = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: S.textSec, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>{children}</div>
)

const PBar = ({ pct, color, h = 6 }) => (
  <div style={{ height: h, background: S.bg, borderRadius: 99, overflow: 'hidden' }}>
    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
  </div>
)

const Avatar = ({ uid, size = 36 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: USERS[uid].accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, flexShrink: 0 }}>{USERS[uid].avatar}</div>
)

const DiscIcon = ({ disc, size = 20, color }) => {
  const Icon = DISC_ICONS[disc] || Activity
  return <Icon size={size} color={color || S.text} />
}

const inputStyle = (extra = {}) => ({
  width: '100%', padding: '12px 14px', fontSize: 15,
  background: S.bg, border: `1px solid ${S.border}`, borderRadius: S.radiusSm,
  color: S.text, outline: 'none', fontFamily: 'inherit', ...extra,
})

function Sheet({ open, onClose, children, title }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: S.card, borderRadius: '24px 24px 0 0', padding: '0 0 40px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: S.border, borderRadius: 99, margin: '12px auto 0' }} />
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px 0' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: S.text }}>{title}</div>
            <button onClick={onClose} style={{ background: S.bg, border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} color={S.textSec} />
            </button>
          </div>
        )}
        <div style={{ padding: '16px 20px 0' }}>{children}</div>
      </div>
    </div>
  )
}

function WellnessForm({ uid, wellness, onSave }) {
  const t = todayStr()
  const ex = wellness.find(w => w.user_id === uid && w.date === t)
  const [vals, setVals] = useState({ sleep: ex?.sleep || 3, fatigue: ex?.fatigue || 3, mood: ex?.mood || 3 })
  const [saved, setSaved] = useState(!!ex)
  const [saving, setSaving] = useState(false)
  const score = Math.round(((vals.sleep + (6 - vals.fatigue) + vals.mood) / 15) * 100)
  const scoreColor = score >= 70 ? S.green : score >= 40 ? S.yellow : S.red
  const emojis = [['😴','😞','😐','😊','🤩'],['🤩','😊','😐','😞','😴'],['😞','😐','😊','😄','🤩']]
  const items = [{ key: 'sleep', label: 'Sommeil', display: vals.sleep, emKey: 0 }, { key: 'fatigue', label: 'Énergie', display: 6 - vals.fatigue, emKey: 1 }, { key: 'mood', label: 'Humeur', display: vals.mood, emKey: 2 }]
  const onChange = (key, v) => { setVals(p => ({ ...p, [key]: key === 'fatigue' ? 6 - v : v })); setSaved(false) }
  async function save() {
    setSaving(true)
    await supabase.from('wellness').upsert({ user_id: uid, date: t, ...vals }, { onConflict: 'user_id,date' })
    await onSave(); setSaved(true); setSaving(false)
  }
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: S.text }}>Check-in du matin</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor }}>{score}<span style={{ fontSize: 12, color: S.textSec, fontWeight: 400 }}>%</span></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 18 }}>
        {items.map(item => (
          <div key={item.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: S.text, fontWeight: 500 }}>{item.label}</span>
              <span style={{ fontSize: 20 }}>{emojis[item.emKey][item.display - 1]}</span>
            </div>
            <input type="range" min="1" max="5" value={item.display} onChange={e => onChange(item.key, +e.target.value)} style={{ width: '100%', accentColor: USERS[uid].accent }} />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saved || saving} style={{ width: '100%', padding: '14px', borderRadius: S.radiusSm, border: 'none', background: saved ? S.bg : USERS[uid].accent, color: saved ? S.textSec : '#fff', fontSize: 15, fontWeight: 700, cursor: saved ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {saving ? 'Enregistrement...' : saved ? '✓ Check-in enregistré' : 'Enregistrer'}
      </button>
    </Card>
  )
}

function Milestones({ uid, sessions }) {
  const targets = [
    { disc: 'Natation', label: "750m sans s'arrêter", target: 750, toM: s => s.distance_unit === 'm' ? +s.distance : +s.distance * 1000 },
    { disc: 'Vélo', label: '20km à rythme soutenu', target: 20000, toM: s => s.distance_unit === 'km' ? +s.distance * 1000 : +s.distance },
    { disc: 'Course à pied', label: '5km sans marcher', target: 5000, toM: s => s.distance_unit === 'km' ? +s.distance * 1000 : +s.distance },
  ]
  return (
    <Card>
      <Label>Jalons objectifs</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {targets.map(m => {
          const best = sessions.filter(s => s.user_id === uid && s.discipline === m.disc && s.distance).reduce((mx, s) => Math.max(mx, m.toM(s)), 0)
          const pct = (best / m.target) * 100
          const done = pct >= 100
          const color = done ? S.green : discColor(m.disc)
          return (
            <div key={m.disc}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DiscIcon disc={m.disc} size={16} color={color} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: S.text }}>{m.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{done ? '🏆' : `${Math.round(pct)}%`}</span>
              </div>
              <PBar pct={pct} color={color} h={5} />
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function SessionForm({ uid, sessions, onSave, onAnalyze }) {
  const [f, setF] = useState({
    date: todayStr(), discipline: 'Course à pied', duration: '', distance: '', distance_unit: 'km',
    pace: '', hr_avg: '', hr_max: '', rpe: '6', conditions: '', notes: '', vitesse: '', denivele: '',
    nageType: 'Crawl', veloType: 'Route', capType: 'Footing', muscuFocus: 'Full body',
    exercises: [{ name: '', sets: [{ weight: '', reps: '' }] }],
    brickLegs: [{ discipline: 'Vélo', duration: '', distance: '' }, { discipline: 'Course à pied', duration: '', distance: '' }],
    brickTransitions: [''],
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const disc = f.discipline
  const last = sessions.filter(s => s.user_id === uid && s.discipline === disc).sort((a, b) => new Date(b.date) - new Date(a.date))[0]
  const delta = last && f.distance && last.distance ? ((+f.distance - +last.distance) / +last.distance * 100).toFixed(1) : null

  const autoPace = (() => {
    const dur = +f.duration, dist = +f.distance
    if (!dur || !dist) return null
    if (disc === 'Course à pied') {
      const pMin = dur / dist
      return `${Math.floor(pMin)}:${String(Math.round((pMin % 1) * 60)).padStart(2, '0')} /km`
    }
    if (disc === 'Vélo') return `${(dist / (dur / 60)).toFixed(1)} km/h`
    if (disc === 'Natation') {
      const pMin = dur / (dist / 100)
      return `${Math.floor(pMin)}:${String(Math.round((pMin % 1) * 60)).padStart(2, '0')} /100m`
    }
    return null
  })()

  const addBrickLeg = () => {
    if (f.brickLegs.length >= 3) return
    setF(p => ({ ...p, brickLegs: [...p.brickLegs, { discipline: 'Course à pied', duration: '', distance: '' }], brickTransitions: [...p.brickTransitions, ''] }))
  }
  const removeBrickLeg = () => setF(p => ({ ...p, brickLegs: p.brickLegs.slice(0, -1), brickTransitions: p.brickTransitions.slice(0, -1) }))
  const updBrickLeg = (i, k, v) => { const legs = [...f.brickLegs]; legs[i] = { ...legs[i], [k]: v }; set('brickLegs', legs) }
  const updBrickTrans = (i, v) => { const t = [...f.brickTransitions]; t[i] = v; set('brickTransitions', t) }

  const addEx = () => setF(p => ({ ...p, exercises: [...p.exercises, { name: '', sets: [{ weight: '', reps: '' }] }] }))
  const rmEx = i => setF(p => ({ ...p, exercises: p.exercises.filter((_, j) => j !== i) }))
  const updEx = (i, name) => { const e = [...f.exercises]; e[i] = { ...e[i], name }; set('exercises', e) }
  const addSet = i => { const e = [...f.exercises]; const l = e[i].sets.slice(-1)[0]; e[i] = { ...e[i], sets: [...e[i].sets, { weight: l?.weight || '', reps: l?.reps || '' }] }; set('exercises', e) }
  const rmSet = (ei, si) => { const e = [...f.exercises]; e[ei] = { ...e[ei], sets: e[ei].sets.filter((_, j) => j !== si) }; set('exercises', e) }
  const updSet = (ei, si, k, v) => { const e = [...f.exercises]; const sets = [...e[ei].sets]; sets[si] = { ...sets[si], [k]: v }; e[ei] = { ...e[ei], sets }; set('exercises', e) }

  async function submit() {
    if (!f.duration) return
    setSaving(true)
    // eslint-disable-next-line no-unused-vars
    const { brickLegs, brickTransitions, conditions, ...rest } = f
    const session = {
      ...rest,
      user_id: uid,
      duration: +f.duration,
      distance: f.distance ? +f.distance : null,
      rpe: +f.rpe,
      hr_avg: f.hr_avg ? +f.hr_avg : null,
      hr_max: f.hr_max ? +f.hr_max : null,
      vitesse: f.vitesse ? +f.vitesse : null,
      denivele: f.denivele ? +f.denivele : null,
    }
    if (disc === 'Brick') {
      const legs = f.brickLegs.filter(l => l.duration)
      const legsDur = legs.reduce((a, l) => a + (+l.duration || 0), 0)
      const transDur = f.brickTransitions.reduce((a, t) => a + (+t || 0), 0)
      if (legsDur > 0) session.duration = legsDur + transDur
      const legStr = legs.map(l => `${l.discipline} ${l.duration}min${l.distance ? ` ${l.distance}${l.discipline === 'Natation' ? 'm' : 'km'}` : ''}`).join(' → ')
      session.notes = session.notes ? `${session.notes} | ${legStr}` : legStr
    }
    console.log('Inserting session:', session)
    const { error } = await supabase.from('sessions').insert(session)
    if (error) {
      console.error('Supabase insert error:', error)
      setSaving(false)
      return
    }
    await onSave(); onAnalyze(session, last)
    setF(p => ({
      ...p, duration: '', distance: '', pace: '', notes: '', rpe: '6', vitesse: '', denivele: '',
      exercises: [{ name: '', sets: [{ weight: '', reps: '' }] }],
      brickLegs: [{ discipline: 'Vélo', duration: '', distance: '' }, { discipline: 'Course à pied', duration: '', distance: '' }],
      brickTransitions: [''],
    }))
    setSaving(false)
  }

  const accentBadge = (color, label) => (
    <div style={{ gridColumn: '1/-1', padding: '10px 14px', background: `${color}12`, borderRadius: S.radiusSm, display: 'flex', alignItems: 'center', gap: 8 }}>
      <TrendingUp size={14} color={color} />
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ padding: '14px 16px' }}>
        <Label>Discipline</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DISCIPLINES.map(d => {
            const color = discColor(d); const active = disc === d
            return (
              <button key={d} onClick={() => set('discipline', d)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 99, border: `1.5px solid ${active ? color : S.border}`, background: active ? `${color}18` : S.card, color: active ? color : S.textSec, fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                <DiscIcon disc={d} size={14} color={active ? color : S.textSec} />{d}
              </button>
            )
          })}
        </div>
      </Card>

      <Card style={{ padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><Label>Date</Label><input type="date" value={f.date} onChange={e => set('date', e.target.value)} style={inputStyle()} /></div>
          <div><Label>Durée (min)</Label><input type="number" value={f.duration} placeholder="45" onChange={e => set('duration', e.target.value)} style={inputStyle()} /></div>

          {disc === 'Natation' && <>
            <div>
              <Label>Distance (m)</Label>
              <input type="number" value={f.distance} placeholder="750" onChange={e => { set('distance', e.target.value); set('distance_unit', 'm') }} style={inputStyle()} />
            </div>
            <div><Label>Allure /100m</Label><input value={f.pace} placeholder="2:00" onChange={e => set('pace', e.target.value)} style={inputStyle()} /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Type de nage</Label><select value={f.nageType} onChange={e => set('nageType', e.target.value)} style={inputStyle()}>{['Crawl','Brasse','Dos','Papillon','Mixte'].map(t => <option key={t}>{t}</option>)}</select></div>
            {autoPace && accentBadge('#007AFF', `Allure calculée : ${autoPace}`)}
          </>}

          {disc === 'Vélo' && <>
            <div><Label>Distance (km)</Label><input type="number" value={f.distance} placeholder="20" onChange={e => set('distance', e.target.value)} style={inputStyle()} /></div>
            <div><Label>Vitesse (km/h)</Label><input type="number" value={f.vitesse} placeholder="28" onChange={e => set('vitesse', e.target.value)} style={inputStyle()} /></div>
            <div><Label>Dénivelé+ (m)</Label><input type="number" value={f.denivele} placeholder="200" onChange={e => set('denivele', e.target.value)} style={inputStyle()} /></div>
            <div><Label>Type</Label><select value={f.veloType} onChange={e => set('veloType', e.target.value)} style={inputStyle()}>{['Route','VTT','Home trainer','Gravel'].map(t => <option key={t}>{t}</option>)}</select></div>
            {autoPace && accentBadge('#FF9500', `Vitesse calculée : ${autoPace}`)}
          </>}

          {disc === 'Course à pied' && <>
            <div><Label>Distance (km)</Label><input type="number" value={f.distance} placeholder="5" onChange={e => set('distance', e.target.value)} style={inputStyle()} /></div>
            <div><Label>Allure /km</Label><input value={f.pace} placeholder="5:30" onChange={e => set('pace', e.target.value)} style={inputStyle()} /></div>
            <div style={{ gridColumn: '1/-1' }}><Label>Type de sortie</Label><select value={f.capType} onChange={e => set('capType', e.target.value)} style={inputStyle()}>{['Footing','Fractionné','Sortie longue','Côtes','Tempo','Récup'].map(t => <option key={t}>{t}</option>)}</select></div>
            {autoPace && accentBadge(ORANGE, `Allure calculée : ${autoPace}`)}
          </>}

          {disc === 'Musculation' && <div style={{ gridColumn: '1/-1' }}><Label>Focus</Label><select value={f.muscuFocus} onChange={e => set('muscuFocus', e.target.value)} style={inputStyle()}>{['Haut du corps','Bas du corps','Full body','Core / Gainage'].map(t => <option key={t}>{t}</option>)}</select></div>}

          {['Natation','Vélo','Course à pied'].includes(disc) && <>
            <div><Label>FC Moy (bpm)</Label><input type="number" value={f.hr_avg} placeholder="145" onChange={e => set('hr_avg', e.target.value)} style={inputStyle()} /></div>
            <div><Label>FC Max (bpm)</Label><input type="number" value={f.hr_max} placeholder="172" onChange={e => set('hr_max', e.target.value)} style={inputStyle()} /></div>
          </>}

          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <Label>Effort perçu (RPE)</Label>
              <span style={{ fontSize: 16, fontWeight: 800, color: USERS[uid].accent }}>{f.rpe}<span style={{ fontSize: 11, color: S.textSec, fontWeight: 400 }}>/10</span></span>
            </div>
            <input type="range" min="1" max="10" value={f.rpe} onChange={e => set('rpe', e.target.value)} style={{ width: '100%', accentColor: USERS[uid].accent }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: S.textTer, marginTop: 4 }}><span>Facile</span><span>Modéré</span><span>Maximum</span></div>
          </div>

          <div style={{ gridColumn: '1/-1' }}>
            <Label>Notes</Label>
            <textarea value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Ressenti, observations..." rows={3} style={{ ...inputStyle(), resize: 'vertical' }} />
          </div>
        </div>
      </Card>

      {disc === 'Brick' && (
        <Card style={{ padding: '14px 16px' }}>
          <Label>Segments du brick</Label>
          {f.brickLegs.map((leg, i) => (
            <div key={i}>
              {i > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: S.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: S.textSec, flexShrink: 0 }}>T{i}</div>
                  <input type="number" value={f.brickTransitions[i - 1] || ''} placeholder="Transition (min)" onChange={e => updBrickTrans(i - 1, e.target.value)} style={{ ...inputStyle(), padding: '8px 10px', fontSize: 13 }} />
                </div>
              )}
              <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: discColor(leg.discipline) }}>Segment {i + 1}</span>
                  {f.brickLegs.length > 2 && i === f.brickLegs.length - 1 && (
                    <button onClick={removeBrickLeg} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.red }}><X size={14} /></button>
                  )}
                </div>
                <select value={leg.discipline} onChange={e => updBrickLeg(i, 'discipline', e.target.value)} style={{ ...inputStyle({ marginBottom: 8 }) }}>
                  {['Natation', 'Vélo', 'Course à pied'].map(d => <option key={d}>{d}</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                  <input type="number" value={leg.duration} placeholder="Durée (min)" onChange={e => updBrickLeg(i, 'duration', e.target.value)} style={inputStyle({ padding: '8px 10px', fontSize: 13 })} />
                  <input type="number" value={leg.distance} placeholder={leg.discipline === 'Natation' ? 'Dist (m)' : 'Dist (km)'} onChange={e => updBrickLeg(i, 'distance', e.target.value)} style={inputStyle({ padding: '8px 10px', fontSize: 13 })} />
                </div>
              </div>
            </div>
          ))}
          {f.brickLegs.length < 3 && (
            <button onClick={addBrickLeg} style={{ width: '100%', padding: '8px', borderRadius: S.radiusSm, border: `1.5px dashed ${discColor('Brick')}`, background: `${discColor('Brick')}08`, color: discColor('Brick'), cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>+ Segment</button>
          )}
        </Card>
      )}

      {disc === 'Musculation' && (
        <Card style={{ padding: '14px 16px' }}>
          <Label>Exercices</Label>
          <datalist id="exo-list">{EXERCISE_SUGGESTIONS.map(e => <option key={e} value={e} />)}</datalist>
          {f.exercises.map((ex, ei) => (
            <div key={ei} style={{ marginBottom: 14, padding: 14, background: S.bg, borderRadius: S.radiusSm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: USERS[uid].accent }}>Exercice {ei + 1}</span>
                {f.exercises.length > 1 && <button onClick={() => rmEx(ei)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.red }}><X size={16} /></button>}
              </div>
              <input list="exo-list" value={ex.name} onChange={e => updEx(ei, e.target.value)} placeholder="Nom de l'exercice" style={{ ...inputStyle(), marginBottom: 10 }} />
              {ex.sets.map((s, si) => (
                <div key={si} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: S.textSec, minWidth: 20 }}>S{si + 1}</span>
                  <input type="number" value={s.weight} placeholder="kg" onChange={e => updSet(ei, si, 'weight', e.target.value)} style={{ ...inputStyle(), flex: 1, padding: '8px 10px', fontSize: 13 }} />
                  <span style={{ color: S.textSec, fontSize: 12 }}>×</span>
                  <input type="number" value={s.reps} placeholder="reps" onChange={e => updSet(ei, si, 'reps', e.target.value)} style={{ ...inputStyle(), flex: 1, padding: '8px 10px', fontSize: 13 }} />
                  {ex.sets.length > 1 && <button onClick={() => rmSet(ei, si)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.textTer }}><X size={14} /></button>}
                </div>
              ))}
              <button onClick={() => addSet(ei)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1px dashed ${S.border}`, background: 'transparent', color: S.textSec, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>+ Série</button>
            </div>
          ))}
          <button onClick={addEx} style={{ width: '100%', padding: '10px', borderRadius: S.radiusSm, border: `1.5px dashed ${USERS[uid].accent}`, background: `${USERS[uid].accent}08`, color: USERS[uid].accent, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>+ Exercice</button>
        </Card>
      )}

      {last && (
        <div style={{ padding: '12px 14px', background: S.bg, borderRadius: S.radiusSm, fontSize: 13 }}>
          <div style={{ color: S.textSec, marginBottom: 6, fontWeight: 500 }}>Dernière {disc} — {last.date}</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span><span style={{ color: S.textSec }}>Durée </span><strong>{last.duration}min</strong></span>
            {last.distance && <span><span style={{ color: S.textSec }}>Dist </span><strong>{last.distance}{last.distance_unit}</strong></span>}
            {delta !== null && <span style={{ fontWeight: 700, color: +delta >= 0 ? S.green : S.red }}>{+delta >= 0 ? '+' : ''}{delta}%</span>}
          </div>
        </div>
      )}
      <button onClick={submit} disabled={saving || !f.duration} style={{ width: '100%', padding: '16px', borderRadius: S.radiusSm, border: 'none', background: saving || !f.duration ? S.bg : USERS[uid].accent, color: saving || !f.duration ? S.textSec : '#fff', fontSize: 16, fontWeight: 700, cursor: saving || !f.duration ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
        {saving ? 'Enregistrement...' : 'Enregistrer la séance'}
      </button>
    </div>
  )
}

function SessionDetail({ session, uid, sessions, wellness }) {
  const [analysis, setAnalysis] = useState(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef()
  useEffect(() => {
    if (!session) return
    const msg = `Analyse cette séance : ${session.discipline}, ${session.date}, ${session.duration}min${session.distance ? `, ${session.distance}${session.distance_unit}` : ''}${session.vitesse ? `, ${session.vitesse}km/h` : ''}, RPE ${session.rpe}/10${session.notes ? `, notes: ${session.notes}` : ''}.
Structure en 4 parties : 1) Bilan 2) Points positifs 3) Points à améliorer 4) Conseil prochain.`
    askCoach(buildSystem(uid, sessions, wellness), [{ role: 'user', content: msg }])
      .then(r => { setAnalysis(r); setLoadingAnalysis(false) })
      .catch(() => { setAnalysis('Erreur lors de l\'analyse.'); setLoadingAnalysis(false) })
  }, [session?.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  async function send() {
    if (!input.trim() || sending) return
    const txt = input.trim(); setInput(''); setSending(true)
    const history = msgs.map(m => ({ role: m.role, content: m.content }))
    setMsgs(p => [...p, { role: 'user', content: txt }])
    const reply = await askCoach(buildSystem(uid, sessions, wellness) + `\nContexte: discussion sur séance du ${session.date} — ${session.discipline}.`, [...history, { role: 'user', content: txt }])
    setMsgs(p => [...p, { role: 'assistant', content: reply }])
    setSending(false)
  }
  if (!session) return null
  const color = discColor(session.discipline)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottom: `1px solid ${S.border}` }}>
        <div style={{ width: 50, height: 50, background: `${color}18`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DiscIcon disc={session.discipline} size={26} color={color} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: S.text }}>{session.discipline}</div>
          <div style={{ fontSize: 13, color: S.textSec }}>{session.date}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Durée', val: `${session.duration}min` },
          { label: 'Distance', val: session.distance ? `${session.distance}${session.distance_unit}` : '—' },
          { label: 'RPE', val: `${session.rpe}/10`, color },
          session.vitesse ? { label: 'Vitesse', val: `${session.vitesse}km/h` } : null,
          session.pace ? { label: 'Allure', val: session.pace } : null,
          session.hr_avg ? { label: 'FC moy', val: `${session.hr_avg}bpm` } : null,
        ].filter(Boolean).map((s, i) => (
          <div key={i} style={{ background: S.bg, borderRadius: S.radiusSm, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color || S.text }}>{s.val}</div>
            <div style={{ fontSize: 10, color: S.textSec, marginTop: 3, fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>
      {session.notes && <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: '12px 14px' }}><div style={{ fontSize: 11, color: S.textSec, fontWeight: 600, marginBottom: 6 }}>NOTES</div><div style={{ fontSize: 14, color: S.text, lineHeight: 1.5 }}>{session.notes}</div></div>}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: S.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={18} color={USERS[uid].accent} /> Analyse du coach</div>
        {loadingAnalysis ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: S.textSec, fontSize: 14 }}><Loader2 size={16} /> Analyse en cours...</div>
        ) : (
          <div style={{ background: `${USERS[uid].accent}08`, border: `1px solid ${USERS[uid].accent}22`, borderRadius: S.radiusSm, padding: '14px 16px', fontSize: 14, lineHeight: 1.7, color: S.text, whiteSpace: 'pre-wrap' }}>{analysis}</div>
        )}
      </div>
      {!loadingAnalysis && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={18} color={USERS[uid].accent} /> Discuter de cette séance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, maxHeight: 250, overflowY: 'auto' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.role === 'user' ? USERS[uid].accent : S.bg, color: m.role === 'user' ? '#fff' : S.text, borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px', fontSize: 14, lineHeight: 1.6 }}>{m.content}</div>
            ))}
            {sending && <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: S.bg, borderRadius: 16, fontSize: 13, color: S.textSec }}>⏳</div>}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Pose une question sur cette séance..." style={{ ...inputStyle(), flex: 1 }} />
            <button onClick={send} disabled={!input.trim() || sending} style={{ padding: '12px 16px', borderRadius: S.radiusSm, border: 'none', background: !input.trim() || sending ? S.bg : USERS[uid].accent, color: !input.trim() || sending ? S.textSec : '#fff', cursor: !input.trim() || sending ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>↑</button>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryPage({ uid, sessions, wellness, setSessions }) {
  const [filter, setFilter] = useState('Toutes')
  const [selected, setSelected] = useState(null)
  const list = sessions.filter(s => s.user_id === uid && (filter === 'Toutes' || s.discipline === filter)).sort((a, b) => new Date(b.date) - new Date(a.date))
  const deleteSession = async (id) => {
    if (!window.confirm('Supprimer cette séance ?')) return
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id)); setSelected(null)
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
        {['Toutes', ...DISCIPLINES].map(d => (
          <button key={d} onClick={() => setFilter(d)} style={{ padding: '7px 14px', borderRadius: 99, border: `1.5px solid ${filter === d ? USERS[uid].accent : S.border}`, background: filter === d ? `${USERS[uid].accent}18` : S.card, color: filter === d ? USERS[uid].accent : S.textSec, fontSize: 12, fontWeight: filter === d ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>{d}</button>
        ))}
      </div>
      <Card>
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: S.textSec }}><div style={{ fontSize: 14 }}>Aucune séance</div></div>
        ) : list.map((s, i) => {
          const color = discColor(s.discipline)
          return (
            <div key={s.id} onClick={() => setSelected(s)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < list.length - 1 ? `1px solid ${S.border}` : 'none', cursor: 'pointer' }}>
              <div style={{ width: 46, height: 46, background: `${color}18`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><DiscIcon disc={s.discipline} size={22} color={color} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: S.text }}>{s.discipline}</div>
                <div style={{ fontSize: 12, color: S.textSec, marginTop: 2 }}>{s.date}{s.distance ? ` · ${s.distance}${s.distance_unit}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right', marginRight: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: S.text }}>{s.duration}<span style={{ fontSize: 11, color: S.textSec }}>min</span></div>
                <div style={{ fontSize: 11, color, fontWeight: 600 }}>RPE {s.rpe}</div>
              </div>
              <ChevronRight size={16} color={S.textTer} />
            </div>
          )
        })}
      </Card>
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Détail de la séance">
        {selected && <>
          <SessionDetail session={selected} uid={uid} sessions={sessions} wellness={wellness} />
          <button onClick={() => deleteSession(selected.id)} style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: S.radiusSm, border: `1px solid ${S.red}`, background: 'transparent', color: S.red, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
        </>}
      </Sheet>
    </div>
  )
}

function DuelPage({ sessions }) {
  const getWeeks = (uid, disc) => {
    const result = []; const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1 - i * 7); start.setHours(0,0,0,0)
      const end = new Date(start); end.setDate(start.getDate() + 7)
      const ws = sessions.filter(s => s.user_id === uid && s.discipline === disc && new Date(s.date) >= start && new Date(s.date) < end)
      result.push({ week: `S${8 - i}`, val: +ws.reduce((a, s) => a + (+s.distance || 0), 0).toFixed(1), min: ws.reduce((a, s) => a + (s.duration || 0), 0) })
    }
    return result
  }
  const score = (uid) => {
    const s = sessions.filter(x => x.user_id === uid)
    const ws = weekStart(); const week = s.filter(x => new Date(x.date) >= ws)
    const totalKm = s.filter(x => ['Course à pied','Vélo','Natation'].includes(x.discipline)).reduce((a, x) => a + (+x.distance || 0), 0)
    const rpe = week.length ? week.reduce((a, x) => a + (x.rpe || 0), 0) / week.length : 0
    return {
      Volume: Math.round(Math.min(100, week.reduce((a, x) => a + (x.duration || 0), 0) / 3)),
      Intensité: Math.round(Math.min(100, (rpe / 10) * 100)),
      Régularité: Math.round(Math.min(100, (week.length / 4) * 100)),
      Progression: Math.round(Math.min(100, s.length * 5)),
      Endurance: Math.round(Math.min(100, totalKm / 2)),
    }
  }
  const ls = score('louis'), rs = score('romain')
  const radarData = Object.keys(ls).map(k => ({ subject: k, Louis: ls[k], Romain: rs[k] }))
  const lTotal = Object.values(ls).reduce((a, v) => a + v, 0), rTotal = Object.values(rs).reduce((a, v) => a + v, 0)
  const leader = lTotal >= rTotal ? 'louis' : 'romain'

  const ChartCard = ({ title, disc, unit = 'km' }) => {
    const lw = getWeeks('louis', disc), rw = getWeeks('romain', disc)
    const data = lw.map((w, i) => ({ week: w.week, Louis: w.val, Romain: rw[i].val }))
    return (
      <Card style={{ marginBottom: 12 }}>
        <Label>{title}</Label>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: S.textSec }} />
            <YAxis tick={{ fontSize: 10, fill: S.textSec }} />
            <Tooltip contentStyle={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 12 }} formatter={(v, n) => [`${v} ${unit}`, n]} />
            <Line type="monotone" dataKey="Louis" stroke={ORANGE} strokeWidth={2} dot={{ fill: ORANGE, r: 3 }} />
            <Line type="monotone" dataKey="Romain" stroke={BLUE} strokeWidth={2} dot={{ fill: BLUE, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ background: `${USERS[leader].accent}12`, border: `1.5px solid ${USERS[leader].accent}33` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Trophy size={32} color={USERS[leader].accent} />
          <div>
            <div style={{ fontSize: 13, color: S.textSec, fontWeight: 500 }}>En tête cette semaine</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: USERS[leader].accent }}>{USERS[leader].name}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: USERS[leader].accent }}>{Math.max(lTotal, rTotal)}<span style={{ fontSize: 12, color: S.textSec, fontWeight: 400 }}>/500</span></div>
            <div style={{ fontSize: 11, color: S.textSec }}>score total</div>
          </div>
        </div>
      </Card>
      <Card>
        <Label>Comparaison globale — radar</Label>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={S.border} />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: S.textSec }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name="Louis" dataKey="Louis" stroke={ORANGE} fill={ORANGE} fillOpacity={0.15} strokeWidth={2} />
            <Radar name="Romain" dataKey="Romain" stroke={BLUE} fill={BLUE} fillOpacity={0.15} strokeWidth={2} />
            <Tooltip contentStyle={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 12 }} />
          </RadarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8 }}>
          {['louis','romain'].map(u => <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: USERS[u].accent }}><div style={{ width: 12, height: 3, background: USERS[u].accent, borderRadius: 99 }} />{USERS[u].name}</div>)}
        </div>
      </Card>
      <ChartCard title="Course à pied — km / semaine" disc="Course à pied" unit="km" />
      <ChartCard title="Vélo — km / semaine" disc="Vélo" unit="km" />
      <ChartCard title="Natation — m / semaine" disc="Natation" unit="m" />
    </div>
  )
}

function ChatPage({ uid, sessions, wellness }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: `Bonjour ${USERS[uid].name} 👋\n\nJe suis ton coach. J'ai accès à tout ton historique.\n\nPose-moi n'importe quelle question : entraînement, nutrition, récupération, stratégie de course...` }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  async function send(text) {
    const txt = (text || input).trim(); if (!txt || loading) return
    setInput(''); setLoading(true)
    setMsgs(p => [...p, { role: 'user', content: txt }])
    try {
      const history = msgs.map(m => ({ role: m.role, content: m.content }))
      const reply = await askCoach(buildSystem(uid, sessions, wellness), [...history, { role: 'user', content: txt }])
      setMsgs(p => [...p, { role: 'assistant', content: reply }])
    } catch { setMsgs(p => [...p, { role: 'assistant', content: 'Erreur de connexion. Réessaie.' }]) }
    setLoading(false)
  }
  const suggestions = ['Analyse ma semaine', 'Plan nutrition demain', 'Je suis épuisé', 'Programme du jour']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 160px)', minHeight: 400 }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'assistant' && <div style={{ width: 30, height: 30, background: S.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>🤖</div>}
            {m.role === 'user' && <Avatar uid={uid} size={30} />}
            <div style={{ maxWidth: '80%', padding: '12px 16px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', background: m.role === 'user' ? USERS[uid].accent : S.card, color: m.role === 'user' ? '#fff' : S.text, borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ display: 'flex', gap: 10 }}><div style={{ width: 30, height: 30, background: S.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div><div style={{ padding: '12px 16px', background: S.card, borderRadius: '18px 18px 18px 4px', display: 'flex', gap: 5 }}>{[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: S.textTer, animation: `pulse 1.4s ${i * 0.18}s ease-in-out infinite` }} />)}</div></div>}
        <div ref={bottomRef} />
      </div>
      {msgs.length === 1 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{suggestions.map(s => <button key={s} onClick={() => send(s)} style={{ padding: '8px 14px', borderRadius: 99, border: `1px solid ${S.border}`, background: S.card, color: S.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{s}</button>)}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: S.card, borderRadius: 18, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} placeholder="Message..." style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: S.text, outline: 'none', fontFamily: 'inherit' }} />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0, background: !input.trim() || loading ? S.bg : USERS[uid].accent, color: !input.trim() || loading ? S.textSec : '#fff', cursor: !input.trim() || loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>↑</button>
      </div>
    </div>
  )
}

const PLAN = {
  louis: [
    { phase: 'Fondation', period: 'Juin – Août', detail: '3 séances/sem · Musculation gainage 2× · RPE 5–6', color: '#007AFF' },
    { phase: 'Développement', period: 'Septembre – Octobre', detail: '4 séances/sem · Bricks introduits · +10%/sem', color: '#AF52DE' },
    { phase: 'Spécifique', period: 'Novembre', detail: '5 séances/sem · Allures cibles · Gainage uniquement', color: '#FF9500' },
    { phase: 'Affûtage', period: 'Décembre', detail: 'Volume −40% · Simulation course · Récupération', color: '#34C759' },
  ],
  romain: [
    { phase: 'Fondation', period: 'Juin – Août', detail: '2 séances/sem · Courir 20min + nager 200m · RPE 4–5', color: '#007AFF' },
    { phase: 'Développement', period: 'Septembre – Octobre', detail: '3 séances/sem · Vélo introduit · Premiers bricks', color: '#AF52DE' },
    { phase: 'Spécifique', period: 'Novembre', detail: '4 séances/sem · Distances cibles atteintes', color: '#FF9500' },
    { phase: 'Affûtage', period: 'Décembre', detail: 'Volume réduit · Confiance · Simulation course', color: '#34C759' },
  ],
}

function PlanPage({ uid, sessions, wellness }) {
  const [aiPlan, setAiPlan] = useLocalStorage(`aiPlan_${uid}`, null)
  const [generating, setGenerating] = useState(false)

  async function generateWeek() {
    setGenerating(true)
    try {
      const prompt = `Génère-moi un planning d'entraînement complet pour la semaine prochaine. Tiens compte de mes séances récentes, de mon niveau de fatigue, et de l'objectif triathlon Sprint en décembre 2026. Donne-moi 5 à 6 séances précises avec : discipline, durée, intensité (RPE cible), objectif de la séance et un conseil clé. Sois concret et adapté à mon niveau actuel.`
      const reply = await askCoach(buildSystem(uid, sessions, wellness), [{ role: 'user', content: prompt }])
      setAiPlan(reply)
    } catch {
      setAiPlan('Erreur lors de la génération. Réessaie.')
    }
    setGenerating(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ background: S.text, padding: '20px 20px' }}>
        <div style={{ fontSize: 13, color: '#8E8E93', fontWeight: 500, marginBottom: 4 }}>Triathlon Sprint · Décembre 2026</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: USERS[uid].accent, letterSpacing: -1 }}>J-{daysLeft()}</div>
        <div style={{ fontSize: 13, color: '#8E8E93', marginTop: 4 }}>750m · 20km · 5km</div>
      </Card>

      <Card>
        <Label>Plan de périodisation</Label>
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: S.border, borderRadius: 99 }} />
          {PLAN[uid].map((p, i) => (
            <div key={p.phase} style={{ position: 'relative', paddingBottom: i < PLAN[uid].length - 1 ? 20 : 0 }}>
              <div style={{ position: 'absolute', left: -20, top: 2, width: 12, height: 12, borderRadius: '50%', background: p.color, border: `3px solid ${S.card}` }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: S.text }}>{p.phase}</div>
              <div style={{ fontSize: 12, color: p.color, fontWeight: 600, marginTop: 2 }}>{p.period}</div>
              <div style={{ fontSize: 13, color: S.textSec, marginTop: 4, lineHeight: 1.5 }}>{p.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label>Semaine avec le coach IA</Label>
        <button onClick={generateWeek} disabled={generating} style={{ width: '100%', padding: '14px', borderRadius: S.radiusSm, border: 'none', background: generating ? S.bg : USERS[uid].accent, color: generating ? S.textSec : '#fff', fontSize: 15, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {generating ? <><Loader2 size={16} /> Génération en cours...</> : <><Bot size={16} /> Générer ma semaine avec le coach IA</>}
        </button>
        {aiPlan && (
          <div style={{ marginTop: 14, background: S.bg, borderRadius: S.radiusSm, padding: '14px 16px', fontSize: 14, lineHeight: 1.75, color: S.text, whiteSpace: 'pre-wrap' }}>{aiPlan}</div>
        )}
        {aiPlan && (
          <button onClick={() => setAiPlan(null)} style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: S.radiusSm, border: `1px solid ${S.border}`, background: 'transparent', color: S.textSec, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Effacer le plan</button>
        )}
      </Card>
    </div>
  )
}

function ProfilePage({ uid, sessions }) {
  const [weights, setWeights] = useLocalStorage(`weights_${uid}`, [])
  const [newWeight, setNewWeight] = useState('')
  const [hrMax, setHrMax] = useLocalStorage(`hrMax_${uid}`, '')
  const [fitnessTests, setFitnessTests] = useLocalStorage(`fitnessTests_${uid}`, { vma: '', ftp: '', cooper: '' })

  const userSessions = sessions.filter(s => s.user_id === uid).sort((a, b) => a.date.localeCompare(b.date))

  const getStreak = () => {
    let streak = 0
    const d = new Date()
    while (true) {
      const ds = d.toISOString().slice(0, 10)
      if (userSessions.some(s => s.date === ds)) { streak++; d.setDate(d.getDate() - 1) }
      else break
    }
    return streak
  }
  const streak = getStreak()

  const zones = hrMax ? [
    { name: 'Z1 — Récupération', range: [Math.round(+hrMax * 0.5), Math.round(+hrMax * 0.6)], color: S.green },
    { name: 'Z2 — Endurance', range: [Math.round(+hrMax * 0.6), Math.round(+hrMax * 0.7)], color: '#007AFF' },
    { name: 'Z3 — Aérobie', range: [Math.round(+hrMax * 0.7), Math.round(+hrMax * 0.8)], color: S.yellow },
    { name: 'Z4 — Seuil', range: [Math.round(+hrMax * 0.8), Math.round(+hrMax * 0.9)], color: ORANGE },
    { name: 'Z5 — VO2max', range: [Math.round(+hrMax * 0.9), +hrMax], color: S.red },
  ] : []

  const badges = [
    { label: 'Première séance', icon: '🏅', earned: userSessions.length >= 1 },
    { label: '10 séances', icon: '🥈', earned: userSessions.length >= 10 },
    { label: '25 séances', icon: '🥇', earned: userSessions.length >= 25 },
    { label: 'Série 3 jours', icon: '🔥', earned: streak >= 3 },
    { label: 'Série 7 jours', icon: '⚡', earned: streak >= 7 },
    { label: 'Premier 5km', icon: '🏃', earned: userSessions.some(s => s.discipline === 'Course à pied' && +s.distance >= 5) },
    { label: 'Premier 750m nat.', icon: '🏊', earned: userSessions.some(s => s.discipline === 'Natation' && ((s.distance_unit === 'm' && +s.distance >= 750) || (s.distance_unit === 'km' && +s.distance >= 0.75))) },
    { label: 'Premier 20km vélo', icon: '🚴', earned: userSessions.some(s => s.discipline === 'Vélo' && +s.distance >= 20) },
  ]

  const exportCSV = () => {
    const headers = ['date', 'discipline', 'duration', 'distance', 'distance_unit', 'pace', 'vitesse', 'hr_avg', 'hr_max', 'rpe', 'notes']
    const rows = userSessions.map(s => headers.map(h => (s[h] ?? '')).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `seances_${uid}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const addWeight = () => {
    if (!newWeight) return
    setWeights(prev => [...prev, { date: todayStr(), weight: +newWeight }].slice(-50))
    setNewWeight('')
  }

  const recentWeights = weights.slice(-12)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ background: streak >= 3 ? `${ORANGE}12` : S.card, border: streak >= 3 ? `1.5px solid ${ORANGE}33` : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 36 }}>{streak >= 3 ? '🔥' : '⏰'}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: streak >= 3 ? ORANGE : S.text }}>{streak} jour{streak !== 1 ? 's' : ''}</div>
            <div style={{ fontSize: 13, color: S.textSec }}>Série en cours</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: S.text }}>{userSessions.length}</div>
            <div style={{ fontSize: 11, color: S.textSec }}>séances totales</div>
          </div>
        </div>
      </Card>

      <Card>
        <Label>Badges</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {badges.map(b => (
            <div key={b.label} style={{ width: 72, padding: '10px 6px', borderRadius: 12, background: b.earned ? `${USERS[uid].accent}15` : S.bg, border: `1px solid ${b.earned ? USERS[uid].accent : S.border}`, opacity: b.earned ? 1 : 0.4, textAlign: 'center' }}>
              <div style={{ fontSize: 22 }}>{b.icon}</div>
              <div style={{ fontSize: 9, color: b.earned ? USERS[uid].accent : S.textSec, fontWeight: 600, marginTop: 5, lineHeight: 1.3 }}>{b.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label>Suivi du poids</Label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="Poids (kg)" style={{ ...inputStyle(), flex: 1 }} onKeyDown={e => e.key === 'Enter' && addWeight()} />
          <button onClick={addWeight} style={{ padding: '12px 20px', borderRadius: S.radiusSm, border: 'none', background: USERS[uid].accent, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 18 }}>+</button>
        </div>
        {recentWeights.length > 1 ? (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={recentWeights}>
              <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: S.textSec }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: S.textSec }} domain={['auto', 'auto']} width={32} />
              <Tooltip contentStyle={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 12 }} formatter={v => [`${v} kg`, 'Poids']} />
              <Line type="monotone" dataKey="weight" stroke={USERS[uid].accent} strokeWidth={2} dot={{ fill: USERS[uid].accent, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: S.textSec, padding: '10px 0' }}>Ajoute au moins 2 mesures pour afficher le graphique</div>
        )}
        {weights.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 13, color: S.textSec, display: 'flex', justifyContent: 'space-between' }}>
            <span>Dernière mesure : <strong style={{ color: S.text }}>{weights[weights.length - 1].weight} kg</strong></span>
            <span>{weights[weights.length - 1].date}</span>
          </div>
        )}
      </Card>

      <Card>
        <Label>Zones FC</Label>
        <div style={{ marginBottom: 14 }}>
          <input type="number" value={hrMax} onChange={e => setHrMax(e.target.value)} placeholder="FC max (bpm)" style={inputStyle()} />
        </div>
        {zones.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {zones.map(z => (
              <div key={z.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: `${z.color}12`, borderRadius: S.radiusSm }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: z.color }}>{z.name}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: S.text }}>{z.range[0]}–{z.range[1]} bpm</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: S.textSec }}>Entre ta FC max pour voir tes zones</div>
        )}
      </Card>

      <Card>
        <Label>Tests physiques</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { key: 'vma', label: 'VMA (km/h)', placeholder: '13.5', hint: 'Vitesse Maximale Aérobie' },
            { key: 'ftp', label: 'FTP vélo (W)', placeholder: '200', hint: 'Functional Threshold Power' },
            { key: 'cooper', label: 'Test de Cooper (m)', placeholder: '2800', hint: 'Distance en 12 min' },
          ].map(t => (
            <div key={t.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{t.label}</span>
                <span style={{ fontSize: 11, color: S.textSec }}>{t.hint}</span>
              </div>
              <input type="number" value={fitnessTests[t.key]} onChange={e => setFitnessTests(p => ({ ...p, [t.key]: e.target.value }))} placeholder={t.placeholder} style={inputStyle()} />
            </div>
          ))}
        </div>
      </Card>

      <button onClick={exportCSV} style={{ width: '100%', padding: '14px', borderRadius: S.radiusSm, border: `1.5px solid ${S.border}`, background: S.card, color: S.text, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Download size={16} /> Exporter mes séances (CSV)
      </button>
    </div>
  )
}

function Dashboard({ uid, sessions, wellness, onSave }) {
  const ws = weekStart()
  const week = sessions.filter(s => s.user_id === uid && new Date(s.date) >= ws)
  const totalMin = week.reduce((a, s) => a + (s.duration || 0), 0)
  const lastWell = wellness.filter(w => w.user_id === uid).sort((a, b) => b.date.localeCompare(a.date))[0]
  const wellScore = lastWell ? Math.round(((lastWell.sleep + (6 - lastWell.fatigue) + lastWell.mood) / 15) * 100) : null
  const scoreColor = wellScore >= 70 ? S.green : wellScore >= 40 ? S.yellow : S.red
  const recent = sessions.filter(s => s.user_id === uid).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { Icon: Calendar, val: week.length, label: 'Séances', color: USERS[uid].accent },
          { Icon: Clock, val: `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}`, label: 'Volume', color: S.text },
          { Icon: Heart, val: wellScore !== null ? `${wellScore}%` : '—', label: 'Bien-être', color: wellScore ? scoreColor : S.textSec },
        ].map((s, i) => (
          <Card key={i} style={{ padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}><s.Icon size={18} color={s.color} /></div>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, letterSpacing: -0.5 }}>{s.val}</div>
            <div style={{ fontSize: 10, color: S.textSec, marginTop: 3, fontWeight: 500 }}>{s.label}</div>
          </Card>
        ))}
      </div>
      <WellnessForm uid={uid} wellness={wellness} onSave={onSave} />
      <Milestones uid={uid} sessions={sessions} />
      {recent.length > 0 && (
        <Card>
          <Label>Activité récente</Label>
          {recent.map((s, i) => {
            const color = discColor(s.discipline)
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < recent.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                <div style={{ width: 40, height: 40, background: `${color}18`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><DiscIcon disc={s.discipline} size={20} color={color} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: S.text }}>{s.discipline}</div>
                  <div style={{ fontSize: 12, color: S.textSec }}>{s.date}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: S.text }}>{s.duration}min</div>
                  {s.distance && <div style={{ fontSize: 11, color: S.textSec }}>{s.distance}{s.distance_unit}</div>}
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

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
      const msg = `Séance : ${session.discipline}, ${session.duration}min${session.distance ? `, ${session.distance}${session.distance_unit}` : ''}, RPE ${session.rpe}/10.${session.notes ? ` Notes: ${session.notes}.` : ''}${last ? ` Dernière (${last.date}): ${last.duration}min, RPE ${last.rpe}/10.` : ''} Analyse en 4 lignes max.`
      const reply = await askCoach(buildSystem(uid, sessions, wellness), [{ role: 'user', content: msg }])
      setAnalysis(reply)
    } catch {}
  }

  const tabs = [
    { id: 'home', label: 'Accueil', Icon: Home },
    { id: 'session', label: 'Séance', Icon: Plus },
    { id: 'coach', label: 'Coach', Icon: Bot },
    { id: 'history', label: 'Historique', Icon: Activity },
    { id: 'plan', label: 'Plan', Icon: Calendar },
    { id: 'duel', label: 'Duel', Icon: Swords },
    { id: 'profil', label: 'Profil', Icon: User },
  ]

  const titles = { home: null, session: 'Nouvelle séance', coach: 'Coach IA', history: 'Historique', plan: 'Plan', duel: 'Duel', profil: 'Profil' }

  return (
    <div style={{ background: S.bg, minHeight: '100vh', fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif', color: S.text }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
        @keyframes pulse { 0%,60%,100% { opacity:0.3; transform:scale(0.8) } 30% { opacity:1; transform:scale(1) } }
        button { -webkit-tap-highlight-color: transparent; }
        input:focus, textarea:focus, select:focus { border-color: #C7C7CC !important; }
      `}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(242,242,247,0.92)', backdropFilter: 'blur(20px) saturate(180%)', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {tab === 'home' ? (
              <>
                <div style={{ fontSize: 13, color: S.textSec, fontWeight: 500 }}>Bonjour,</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>{USERS[uid].name} 👋</div>
              </>
            ) : <div style={{ fontSize: 20, fontWeight: 700 }}>{titles[tab]}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: S.text, borderRadius: 10, padding: '5px 11px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: USERS[uid].accent, lineHeight: 1 }}>J‑{daysLeft()}</div>
              <div style={{ fontSize: 9, color: '#8E8E93', letterSpacing: '0.06em' }}>COURSE</div>
            </div>
            <div style={{ display: 'flex', background: S.border, borderRadius: 99, padding: 3, gap: 2 }}>
              {['louis','romain'].map(u => (
                <button key={u} onClick={() => setUid(u)} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: uid === u ? USERS[u].accent : 'transparent', color: uid === u ? '#fff' : S.textSec, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>{USERS[u].avatar}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 110px' }}>
        {booting ? <div style={{ textAlign: 'center', padding: 60, color: S.textSec }}>Chargement...</div> : (
          <>
            {tab === 'home' && <Dashboard uid={uid} sessions={sessions} wellness={wellness} onSave={load} />}
            {tab === 'session' && <SessionForm uid={uid} sessions={sessions} onSave={load} onAnalyze={handleAnalyze} />}
            {tab === 'coach' && <ChatPage uid={uid} sessions={sessions} wellness={wellness} />}
            {tab === 'history' && <HistoryPage uid={uid} sessions={sessions} wellness={wellness} setSessions={setSessions} />}
            {tab === 'plan' && <PlanPage uid={uid} sessions={sessions} wellness={wellness} />}
            {tab === 'duel' && <DuelPage sessions={sessions} />}
            {tab === 'profil' && <ProfilePage uid={uid} sessions={sessions} />}
          </>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(242,242,247,0.95)', backdropFilter: 'blur(20px) saturate(180%)', borderTop: `1px solid ${S.border}`, display: 'flex', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '10px 4px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: active ? USERS[uid].accent : S.textTer, transition: 'color 0.12s' }}>
              {t.id === 'session' ? (
                <div style={{ width: 32, height: 32, background: active ? USERS[uid].accent : S.textTer, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                  <Plus size={18} color="#fff" />
                </div>
              ) : <t.Icon size={22} color={active ? USERS[uid].accent : S.textTer} />}
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{t.label}</span>
            </button>
          )
        })}
      </div>

      <Sheet open={!!analysis} onClose={() => setAnalysis(null)} title="Analyse du coach">
        {analysis && <div style={{ fontSize: 14, lineHeight: 1.75, color: S.text, whiteSpace: 'pre-wrap' }}>{analysis}</div>}
      </Sheet>
    </div>
  )
}
