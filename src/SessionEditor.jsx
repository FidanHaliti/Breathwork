import { useState } from 'react';
import { DEFAULT_ROUNDS, DEFAULT_STANDARD, validRounds, validStandard } from './sessionConfig';

export default function SessionEditor({ mode, rounds, standard, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => rounds.map(r => ({ ...r })));
  const [rhythm, setRhythm] = useState({ ...standard });
  const valid = mode === 'dynamic' ? validRounds(draft) : validStandard(rhythm);
  const field = (label, value, min, max, change) => <label>{label}<input type="number" min={min} max={max} step="1" required value={value} onChange={e => change(e.target.value === '' ? '' : Number(e.target.value))} /></label>;
  return <form className="session-editor" aria-label="Editimi i timerit" onSubmit={e => { e.preventDefault(); if (valid) onSave(draft, rhythm); }}>
    <h2>Përshtat seancën {mode === 'dynamic' ? 'dinamike' : 'standarde'}</h2>
    <p>Kohët janë në sekonda. Ruajtja e nis timerin nga fillimi; muzika vazhdon veçmas.</p>
    {mode === 'dynamic' ? <>
      <p>Vendos 0 te mbajtja ose pushimi për ta hequr atë fazë. Deri në 12 raunde.</p>
      {draft.map((round, index) => <fieldset key={index}><legend>Raundi {index + 1}</legend><div className="editor-fields">
        {Object.entries({ breathing: 'Frymëmarrje', hold: 'Mbajtje', relax: 'Pushim' }).map(([key, label]) => <div key={key}>{field(`${label} · raundi ${index + 1}`, round[key], key === 'breathing' ? 1 : 0, 600, value => setDraft(draft.map((r, i) => i === index ? { ...r, [key]: value } : r)))}</div>)}
        <button type="button" className="audio-button" disabled={draft.length === 1} onClick={() => setDraft(draft.filter((_, i) => i !== index))}>Hiq raundin {index + 1}</button>
      </div></fieldset>)}
      <button type="button" className="audio-button" disabled={draft.length >= 12} onClick={() => setDraft([...draft, { breathing: 60, hold: 0, relax: 20 }])}>+ Shto raund</button>
    </> : <div className="editor-fields">{Object.entries({ inhale: 'Marrja e frymës', exhale: 'Nxjerrja e frymës', cycles: 'Numri i cikleve' }).map(([key, label]) => <div key={key}>{field(label, rhythm[key], 1, key === 'cycles' ? 120 : 30, value => setRhythm({ ...rhythm, [key]: value }))}</div>)}</div>}
    {!valid && <p role="alert">Plotëso kohë të plota brenda kufijve të fushave.</p>}
    <div className="editor-actions"><button className="audio-button" type="submit" disabled={!valid}>Ruaj ndryshimet</button><button className="audio-button" type="button" onClick={onCancel}>Anulo</button><button className="quiet-button" type="button" onClick={() => { if (mode === 'dynamic') setDraft(DEFAULT_ROUNDS.map(r => ({ ...r }))); else setRhythm({ ...DEFAULT_STANDARD }); }}>Rikthe vlerat fillestare</button></div>
  </form>;
}
