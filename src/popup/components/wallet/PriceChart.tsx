import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  fetchPriceHistory,
  percentChange,
  PRICE_RANGES,
  type PricePoint,
  type PriceRange,
} from '@/core/prices';

interface PriceChartProps {
  currentPrice: number;
  symbol?: 'HIVE' | 'HBD';
}

const WIDTH = 368;
const HEIGHT = 140;

function formatTick(time: number, range: PriceRange): string {
  const d = new Date(time);
  if (range === '1h' || range === '24h') {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  if (range === '1y') {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Real market history from CoinGecko. Shows a plain message when the data
 * cannot be loaded instead of inventing a line.
 */
export function PriceChart({ currentPrice, symbol = 'HIVE' }: PriceChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [range, setRange] = useState<PriceRange>('24h');
  const [data, setData] = useState<PricePoint[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tooltip, setTooltip] = useState<{ price: number; time: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setTooltip(null);
    fetchPriceHistory(symbol, range).then((points) => {
      if (cancelled) return;
      if (points && points.length >= 2) {
        setData(points);
        setStatus('ready');
      } else {
        setData(null);
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    if (!data || status !== 'ready') return;

    const margin = { top: 12, right: 8, bottom: 18, left: 8 };
    const innerW = WIDTH - margin.left - margin.right;
    const innerH = HEIGHT - margin.top - margin.bottom;

    const xScale = d3
      .scaleLinear()
      .domain(d3.extent(data, (d) => d.time) as [number, number])
      .range([0, innerW]);

    const [minP, maxP] = d3.extent(data, (d) => d.price) as [number, number];
    const pad = (maxP - minP) * 0.08 || maxP * 0.01;
    const yScale = d3.scaleLinear().domain([minP - pad, maxP + pad]).range([innerH, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const isUp = data[data.length - 1].price >= data[0].price;
    const lineColor = isUp ? 'var(--color-success)' : 'var(--color-error)';
    const gradientId = `chart-gradient-${symbol}`;

    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', lineColor).attr('stop-opacity', 0.22);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', lineColor).attr('stop-opacity', 0);

    const area = d3
      .area<PricePoint>()
      .x((d) => xScale(d.time))
      .y0(innerH)
      .y1((d) => yScale(d.price))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(data).attr('d', area).attr('fill', `url(#${gradientId})`);

    const line = d3
      .line<PricePoint>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.price))
      .curve(d3.curveMonotoneX);
    g.append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');

    // Time labels: first, middle, last
    const [t0, t1] = xScale.domain();
    [t0, (t0 + t1) / 2, t1].forEach((t, i) => {
      g.append('text')
        .attr('x', xScale(t))
        .attr('y', innerH + 14)
        .attr('fill', 'var(--color-text-tertiary)')
        .attr('font-size', '9')
        .attr('text-anchor', i === 0 ? 'start' : i === 2 ? 'end' : 'middle')
        .text(formatTick(t, range));
    });

    const last = data[data.length - 1];
    g.append('circle')
      .attr('cx', xScale(last.time))
      .attr('cy', yScale(last.price))
      .attr('r', 4)
      .attr('fill', lineColor)
      .attr('stroke', 'var(--color-surface-card)')
      .attr('stroke-width', 2.5);

    const bisect = d3.bisector<PricePoint, number>((d) => d.time).center;
    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const d = data[bisect(data, xScale.invert(mx))];
        if (!d) return;
        setTooltip({
          price: d.price,
          time: d.time,
          x: xScale(d.time) + margin.left,
          y: yScale(d.price) + margin.top,
        });
      })
      .on('mouseleave', () => setTooltip(null));
  }, [data, status, range, symbol]);

  const change = data ? percentChange(data) : null;
  const decimals = currentPrice >= 1 ? 3 : 4;

  return (
    <div className="rounded-2xl bg-surface-card border border-border overflow-hidden">
      <div className="px-4 pt-4 pb-1 flex items-start justify-between">
        <div>
          <p className="text-xs text-text-secondary font-medium">{symbol} Price</p>
          <p className="text-2xl font-extrabold text-text-primary animate-count">
            ${currentPrice.toFixed(decimals)}
          </p>
        </div>
        {change !== null && status === 'ready' && (
          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
              change >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
            }`}
            title={`Change over ${range}`}
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </div>
        )}
      </div>

      <div className="relative px-2" style={{ minHeight: HEIGHT * 0.9 }}>
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" preserveAspectRatio="xMidYMid meet" />
        {status === 'loading' && (
          <div className="absolute inset-x-2 top-2 bottom-2 rounded-xl shimmer" />
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-text-tertiary">Price history unavailable right now</p>
          </div>
        )}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-surface-elevated border border-border rounded-lg px-2.5 py-1 text-xs text-text-primary"
            style={{
              left: `${(tooltip.x / WIDTH) * 100}%`,
              top: `${(tooltip.y / HEIGHT) * 100 - 16}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <span className="font-bold">${tooltip.price.toFixed(decimals)}</span>
            <span className="text-text-tertiary ml-1.5">{formatTick(tooltip.time, range)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-1 px-4 pb-3 pt-1">
        {PRICE_RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-colors ${
              range === r ? 'bg-hive text-white' : 'bg-surface-elevated text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
