import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface PricePoint {
  time: number;
  price: number;
}

type TimeRange = '1h' | '24h' | '1w' | '1m' | '1y';

interface PriceChartProps {
  currentPrice: number;
  symbol?: string;
}

const TIME_RANGES: TimeRange[] = ['1h', '24h', '1w', '1m', '1y'];

/**
 * Generate simulated price data based on current price.
 * In production, this would fetch from CoinGecko or Hive APIs.
 */
function generatePriceData(currentPrice: number, range: TimeRange): PricePoint[] {
  const now = Date.now();
  let points: number;
  let intervalMs: number;
  let volatility: number;

  switch (range) {
    case '1h':
      points = 60; intervalMs = 60_000; volatility = 0.002; break;
    case '24h':
      points = 96; intervalMs = 900_000; volatility = 0.008; break;
    case '1w':
      points = 84; intervalMs = 7_200_000; volatility = 0.02; break;
    case '1m':
      points = 90; intervalMs = 28_800_000; volatility = 0.04; break;
    case '1y':
      points = 120; intervalMs = 259_200_000; volatility = 0.12; break;
  }

  // Walk backward from current price with random noise
  const data: PricePoint[] = [];
  let price = currentPrice;

  // Seed from current price for consistent results
  let seed = Math.floor(currentPrice * 10000);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };

  for (let i = points; i >= 0; i--) {
    data.push({ time: now - i * intervalMs, price });
    price = price * (1 + rand() * volatility);
    price = Math.max(price * 0.5, price); // prevent going negative
  }

  // Ensure last point is current price
  data[data.length - 1].price = currentPrice;

  return data;
}

export function PriceChart({ currentPrice, symbol = 'HIVE' }: PriceChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [range, setRange] = useState<TimeRange>('24h');
  const [tooltip, setTooltip] = useState<{ price: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!svgRef.current || currentPrice <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 368;
    const height = 140;
    const margin = { top: 12, right: 8, bottom: 4, left: 8 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const data = generatePriceData(currentPrice, range);

    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.time) as [number, number])
      .range([0, innerW]);

    const yScale = d3.scaleLinear()
      .domain([
        (d3.min(data, d => d.price) || 0) * 0.995,
        (d3.max(data, d => d.price) || 1) * 1.005,
      ])
      .range([innerH, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Gradient for area fill
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'chart-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');

    const isUp = data[data.length - 1].price >= data[0].price;
    const lineColor = isUp ? '#5CEAA0' : '#EF476F';

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', lineColor)
      .attr('stop-opacity', 0.25);
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', lineColor)
      .attr('stop-opacity', 0);

    // Area
    const area = d3.area<PricePoint>()
      .x(d => xScale(d.time))
      .y0(innerH)
      .y1(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('d', area)
      .attr('fill', 'url(#chart-gradient)');

    // Line
    const line = d3.line<PricePoint>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.price))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');

    // End dot
    const lastPoint = data[data.length - 1];
    g.append('circle')
      .attr('cx', xScale(lastPoint.time))
      .attr('cy', yScale(lastPoint.price))
      .attr('r', 4)
      .attr('fill', lineColor)
      .attr('stroke', '#1A1128')
      .attr('stroke-width', 2.5);

    // Invisible overlay for hover
    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const bisect = d3.bisector<PricePoint, number>(d => d.time).left;
        const x0 = xScale.invert(mx);
        const idx = bisect(data, x0, 1);
        const d = data[Math.min(idx, data.length - 1)];
        setTooltip({
          price: d.price,
          x: xScale(d.time) + margin.left,
          y: yScale(d.price) + margin.top,
        });
      })
      .on('mouseleave', () => setTooltip(null));

  }, [currentPrice, range]);

  const percentChange = currentPrice > 0 ? (
    ((generatePriceData(currentPrice, range).slice(-1)[0]?.price || currentPrice) /
      (generatePriceData(currentPrice, range)[0]?.price || currentPrice) - 1) * 100
  ) : 0;

  return (
    <div className="rounded-2xl bg-surface-card border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-1 flex items-start justify-between">
        <div>
          <p className="text-xs text-text-secondary font-medium">{symbol} Price</p>
          <p className="text-2xl font-extrabold text-text-primary tracking-tight animate-count">
            ${currentPrice.toFixed(4)}
          </p>
        </div>
        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
          percentChange >= 0
            ? 'bg-success/10 text-success'
            : 'bg-error/10 text-error'
        }`}>
          {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
        </div>
      </div>

      {/* Chart */}
      <div className="relative px-2">
        <svg
          ref={svgRef}
          viewBox="0 0 368 140"
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
        />
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-surface-elevated border border-border rounded-lg px-2.5 py-1 text-xs font-bold text-text-primary shadow-lg"
            style={{
              left: `${(tooltip.x / 368) * 100}%`,
              top: `${(tooltip.y / 140) * 100 - 14}%`,
              transform: 'translateX(-50%)',
            }}
          >
            ${tooltip.price.toFixed(4)}
          </div>
        )}
      </div>

      {/* Time range selector */}
      <div className="flex gap-1 px-4 pb-3 pt-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-colors ${
              range === r
                ? 'bg-hive text-white'
                : 'bg-surface-elevated text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
