// Stocks — 2x1, native macOS Stocks widget look.
// A watchlist: symbol, name, last price and the day's change as a coloured pill.
// Data: Yahoo Finance's public chart endpoint (no key). Needs `jq`.
const SYMBOLS = ["AAPL", "MSFT", "NVDA", "^GSPC"]; // ^GSPC = S&P 500

export const command = SYMBOLS.map((s) => `
  curl -s -m 10 -H "User-Agent: Mozilla/5.0" \
    "https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?range=1d&interval=15m" |
  jq -r '.chart.result[0] | [ .meta.symbol, (.meta.shortName // .meta.symbol),
    .meta.regularMarketPrice, (.meta.chartPreviousClose // .meta.previousClose) ] | @tsv' 2>/dev/null
`).join("\n");

export const refreshFrequency = 300000; // 5 min

export const glass = true;

export const className = `
  top: 234px;
  left: 20px;
  width: 366px;
  height: 170px;
  box-sizing: border-box;
  padding: 12px 16px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.52);
  --line: rgba(0,0,0,0.08);
  --green: #34C759;
  --red: #FF3B30;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --line: rgba(255,255,255,0.12);
    --green: #30D158;
    --red: #FF453A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);

  .row {
    display: flex; align-items: center; gap: 8px;
    height: 34px; border-bottom: 1px solid var(--line);
  }
  .row:last-child { border-bottom: none; }
  .sym { width: 68px; flex: none; }
  .sym .t { font-size: 13px; font-weight: 700; line-height: 15px; }
  .sym .n {
    font-size: 9.5px; font-weight: 500; color: var(--fg2); line-height: 11px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .price {
    margin-left: auto; text-align: right;
    font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
  }
  .pill {
    width: 74px; flex: none; text-align: center;
    padding: 3px 0; border-radius: 6px; color: #fff;
    font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
  }
  .notice { height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--fg2); font-size: 13px; font-weight: 500; }
`;

const fmt = (v) =>
  v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v.toFixed(2);

export const render = ({ output }) => {
  const rows = (output || "").trim().split("\n").filter(Boolean)
    .map((l) => {
      const [sym, name, price, prev] = l.split("\t");
      const p = parseFloat(price), c = parseFloat(prev);
      if (isNaN(p)) return null;
      const pct = c ? ((p - c) / c) * 100 : 0;
      return { sym, name, price: p, pct };
    })
    .filter(Boolean);

  if (!rows.length) return <div className="notice">No quotes</div>;

  return (
    <div>
      {rows.slice(0, 4).map((r) => (
        <div className="row" key={r.sym}>
          <div className="sym">
            <div className="t">{r.sym.replace(/^\^/, "")}</div>
            <div className="n">{r.name}</div>
          </div>
          <div className="price">{fmt(r.price)}</div>
          <div className="pill" style={{ background: r.pct >= 0 ? "var(--green)" : "var(--red)" }}>
            {r.pct >= 0 ? "+" : ""}{r.pct.toFixed(2)}%
          </div>
        </div>
      ))}
    </div>
  );
};
