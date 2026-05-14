import { useState, useEffect } from 'react';
import { Card, Badge } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DIMS = [
  { key: 'clarity_score',         label: '명확성',  color: '#6366F1' },
  { key: 'relevance_score',       label: '관련성',  color: '#34D399' },
  { key: 'value_score',           label: '가치',    color: '#E8D5A3' },
  { key: 'differentiation_score', label: '차별화',  color: '#C084FC' },
  { key: 'trust_score',           label: '신뢰',    color: '#6EE7B7' },
];

const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function TimelineTracker() {
  const [missions, setMissions]   = useState([]);
  const [selected, setSelected]   = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('weekly'); // 'weekly' | 'mission'

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: co } = await supabase.from('companies').select('id').eq('user_id', user.id).single();
      if (!co) { setLoading(false); return; }

      const { data: ms } = await supabase
        .from('missions').select('id, title, created_at, status')
        .eq('company_id', co.id)
        .order('created_at', { ascending: false });

      const missionList = ms || [];
      setMissions(missionList);
      setSelected(missionList.map(m => m.id));

      if (missionList.length) {
        await fetchChartData(missionList, missionList.map(m => m.id), view);
      }
      setLoading(false);
    } catch (err) {
      console.error('[TimelineTracker load]', err);
      setLoading(false);
    }
  }

  async function fetchChartData(missionList, ids, viewMode) {
    if (!ids.length) { setChartData([]); return; }

    const { data: fbs } = await supabase
      .from('feedbacks')
      .select('mission_id, clarity_score, relevance_score, value_score, differentiation_score, trust_score, created_at')
      .in('mission_id', ids)
      .eq('purity_passed', true)
      .order('created_at', { ascending: true });

    if (!fbs || !fbs.length) { setChartData([]); return; }

    if (viewMode === 'weekly') {
      // Group by ISO week → one data point per week
      const weekMap = {};
      fbs.forEach(f => {
        const d = new Date(f.created_at);
        const dayOfWeek = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const key = monday.toISOString().slice(0, 10);
        if (!weekMap[key]) weekMap[key] = { label: formatDate(monday) + '주', _items: [] };
        weekMap[key]._items.push(f);
      });

      const data = Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => {
          const point = { label: v.label };
          DIMS.forEach(d => {
            const vals = v._items.map(f => f[d.key]).filter(Boolean);
            point[d.key] = vals.length ? +avg(vals).toFixed(2) : null;
          });
          return point;
        });
      setChartData(data);
    } else {
      // One data point per mission (average over all feedbacks)
      const data = missionList
        .filter(m => ids.includes(m.id))
        .map(m => {
          const mFbs = fbs.filter(f => f.mission_id === m.id);
          const point = { label: m.title.length > 12 ? m.title.slice(0, 12) + '…' : m.title };
          DIMS.forEach(d => {
            const vals = mFbs.map(f => f[d.key]).filter(Boolean);
            point[d.key] = vals.length ? +avg(vals).toFixed(2) : null;
          });
          return point;
        })
        .filter(p => DIMS.some(d => p[d.key] !== null));
      setChartData(data);
    }
  }

  const toggleMission = async (id) => {
    const next = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    setSelected(next);
    await fetchChartData(missions, next, view);
  };

  const switchView = async (v) => {
    setView(v);
    await fetchChartData(missions, selected, v);
  };

  if (loading) return (
    <div style={{ padding: '40px 48px', color: 'var(--text-3)', fontSize: 14 }}>불러오는 중…</div>
  );

  return (
    <div className="page-wrap" style={{ padding: '40px 48px', maxWidth: 1060, animation: 'fadeUp 0.5s ease both' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.1em' }}>TIMELINE · SCORE EVOLUTION</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>시계열 점수 추적</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>의뢰별·기간별 5차원 점수 변화를 추적하고 개선 추이를 확인하세요.</p>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 4 }}>
            {[['weekly', '주간'], ['mission', '의뢰별']].map(([v, l]) => (
              <button key={v} onClick={() => switchView(v)} style={{
                padding: '6px 14px', borderRadius: 3, fontSize: 12, fontWeight: 500,
                background: view === v ? 'var(--bg)' : 'transparent',
                color: view === v ? 'var(--text)' : 'var(--text-3)',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Mission toggle chips */}
      {missions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {missions.map(m => (
            <button key={m.id} onClick={() => toggleMission(m.id)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: 'var(--surface)',
              color: selected.includes(m.id) ? 'var(--accent)' : 'var(--text-3)',
              border: '1px solid ' + (selected.includes(m.id) ? 'var(--accent)' : 'var(--border)'),
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {m.title.length > 20 ? m.title.slice(0, 20) + '…' : m.title}
            </button>
          ))}
        </div>
      )}

      {missions.length === 0 ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📈</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>등록된 의뢰가 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>의뢰를 등록하고 피드백이 수집되면 시계열 차트가 표시됩니다.</div>
        </Card>
      ) : chartData.length === 0 ? (
        <Card style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>아직 피드백 데이터가 없습니다</div>
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>승인된 피드백이 수집되면 차트가 표시됩니다.</div>
        </Card>
      ) : (
        <>
          <Card style={{ padding: '28px 24px', marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: 'var(--font-sans)' }} />
                <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: 'var(--text-3)', fontFamily: 'var(--font-sans)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, name) => [value?.toFixed(2) ?? '—', DIMS.find(d => d.key === name)?.label || name]}
                />
                <Legend formatter={name => DIMS.find(d => d.key === name)?.label || name} wrapperStyle={{ fontSize: 12 }} />
                {DIMS.map(d => (
                  <Line
                    key={d.key}
                    type="monotone"
                    dataKey={d.key}
                    stroke={d.color}
                    strokeWidth={2}
                    dot={{ r: 4, fill: d.color }}
                    activeDot={{ r: 6 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Summary table */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase' }}>기간/의뢰</th>
                  {DIMS.map(d => (
                    <th key={d.key} style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--text-3)', fontWeight: 500 }}>
                      <span style={{ color: d.color }}>{d.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < chartData.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600 }}>{row.label}</td>
                    {DIMS.map(d => {
                      const val = row[d.key];
                      return (
                        <td key={d.key} style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: val >= 4 ? 'var(--green)' : val >= 3 ? 'var(--accent)' : val ? 'var(--red)' : 'var(--text-3)' }}>
                          {val ? val.toFixed(1) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
