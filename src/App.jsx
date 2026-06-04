import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { supabase } from './supabase.js'
import {
  Waves, Bike, Footprints, Dumbbell, Zap, HeartPulse,
  Home, Plus, Bot, Calendar, Swords, Activity,
  Trophy, Clock, ChevronRight, Heart, X,
  Loader2, MessageSquare, User, Download, TrendingUp, Flame, Award,
  Timer, Play, Pause, RotateCcw, AlertTriangle, Utensils, Target
} from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid
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

function useRemoteData(uid, key, initial, userData, updateUserData) {
  const addToast = useToast()
  const value = userData[uid]?.[key] !== undefined ? userData[uid][key] : initial
  const valueRef = useRef(value)
  valueRef.current = value
  const setValue = useCallback(async (newVal) => {
    const resolved = typeof newVal === 'function' ? newVal(valueRef.current) : newVal
    updateUserData(uid, key, resolved)
    try {
      const { error } = await supabase.from('user_data').upsert(
        { user_id: uid, key, value: resolved, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      )
      if (error) throw error
    } catch (e) {
      console.error('user_data upsert error:', e)
      addToast?.('Sauvegarde échouée — réessaie dans un instant')
    }
  }, [uid, key, updateUserData, addToast])
  return [value, setValue]
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
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const weekStart = () => { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const fmtDuration = (sec) => { if (!sec) return '0:00'; const s = Math.round(sec); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const ss = s % 60; return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${m}:${String(ss).padStart(2,'0')}` }

function buildSystem(uid, sessions, wellness, userData = {}) {
  const ud = userData[uid] || {}

  const today = todayStr()
  const userSessions = sessions.filter(x => x.user_id === uid && !isPlanned(x))
  const all = sessions.filter(x => x.user_id === uid).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
  const past = all.filter(x => x.date < today && !isPlanned(x))
  const future = all.filter(x => isPlanned(x) || x.date >= today)
  const w = wellness.filter(x => x.user_id === uid).slice(0, 7)

  // ── Profil physique ──
  const weights = ud.weights || []
  const lastWeight = weights.length ? weights[weights.length - 1] : null
  const hrMax = ud.hrMax || ''
  const hrRest = ud.hrRest || ''
  const vma = ud.vma || ''

  // ── Score de forme ──
  const lastWell = w[0]
  const wellScore = lastWell ? Math.round(((lastWell.sleep + (6 - lastWell.fatigue) + lastWell.mood) / 15) * 100) : null
  const wsStr = weekStart()
  const weekSessions = userSessions.filter(s => s.date >= wsStr)
  const totalSec = weekSessions.reduce((a, s) => a + (s.duration || 0), 0)
  const loadScore = Math.min(100, (totalSec / 18000) * 100)
  const formPct = wellScore !== null ? Math.round(wellScore * 0.70 + (100 - loadScore * 0.5) * 0.30) : null
  const formTxt = formPct === null ? 'Données insuffisantes'
    : formPct >= 68 ? `${formPct}% — Prêt à s'entraîner fort`
    : formPct >= 45 ? `${formPct}% — Entraînement modéré conseillé`
    : `${formPct}% — Repos recommandé`
  const totalMin = Math.floor(totalSec / 60)

  // ── Jalons ──
  const milestoneLines = [
    { disc: 'Natation',       label: '750m natation',   target: 750,   toM: s => s.distance_unit === 'm'  ? +s.distance : +s.distance * 1000 },
    { disc: 'Vélo',           label: '20km vélo',       target: 20000, toM: s => s.distance_unit === 'km' ? +s.distance * 1000 : +s.distance },
    { disc: 'Course à pied',  label: '5km course à pied', target: 5000, toM: s => s.distance_unit === 'km' ? +s.distance * 1000 : +s.distance },
  ].map(m => {
    const best = userSessions.filter(s => s.discipline === m.disc && s.distance).reduce((mx, s) => Math.max(mx, m.toM(s)), 0)
    const pct = Math.min(100, Math.round((best / m.target) * 100))
    const bestFmt = m.disc === 'Natation' ? `${Math.round(best)}m` : `${(best / 1000).toFixed(2)}km`
    return `• ${m.label} : ${pct}%${best > 0 ? ` (record : ${bestFmt})` : ''}`
  }).join('\n')

  // ── Chaussures ──
  const shoes = (ud.shoes || []).filter(s => !s.archived)
  const shoeLines = shoes.length ? shoes.map(shoe => {
    const fromSessions = userSessions.filter(s => s.discipline === 'Course à pied' && s.date >= shoe.purchaseDate && s.distance).reduce((a, s) => a + (s.distance_unit === 'm' ? +s.distance / 1000 : +s.distance), 0)
    const km = Math.round((+shoe.startKm || 0) + fromSessions)
    const max = +shoe.maxKm || 700
    const pct = Math.round(km / max * 100)
    const state = pct >= 100 ? '🔴 À remplacer' : pct >= 80 ? '🟡 Fin de vie' : '🟢 OK'
    return `• ${shoe.name} : ${km}/${max} km (${pct}%) ${state}`
  }).join('\n') : 'Aucune chaussure enregistrée.'

  // ── Objectif course ──
  const simTarget = ud.simTarget || { h: '1', m: '30' }
  const simStr = `${simTarget.h}h${String(simTarget.m).padStart(2,'0')}`

  // ── Plans IA (tronqués pour ne pas saturer le contexte) ──
  const aiPlan = ud.aiPlan || null
  const aiNutrition = ud.aiNutrition || null

  return `Tu es le coach personnel de ${USERS[uid].name}, expert triathlon Sprint, préparation physique et nutrition sportive.
Réponds toujours en français, de façon directe, bienveillante et concrète.

━━ PROFIL ━━
${USERS[uid].profile}
${lastWeight ? `Poids : ${lastWeight.weight} kg (${lastWeight.date})` : 'Poids : non renseigné'}
${hrMax ? `FC max : ${hrMax} bpm${hrRest ? ` | FC repos : ${hrRest} bpm` : ''}` : 'FC max : non renseignée'}
${vma ? `VMA : ${vma} km/h` : 'VMA : non renseignée'}

━━ OBJECTIF ━━
Triathlon Sprint (750m nat / 20km vélo / 5km CAP) — 15 décembre 2026 — J-${daysLeft()}
Temps cible : ${simStr}

━━ SCORE DE FORME DU JOUR ━━
${formTxt}
Volume semaine en cours : ${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')} (${weekSessions.length} séance${weekSessions.length > 1 ? 's' : ''})

━━ JALONS OBJECTIFS ━━
${milestoneLines}

━━ SÉANCES PASSÉES — 20 dernières réelles ━━
${past.slice(0, 20).map(x => {
  let extra = {}; try { extra = JSON.parse(x.notes || '{}') } catch {}
  const typeInfo = extra.capType || extra.nageType || extra.veloType || extra.muscuFocus || ''
  return `• ${x.date} | ${x.discipline}${typeInfo ? ` (${typeInfo})` : ''} | ${fmtDuration(x.duration)}${x.distance ? ` | ${x.distance}${x.distance_unit}` : ''} | RPE ${x.rpe}/10${extra.userNotes ? ` | "${extra.userNotes}"` : ''}`
}).join('\n') || 'Aucune séance passée.'}

━━ SÉANCES PLANIFIÉES (futures — sans RPE réel) ━━
${future.slice(0, 10).map(x => `• ${x.date} | ${x.discipline} | ${fmtDuration(x.duration)}${x.distance ? ` | ${x.distance}${x.distance_unit}` : ''} [PLANIFIÉE]`).join('\n') || 'Aucune séance planifiée.'}
⚠️ Ne jamais analyser les séances planifiées comme réalisées. S'en servir uniquement pour anticiper la charge future.

━━ BIEN-ÊTRE — 7 derniers jours ━━
${w.map(x => `• ${x.date} | Sommeil ${x.sleep}/5 | Énergie ${6 - x.fatigue}/5 | Humeur ${x.mood}/5`).join('\n') || 'Aucune donnée.'}

━━ CHAUSSURES DE COURSE ━━
${shoeLines}
${aiPlan ? `
━━ DERNIER PLAN DE SEMAINE IA ━━
${aiPlan.slice(0, 800)}${aiPlan.length > 800 ? '\n[...]' : ''}` : ''}
${aiNutrition ? `
━━ DERNIER PLAN NUTRITIONNEL ━━
${aiNutrition.slice(0, 600)}${aiNutrition.length > 600 ? '\n[...]' : ''}` : ''}`
}

const S = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSec: '#636366',
  textTer: '#AEAEB2',
  border: '#E5E5EA',
  green: '#34C759',
  red: '#FF3B30',
  yellow: '#FF9500',
  radius: 16,
  radiusSm: 12,
  shadow: '0 1px 3px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 20px rgba(0,0,0,0.10)',
}

const TOOLTIP_STYLE = { background: '#FFFFFF', border: '1px solid #E5E5EA', borderRadius: 10, fontSize: 11, color: '#1C1C1E', boxShadow: '0 4px 12px rgba(0,0,0,0.10)' }

// ── Toast system ──
const ToastContext = createContext(null)
const useToast = () => useContext(ToastContext)

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'error') => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p.slice(-3), { msg, type, id }])
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 4000)
  }, [])
  return (
    <ToastContext.Provider value={add}>
      {children}
      <div style={{ position: 'fixed', top: 20, left: 0, right: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: '11px 22px', borderRadius: 99, fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '0.02em', background: t.type === 'error' ? '#FF3B30' : t.type === 'warning' ? '#FF9500' : '#34C759', boxShadow: '0 4px 20px rgba(0,0,0,0.18)', maxWidth: 360, textAlign: 'center' }}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const discColor = (disc) => ({ Natation: '#007AFF', Vélo: '#FF9500', 'Course à pied': '#FC4C02', Musculation: '#AF52DE', Brick: '#FF3B30', Récupération: '#34C759' })[disc] || S.textSec

const isPlanned = (session) => {
  if (!session?.notes) return false
  try { return JSON.parse(session.notes)?.planned === true } catch { return false }
}

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: S.card, borderRadius: S.radius, padding: '18px 18px', boxShadow: S.shadow, ...style, cursor: onClick ? 'pointer' : 'default', transition: onClick ? 'box-shadow 0.15s, transform 0.1s' : undefined }}>{children}</div>
)

const Label = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: S.textTer, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 12, fontFamily: '"Barlow Condensed", sans-serif' }}>{children}</div>
)

const PBar = ({ pct, color, h = 5 }) => (
  <div style={{ height: h, background: S.bg, borderRadius: 99, overflow: 'hidden' }}>
    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' }} />
  </div>
)

const Avatar = ({ uid, size = 36 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: USERS[uid].accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, flexShrink: 0, boxShadow: `0 0 0 2.5px #FFFFFF, 0 2px 8px rgba(0,0,0,0.14)` }}>{USERS[uid].avatar}</div>
)

const DiscIcon = ({ disc, size = 20, color }) => {
  const Icon = DISC_ICONS[disc] || Activity
  return <Icon size={size} color={color || S.text} />
}

const inputStyle = (extra = {}) => ({
  width: '100%', padding: '13px 15px', fontSize: 15,
  background: S.bg, border: `1px solid ${S.border}`, borderRadius: S.radiusSm,
  color: S.text, outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s', ...extra,
})

function Sheet({ open, onClose, children, title }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(6px)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#FFFFFF', borderRadius: '28px 28px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)', padding: '0 0 44px', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: '#D1D1D6', borderRadius: 99, margin: '14px auto 0' }} />
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 0' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: S.text, fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '-0.01em' }}>{title}</div>
            <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} color={S.textSec} />
            </button>
          </div>
        )}
        <div style={{ padding: '18px 20px 0' }}>{children}</div>
      </div>
    </div>
  )
}

