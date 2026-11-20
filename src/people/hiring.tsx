import { tr } from '../platform/i18n';
import { useState } from 'react';
import { CANDIDATE_LABEL, CANDIDATE_STAGES, Candidate, CandidateStage, addDays, averageScore, candidatesToDelete, hiringFunnel } from './domain';
import { People } from './usePeople';
import { PersonSelect, Score, money, nameOf } from './shared';
import { Avatar, Field, Head, Icon, Menu, Panel, Seg, fmtDay, plural, todayIso, useToast } from '../platform/ui';

const BOARD: CandidateStage[] = ['applied', 'screen', 'interview', 'offer'];
const REJECT = [tr("Not enough experience"), tr("Salary expectations"), tr("Chose another offer"), 'Withdrew', tr("Culture add unclear")];

export function Hiring({ hr }: { hr: People }) {
  const toast = useToast();
  const { data } = hr;
  const t = todayIso();
  const open = data.openings.filter((o) => o.open);
  const [opening, setOpening] = useState<string>(open[0]?.id ?? 'all');
  const [cand, setCand] = useState<string | null>(null);
  const [adding, setAdding] = useState<'opening' | 'candidate' | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const list = data.candidates.filter((c) => opening === 'all' || c.openingId === opening);
  const funnel = hiringFunnel(data, opening === 'all' ? undefined : opening);
  const expired = candidatesToDelete(data, t);
  const rejected = list.filter((c) => c.stage === 'rejected');

  const move = (c: Candidate, to: CandidateStage) => {
    if (to === c.stage) return;
    if (to === 'rejected') return setCand(c.id);
    toast(tr("{0} moved to {1}", { 0: c.name, 1: CANDIDATE_LABEL[to] }), hr.moveCandidate(c.id, to));
  };

  return (
    <div className="page">
      <Head eyebrow={tr("People")} title={open.length ? tr("{0} open, {1} in play.", { 0: plural(open.length, 'role'), 1: plural(list.filter((c) => BOARD.includes(c.stage)).length, 'candidate') }) : tr("No open roles.")}>
        <Menu items={[{ label: tr("New role"), icon: 'plus', onClick: () => setAdding('opening') }, ...(expired.length ? [{ label: tr("Delete {0}", { 0: plural(expired.length, 'expired candidate') }), icon: 'trash', danger: true, onClick: () => toast(tr("Deleted {0} past the GDPR keep date", { 0: plural(expired.length, 'candidate') }), hr.deleteCandidates(expired.map((c) => c.id))) }] : [])]} />
        <button className="btn primary" onClick={() => setAdding('candidate')} disabled={!open.length}><Icon name="plus" size={16} />{tr("Add candidate")}</button>
      </Head>
      {expired.length > 0 && (
        <div className="card flat tight" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Icon name="sparkle" /><div className="grow"><div className="ink">{plural(expired.length, 'rejected candidate')} {tr("past the 6-month keep date")}</div><div className="sub">{tr("GDPR: we only keep applications as long as we said we would.")}</div></div>
          <button className="btn sm danger" onClick={() => toast(tr("Deleted {0}", { 0: plural(expired.length, 'candidate') }), hr.deleteCandidates(expired.map((c) => c.id)))}>{tr("Delete now")}</button>
        </div>
      )}
      <div className="toolbar">
        <Seg label={tr("Role")} value={opening} onChange={setOpening} options={[...open.map((o) => ({ id: o.id, label: o.title })), { id: 'all', label: tr("All roles") }]} />
        <div className="spacer" />
        <span className="sub">{funnel.map((f) => `${CANDIDATE_LABEL[f.stage]} ${f.count}`).join(' · ')}</span>
      </div>
      {opening !== 'all' && (() => { const o = data.openings.find((x) => x.id === opening); return o && (
        <p className="sub" style={{ margin: 0 }}>{o.team} {tr("· hiring manager")} {nameOf(data, o.hiringManagerId)}{o.salaryFrom ? tr(" · {0}–{1} a month (published, as the EU pay transparency directive asks)", { 0: money(o.salaryFrom), 1: money(o.salaryTo ?? o.salaryFrom) }) : ''}</p>
      ); })()}
      <div className="board">
        {BOARD.map((s) => {
          const cs = list.filter((c) => c.stage === s);
          return (
            <div key={s} className={`col ${over === s ? 'drop' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)}
              onDrop={() => { const c = data.candidates.find((x) => x.id === drag); setOver(null); setDrag(null); if (c) move(c, s); }}>
              <div className="col-head"><b>{CANDIDATE_LABEL[s]}</b><span className="sub">{cs.length}</span></div>
              {cs.map((c) => {
                const avg = averageScore(c);
                const idx = BOARD.indexOf(c.stage);
                return (
                  <div key={c.id} className="tile" draggable onDragStart={() => setDrag(c.id)} onClick={() => setCand(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setCand(c.id)}>
                    <div className="tt">{c.name}</div>
                    <div className="meta"><span>{c.source} · {fmtDay(c.appliedAt)}</span>{avg !== null && <span className="ink num" data-tip={tr("Average of {0}", { 0: plural(c.scores.length, 'interview score') })}>★ {avg.toFixed(1)}</span>}</div>
                    <span className="menu-at" onClick={(e) => e.stopPropagation()}><Menu items={[
                      ...(idx < BOARD.length - 1 ? [{ label: tr("Move to {0}", { 0: CANDIDATE_LABEL[BOARD[idx + 1]] }), icon: 'arrow', onClick: () => move(c, BOARD[idx + 1]) }] : []),
                      ...(c.stage === 'offer' ? [{ label: tr("Hire"), icon: 'check', onClick: () => setCand(c.id) }] : []),
                      'divider' as const,
                      { label: tr("Reject"), icon: 'close', danger: true, onClick: () => setCand(c.id) },
                    ]} /></span>
                  </div>
                );
              })}
              {cs.length === 0 && <div className="sub" style={{ padding: 8 }}>{tr("Drop a candidate here")}</div>}
            </div>
          );
        })}
      </div>
      {rejected.length > 0 && (
        <details className="card tight">
          <summary className="sub" style={{ cursor: 'pointer', padding: 4 }}>{plural(rejected.length, 'rejected candidate')}</summary>
          <div className="rows" style={{ marginTop: 8 }}>{rejected.map((c) => (
            <div key={c.id} className="row" onClick={() => setCand(c.id)}><Avatar name={c.name} size="sm" /><div className="grow"><div className="t">{c.name}</div><div className="sub">{c.rejectReason} {tr("· keep until")} {fmtDay(c.retainUntil)}</div></div>{c.retainUntil < t && <span className="pill neg">{tr("Delete")}</span>}</div>
          ))}</div>
        </details>
      )}
      {cand && <CandidatePanel hr={hr} id={cand} onClose={() => setCand(null)} />}
      {adding === 'opening' && <OpeningForm hr={hr} onClose={() => setAdding(null)} onAdded={() => setOpening('all')} />}
      {adding === 'candidate' && <CandidateForm hr={hr} openingId={opening === 'all' ? open[0]?.id : opening} onClose={() => setAdding(null)} />}
    </div>
  );
}

function CandidatePanel({ hr, id, onClose }: { hr: People; id: string; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const c = data.candidates.find((x) => x.id === id);
  const [reason, setReason] = useState('');
  const [start, setStart] = useState(addDays(todayIso(), 30));
  const [salary, setSalary] = useState('');
  if (!c) return null;
  const op = data.openings.find((o) => o.id === c.openingId);
  const avg = averageScore(c);
  const active = c.stage !== 'hired' && c.stage !== 'rejected';
  return (
    <Panel title={c.name} eyebrow={`${op?.title ?? ''} · ${CANDIDATE_LABEL[c.stage]}`} lead={<Avatar name={c.name} size="lg" />} onClose={onClose}>
      <div className="hero" style={{ gap: 28 }}>
        <div><div className="sub">{tr("Interview score")}</div><div className="big" style={{ fontSize: 40 }}>{avg === null ? '—' : avg.toFixed(1)}</div><div className="sub">{plural(c.scores.length, 'interviewer')}</div></div>
        <div><div className="sub" data-tip={tr("GDPR: unhired candidates are deleted after this date unless they agree to stay in the talent pool.")} tabIndex={0}>{tr("Keep until")}</div><div className="big" style={{ fontSize: 40 }}>{fmtDay(c.retainUntil)}</div></div>
      </div>
      <dl className="facts"><dt>{tr("Source")}</dt><dd>{c.source}</dd><dt>{tr("Applied")}</dt><dd>{fmtDay(c.appliedAt)}</dd>{c.email && <><dt>{tr("Email")}</dt><dd>{c.email}</dd></>}{c.rejectReason && <><dt>{tr("Reason")}</dt><dd>{c.rejectReason}</dd></>}</dl>
      {active && (
        <>
          <div><div className="section-title">{tr("Stage")}</div><Seg label={tr("Stage")} value={c.stage} onChange={(s) => toast(tr("{0} moved to {1}", { 0: c.name, 1: CANDIDATE_LABEL[s] }), hr.moveCandidate(c.id, s))} options={BOARD.map((s) => ({ id: s, label: CANDIDATE_LABEL[s] }))} /></div>
          <div><div className="section-title">{tr("Add an interview score")}</div><Score label={tr("Score from 1 to 5")} onChange={(n) => toast(tr("Scored {0} of 5", { 0: n }), hr.scoreCandidate(c.id, n))} /><p className="sub" style={{ margin: '8px 0 0' }}>{tr("Each interviewer scores on their own before talking, so the first voice doesn't set the rest.")}</p></div>
          {c.stage === 'offer' && (
            <div className="card flat tight">
              <div className="section-title">{tr("Hire")} {c.name}</div>
              <div className="row2"><Field label={tr("Start date")} id="cp-s"><input id="cp-s" className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label={tr("Monthly salary (€)")} id="cp-sa"><input id="cp-sa" className="input" type="number" value={salary} placeholder={op?.salaryFrom ? String(op.salaryFrom) : ''} onChange={(e) => setSalary(e.target.value)} /></Field></div>
              <button className="btn primary" style={{ marginTop: 10 }} onClick={() => { const r = hr.hire(c.id, start, salary ? Number(salary) : op?.salaryFrom); toast(tr("Hired {0}. Their journey and kit requests have started.", { 0: c.name }), r.undo); onClose(); }}><Icon name="check" size={16} />{tr("Hire and start their journey")}</button>
            </div>
          )}
          <div className="card flat tight">
            <div className="section-title">{tr("Reject")}</div>
            <div className="toolbar">{REJECT.map((r) => <button key={r} className="btn sm" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>)}</div>
            <form className="inline-form" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); if (!reason.trim()) return; toast(tr("Rejected {0}", { 0: c.name }), hr.moveCandidate(c.id, 'rejected', reason.trim())); onClose(); }}>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("Reason, kept for the hiring report")} aria-label={tr("Reason")} />
              <button className="btn danger sm" type="submit" disabled={!reason.trim()}>{tr("Reject")}</button>
            </form>
          </div>
        </>
      )}
      <button className="btn ghost danger" style={{ alignSelf: 'flex-start' }} onClick={() => { toast(tr("Deleted {0}'s application", { 0: c.name }), hr.deleteCandidates([c.id])); onClose(); }}><Icon name="trash" size={16} />{tr("Delete application now")}</button>
    </Panel>
  );
}

function OpeningForm({ hr, onClose, onAdded }: { hr: People; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const [f, setF] = useState({ title: '', team: '', hiringManagerId: '', salaryFrom: '', salaryTo: '' });
  const [err, setErr] = useState('');
  return (
    <Panel title={tr("New role")} onClose={onClose}>
      <form className="form" onSubmit={(e) => {
        e.preventDefault();
        if (!f.title.trim() || !f.team.trim()) return setErr(tr("Add a title and a team."));
        if (!f.salaryFrom) return setErr(tr("Add a salary range: the EU pay transparency directive asks for it in the job ad from June 2026."));
        toast(tr("Opened {0}", { 0: f.title }), hr.addOpening({ title: f.title.trim(), team: f.team.trim(), hiringManagerId: f.hiringManagerId || undefined, salaryFrom: Number(f.salaryFrom), salaryTo: Number(f.salaryTo || f.salaryFrom) }));
        onAdded(); onClose();
      }}>
        {err && <ul className="errors"><li>{err}</li></ul>}
        <div className="row2"><Field label={tr("Role")} id="of-t"><input id="of-t" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field><Field label={tr("Team")} id="of-tm"><input id="of-tm" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} /></Field></div>
        <Field label={tr("Hiring manager")} id="of-m"><PersonSelect id="of-m" people={data.people} value={f.hiringManagerId} onChange={(v) => setF({ ...f, hiringManagerId: v })} none="Choose" /></Field>
        <div className="row2"><Field label={tr("Salary from (€ a month)")} id="of-sf"><input id="of-sf" type="number" value={f.salaryFrom} onChange={(e) => setF({ ...f, salaryFrom: e.target.value })} /></Field><Field label={tr("Salary to")} id="of-st"><input id="of-st" type="number" value={f.salaryTo} onChange={(e) => setF({ ...f, salaryTo: e.target.value })} /></Field></div>
        <div className="toolbar"><button className="btn primary" type="submit">{tr("Open role")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
      </form>
    </Panel>
  );
}

function CandidateForm({ hr, openingId, onClose }: { hr: People; openingId?: string; onClose: () => void }) {
  const toast = useToast();
  const { data } = hr;
  const [f, setF] = useState({ name: '', email: '', source: 'LinkedIn', openingId: openingId ?? '' });
  return (
    <Panel title={tr("Add candidate")} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (!f.name.trim() || !f.openingId) return; toast(tr("Added {0}", { 0: f.name }), hr.addCandidate({ name: f.name.trim(), email: f.email || undefined, source: f.source, openingId: f.openingId })); onClose(); }}>
        <div className="row2"><Field label={tr("Name")} id="cf-n"><input id="cf-n" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label={tr("Email")} id="cf-e"><input id="cf-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field></div>
        <div className="row2">
          <Field label={tr("Role")} id="cf-o"><select id="cf-o" value={f.openingId} onChange={(e) => setF({ ...f, openingId: e.target.value })}>{data.openings.filter((o) => o.open).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select></Field>
          <Field label={tr("Source")} id="cf-s"><select id="cf-s" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>{['LinkedIn', 'Referral', 'CV.lv', 'Website', 'Event', 'Other'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <p className="sub" style={{ margin: 0 }}>{tr("We keep the application for 6 months, then delete it unless they're hired.")}</p>
        <div className="toolbar"><button className="btn primary" type="submit" disabled={!f.name.trim()}>{tr("Add candidate")}</button><button className="btn ghost" type="button" onClick={onClose}>{tr("Cancel")}</button></div>
      </form>
    </Panel>
  );
}

export { CANDIDATE_STAGES };
