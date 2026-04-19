import React from 'react';
import { Link } from 'react-router-dom';
import { COLORS, DISPLAY } from '../config/design-tokens';

export default function Dashboard({ people, companies, interviews }) {
  const scheduledInterviews = interviews.filter((i) => i.status === 'Scheduled').length;
  const completedInterviews = interviews.filter((i) => (i.status || '').toLowerCase() === 'completed' || (i.status || '').toLowerCase() === 'synthesized').length;
  const unlinkedInterviews = interviews.filter((i) => !i.linkedContactId).length;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 4px', fontFamily: DISPLAY, fontSize: 28, color: COLORS.text }}>Dashboard</h1>
      <p style={{ margin: '0 0 20px', color: COLORS.textMuted, fontSize: 14 }}>
        Overview of your research and outreach. Full widgets (funnel chart, activity feed, tasks) ship in later sprints.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label="People" value={people.length} to="/people" color={COLORS.primary} />
        <Stat label="Companies" value={companies.length} to="/companies" color={COLORS.blue} />
        <Stat label="Interviews" value={interviews.length} to="/interviews" color={COLORS.accent} />
        <Stat label="Unlinked interviews" value={unlinkedInterviews} to="/interviews?filter=unlinked" color={COLORS.warning} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <Card title="This Week" subtitle="Tasks widget ships in Sprint 5">
          <Row label="Scheduled interviews" value={scheduledInterviews} />
          <Row label="Completed interviews" value={completedInterviews} />
        </Card>
        <Card title="Recent Insights" subtitle="Syntheses ship in Sprint 3 catch-up">
          <div style={{ color: COLORS.textDim, fontSize: 12, fontStyle: 'italic' }}>No syntheses yet.</div>
        </Card>
        <Card title="Activity" subtitle="Interactions timeline ships in Sprint 4 catch-up">
          <div style={{ color: COLORS.textDim, fontSize: 12, fontStyle: 'italic' }}>No activity yet.</div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, to, color }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      </div>
    </Link>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: COLORS.text }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