function WellnessForm({ uid, wellness, onSave }) {
  const addToast = useToast()
  const t = todayStr()
  const ex = wellness.find(w => w.user_id === uid && w.date === t)
  const [vals, setVals] = useState({ sleep: ex?.sleep || 3, fatigue: ex?.fatigue || 3, mood: ex?.mood || 3 })
  const [saved, setSaved] = useState(!!ex)
  const [saving, setSaving] = useState(false)
  const score = Math.round(((vals.sleep + (6 - vals.fatigue) + vals.mood) / 15) * 100)
  const scoreColor = score >= 70 ? S.green : score >= 40 ? S.yellow : S.red
  const emojis = [['😴','😞','😐','😊','🤩'],['😴','😞','😐','😊','🤩'],['😞','😐','😊','😄','🤩']]
  const items = [{ key: 'sleep', label: 'Sommeil', display: vals.sleep, emKey: 0 }, { key: 'fatigue', label: 'Énergie', display: 6 - vals.fatigue, emKey: 1 }, { key: 'mood', label: 'Humeur', display: vals.mood, emKey: 2 }]
  const onChange = (key, v) => { setVals(p => ({ ...p, [key]: key === 'fatigue' ? 6 - v : v })); setSaved(false) }
  async function save() {
    setSaving(true)
    try {
      const { error } = await supabase.from('wellness').upsert({ user_id: uid, date: t, ...vals }, { onConflict: 'user_id,date' })
      if (error) throw error
      await onSave()
      setSaved(true)
    } catch (e) {
      console.error('Wellness save error:', e)
      addToast('Check-in non sauvegardé — réessaie')
    }
    setSaving(false)
  }
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: S.text, fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '-0.01em' }}>Check-in du matin</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: scoreColor, fontFamily: '"Barlow Condensed", sans-serif', lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 13, color: S.textSec, fontWeight: 500 }}>%</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 20 }}>
        {items.map(item => (
          <div key={item.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: S.textSec, fontWeight: 500 }}>{item.label}</span>
              <span style={{ fontSize: 22 }}>{emojis[item.emKey][item.display - 1]}</span>
            </div>
            <input type="range" min="1" max="5" value={item.display} onChange={e => onChange(item.key, +e.target.value)} style={{ width: '100%', accentColor: USERS[uid].accent }} />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saved || saving} style={{ width: '100%', padding: '15px', borderRadius: S.radiusSm, border: 'none', background: saved ? 'rgba(255,255,255,0.06)' : USERS[uid].accent, color: saved ? S.textSec : '#fff', fontSize: 15, fontWeight: 700, cursor: saved ? 'default' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.01em' }}>
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
  const addToast = useToast()
  const [f, setF] = useState({
    date: todayStr(), discipline: 'Course à pied', durationMin: '', durationSec: '0', distance: '', distance_unit: 'km',
    pace: '', hr_avg: '', hr_max: '', rpe: '6', conditions: '', notes: '', vitesse: '', denivele: '',
    nageType: 'Crawl', veloType: 'Route', capType: 'Footing', muscuFocus: 'Full body',
    exercises: [{ name: '', sets: [{ weight: '', reps: '' }] }],
    brickLegs: [{ discipline: 'Vélo', duration: '', distance: '' }, { discipline: 'Course à pied', duration: '', distance: '' }],
    brickTransitions: [''],
  })
  const [saving, setSaving] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSec, setTimerSec] = useState(0)
  const timerRef = useRef(null)
  useEffect(() => {
    if (timerRunning) { timerRef.current = setInterval(() => setTimerSec(s => s + 1), 1000) }
    else { clearInterval(timerRef.current) }
    return () => clearInterval(timerRef.current)
  }, [timerRunning])
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const disc = f.discipline
  const isFuture = f.date > todayStr()
  const last = sessions.filter(s => s.user_id === uid && s.discipline === disc && !isPlanned(s)).sort((a, b) => new Date(b.date) - new Date(a.date))[0]
  const delta = last && f.distance && last.distance ? ((+f.distance - +last.distance) / +last.distance * 100).toFixed(1) : null

  const autoPace = (() => {
    const dur = ((+f.durationMin || 0) * 60 + (+f.durationSec || 0)) / 60, dist = +f.distance
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
    if (!f.durationMin) return
    // Validate inputs before sending to Supabase
    const durSec = (+f.durationMin || 0) * 60 + Math.min(59, Math.max(0, +f.durationSec || 0))
    if (!Number.isFinite(durSec) || durSec <= 0 || durSec > 86400) { addToast('Durée invalide (max 24h)'); return }
    if (f.distance && (!Number.isFinite(+f.distance) || +f.distance < 0)) { addToast('Distance invalide'); return }
    if (!isFuture && (+f.rpe < 1 || +f.rpe > 10)) { addToast('RPE invalide (1–10)'); return }
    if (f.hr_avg && (+f.hr_avg < 20 || +f.hr_avg > 250)) { addToast('FC moy invalide'); return }
    if (f.hr_max && (+f.hr_max < 20 || +f.hr_max > 300)) { addToast('FC max invalide'); return }
    setSaving(true)

    // Build discipline-specific extra data (all serialized into notes)
    const extra = {}
    if (disc === 'Natation') {
      if (f.nageType) extra.nageType = f.nageType
    } else if (disc === 'Vélo') {
      if (f.veloType) extra.veloType = f.veloType
      if (f.vitesse) extra.vitesse = f.vitesse
      if (f.denivele) extra.denivele = f.denivele
    } else if (disc === 'Course à pied') {
      if (f.capType) extra.capType = f.capType
      if (f.vitesse) extra.vitesse = f.vitesse
      if (f.denivele) extra.denivele = f.denivele
    } else if (disc === 'Musculation') {
      if (f.muscuFocus) extra.muscuFocus = f.muscuFocus
      const exos = f.exercises.filter(e => e.name)
      if (exos.length) extra.exercises = exos
    } else if (disc === 'Brick') {
      const legs = f.brickLegs.filter(l => l.duration)
      extra.brickLegs = legs
      extra.brickTransitions = f.brickTransitions.slice(0, legs.length - 1)
    }
    if (f.notes) extra.userNotes = f.notes
    if (isFuture) extra.planned = true

    // Compute duration in seconds (Brick = sum of legs + transitions, legs entered in minutes)
    let duration = durSec
    if (disc === 'Brick') {
      const legs = f.brickLegs.filter(l => l.duration)
      const legsDur = legs.reduce((a, l) => a + (+l.duration || 0) * 60, 0)
      const transDur = f.brickTransitions.reduce((a, t) => a + (+t || 0) * 60, 0)
      duration = legsDur + transDur || durSec
    }

    // Whitelist strict : seules les colonnes existantes en base
    const sessionPayload = {
      user_id: uid,
      date: f.date,
      discipline: f.discipline,
      duration,
      distance: f.distance ? +f.distance : null,
      distance_unit: f.distance_unit || 'km',
      pace: f.pace || null,
      hr_avg: f.hr_avg ? +f.hr_avg : null,
      hr_max: f.hr_max ? +f.hr_max : null,
      rpe: isFuture ? null : +f.rpe,
      notes: Object.keys(extra).length ? JSON.stringify(extra) : null,
    }

    console.log('Inserting session:', JSON.stringify(sessionPayload))
    try {
      const { error } = await supabase.from('sessions').insert(sessionPayload)
      if (error) throw error
      await onSave()
      onAnalyze(sessionPayload, last)
      setF(p => ({
        ...p, durationMin: '', durationSec: '0', distance: '', pace: '', notes: '', rpe: '6', vitesse: '', denivele: '',
        exercises: [{ name: '', sets: [{ weight: '', reps: '' }] }],
        brickLegs: [{ discipline: 'Vélo', duration: '', distance: '' }, { discipline: 'Course à pied', duration: '', distance: '' }],
        brickTransitions: [''],
      }))
    } catch (e) {
      console.error('Session insert error:', JSON.stringify(e), e)
      addToast('Impossible d\'enregistrer la séance')
    }
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Timer size={16} color={timerRunning ? USERS[uid].accent : S.textSec} />
            <span style={{ fontSize: 14, fontWeight: 600, color: S.text }}>Chronomètre</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {timerSec > 0 && <span style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: timerRunning ? USERS[uid].accent : S.text }}>{String(Math.floor(timerSec / 60)).padStart(2, '0')}:{String(timerSec % 60).padStart(2, '0')}</span>}
            {timerSec > 0 && !timerRunning && (
              <button onClick={() => { set('durationMin', String(Math.floor(timerSec / 60))); set('durationSec', String(timerSec % 60)); setTimerRunning(false); setTimerSec(0) }} style={{ padding: '5px 12px', borderRadius: 99, border: 'none', background: S.green, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Utiliser</button>
            )}
            {timerSec > 0 && <button onClick={() => { setTimerRunning(false); setTimerSec(0) }} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: S.bg, color: S.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RotateCcw size={12} /></button>}
            <button onClick={() => setTimerRunning(r => !r)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: timerRunning ? USERS[uid].accent : S.bg, color: timerRunning ? '#fff' : S.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{timerRunning ? <Pause size={15} /> : <Play size={15} />}</button>
          </div>
        </div>
      </Card>

      <Card style={{ padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><Label>Date</Label><input type="date" value={f.date} onChange={e => set('date', e.target.value)} style={inputStyle()} /></div>
          <div>
            <Label>Durée</Label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="number" value={f.durationMin} placeholder="min" min="0" onChange={e => set('durationMin', e.target.value)} style={{ ...inputStyle(), flex: 2 }} />
              <span style={{ color: S.textSec, fontSize: 13, flexShrink: 0 }}>:</span>
              <input type="number" value={f.durationSec} placeholder="sec" min="0" max="59" onChange={e => set('durationSec', e.target.value)} style={{ ...inputStyle(), flex: 1 }} />
            </div>
          </div>

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

          {!isFuture && (
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <Label>Effort perçu (RPE)</Label>
                <span style={{ fontSize: 16, fontWeight: 800, color: USERS[uid].accent }}>{f.rpe}<span style={{ fontSize: 11, color: S.textSec, fontWeight: 400 }}>/10</span></span>
              </div>
              <input type="range" min="1" max="10" value={f.rpe} onChange={e => set('rpe', e.target.value)} style={{ width: '100%', accentColor: USERS[uid].accent }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: S.textTer, marginTop: 4 }}><span>Facile</span><span>Modéré</span><span>Maximum</span></div>
            </div>
          )}

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
            <span><span style={{ color: S.textSec }}>Durée </span><strong>{fmtDuration(last.duration)}</strong></span>
            {last.distance && <span><span style={{ color: S.textSec }}>Dist </span><strong>{last.distance}{last.distance_unit}</strong></span>}
            {delta !== null && <span style={{ fontWeight: 700, color: +delta >= 0 ? S.green : S.red }}>{+delta >= 0 ? '+' : ''}{delta}%</span>}
          </div>
        </div>
      )}
      {isFuture && (
        <div style={{ padding: '10px 14px', background: `${S.yellow}15`, borderRadius: S.radiusSm, fontSize: 13, color: S.yellow, fontWeight: 600, textAlign: 'center' }}>
          Séance future — sera marquée comme "Planifiée"
        </div>
      )}
      <button onClick={submit} disabled={saving || !f.durationMin} style={{ width: '100%', padding: '16px', borderRadius: S.radiusSm, border: 'none', background: saving || !f.durationMin ? S.bg : USERS[uid].accent, color: saving || !f.durationMin ? S.textSec : '#fff', fontSize: 16, fontWeight: 700, cursor: saving || !f.durationMin ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
        {saving ? 'Enregistrement...' : isFuture ? 'Planifier la séance' : 'Enregistrer la séance'}
      </button>
    </div>
  )
}

function SessionDetail({ session, uid, sessions, wellness, userData }) {
  const addToast = useToast()
  const [analysis, setAnalysis] = useState(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(true)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef()
  useEffect(() => {
    if (!session) return
    const msg = `Analyse cette séance : ${session.discipline}, ${session.date}, ${fmtDuration(session.duration)}${session.distance ? `, ${session.distance}${session.distance_unit}` : ''}${session.vitesse ? `, ${session.vitesse}km/h` : ''}, RPE ${session.rpe}/10${session.notes ? `, notes: ${session.notes}` : ''}.
Structure en 4 parties : 1) Bilan 2) Points positifs 3) Points à améliorer 4) Conseil prochain.`
    askCoach(buildSystem(uid, sessions, wellness, userData), [{ role: 'user', content: msg }])
      .then(r => { setAnalysis(r); setLoadingAnalysis(false) })
      .catch(() => { setAnalysis('Erreur lors de l\'analyse.'); setLoadingAnalysis(false) })
  }, [session?.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  async function send() {
    if (!input.trim() || sending) return
    const txt = input.trim(); setInput(''); setSending(true)
    const history = msgs.map(m => ({ role: m.role, content: m.content }))
    setMsgs(p => [...p, { role: 'user', content: txt }])
    try {
      const reply = await askCoach(buildSystem(uid, sessions, wellness, userData) + `\nContexte: discussion sur séance du ${session.date} — ${session.discipline}.`, [...history, { role: 'user', content: txt }])
      setMsgs(p => [...p, { role: 'assistant', content: reply }])
    } catch {
      addToast?.('Coach temporairement indisponible')
      setMsgs(p => [...p, { role: 'assistant', content: 'Coach temporairement indisponible. Réessaie dans un instant.' }])
    }
    setSending(false)
  }
  if (!session) return null
  const color = discColor(session.discipline)
  const planned = isPlanned(session)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottom: `1px solid ${S.border}` }}>
        <div style={{ width: 50, height: 50, background: `${color}18`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DiscIcon disc={session.discipline} size={26} color={color} />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: S.text }}>{session.discipline}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <div style={{ fontSize: 13, color: S.textSec }}>{session.date}</div>
            {planned && <div style={{ fontSize: 10, fontWeight: 700, color: S.yellow, background: `${S.yellow}20`, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase' }}>Planifiée</div>}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Durée', val: fmtDuration(session.duration) },
          { label: 'Distance', val: session.distance ? `${session.distance}${session.distance_unit}` : '—' },
          { label: 'RPE', val: session.rpe != null ? `${session.rpe}/10` : '—', color: session.rpe != null ? color : S.textSec },
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
      {session.notes && (() => { try { const p = JSON.parse(session.notes); const { planned: _, ...rest } = p; const txt = rest.userNotes || (Object.keys(rest).length ? JSON.stringify(rest) : null); return txt ? <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: '12px 14px' }}><div style={{ fontSize: 11, color: S.textSec, fontWeight: 600, marginBottom: 6 }}>NOTES</div><div style={{ fontSize: 14, color: S.text, lineHeight: 1.5 }}>{txt}</div></div> : null } catch { return <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: '12px 14px' }}><div style={{ fontSize: 11, color: S.textSec, fontWeight: 600, marginBottom: 6 }}>NOTES</div><div style={{ fontSize: 14, color: S.text, lineHeight: 1.5 }}>{session.notes}</div></div> } })()}
      {planned ? (
        <div style={{ background: `${S.yellow}10`, border: `1px solid ${S.yellow}33`, borderRadius: S.radiusSm, padding: '14px 16px', fontSize: 14, color: S.text }}>
          Cette séance est planifiée et n'a pas encore été réalisée. Complète-la après l'entraînement pour obtenir une analyse du coach.
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={18} color={USERS[uid].accent} /> Analyse du coach</div>
          {loadingAnalysis ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: S.textSec, fontSize: 14 }}><Loader2 size={16} /> Analyse en cours...</div>
          ) : (
            <div style={{ background: `${USERS[uid].accent}08`, border: `1px solid ${USERS[uid].accent}22`, borderRadius: S.radiusSm, padding: '14px 16px', fontSize: 14, lineHeight: 1.7, color: S.text, whiteSpace: 'pre-wrap' }}>{analysis}</div>
          )}
        </div>
      )}
      {!planned && !loadingAnalysis && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.text, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><MessageSquare size={18} color={USERS[uid].accent} /> Discuter de cette séance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, maxHeight: 250, overflowY: 'auto' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: m.role === 'user' ? USERS[uid].accent : S.bg, color: m.role === 'user' ? '#fff' : S.text, borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '11px 15px', fontSize: 14, lineHeight: 1.65 }}>{m.content}</div>
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

