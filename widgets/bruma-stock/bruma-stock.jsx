// Stock — 1x1, native macOS Stocks widget look (a single symbol).
// Price, absolute and percent change, and the day's line chart.
// Data: Yahoo Finance's public chart endpoint (no key). Needs `jq`.
const SYMBOL = "AAPL";

export const command = `
  curl -s -m 10 -H "User-Agent: Mozilla/5.0" \
    "https://query1.finance.yahoo.com/v8/finance/chart/${SYMBOL}?range=1d&interval=5m" |
  jq -r '.chart.result[0] |
    ( [ .meta.symbol, .meta.regularMarketPrice,
        (.meta.chartPreviousClose // .meta.previousClose) ] | @tsv ),
    ( [ .indicators.quote[0].close[] | select(. != null) ] | join(",") )'
`;

export const refreshFrequency = 300000; // 5 min

export const glass = true;

export const className = `
  top: 48px;
  left: 950px;
  width: 170px;
  height: 170px;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 24px;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color-scheme: light dark;

  --fg: rgba(0,0,0,0.88);
  --fg2: rgba(0,0,0,0.52);
  --green: #34C759;
  --red: #FF3B30;

  @media (prefers-color-scheme: dark) {
    --fg: rgba(255,255,255,0.95);
    --fg2: rgba(255,255,255,0.58);
    --green: #30D158;
    --red: #FF453A;
  }

  /* bruma mounts the widget inside .widget-body; make it fill the box so
     percentage heights and auto margins have something to resolve against. */
  .widget-body { height: 100%; }

  color: var(--fg);
  display: flex;
  flex-direction: column;

  .sym { font-size: 15px; font-weight: 700; }
  .price {
    font-size: 24px; font-weight: 600; line-height: 28px;
    font-variant-numeric: tabular-nums;
  }
  .chg { font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .spark { margin-top: auto; display: block; }
  .notice { margin: auto; font-size: 12px; font-weight: 500; color: var(--fg2); }
`;

const W = 138, H = 44;

export const render = ({ output }) => {
  const lines = (output || "").trim().split("\n");
  const [sym, priceS, prevS] = (lines[0] || "").split("\t");
  const price = parseFloat(priceS), prev = parseFloat(prevS);
  if (isNaN(price)) return <div className="notice">No quote</div>;

  const series = (lines[1] || "").split(",").map(Number).filter((n) => !isNaN(n));
  const diff = price - prev;
  const pct = prev ? (diff / prev) * 100 : 0;
  const color = diff >= 0 ? "var(--green)" : "var(--red)";

  let path = "", base = "";
  if (series.length > 1) {
    const min = Math.min(...series, prev), max = Math.max(...series, prev);
    const span = max - min || 1;
    const x = (i) => (i / (series.length - 1)) * W;
    const y = (v) => H - ((v - min) / span) * H;
    path = series.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    base = y(prev).toFixed(1);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="sym">{sym}</div>
      <div className="price">{price.toFixed(2)}</div>
      <div className="chg" style={{ color }}>
        {diff >= 0 ? "+" : ""}{diff.toFixed(2)} ({diff >= 0 ? "+" : ""}{pct.toFixed(2)}%)
      </div>
      {path && (
        <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <line x1="0" x2={W} y1={base} y2={base}
            style={{ stroke: "var(--fg2)" }} strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
          <path d={path} fill="none" style={{ stroke: color }} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
};
