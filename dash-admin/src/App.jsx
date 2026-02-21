import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Mock data helpers ─────────────────────────────────────────────────────────

function generateProfitData(count = 20) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(now - (count - i) * 60_000).toLocaleTimeString(),
    profit: parseFloat((Math.random() * 50 - 5).toFixed(2)),
  }));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ active }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 700,
      background: active ? 'var(--success)' : 'var(--danger)',
      color: '#fff',
    }}>
      {active ? 'RUNNING' : 'STOPPED'}
    </span>
  );
}

function Card({ title, children, style }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '20px 24px',
      ...style,
    }}>
      {title && (
        <h3 style={{ fontSize: 14, color: '#8b949e', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <Card>
      <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--accent)' }}>
        {value}
        {unit && <span style={{ fontSize: 14, marginLeft: 4, color: '#8b949e' }}>{unit}</span>}
      </div>
    </Card>
  );
}

// ── Chain selector ────────────────────────────────────────────────────────────

const CHAINS = ['ethereum', 'polygon', 'arbitrum', 'bsc'];

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [botActive,   setBotActive]   = useState(false);
  const [chain,       setChain]       = useState('ethereum');
  const [loanAmount,  setLoanAmount]  = useState(10000);
  const [minProfit,   setMinProfit]   = useState(15);
  const [scanInterval, setScanInterval] = useState(2000);
  const [tradelive,   setTradeLive]   = useState(false);
  const [profitData,  setProfitData]  = useState(generateProfitData());
  const [scans,       setScans]       = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [rpcStatus,   setRpcStatus]   = useState({ ethereum: true, polygon: true, arbitrum: false, bsc: true });

  // Simulate live data when bot is active
  useEffect(() => {
    if (!botActive) return;
    const id = setInterval(() => {
      const newPoint = {
        time:   new Date().toLocaleTimeString(),
        profit: parseFloat((Math.random() * 60 - 10).toFixed(2)),
      };
      setProfitData(prev => [...prev.slice(-29), newPoint]);
      setScans(s => s + 1);
      setTotalProfit(p => parseFloat((p + Math.max(0, newPoint.profit)).toFixed(2)));
    }, scanInterval);
    return () => clearInterval(id);
  }, [botActive, scanInterval]);

  const toggleBot = useCallback(() => setBotActive(v => !v), []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>⚡ AaveFlash</span>
        <span style={{ color: '#8b949e', fontSize: 14, flex: 1 }}>Cross-Chain Arbitrage Dashboard</span>
        <StatusBadge active={botActive} />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1 }}>

        {/* Sidebar – Controls */}
        <aside style={{
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <Card title="Bot Control">
            <button
              onClick={toggleBot}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
                background: botActive ? 'var(--danger)' : 'var(--success)',
                color: '#fff',
              }}
            >
              {botActive ? '⏹  Stop Bot' : '▶  Start Bot'}
            </button>
          </Card>

          <Card title="Chain">
            <select
              value={chain}
              onChange={e => setChain(e.target.value)}
              style={selectStyle}
            >
              {CHAINS.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </Card>

          <Card title="Parameters">
            <label style={labelStyle}>
              Loan Amount (USD)
              <input
                type="number"
                value={loanAmount}
                min={1}
                max={1000000}
                onChange={e => setLoanAmount(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Min Profit (bps)
              <input
                type="number"
                value={minProfit}
                min={1}
                onChange={e => setMinProfit(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Scan Interval (ms)
              <input
                type="number"
                value={scanInterval}
                min={500}
                step={500}
                onChange={e => setScanInterval(Number(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <input
                type="checkbox"
                checked={tradelive}
                onChange={e => setTradeLive(e.target.checked)}
              />
              <span>Trade Live</span>
            </label>
          </Card>
        </aside>

        {/* Main content */}
        <main style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <StatCard label="Total Scans"    value={scans.toLocaleString()} />
            <StatCard label="Total Profit"   value={`$${totalProfit.toLocaleString()}`} color="var(--success)" />
            <StatCard label="Loan Amount"    value={`$${loanAmount.toLocaleString()}`} color="var(--warning)" />
            <StatCard label="Active Chain"   value={chain.charAt(0).toUpperCase() + chain.slice(1)} />
          </div>

          {/* Profit chart */}
          <Card title="Profit per Scan (USD)" style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={profitData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fill: '#8b949e', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  labelStyle={{ color: '#e6edf3' }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* RPC Status */}
          <Card title="RPC / API Status">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {Object.entries(rpcStatus).map(([net, ok]) => (
                <div key={net} style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: ok ? '#1a2e1a' : '#2e1a1a',
                  border: `1px solid ${ok ? 'var(--success)' : 'var(--danger)'}`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{net}</div>
                  <div style={{ fontSize: 11, color: ok ? 'var(--success)' : 'var(--danger)', marginTop: 4 }}>
                    {ok ? '● Connected' : '● Disconnected'}
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </main>
      </div>
    </div>
  );
}

// ── Shared Styles ─────────────────────────────────────────────────────────────

const selectStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: '#0d1117',
  color: '#e6edf3',
  fontSize: 13,
};

const inputStyle = {
  ...selectStyle,
  marginTop: 4,
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  fontSize: 12,
  color: '#8b949e',
  marginBottom: 10,
};