function PlannedSessionSheet({ session, uid, onDone, open, onClose }) {
  const addToast = useToast()
  const [showComplete, setShowComplete] = useState(false)
  const [form, setForm] = useState({ rpe: '7', distance: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (session) setForm({ rpe: '7', distance: session.distance ? String(session.distance) : '', notes: '' })
    setShowComplete(false)
  }, [session?.id])

  if (!session) return null

  let extra = {}
  try { extra = JSON.parse(session.notes || '{}') } catch {}
  const color = discColor(session.discipline)
  const descParts = [
    extra.nageType, extra.veloType, extra.capType, extra.muscuFocus,
    extra.vitesse ? `${extra.vitesse} km/h` : null,
    extra.denivele ? `D+ ${extra.denivele}m` : null,
  ].filter(Boolean)

  async function complete() {
    setSaving(true)
    const updated = { ...extra }
    delete updated.planned
    if (form.notes) updated.userNotes = form.notes
    const updates = { rpe: +form.rpe, notes: Object.keys(updated).length ? JSON.stringify(updated) : null }
    if (form.distance) updates.distance = +form.distance
    try {
      const { error } = await supabase.from('sessions').update(updates).eq('id', session.id)
      if (error) throw error
      onDone(session.id, updates)
      onClose()
    } catch (e) {
      console.error('Complete session error:', e)
      addToast('Impossible de valider la séance')
    }
    setSaving(false)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Séance planifiée">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, background: 'transparent', border: `2px dashed ${color}`, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DiscIcon disc={session.discipline} size={26} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: S.text }}>{session.discipline}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <div style={{ fontSize: 13, color: S.textSec }}>{session.date}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: S.yellow, background: `${S.yellow}20`, padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase' }}>Planifiée</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: session.distance ? '1fr 1fr' : '1fr', gap: 10 }}>
          <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: S.text }}>{fmtDuration(session.duration)}</div>
            <div style={{ fontSize: 10, color: S.textSec, marginTop: 3 }}>Durée prévue</div>
          </div>
          {session.distance && (
            <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: S.text }}>{session.distance}<span style={{ fontSize: 12, color: S.textSec, fontWeight: 400 }}>{session.distance_unit}</span></div>
              <div style={{ fontSize: 10, color: S.textSec, marginTop: 3 }}>Distance cible</div>
            </div>
          )}
        </div>

        {descParts.length > 0 && (
          <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: S.textSec, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Description</div>
            <div style={{ fontSize: 14, color: S.text }}>{descParts.join(' · ')}</div>
          </div>
        )}

        {(extra.userNotes || extra.note) && (
          <div style={{ background: `${USERS[uid].accent}08`, border: `1px solid ${USERS[uid].accent}22`, borderRadius: S.radiusSm, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: USERS[uid].accent, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Note</div>
            <div style={{ fontSize: 14, color: S.text, lineHeight: 1.6 }}>{extra.userNotes || extra.note}</div>
          </div>
        )}

        {!showComplete ? (
          <button onClick={() => setShowComplete(true)} style={{ width: '100%', padding: '14px', borderRadius: S.radiusSm, border: 'none', background: USERS[uid].accent, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Marquer comme effectuée
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px', background: S.bg, borderRadius: S.radiusSm }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: S.text }}>Compléter la séance</div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <Label>Effort perçu (RPE)</Label>
                <span style={{ fontSize: 16, fontWeight: 800, color: USERS[uid].accent }}>{form.rpe}<span style={{ fontSize: 11, color: S.textSec, fontWeight: 400 }}>/10</span></span>
              </div>
              <input type="range" min="1" max="10" value={form.rpe} onChange={e => setForm(p => ({ ...p, rpe: e.target.value }))} style={{ width: '100%', accentColor: USERS[uid].accent }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: S.textTer, marginTop: 4 }}><span>Facile</span><span>Modéré</span><span>Maximum</span></div>
            </div>
            <div>
              <Label>Distance réelle {session.distance_unit === 'm' ? '(m)' : '(km)'}</Label>
              <input type="number" value={form.distance} onChange={e => setForm(p => ({ ...p, distance: e.target.value }))} placeholder={session.distance ? String(session.distance) : 'Distance'} style={inputStyle()} />
            </div>
            <div>
              <Label>Notes</Label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Ressenti, observations..." rows={3} style={{ ...inputStyle(), resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowComplete(false)} style={{ flex: 1, padding: '12px', borderRadius: S.radiusSm, border: `1px solid ${S.border}`, background: 'transparent', color: S.textSec, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={complete} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: S.radiusSm, border: 'none', background: saving ? S.bg : USERS[uid].accent, color: saving ? S.textSec : '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Enregistrement...' : 'Valider'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

function HistoryPage({ uid, sessions, wellness, setSessions, userData }) {
  const addToast = useToast()
  const [filter, setFilter] = useState('Toutes')
  const [selected, setSelected] = useState(null)
  const [plannedSelected, setPlannedSelected] = useState(null)
  const today = todayStr()
  const list = sessions.filter(s => s.user_id === uid && (filter === 'Toutes' || s.discipline === filter)).sort((a, b) => new Date(b.date) - new Date(a.date))
  const deleteSession = async (id) => {
    if (!window.confirm('Supprimer cette séance ?')) return
    try {
      const { error } = await supabase.from('sessions').delete().eq('id', id)
      if (error) throw error
      setSessions(prev => prev.filter(s => s.id !== id))
      setSelected(null)
    } catch (e) {
      console.error('Delete session error:', e)
      addToast('Impossible de supprimer la séance')
    }
  }
  const handleDone = (id, updates) => setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
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
          const planned = isPlanned(s)
          const isPastPlanned = planned && s.date < today
          return (
            <div key={s.id} onClick={() => planned ? setPlannedSelected(s) : setSelected(s)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < list.length - 1 ? `1px solid ${S.border}` : 'none', cursor: 'pointer' }}>
              <div style={{ width: 46, height: 46, background: planned ? 'transparent' : `${color}18`, border: planned ? `2px dashed ${color}` : 'none', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <DiscIcon disc={s.discipline} size={22} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: S.text }}>{s.discipline}</div>
                  {planned && <div style={{ fontSize: 9, fontWeight: 700, color: isPastPlanned ? S.red : S.yellow, background: isPastPlanned ? `${S.red}18` : `${S.yellow}20`, padding: '2px 6px', borderRadius: 99, textTransform: 'uppercase', flexShrink: 0 }}>{isPastPlanned ? 'À compléter' : 'Planifiée'}</div>}
                </div>
                <div style={{ fontSize: 12, color: S.textSec, marginTop: 2 }}>{s.date}{s.distance ? ` · ${s.distance}${s.distance_unit}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: S.text }}>{fmtDuration(s.duration)}</div>
                {!planned && <div style={{ fontSize: 11, color, fontWeight: 600 }}>RPE {s.rpe}</div>}
              </div>
              <ChevronRight size={16} color={S.textTer} />
            </div>
          )
        })}
      </Card>
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Détail de la séance">
        {selected && <>
          <SessionDetail session={selected} uid={uid} sessions={sessions} wellness={wellness} userData={userData} />
          <button onClick={() => deleteSession(selected.id)} style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: S.radiusSm, border: `1px solid ${S.red}`, background: 'transparent', color: S.red, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
        </>}
      </Sheet>
      <PlannedSessionSheet session={plannedSelected} uid={uid} onDone={handleDone} open={!!plannedSelected} onClose={() => setPlannedSelected(null)} />
    </div>
  )
}

function DuelPage({ sessions }) {
  // Monday of the week containing a given date (matches global weekStart() logic)
  const toWeekStart = (date) => {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay() + 1)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // Build the shared week-start list: S1 = week of the earliest session across all users
  const allWeekStarts = (() => {
    const now = new Date()
    const currentWS = toWeekStart(now)
    const realSessions = sessions.filter(s => !isPlanned(s))
    if (!realSessions.length) {
      // fallback: last 8 weeks
      return Array.from({ length: 8 }, (_, i) => {
        const d = new Date(currentWS); d.setDate(d.getDate() - (7 - i) * 7); return d
      })
    }
    const earliest = realSessions.reduce((min, s) => s.date < min ? s.date : min, realSessions[0].date)
    const s1 = toWeekStart(new Date(earliest))
    const weeks = []
    const d = new Date(s1)
    while (d <= currentWS) { weeks.push(new Date(d)); d.setDate(d.getDate() + 7) }
    return weeks
  })()

  const getWeeks = (uid, disc) =>
    allWeekStarts.map(start => {
      const end = new Date(start); end.setDate(start.getDate() + 7)
      const label = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`
      const ws = sessions.filter(s => s.user_id === uid && s.discipline === disc && !isPlanned(s) && new Date(s.date) >= start && new Date(s.date) < end)
      return { week: label, val: +ws.reduce((a, s) => a + (+s.distance || 0), 0).toFixed(1), min: ws.reduce((a, s) => a + (s.duration || 0), 0) }
    })
  const score = (uid) => {
    const s = sessions.filter(x => x.user_id === uid)
    const ws = weekStart(); const week = s.filter(x => x.date >= ws)
    const totalKm = s.filter(x => ['Course à pied','Vélo','Natation'].includes(x.discipline)).reduce((a, x) => a + (+x.distance || 0), 0)
    const rpe = week.length ? week.reduce((a, x) => a + (x.rpe || 0), 0) / week.length : 0
    return {
      Volume: Math.round(Math.min(100, week.reduce((a, x) => a + (x.duration || 0), 0) / 180)),
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
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v} ${unit}`, n]} />
            <Line type="monotone" dataKey="Louis" stroke={ORANGE} strokeWidth={2} dot={{ fill: ORANGE, r: 3 }} />
            <Line type="monotone" dataKey="Romain" stroke={BLUE} strokeWidth={2} dot={{ fill: BLUE, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ background: `linear-gradient(145deg, ${USERS[leader].accent}12, ${USERS[leader].accent}04)`, border: `1px solid ${USERS[leader].accent}28`, padding: '20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, background: `${USERS[leader].accent}14`, border: `1px solid ${USERS[leader].accent}28`, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trophy size={26} color={USERS[leader].accent} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: USERS[leader].accent, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', opacity: 0.75, fontFamily: '"Barlow Condensed", sans-serif' }}>En tête cette semaine</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: USERS[leader].accent, fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{USERS[leader].name}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: USERS[leader].accent, fontFamily: '"Barlow Condensed", sans-serif', lineHeight: 1 }}>{Math.max(lTotal, rTotal)}</div>
            <div style={{ fontSize: 10, color: S.textSec, letterSpacing: '0.06em' }}>/ 500 pts</div>
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
            <Tooltip contentStyle={TOOLTIP_STYLE} />
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

function ChatPage({ uid, sessions, wellness, userData }) {
  const addToast = useToast()
  const makeWelcome = (u) => ({ role: 'assistant', content: `Bonjour ${USERS[u].name} 👋\n\nJe suis ton coach. J'ai accès à tout ton historique.\n\nPose-moi n'importe quelle question : entraînement, nutrition, récupération, stratégie de course...` })
  const [view, setView] = useState('list')
  const [convList, setConvList] = useState([])
  const [convId, setConvId] = useState(null)
  const [msgs, setMsgs] = useState([makeWelcome(uid)])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const bottomRef = useRef()
  const convIdRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => {
    async function loadConvs() {
      setLoadingList(true)
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('id, title, updated_at, messages')
          .eq('user_id', uid)
          .order('updated_at', { ascending: false })
        if (error) throw error
        setConvList(data || [])
      } catch (e) {
        console.error('Load convs error:', e)
        addToast('Impossible de charger les conversations')
      }
      setLoadingList(false)
    }
    loadConvs()
    setView('list')
    setConvId(null)
    convIdRef.current = null
    setMsgs([makeWelcome(uid)])
    setInput('')
  }, [uid])

  function startNewConv() {
    setConvId(null)
    convIdRef.current = null
    setMsgs([makeWelcome(uid)])
    setInput('')
    setView('chat')
  }

  function openConv(conv) {
    setConvId(conv.id)
    convIdRef.current = conv.id
    setMsgs(conv.messages || [makeWelcome(uid)])
    setView('chat')
  }

  async function deleteConv(id, e) {
    e.stopPropagation()
    try {
      const { error } = await supabase.from('conversations').delete().eq('id', id)
      if (error) throw error
      setConvList(p => p.filter(c => c.id !== id))
      if (convIdRef.current === id) { setConvId(null); convIdRef.current = null; setView('list') }
    } catch (e) {
      console.error('Delete conv error:', e)
      addToast('Impossible de supprimer la conversation')
    }
  }

  async function send(text) {
    const txt = (text || input).trim()
    if (!txt || loading) return
    setInput('')
    setLoading(true)
    const newUserMsg = { role: 'user', content: txt }
    const newMsgs = [...msgs, newUserMsg]
    setMsgs(newMsgs)

    const isFirstUserMsg = !msgs.some(m => m.role === 'user')
    const title = isFirstUserMsg ? txt.slice(0, 40) : null

    // ── AI call ──
    let finalMsgs
    try {
      const history = msgs.map(m => ({ role: m.role, content: m.content }))
      const reply = await askCoach(buildSystem(uid, sessions, wellness, userData), [...history, newUserMsg])
      finalMsgs = [...newMsgs, { role: 'assistant', content: reply }]
      setMsgs(finalMsgs)
    } catch {
      setMsgs(p => [...p, { role: 'assistant', content: 'Coach temporairement indisponible. Réessaie.' }])
      setLoading(false)
      return
    }

    // ── Supabase save (non-blocking for the UI) ──
    let cid = convIdRef.current
    try {
      if (!cid) {
        const { data, error } = await supabase
          .from('conversations')
          .insert({ user_id: uid, title: title || 'Conversation', messages: finalMsgs, updated_at: new Date().toISOString() })
          .select('id')
          .single()
        if (error) throw error
        if (data) {
          cid = data.id
          setConvId(data.id)
          convIdRef.current = data.id
          setConvList(p => [{ id: data.id, title: title || 'Conversation', updated_at: new Date().toISOString(), messages: finalMsgs }, ...p])
        }
      } else {
        const { error } = await supabase
          .from('conversations')
          .update({ messages: finalMsgs, updated_at: new Date().toISOString() })
          .eq('id', cid)
        if (error) throw error
        setConvList(p => p.map(c => c.id === cid ? { ...c, messages: finalMsgs, updated_at: new Date().toISOString() } : c))
      }
    } catch (e) {
      console.error('Save conv error:', e)
      addToast('Conversation non sauvegardée')
    }
    setLoading(false)
  }

  const suggestions = ['Analyse ma semaine', 'Plan nutrition demain', 'Je suis épuisé', 'Programme du jour']

  function fmtDate(iso) {
    const d = new Date(iso)
    const diff = Date.now() - d
    if (diff < 86400000) return "Aujourd'hui"
    if (diff < 172800000) return 'Hier'
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  if (view === 'list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={startNewConv} style={{ width: '100%', padding: '14px', borderRadius: S.radiusSm, border: 'none', background: USERS[uid].accent, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <MessageSquare size={16} /> Nouvelle conversation
        </button>
        {loadingList ? (
          <div style={{ textAlign: 'center', padding: 40, color: S.textSec }}>Chargement...</div>
        ) : convList.length === 0 ? (
          <Card><div style={{ textAlign: 'center', padding: '20px 0', color: S.textSec, fontSize: 14 }}>Aucune conversation pour l'instant.</div></Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px 4px' }}><Label>Conversations récentes</Label></div>
            {convList.map((c, i) => (
              <div key={c.id} onClick={() => openConv(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < convList.length - 1 ? `1px solid ${S.border}` : 'none', cursor: 'pointer' }}>
                <div style={{ width: 36, height: 36, background: '#F2F2F7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>🤖</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: S.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title || 'Conversation'}</div>
                  <div style={{ fontSize: 12, color: S.textSec, marginTop: 2 }}>{fmtDate(c.updated_at)}</div>
                </div>
                <button onClick={(e) => deleteConv(c.id, e)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'transparent', color: S.textSec, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100svh - 160px)', minHeight: 400 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <button onClick={() => setView('list')} style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: USERS[uid].accent, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: 0 }}>← Conversations</button>
        <button onClick={startNewConv} style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${S.border}`, background: S.bg, color: S.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: '6px 12px', borderRadius: 99, fontWeight: 600, transition: 'background 0.15s' }}><Plus size={13} /> Nouveau</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            {m.role === 'assistant' && <div style={{ width: 30, height: 30, background: '#F2F2F7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>🤖</div>}
            {m.role === 'user' && <Avatar uid={uid} size={30} />}
            <div style={{ maxWidth: '80%', padding: '12px 16px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', background: m.role === 'user' ? USERS[uid].accent : S.bg, color: m.role === 'user' ? '#fff' : S.text, borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px' }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ display: 'flex', gap: 10 }}><div style={{ width: 30, height: 30, background: S.bg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div><div style={{ padding: '12px 16px', background: S.bg, borderRadius: '18px 18px 18px 4px', display: 'flex', gap: 5, alignItems: 'center' }}>{[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: S.textTer, animation: `pulse 1.4s ${i * 0.18}s ease-in-out infinite` }} />)}</div></div>}
        <div ref={bottomRef} />
      </div>
      {msgs.length === 1 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, flexShrink: 0 }}>{suggestions.map(s => <button key={s} onClick={() => send(s)} style={{ padding: '8px 14px', borderRadius: 99, border: `1px solid ${S.border}`, background: S.card, color: S.text, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>{s}</button>)}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 18, flexShrink: 0 }}>
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

function PlanPage({ uid, sessions, wellness, setSessions, userData, updateUserData }) {
  const [aiPlan, setAiPlan] = useRemoteData(uid, 'aiPlan', null, userData, updateUserData)
  const [aiNutrition, setAiNutrition] = useRemoteData(uid, 'aiNutrition', null, userData, updateUserData)
  const [simTarget, setSimTarget] = useRemoteData(uid, 'simTarget', { h: '1', m: '30' }, userData, updateUserData)
  const [generating, setGenerating] = useState(false)
  const [generatingNutrition, setGeneratingNutrition] = useState(false)
  const [plannedSelected, setPlannedSelected] = useState(null)

  // Calendrier 2 semaines
  const buildWeekDays = (offsetWeeks) => {
    const wsStr = weekStart()
    const [yr, mo, dy] = wsStr.split('-').map(Number)
    const wsDate = new Date(yr, mo - 1, dy) // minuit heure locale, pas UTC
    const names = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(wsDate); d.setDate(wsDate.getDate() + offsetWeeks * 7 + i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      return { date: dateStr, name: names[i], num: d.getDate(), isToday: d.getTime() === today.getTime(), isPast: d < today, sessions: sessions.filter(s => s.user_id === uid && s.date === dateStr) }
    })
  }
  const thisWeekDays = buildWeekDays(0)
  const nextWeekDays = buildWeekDays(1)

  // Simulateur de course
  const simTotal = (+simTarget.h * 3600) + (+simTarget.m * 60)
  const simCalc = simTotal > 60 ? (() => {
    const fmt = s => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}` }
    const fmtP = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
    const nat = Math.round(simTotal * 0.115), t1 = Math.round(simTotal * 0.025)
    const velo = Math.round(simTotal * 0.43), t2 = Math.round(simTotal * 0.020)
    const cap = simTotal - nat - t1 - velo - t2
    return [
      { label: 'Natation 750m', time: fmt(nat), detail: `${fmtP(nat / 7.5)}/100m`, color: discColor('Natation') },
      { label: 'Transition 1', time: fmt(t1), detail: '—', color: S.textSec },
      { label: 'Vélo 20km', time: fmt(velo), detail: `${(20 / (velo / 3600)).toFixed(1)} km/h`, color: discColor('Vélo') },
      { label: 'Transition 2', time: fmt(t2), detail: '—', color: S.textSec },
      { label: 'Course 5km', time: fmt(cap), detail: `${fmtP(cap / 5)}/km`, color: discColor('Course à pied') },
    ]
  })() : null

  async function generateWeek() {
    setGenerating(true)
    try {
      const reply = await askCoach(buildSystem(uid, sessions, wellness, userData), [{ role: 'user', content: `Génère-moi un planning d'entraînement complet pour la semaine prochaine. Tiens compte de mes séances récentes, de mon niveau de fatigue, et de l'objectif triathlon Sprint en décembre 2026. Donne-moi 5 à 6 séances précises avec : discipline, durée, intensité (RPE cible), objectif de la séance et un conseil clé. Sois concret et adapté à mon niveau actuel.` }])
      setAiPlan(reply)
    } catch { setAiPlan('Erreur lors de la génération. Réessaie.') }
    setGenerating(false)
  }

  async function generateNutrition() {
    setGeneratingNutrition(true)
    try {
      const weekMins = Math.round(sessions.filter(s => s.user_id === uid && s.date >= weekStart()).reduce((a, s) => a + (s.duration || 0), 0) / 60)
      const reply = await askCoach(buildSystem(uid, sessions, wellness, userData), [{ role: 'user', content: `Génère mon plan nutritionnel pour les 7 prochains jours. Volume d'entraînement cette semaine : ${weekMins} minutes. Pour chaque jour donne : calories totales, protéines (g), glucides (g), lipides (g), et 2-3 repas/collations clés. Mets en avant les jours de grosse séance vs jours de repos. Sois concret, en français, format structuré.` }])
      setAiNutrition(reply)
    } catch { setAiNutrition('Erreur lors de la génération. Réessaie.') }
    setGeneratingNutrition(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card style={{ background: `linear-gradient(145deg, ${USERS[uid].accent}10 0%, #FFFFFF 100%)`, border: `1px solid ${USERS[uid].accent}22`, padding: '24px 22px' }}>
        <div style={{ fontSize: 11, color: USERS[uid].accent, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6, opacity: 0.8, fontFamily: '"Barlow Condensed", sans-serif' }}>Triathlon Sprint · Décembre 2026</div>
        <div style={{ fontSize: 72, fontWeight: 900, color: USERS[uid].accent, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: '"Barlow Condensed", sans-serif' }}>J-{daysLeft()}</div>
        <div style={{ fontSize: 13, color: S.textSec, marginTop: 8, fontWeight: 500 }}>750m natation · 20km vélo · 5km course</div>
      </Card>

      {/* Calendrier 2 semaines */}
      <Card>
        <Label>Calendrier</Label>
        {[{ label: 'Cette semaine', days: thisWeekDays }, { label: 'Semaine prochaine', days: nextWeekDays }].map(({ label, days }) => (
          <div key={label} style={{ marginBottom: label === 'Cette semaine' ? 16 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: S.text }}>{label}</div>
              <div style={{ flex: 1, height: 1, background: S.border }} />
              <div style={{ fontSize: 11, color: S.textSec }}>
                {days.filter(d => d.sessions.some(s => !isPlanned(s))).length > 0 && (
                  <span style={{ color: S.green, fontWeight: 600 }}>
                    {days.filter(d => d.sessions.some(s => !isPlanned(s))).length} séance{days.filter(d => d.sessions.some(s => !isPlanned(s))).length > 1 ? 's' : ''}
                  </span>
                )}
                {days.filter(d => d.sessions.some(s => isPlanned(s))).length > 0 && (
                  <span style={{ color: S.yellow, fontWeight: 600, marginLeft: 6 }}>
                    {days.filter(d => d.sessions.some(s => isPlanned(s))).length} planifiée{days.filter(d => d.sessions.some(s => isPlanned(s))).length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {days.map(day => {
                const hasReal = day.sessions.some(s => !isPlanned(s))
                const hasPlanned = day.sessions.some(s => isPlanned(s))
                const firstPlanned = day.sessions.find(s => isPlanned(s))
                const dotBg = day.sessions.length === 0
                  ? (day.isPast ? S.border : `${S.textTer}40`)
                  : null
                return (
                  <div key={day.date} onClick={() => firstPlanned && setPlannedSelected(firstPlanned)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 2px', borderRadius: S.radiusSm, background: day.isToday ? `${USERS[uid].accent}15` : 'transparent', border: `1.5px solid ${day.isToday ? USERS[uid].accent + '55' : 'transparent'}`, cursor: firstPlanned ? 'pointer' : 'default' }}>
                    <div style={{ fontSize: 9, color: S.textSec, fontWeight: 600, marginBottom: 3, textTransform: 'uppercase' }}>{day.name}</div>
                    <div style={{ fontSize: 15, fontWeight: day.isToday ? 800 : 500, color: day.isToday ? USERS[uid].accent : S.text, marginBottom: 5 }}>{day.num}</div>
                    {day.sessions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        {day.sessions.slice(0, 2).map((s, i) => {
                          const sp = isPlanned(s)
                          return (
                            <div key={i} style={{ width: 22, height: 22, borderRadius: 7, background: sp ? 'transparent' : `${discColor(s.discipline)}22`, border: sp ? `1.5px dashed ${discColor(s.discipline)}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <DiscIcon disc={s.discipline} size={11} color={discColor(s.discipline)} />
                            </div>
                          )
                        })}
                        {hasReal && !hasPlanned && <div style={{ fontSize: 8, color: S.green, fontWeight: 700 }}>{Math.round(day.sessions.filter(s => !isPlanned(s)).reduce((a, s) => a + (s.duration || 0), 0) / 60)}m</div>}
                        {hasPlanned && !hasReal && <div style={{ fontSize: 7, color: S.yellow, fontWeight: 700 }}>Planifié</div>}
                        {hasReal && hasPlanned && <div style={{ fontSize: 7, color: S.green, fontWeight: 700 }}>+plan</div>}
                      </div>
                    ) : (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotBg }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 14, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: S.textSec }}><div style={{ width: 10, height: 10, borderRadius: 3, background: `${S.green}40` }} />Séance faite</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: S.textSec }}><div style={{ width: 10, height: 10, borderRadius: 3, border: `1.5px dashed ${S.yellow}` }} />Planifiée</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: S.textSec }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: S.border }} />Repos</div>
        </div>
      </Card>

      {/* Simulateur de course */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Target size={15} color={USERS[uid].accent} />
          <Label>Simulateur triathlon Sprint</Label>
        </div>
        <div style={{ fontSize: 12, color: S.textSec, marginBottom: 10 }}>Temps total objectif</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <input type="number" value={simTarget.h} onChange={e => setSimTarget(p => ({ ...p, h: e.target.value }))} min="0" max="5" style={inputStyle({ textAlign: 'center' })} />
            <div style={{ fontSize: 10, color: S.textSec, textAlign: 'center', marginTop: 4 }}>heures</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: S.textSec, paddingBottom: 22 }}>:</div>
          <div style={{ flex: 1 }}>
            <input type="number" value={simTarget.m} onChange={e => setSimTarget(p => ({ ...p, m: e.target.value }))} min="0" max="59" style={inputStyle({ textAlign: 'center' })} />
            <div style={{ fontSize: 10, color: S.textSec, textAlign: 'center', marginTop: 4 }}>minutes</div>
          </div>
        </div>
        {simCalc && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {simCalc.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: `${item.color}12`, borderRadius: S.radiusSm, borderLeft: `3px solid ${item.color}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{item.label}</div>
                  {item.detail !== '—' && <div style={{ fontSize: 11, color: S.textSec, marginTop: 1 }}>{item.detail}</div>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: S.text }}>{item.time}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Label>Plan de périodisation</Label>
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: S.border, borderRadius: 99 }} />
          {PLAN[uid].map((p, i) => (
            <div key={p.phase} style={{ position: 'relative', paddingBottom: i < PLAN[uid].length - 1 ? 20 : 0 }}>
              <div style={{ position: 'absolute', left: -20, top: 2, width: 12, height: 12, borderRadius: '50%', background: p.color, border: '3px solid #FFFFFF', boxShadow: '0 0 0 1px rgba(0,0,0,0.08)' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: S.text }}>{p.phase}</div>
              <div style={{ fontSize: 12, color: p.color, fontWeight: 600, marginTop: 2 }}>{p.period}</div>
              <div style={{ fontSize: 13, color: S.textSec, marginTop: 4, lineHeight: 1.5 }}>{p.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Plan nutrition IA */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Utensils size={15} color={USERS[uid].accent} />
          <Label>Plan nutrition IA</Label>
        </div>
        <button onClick={generateNutrition} disabled={generatingNutrition} style={{ width: '100%', padding: '14px', borderRadius: S.radiusSm, border: 'none', background: generatingNutrition ? S.bg : USERS[uid].accent, color: generatingNutrition ? S.textSec : '#fff', fontSize: 15, fontWeight: 700, cursor: generatingNutrition ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {generatingNutrition ? <><Loader2 size={16} /> Génération en cours...</> : <><Utensils size={16} /> Générer mon plan nutrition 7 jours</>}
        </button>
        {aiNutrition && <>
          <div style={{ marginTop: 14, background: S.bg, borderRadius: S.radiusSm, padding: '14px 16px', fontSize: 14, lineHeight: 1.75, color: S.text, whiteSpace: 'pre-wrap' }}>{aiNutrition}</div>
          <button onClick={() => setAiNutrition(null)} style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: S.radiusSm, border: `1px solid ${S.border}`, background: 'transparent', color: S.textSec, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Effacer</button>
        </>}
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
      <PlannedSessionSheet session={plannedSelected} uid={uid} onDone={(id, updates) => setSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))} open={!!plannedSelected} onClose={() => setPlannedSelected(null)} />
    </div>
  )
}

function ProfilePage({ uid, sessions, userData, updateUserData }) {
  const [shoes, setShoes] = useRemoteData(uid, 'shoes', [], userData, updateUserData)
  const [showShoeForm, setShowShoeForm] = useState(false)
  const [newShoe, setNewShoe] = useState({ name: '', brand: '', purchaseDate: todayStr(), startKm: '0', maxKm: '700' })
  const [hrMax, setHrMax] = useRemoteData(uid, 'hrMax', '', userData, updateUserData)
  const [hrRest, setHrRest] = useRemoteData(uid, 'hrRest', '', userData, updateUserData)
  const [vma, setVma] = useRemoteData(uid, 'vma', '', userData, updateUserData)
  const [weights, setWeights] = useRemoteData(uid, 'weights', [], userData, updateUserData)
  const [newWeight, setNewWeight] = useState('')

  const userSessions = sessions.filter(s => s.user_id === uid)

  // Streaks — iterate over sorted unique training dates
  const { currentStreak, bestStreak } = (() => {
    const dates = [...new Set(userSessions.map(s => s.date))].sort()
    if (!dates.length) return { currentStreak: 0, bestStreak: 0 }
    let best = 1, cur = 1
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]), next = new Date(dates[i])
      const diff = (next - prev) / 86400000
      cur = diff === 1 ? cur + 1 : 1
      if (cur > best) best = cur
    }
    // check if streak reaches today or yesterday
    const lastDate = new Date(dates[dates.length - 1])
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const diffFromToday = (today - lastDate) / 86400000
    const activeCur = diffFromToday <= 1 ? cur : 0
    return { currentStreak: activeCur, bestStreak: best }
  })()

  // Badges
  const totalSec = userSessions.reduce((a, s) => a + (s.duration || 0), 0)
  const totalMin = Math.floor(totalSec / 60)
  const badges = [
    { icon: '🔥', label: '7j streak', earned: bestStreak >= 7, desc: '7 jours consécutifs' },
    { icon: '🔥', label: '30j streak', earned: bestStreak >= 30, desc: '30 jours consécutifs' },
    { icon: '🏅', label: '10 séances', earned: userSessions.length >= 10, desc: '10 séances enregistrées' },
    { icon: '🏅', label: '50 séances', earned: userSessions.length >= 50, desc: '50 séances enregistrées' },
    { icon: '🏊', label: '750m natation', earned: userSessions.some(s => s.discipline === 'Natation' && s.distance && (s.distance_unit === 'm' ? +s.distance >= 750 : +s.distance >= 0.75)), desc: '750m en une séance' },
    { icon: '🚴', label: '20km vélo', earned: userSessions.some(s => s.discipline === 'Vélo' && +s.distance >= 20), desc: '20km en une séance' },
    { icon: '🏃', label: '5km course', earned: userSessions.some(s => s.discipline === 'Course à pied' && +s.distance >= 5), desc: '5km en une séance' },
    { icon: '⚡', label: '1er Brick', earned: userSessions.some(s => s.discipline === 'Brick'), desc: 'Première séance Brick' },
    { icon: '⏱', label: '+1000min', earned: totalSec >= 60000, desc: '1000 min d\'entraînement' },
  ]
  const earnedCount = badges.filter(b => b.earned).length

  // km accumulated by a shoe = startKm + sessions after purchaseDate
  const shoeKm = (shoe) => {
    const start = +shoe.startKm || 0
    const fromSessions = userSessions
      .filter(s => s.discipline === 'Course à pied' && s.date >= shoe.purchaseDate && s.distance)
      .reduce((a, s) => a + (s.distance_unit === 'm' ? +s.distance / 1000 : +s.distance), 0)
    return start + fromSessions
  }

  const addShoe = () => {
    if (!newShoe.name) return
    setShoes(prev => [...prev, { ...newShoe, id: Date.now(), archived: false }])
    setNewShoe({ name: '', brand: '', purchaseDate: todayStr(), startKm: '0', maxKm: '700' })
    setShowShoeForm(false)
  }
  const archiveShoe = (id) => setShoes(prev => prev.map(s => s.id === id ? { ...s, archived: true } : s))
  const deleteShoe = (id) => { if (window.confirm('Supprimer cette paire ?')) setShoes(prev => prev.filter(s => s.id !== id)) }

  const activeShoes = shoes.filter(s => !s.archived)
  const archivedShoes = shoes.filter(s => s.archived)

  // Global stats
  const discStats = [
    { disc: 'Course à pied', icon: '🏃', unit: 'km' },
    { disc: 'Vélo', icon: '🚴', unit: 'km' },
    { disc: 'Natation', icon: '🏊', unit: 'km' },
  ].map(({ disc, icon, unit }) => {
    const ds = userSessions.filter(s => s.discipline === disc && s.distance)
    const toKm = s => s.distance_unit === 'm' ? +s.distance / 1000 : +s.distance
    const totalKm = ds.reduce((a, s) => a + toKm(s), 0)
    const bestKm = ds.reduce((mx, s) => Math.max(mx, toKm(s)), 0)
    return { disc, icon, unit, totalKm: Math.round(totalKm * 10) / 10, bestKm: Math.round(bestKm * 10) / 10, count: ds.length }
  })

  // Chart data — last 12 weeks
  const weeklyChartData = (() => {
    const now = new Date()
    const toWeekStart = (date) => {
      const d = new Date(date); d.setDate(d.getDate() - d.getDay() + 1); d.setHours(0, 0, 0, 0); return d
    }
    const currentWS = toWeekStart(now)
    const realSessions = userSessions.filter(s => !isPlanned(s))
    let weekStarts
    if (!realSessions.length) {
      weekStarts = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(currentWS); d.setDate(d.getDate() - (11 - i) * 7); return d
      })
    } else {
      const earliest = realSessions.reduce((min, s) => s.date < min ? s.date : min, realSessions[0].date)
      const s1 = toWeekStart(new Date(earliest))
      weekStarts = []
      const d = new Date(s1)
      while (d <= currentWS) { weekStarts.push(new Date(d)); d.setDate(d.getDate() + 7) }
    }
    return weekStarts.map(start => {
      const end = new Date(start); end.setDate(start.getDate() + 7)
      const label = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`
      const ws = realSessions.filter(s => { const d = new Date(s.date); return d >= start && d < end })
      const byDisc = d => ws.filter(s => s.discipline === d)
      const natDist = s => s.distance_unit === 'm' ? +s.distance : +s.distance * 1000
      const allRpe = ws.filter(s => s.rpe).map(s => +s.rpe)
      return {
        week: label,
        Course: Math.round(byDisc('Course à pied').reduce((a, s) => a + (s.duration || 0), 0) / 60),
        Vélo: Math.round(byDisc('Vélo').reduce((a, s) => a + (s.duration || 0), 0) / 60),
        Natation: Math.round(byDisc('Natation').reduce((a, s) => a + (s.duration || 0), 0) / 60),
        CourseKm: +byDisc('Course à pied').filter(s => s.distance).reduce((a, s) => a + (s.distance_unit === 'm' ? +s.distance / 1000 : +s.distance), 0).toFixed(1),
        VéloKm: +byDisc('Vélo').filter(s => s.distance).reduce((a, s) => a + +s.distance, 0).toFixed(1),
        NatM: +byDisc('Natation').filter(s => s.distance).reduce((a, s) => a + natDist(s), 0).toFixed(0),
        rpe: allRpe.length ? +(allRpe.reduce((a, v) => a + v, 0) / allRpe.length).toFixed(1) : null,
      }
    })
  })()
  const rpeData8 = weeklyChartData.slice(-8)
  const hasChartData = weeklyChartData.some(w => w.Course || w.Vélo || w.Natation)

  const addWeight = () => {
    if (!newWeight) return
    setWeights(prev => [...prev, { date: todayStr(), weight: +newWeight }].slice(-60))
    setNewWeight('')
  }
  const deleteWeight = (idx) => setWeights(prev => prev.filter((_, i) => i !== idx))

  // HR zones — Karvonen formula: zone = hrRest + (hrMax - hrRest) × pct
  const zones = hrMax ? (() => {
    const max = +hrMax, rest = hrRest ? +hrRest : 0
    const hrr = max - rest  // heart rate reserve
    const k = (lo, hi) => [Math.round(rest + hrr * lo), Math.round(rest + hrr * hi)]
    return [
      { name: 'Z1 — Récupération', pct: '50–60%', range: k(0.5, 0.6), color: S.green,   desc: 'Récupération active, brûle les graisses' },
      { name: 'Z2 — Endurance',    pct: '60–70%', range: k(0.6, 0.7), color: '#007AFF', desc: 'Base aérobie, endurance fondamentale' },
      { name: 'Z3 — Tempo',        pct: '70–80%', range: k(0.7, 0.8), color: S.yellow,  desc: 'Améliore l\'efficacité cardiovasculaire' },
      { name: 'Z4 — Seuil',        pct: '80–90%', range: k(0.8, 0.9), color: ORANGE,    desc: 'Repousse le seuil lactique' },
      { name: 'Z5 — VMA/Max',      pct: '90–100%', range: k(0.9, 1.0), color: S.red,    desc: 'VO2max, effort maximal court' },
    ]
  })() : []

  const exportCSV = () => {
    const headers = ['date', 'discipline', 'duration', 'distance', 'distance_unit', 'pace', 'hr_avg', 'hr_max', 'rpe', 'conditions', 'notes']
    const sorted = [...userSessions].sort((a, b) => a.date.localeCompare(b.date))
    const rows = sorted.map(s => headers.map(h => {
      const v = s[h] ?? ''
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v
    }).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `seances_${uid}_${todayStr()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Shoe tracking ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeShoes.length > 0 ? 16 : 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: S.textSec, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Chaussures de course</div>
          <button onClick={() => setShowShoeForm(true)} style={{ padding: '6px 14px', borderRadius: 99, border: 'none', background: USERS[uid].accent, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Ajouter</button>
        </div>

        {activeShoes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: S.textSec, fontSize: 13 }}>Aucune paire enregistrée</div>
        )}

        {activeShoes.map((shoe, idx) => {
          const km = shoeKm(shoe)
          const maxKm = +shoe.maxKm || 700
          const pct = (km / maxKm) * 100
          const isWorn = pct >= 100
          const isAlert = pct >= 80
          const barColor = isWorn ? S.red : isAlert ? S.yellow : S.green
          return (
            <div key={shoe.id} style={{ paddingTop: idx === 0 ? 0 : 16, paddingBottom: 16, borderBottom: idx < activeShoes.length - 1 || archivedShoes.length > 0 ? `1px solid ${S.border}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: S.text }}>{shoe.name}</div>
                  <div style={{ fontSize: 12, color: S.textSec, marginTop: 2 }}>
                    {[shoe.brand, shoe.purchaseDate].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isWorn ? S.red : isAlert ? S.yellow : S.text }}>{Math.round(km)} km</div>
                  <div style={{ fontSize: 11, color: S.textSec }}>/ {maxKm} km</div>
                </div>
              </div>
              <PBar pct={pct} color={barColor} h={8} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                {isWorn
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: S.red }}>🔴 À remplacer</span>
                  : isAlert
                    ? <span style={{ fontSize: 12, fontWeight: 600, color: S.yellow }}>🟡 Fin de vie ({Math.round(pct)}%)</span>
                    : <span style={{ fontSize: 12, color: S.textSec }}>{Math.round(pct)}% de la durée de vie</span>
                }
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => archiveShoe(shoe.id)} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.textSec, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Archiver</button>
                  <button onClick={() => deleteShoe(shoe.id)} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.red, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                </div>
              </div>
            </div>
          )
        })}

        {archivedShoes.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: S.textTer, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Archivées ({archivedShoes.length})</div>
            {archivedShoes.map(shoe => (
              <div key={shoe.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', opacity: 0.5 }}>
                <span style={{ fontSize: 13, color: S.textSec }}>{shoe.name}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: S.textTer }}>{Math.round(shoeKm(shoe))} km</span>
                  <button onClick={() => deleteShoe(shoe.id)} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: S.textSec, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add shoe sheet */}
      <Sheet open={showShoeForm} onClose={() => setShowShoeForm(false)} title="Nouvelle paire">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
          <div>
            <Label>Nom *</Label>
            <input value={newShoe.name} onChange={e => setNewShoe(p => ({ ...p, name: e.target.value }))} placeholder="Nike Pegasus 41" style={inputStyle()} />
          </div>
          <div>
            <Label>Marque</Label>
            <input value={newShoe.brand} onChange={e => setNewShoe(p => ({ ...p, brand: e.target.value }))} placeholder="Nike" style={inputStyle()} />
          </div>
          <div>
            <Label>Date d'achat</Label>
            <input type="date" value={newShoe.purchaseDate} onChange={e => setNewShoe(p => ({ ...p, purchaseDate: e.target.value }))} style={inputStyle()} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Km de départ</Label>
              <input type="number" value={newShoe.startKm} onChange={e => setNewShoe(p => ({ ...p, startKm: e.target.value }))} placeholder="0" style={inputStyle()} />
            </div>
            <div>
              <Label>Km max</Label>
              <input type="number" value={newShoe.maxKm} onChange={e => setNewShoe(p => ({ ...p, maxKm: e.target.value }))} placeholder="700" style={inputStyle()} />
            </div>
          </div>
          <button onClick={addShoe} disabled={!newShoe.name} style={{ width: '100%', padding: '14px', borderRadius: S.radiusSm, border: 'none', background: newShoe.name ? USERS[uid].accent : S.bg, color: newShoe.name ? '#fff' : S.textSec, fontSize: 15, fontWeight: 700, cursor: newShoe.name ? 'pointer' : 'not-allowed', fontFamily: 'inherit', marginTop: 4 }}>
            Enregistrer
          </button>
        </div>
      </Sheet>

      {/* ── Streaks & Badges ── */}
      <Card>
        <Label>Série & badges</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div style={{ background: currentStreak >= 7 ? `${ORANGE}12` : S.bg, borderRadius: S.radiusSm, padding: '16px 12px', textAlign: 'center', border: `1px solid ${currentStreak >= 7 ? ORANGE + '30' : S.border}` }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: currentStreak >= 3 ? ORANGE : S.text, fontFamily: '"Barlow Condensed", sans-serif', lineHeight: 1 }}>{currentStreak}j</div>
            <div style={{ fontSize: 10, color: S.textTer, marginTop: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>série actuelle</div>
          </div>
          <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: '16px 12px', textAlign: 'center', border: `1px solid ${S.border}` }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: S.text, fontFamily: '"Barlow Condensed", sans-serif', lineHeight: 1 }}>{bestStreak}j</div>
            <div style={{ fontSize: 10, color: S.textTer, marginTop: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>meilleur streak</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: S.textTer, marginBottom: 12, letterSpacing: '0.04em' }}>{earnedCount}/{badges.length} badges débloqués</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {badges.map(b => (
            <div key={b.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 74, padding: '12px 6px', borderRadius: 14, background: b.earned ? `${USERS[uid].accent}12` : S.bg, border: `1px solid ${b.earned ? USERS[uid].accent + '35' : S.border}`, opacity: b.earned ? 1 : 0.40, transition: 'all 0.2s' }}>
              <div style={{ fontSize: 24 }}>{b.icon}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: b.earned ? USERS[uid].accent : S.textTer, marginTop: 6, textAlign: 'center', lineHeight: 1.3, letterSpacing: '0.02em' }}>{b.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Global stats ── */}
      <Card>
        <Label>Statistiques globales</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: `${USERS[uid].accent}10`, borderRadius: S.radiusSm, padding: '16px 12px', textAlign: 'center', border: `1px solid ${USERS[uid].accent}22` }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: USERS[uid].accent, fontFamily: '"Barlow Condensed", sans-serif', lineHeight: 1 }}>{userSessions.length}</div>
            <div style={{ fontSize: 10, color: S.textTer, marginTop: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>séances totales</div>
          </div>
          <div style={{ background: S.bg, borderRadius: S.radiusSm, padding: '16px 12px', textAlign: 'center', border: `1px solid ${S.border}` }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: S.text, fontFamily: '"Barlow Condensed", sans-serif', lineHeight: 1 }}>{Math.round(totalSec / 3600 * 10) / 10}h</div>
            <div style={{ fontSize: 10, color: S.textTer, marginTop: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>d'entraînement</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {discStats.map(ds => (
            <div key={ds.disc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 14px', background: S.bg, borderRadius: S.radiusSm, border: `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <DiscIcon disc={ds.disc} size={18} color={discColor(ds.disc)} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{ds.disc}</div>
                  <div style={{ fontSize: 11, color: S.textSec }}>{ds.count} séance{ds.count !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: S.text }}>{ds.totalKm} km</div>
                {ds.bestKm > 0 && <div style={{ fontSize: 10, color: S.textSec }}>record {ds.bestKm} km</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Progression charts ── */}
      {hasChartData && (
        <Card>
          <Label>Volume hebdomadaire (min) — 12 semaines</Label>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyChartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: S.textSec }} interval={2} />
              <YAxis tick={{ fontSize: 9, fill: S.textSec }} width={30} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${v} min`, n]} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
              <Line type="monotone" dataKey="Course" name="Course à pied" stroke={ORANGE} strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="Vélo" name="Vélo" stroke="#FF9500" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="Natation" name="Natation" stroke="#007AFF" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {hasChartData && (
        <Card>
          <Label>Distance hebdomadaire — 12 semaines</Label>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weeklyChartData} margin={{ top: 4, right: 28, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: S.textSec }} interval={2} />
              <YAxis yAxisId="km" tick={{ fontSize: 9, fill: S.textSec }} width={30} />
              <YAxis yAxisId="m" orientation="right" tick={{ fontSize: 9, fill: S.textSec }} width={30} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [n === 'Natation (m)' ? `${v} m` : `${v} km`, n]} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
              <Line yAxisId="km" type="monotone" dataKey="CourseKm" name="Course (km)" stroke={ORANGE} strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="km" type="monotone" dataKey="VéloKm" name="Vélo (km)" stroke="#FF9500" strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="m" type="monotone" dataKey="NatM" name="Natation (m)" stroke="#007AFF" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {rpeData8.some(w => w.rpe !== null) && (
        <Card>
          <Label>Charge d'entraînement — RPE moyen / semaine</Label>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={rpeData8} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: S.textSec }} />
              <YAxis tick={{ fontSize: 9, fill: S.textSec }} domain={[0, 10]} width={22} ticks={[0, 2, 4, 6, 8, 10]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v ?? '—', 'RPE moyen']} />
              <Bar dataKey="rpe" name="RPE moyen" fill={USERS[uid].accent} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <Label>Suivi du poids</Label>
        <div style={{ display: 'flex', gap: 8, marginBottom: weights.length > 1 ? 14 : 10 }}>
          <input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} onKeyDown={e => e.key === 'Enter' && addWeight()} placeholder="Poids (kg)" style={{ ...inputStyle(), flex: 1 }} />
          <button onClick={addWeight} style={{ padding: '12px 18px', borderRadius: S.radiusSm, border: 'none', background: USERS[uid].accent, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 16 }}>+</button>
        </div>
        {weights.length > 1 ? (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={weights.slice(-20)} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={S.border} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: S.textSec }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: S.textSec }} domain={['auto', 'auto']} width={32} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v} kg`, 'Poids']} />
              <Line type="monotone" dataKey="weight" stroke={USERS[uid].accent} strokeWidth={2} dot={{ fill: USERS[uid].accent, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: S.textSec, padding: '4px 0 8px' }}>
            {weights.length === 0 ? 'Ajoute ta première mesure' : 'Ajoute une 2ᵉ mesure pour afficher le graphique'}
          </div>
        )}
        {weights.length > 0 && (
          <div style={{ marginTop: 12, maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...weights].reverse().map((w, i) => (
              <div key={weights.length - 1 - i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, background: i === 0 ? `${USERS[uid].accent}10` : 'transparent' }}>
                <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400, color: S.text }}>{w.weight} kg</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: S.textSec }}>{w.date}</span>
                  <button onClick={() => deleteWeight(weights.length - 1 - i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.textTer, lineHeight: 1, padding: 2, fontSize: 14 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Zones d'allure course ── */}
      <Card>
        <Label>Zones d'allure course — VMA</Label>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: S.textSec, fontWeight: 600, marginBottom: 6 }}>VMA (km/h)</div>
          <input type="number" value={vma} onChange={e => setVma(e.target.value)} placeholder="ex: 14" style={inputStyle()} />
          {vma && <div style={{ fontSize: 12, color: S.textSec, marginTop: 6 }}>Allure VMA : {(() => { const s = 3600 / +vma; return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` })()} /km</div>}
        </div>
        {vma ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'Z1 — Récupération', range: '55–65%', lo: 0.55, hi: 0.65, color: S.green },
              { name: 'Z2 — Endurance',    range: '65–75%', lo: 0.65, hi: 0.75, color: '#007AFF' },
              { name: 'Z3 — Tempo',        range: '75–85%', lo: 0.75, hi: 0.85, color: S.yellow },
              { name: 'Z4 — Seuil',        range: '85–95%', lo: 0.85, hi: 0.95, color: ORANGE },
              { name: 'Z5 — VMA',          range: '95–105%', lo: 0.95, hi: 1.05, color: S.red },
            ].map(z => {
              const toAllure = pct => { const s = 3600 / (+vma * pct); return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` }
              return (
                <div key={z.name} style={{ padding: '10px 14px', background: `${z.color}12`, borderRadius: S.radiusSm }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: z.color }}>{z.name} <span style={{ fontSize: 10, fontWeight: 400, color: S.textSec }}>{z.range}</span></div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.text }}>{toAllure(z.hi)} – {toAllure(z.lo)}<span style={{ fontSize: 10, fontWeight: 400, color: S.textSec }}> /km</span></div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: S.textSec }}>Entre ta VMA pour calculer tes allures cibles</div>
        )}
      </Card>

      {/* ── HR Zones ── */}
      <Card>
        <Label>Zones de fréquence cardiaque — Karvonen</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: S.textSec, fontWeight: 600, marginBottom: 6 }}>FC MAX (bpm)</div>
            <input type="number" value={hrMax} onChange={e => setHrMax(e.target.value)} placeholder="190" style={inputStyle()} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: S.textSec, fontWeight: 600, marginBottom: 6 }}>FC REPOS (bpm)</div>
            <input type="number" value={hrRest} onChange={e => setHrRest(e.target.value)} placeholder="55" style={inputStyle()} />
          </div>
        </div>
        {hrMax && !hrRest && (
          <div style={{ fontSize: 11, color: S.textSec, marginBottom: 10, padding: '8px 12px', background: S.bg, borderRadius: 8, border: `1px solid ${S.border}` }}>
            💡 Ajoute ta FC au repos (matin au réveil) pour des zones plus précises
          </div>
        )}
        {zones.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {zones.map(z => (
              <div key={z.name} style={{ padding: '10px 14px', background: `${z.color}12`, borderRadius: S.radiusSm }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: z.color }}>{z.name} <span style={{ fontSize: 10, fontWeight: 400, color: S.textSec }}>{z.pct}</span></div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: S.text }}>{z.range[0]}–{z.range[1]} <span style={{ fontSize: 11, fontWeight: 400, color: S.textSec }}>bpm</span></div>
                </div>
                <div style={{ fontSize: 11, color: S.textSec, marginTop: 3 }}>{z.desc}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: S.textSec }}>Entre ta FC max pour calculer tes zones</div>
        )}
      </Card>

      {/* ── CSV Export ── */}
      <button onClick={exportCSV} style={{ width: '100%', padding: '14px', borderRadius: S.radiusSm, border: `1.5px solid ${S.border}`, background: S.card, color: S.text, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Download size={16} /> Exporter mes séances (CSV)
      </button>
    </div>
  )
}

function Dashboard({ uid, sessions, wellness, onSave }) {
  console.log('[Dashboard] uid:', uid, '| sessions.length:', sessions.length, '| user_ids in data:', [...new Set(sessions.map(s => s.user_id))])
  const ws = weekStart()
  const week = sessions.filter(s => s.user_id === uid && s.date >= ws)
  const totalSec = week.reduce((a, s) => a + (s.duration || 0), 0)
  const lastWell = wellness.filter(w => w.user_id === uid).sort((a, b) => b.date.localeCompare(a.date))[0]
  const wellScore = lastWell ? Math.round(((lastWell.sleep + (6 - lastWell.fatigue) + lastWell.mood) / 15) * 100) : null
  const scoreColor = wellScore >= 70 ? S.green : wellScore >= 40 ? S.yellow : S.red
  const recent = sessions.filter(s => s.user_id === uid).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3)
  console.log('[Dashboard] recent sessions:', recent, '| uid:', uid, '| all user_ids:', [...new Set(sessions.map(s => s.user_id))])

  // Score de forme = wellness (70%) + inverse de la charge semaine (30%)
  const loadScore = Math.min(100, (totalSec / 18000) * 100)
  const formPct = wellScore !== null ? Math.round(wellScore * 0.70 + (100 - loadScore * 0.5) * 0.30) : null
  const formRec = formPct === null ? null
    : formPct >= 68 ? { txt: "🟢 Prêt à s'entraîner fort", c: S.green, bg: `${S.green}12` }
    : formPct >= 45 ? { txt: '🟡 Entraînement modéré conseillé', c: S.yellow, bg: `${S.yellow}12` }
    : { txt: '🔴 Repos recommandé aujourd\'hui', c: S.red, bg: `${S.red}12` }

  // Alertes surcharge — semaine précédente en string locale
  const [yr, mo, dy] = ws.split('-').map(Number)
  const prevWsDate = new Date(yr, mo - 1, dy); prevWsDate.setDate(prevWsDate.getDate() - 7)
  const prevWs = `${prevWsDate.getFullYear()}-${String(prevWsDate.getMonth()+1).padStart(2,'0')}-${String(prevWsDate.getDate()).padStart(2,'0')}`
  const prevWeek = sessions.filter(s => s.user_id === uid && s.date >= prevWs && s.date < ws)
  const prevSec = prevWeek.reduce((a, s) => a + (s.duration || 0), 0)
  const volInc = prevSec > 1200 ? Math.round((totalSec - prevSec) / prevSec * 100) : null
  const volAlert = volInc !== null && volInc > 10
  const last3 = [...sessions].filter(s => s.user_id === uid).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3)
  const rpeAlert = last3.length >= 3 && last3.every(s => (s.rpe || 0) > 7.5)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { Icon: Calendar, val: week.length, label: 'Séances', color: USERS[uid].accent },
          { Icon: Clock, val: `${Math.floor(totalSec / 3600)}h${String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')}`, label: 'Volume', color: S.text },
          { Icon: Heart, val: wellScore !== null ? `${wellScore}%` : '—', label: 'Bien-être', color: wellScore ? scoreColor : S.textTer },
        ].map((item, i) => (
          <Card key={i} style={{ padding: '16px 10px', textAlign: 'center', background: i === 0 ? `linear-gradient(145deg, ${USERS[uid].accent}14, ${USERS[uid].accent}06)` : S.card, border: i === 0 ? `1px solid ${USERS[uid].accent}25` : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><item.Icon size={16} color={item.color} strokeWidth={2} /></div>
            <div style={{ fontSize: 24, fontWeight: 900, color: item.color, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: '"Barlow Condensed", sans-serif' }}>{item.val}</div>
            <div style={{ fontSize: 9, color: S.textTer, marginTop: 5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{item.label}</div>
          </Card>
        ))}
      </div>
      {formRec && (
        <div style={{ padding: '14px 18px', borderRadius: S.radius, background: `${formRec.c}12`, border: `1px solid ${formRec.c}25`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: formRec.c }}>{formRec.txt}</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: formRec.c, fontFamily: '"Barlow Condensed", sans-serif' }}>{formPct}%</span>
        </div>
      )}
      {(volAlert || rpeAlert) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {volAlert && (
            <div style={{ padding: '12px 14px', borderRadius: S.radius, background: `${S.yellow}15`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={16} color={S.yellow} />
              <span style={{ fontSize: 13, fontWeight: 600, color: S.yellow }}>Volume en hausse de {volInc}% vs semaine dernière — pense à récupérer</span>
            </div>
          )}
          {rpeAlert && (
            <div style={{ padding: '12px 14px', borderRadius: S.radius, background: `${S.red}12`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={16} color={S.red} />
              <span style={{ fontSize: 13, fontWeight: 600, color: S.red }}>3 séances consécutives à RPE élevé — récupération active conseillée</span>
            </div>
          )}
        </div>
      )}
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
                  <div style={{ fontSize: 15, fontWeight: 700, color: S.text }}>{fmtDuration(s.duration)}</div>
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
  const [userData, setUserData] = useState({})
  const [offline, setOffline] = useState(false)
  const loadingRef = useRef(false)

  const updateUserData = useCallback((userId, key, value) => {
    setUserData(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || {}), [key]: value }
    }))
  }, [])

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const [{ data: s, error: e1 }, { data: w, error: e2 }, { data: ud, error: e3 }] = await Promise.all([
        supabase.from('sessions').select('*').order('date', { ascending: false }),
        supabase.from('wellness').select('*').order('date', { ascending: false }),
        supabase.from('user_data').select('*'),
      ])
      console.log('[load] sessions data:', s, '| error:', e1)
      console.log('[load] wellness data:', w, '| error:', e2)
      console.log('[load] user_data data:', ud, '| error:', e3)
      if (e1 || e2 || e3) throw new Error('Supabase fetch failed')

      // Cache pour fallback hors-ligne
      try {
        sessionStorage.setItem('cache_sessions', JSON.stringify(s || []))
        sessionStorage.setItem('cache_wellness', JSON.stringify(w || []))
      } catch {}

      setSessions(s || [])
      setWellness(w || [])
      setOffline(false)

      // Build userData map from Supabase rows
      const byUser = {}
      if (ud) {
        ud.forEach(row => {
          if (!byUser[row.user_id]) byUser[row.user_id] = {}
          byUser[row.user_id][row.key] = row.value
        })
      }

      // One-time migration: push any localStorage data to Supabase then wipe it
      const legacyKeys = ['shoes', 'hrMax', 'hrRest', 'vma', 'weights', 'simTarget', 'aiPlan', 'aiNutrition']
      const migrateOps = []
      const keysToWipe = []
      for (const userId of Object.keys(USERS)) {
        if (!byUser[userId]) byUser[userId] = {}
        for (const key of legacyKeys) {
          const lsKey = `${key}_${userId}`
          const raw = localStorage.getItem(lsKey)
          if (raw === null) continue
          keysToWipe.push(lsKey)
          if (byUser[userId][key] !== undefined) continue
          try {
            const value = JSON.parse(raw)
            byUser[userId][key] = value
            migrateOps.push(supabase.from('user_data').upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' }))
          } catch {}
        }
      }
      if (migrateOps.length > 0) await Promise.all(migrateOps)
      keysToWipe.forEach(k => localStorage.removeItem(k))

      setUserData(byUser)
    } catch (e) {
      console.error('Load error:', e)
      try {
        const cs = sessionStorage.getItem('cache_sessions')
        const cw = sessionStorage.getItem('cache_wellness')
        if (cs) setSessions(JSON.parse(cs))
        if (cw) setWellness(JSON.parse(cw))
      } catch {}
      setOffline(!navigator.onLine)
    } finally {
      setBooting(false)
      loadingRef.current = false
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Refresh user_data from Supabase when switching between Louis and Romain
  useEffect(() => {
    if (booting) return
    supabase.from('user_data').select('*').eq('user_id', uid)
      .then(({ data, error }) => {
        if (error) { console.error('Refresh user_data error:', error); return }
        if (data) {
          setUserData(prev => ({
            ...prev,
            [uid]: Object.fromEntries(data.map(row => [row.key, row.value]))
          }))
        }
      })
      .catch(e => console.error('Refresh user_data error:', e))
  }, [uid, booting])

  async function handleAnalyze(session, last) {
    try {
      const msg = `Séance : ${session.discipline}, ${fmtDuration(session.duration)}${session.distance ? `, ${session.distance}${session.distance_unit}` : ''}, RPE ${session.rpe}/10.${session.notes ? ` Notes: ${session.notes}.` : ''}${last ? ` Dernière (${last.date}): ${fmtDuration(last.duration)}, RPE ${last.rpe}/10.` : ''} Analyse en 4 lignes max.`
      const reply = await askCoach(buildSystem(uid, sessions, wellness, userData), [{ role: 'user', content: msg }])
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
    <ToastProvider>
    <div style={{ background: S.bg, minHeight: '100vh', fontFamily: '"Barlow", -apple-system, "Helvetica Neue", sans-serif', color: S.text }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
        @keyframes pulse { 0%,60%,100% { opacity:0.3; transform:scale(0.8) } 30% { opacity:1; transform:scale(1) } }
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        button { -webkit-tap-highlight-color: transparent; }
        button:active:not(:disabled) { transform: scale(0.96); }
        input, textarea, select { color-scheme: light; }
        input::placeholder, textarea::placeholder { color: #AEAEB2; }
        input:focus, textarea:focus, select:focus { border-color: #C7C7CC !important; outline: none; }
        select option { background: #FFFFFF; color: #1C1C1E; }
        input[type=range] { height: 4px; }
      `}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(24px) saturate(180%)', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '13px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {tab === 'home' ? (
              <>
                <div style={{ fontSize: 12, color: S.textTer, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: '"Barlow Condensed", sans-serif' }}>Bonjour</div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', color: S.text, fontFamily: '"Barlow Condensed", sans-serif', lineHeight: 1.1 }}>{USERS[uid].name}</div>
              </>
            ) : <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', fontFamily: '"Barlow Condensed", sans-serif' }}>{titles[tab]}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: `${USERS[uid].accent}18`, border: `1px solid ${USERS[uid].accent}30`, borderRadius: 12, padding: '6px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: USERS[uid].accent, lineHeight: 1, letterSpacing: '-0.02em', fontFamily: '"Barlow Condensed", sans-serif' }}>J‑{daysLeft()}</div>
              <div style={{ fontSize: 8, color: USERS[uid].accent, letterSpacing: '0.10em', fontWeight: 700, opacity: 0.65, marginTop: 1, fontFamily: '"Barlow Condensed", sans-serif' }}>COURSE</div>
            </div>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.06)', borderRadius: 99, padding: 3, gap: 2 }}>
              {['louis','romain'].map(u => (
                <button key={u} onClick={() => setUid(u)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: uid === u ? USERS[u].accent : 'transparent', color: uid === u ? '#fff' : S.textTer, fontWeight: 900, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>{USERS[u].avatar}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {offline && (
        <div style={{ padding: '10px 18px', background: `${S.yellow}15`, borderBottom: `1px solid ${S.yellow}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <AlertTriangle size={14} color={S.yellow} />
          <span style={{ fontSize: 13, fontWeight: 600, color: S.yellow, fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: '0.02em' }}>Mode hors-ligne — données en cache</span>
          <button onClick={load} style={{ fontSize: 11, color: S.yellow, background: 'none', border: `1px solid ${S.yellow}50`, borderRadius: 99, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Réessayer</button>
        </div>
      )}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 110px' }}>
        {booting ? <div style={{ textAlign: 'center', padding: 60, color: S.textSec }}>Chargement...</div> : (
          <>
            {tab === 'home' && <Dashboard key={uid} uid={uid} sessions={sessions} wellness={wellness} onSave={load} />}
            {tab === 'session' && <SessionForm key={uid} uid={uid} sessions={sessions} onSave={load} onAnalyze={handleAnalyze} />}
            {tab === 'coach' && <ChatPage key={uid} uid={uid} sessions={sessions} wellness={wellness} userData={userData} />}
            {tab === 'history' && <HistoryPage key={uid} uid={uid} sessions={sessions} wellness={wellness} setSessions={setSessions} userData={userData} />}
            {tab === 'plan' && <PlanPage key={uid} uid={uid} sessions={sessions} wellness={wellness} setSessions={setSessions} userData={userData} updateUserData={updateUserData} />}
            {tab === 'duel' && <DuelPage sessions={sessions} />}
            {tab === 'profil' && <ProfilePage key={uid} uid={uid} sessions={sessions} userData={userData} updateUserData={updateUserData} />}
          </>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(24px) saturate(180%)', borderTop: `1px solid ${S.border}`, boxShadow: '0 -4px 16px rgba(0,0,0,0.06)', display: 'flex', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        {tabs.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '10px 4px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: active ? USERS[uid].accent : S.textTer, transition: 'color 0.15s', position: 'relative' }}>
              {t.id === 'session' ? (
                <div style={{ width: 38, height: 38, background: active ? USERS[uid].accent : `${USERS[uid].accent}22`, border: `1.5px solid ${active ? 'transparent' : `${USERS[uid].accent}45`}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 1, boxShadow: active ? `0 0 16px ${USERS[uid].accent}50` : 'none' }}>
                  <Plus size={19} color={active ? '#fff' : USERS[uid].accent} />
                </div>
              ) : (
                <>
                  <t.Icon size={21} color={active ? USERS[uid].accent : S.textTer} strokeWidth={active ? 2.2 : 1.5} />
                  {active && <div style={{ position: 'absolute', top: 6, width: 4, height: 4, borderRadius: '50%', background: USERS[uid].accent }} />}
                </>
              )}
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: active ? '0.02em' : 0 }}>{t.label}</span>
            </button>
          )
        })}
      </div>

      <Sheet open={!!analysis} onClose={() => setAnalysis(null)} title="Analyse du coach">
        {analysis && <div style={{ fontSize: 14, lineHeight: 1.75, color: S.text, whiteSpace: 'pre-wrap' }}>{analysis}</div>}
      </Sheet>
    </div>
    </ToastProvider>
  )
}
