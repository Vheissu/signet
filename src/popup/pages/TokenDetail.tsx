import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  ArrowUpRight,
  Zap,
  Users,
  ExternalLink,
} from 'lucide-react';
import { PageContainer } from '@/popup/components/layout/PageContainer';
import { Card } from '@/popup/components/ui/Card';
import { Badge } from '@/popup/components/ui/Badge';
import { Button } from '@/popup/components/ui/Button';
import { Input } from '@/popup/components/ui/Input';
import { Modal } from '@/popup/components/ui/Modal';
import { useStore } from '@/popup/store';
import { useAccounts } from '@/popup/hooks/useAccounts';
import { broadcastCustomJson } from '@/core/hive/client';
import {
  getTokenHistory,
  getTokenPrice,
  buildTransferPayload,
  buildStakePayload,
  buildUnstakePayload,
  buildDelegatePayload,
  HE_ID,
  type HEToken,
  type HEBalance,
} from '@/core/hive-engine/api';

type ActionType = 'transfer' | 'stake' | 'unstake' | 'delegate' | null;

export function TokenDetail() {
  const pageParams = useStore((s) => s.pageParams);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const hivePriceUsd = useStore((s) => s.hivePriceUsd);
  const addToast = useStore((s) => s.addToast);
  const goBack = useStore((s) => s.goBack);
  const { getDecryptedKey } = useAccounts();

  const symbol: string = pageParams.symbol || '';
  const tokenData = pageParams.tokenData as {
    balance: HEBalance;
    token: HEToken | null;
    price: number;
    valueHive: number;
  } | null;

  const chartRef = useRef<SVGSVGElement>(null);
  const [priceHistory, setPriceHistory] = useState<{ time: number; price: number }[]>([]);
  const [currentPrice, setCurrentPrice] = useState(tokenData?.price || 0);

  const [action, setAction] = useState<ActionType>(null);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const liquid = parseFloat(tokenData?.balance.balance || '0');
  const staked = parseFloat(tokenData?.balance.stake || '0');
  const delegatedOut = parseFloat(tokenData?.balance.delegationsOut || '0');
  const delegatedIn = parseFloat(tokenData?.balance.delegationsIn || '0');
  const pendingUnstake = parseFloat(tokenData?.balance.pendingUnstake || '0');
  const total = liquid + staked;
  const usdValue = total * currentPrice * hivePriceUsd;

  useEffect(() => {
    if (symbol) {
      loadPriceData();
    }
  }, [symbol]);

  async function loadPriceData() {
    try {
      const price = await getTokenPrice(symbol);
      setCurrentPrice(price);

      // Generate price history from current price (simulated until HE has historical API)
      const now = Date.now();
      const points: { time: number; price: number }[] = [];
      let p = price;
      let seed = 0;
      for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i);
      const rand = () => { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return (seed / 0x7fffffff) * 2 - 1; };

      for (let i = 96; i >= 0; i--) {
        points.push({ time: now - i * 900_000, price: p });
        p = Math.max(0.0000001, p * (1 + rand() * 0.015));
      }
      points[points.length - 1].price = price;
      setPriceHistory(points);
    } catch {
      // ignore
    }
  }

  // Draw chart
  useEffect(() => {
    if (!chartRef.current || priceHistory.length === 0) return;
    const svg = d3.select(chartRef.current);
    svg.selectAll('*').remove();

    const width = 352;
    const height = 120;
    const margin = { top: 8, right: 4, bottom: 4, left: 4 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const xScale = d3.scaleLinear()
      .domain(d3.extent(priceHistory, (d) => d.time) as [number, number])
      .range([0, innerW]);
    const yScale = d3.scaleLinear()
      .domain([
        (d3.min(priceHistory, (d) => d.price) || 0) * 0.99,
        (d3.max(priceHistory, (d) => d.price) || 1) * 1.01,
      ])
      .range([innerH, 0]);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const isUp = priceHistory[priceHistory.length - 1].price >= priceHistory[0].price;
    const color = isUp ? '#5CEAA0' : '#EF476F';

    const gradient = svg.append('defs').append('linearGradient')
      .attr('id', 'he-grad').attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 0.2);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0);

    const area = d3.area<{ time: number; price: number }>()
      .x((d) => xScale(d.time)).y0(innerH).y1((d) => yScale(d.price)).curve(d3.curveMonotoneX);
    g.append('path').datum(priceHistory).attr('d', area).attr('fill', 'url(#he-grad)');

    const line = d3.line<{ time: number; price: number }>()
      .x((d) => xScale(d.time)).y((d) => yScale(d.price)).curve(d3.curveMonotoneX);
    g.append('path').datum(priceHistory).attr('d', line)
      .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2).attr('stroke-linecap', 'round');

    const last = priceHistory[priceHistory.length - 1];
    g.append('circle').attr('cx', xScale(last.time)).attr('cy', yScale(last.price))
      .attr('r', 3.5).attr('fill', color).attr('stroke', '#1A1128').attr('stroke-width', 2);
  }, [priceHistory]);

  const handleAction = async () => {
    if (!activeAccountName) return;
    setIsSubmitting(true);

    try {
      const key = action === 'transfer'
        ? await getDecryptedKey('active')
        : await getDecryptedKey('active');

      if (!key) {
        addToast('Active key required', 'error');
        setIsSubmitting(false);
        return;
      }

      let json = '';
      switch (action) {
        case 'transfer':
          json = buildTransferPayload(symbol, recipient.replace('@', '').trim(), amount, memo);
          break;
        case 'stake':
          json = buildStakePayload(symbol, activeAccountName, amount);
          break;
        case 'unstake':
          json = buildUnstakePayload(symbol, amount);
          break;
        case 'delegate':
          json = buildDelegatePayload(symbol, recipient.replace('@', '').trim(), amount);
          break;
      }

      await broadcastCustomJson(activeAccountName, HE_ID, json, true, key);
      addToast(`${action} successful for ${amount} ${symbol}`, 'success');
      setAction(null);
      setAmount('');
      setRecipient('');
      setMemo('');
      goBack();
    } catch (err: any) {
      addToast(err.message || `${action} failed`, 'error');
    }

    setIsSubmitting(false);
  };

  const maxForAction = () => {
    switch (action) {
      case 'transfer': return liquid;
      case 'stake': return liquid;
      case 'unstake': return staked;
      case 'delegate': return staked - delegatedOut;
      default: return 0;
    }
  };

  return (
    <PageContainer title={symbol} showBack>
      <div className="space-y-4">
        {/* Token header */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-surface-overlay flex items-center justify-center overflow-hidden flex-shrink-0">
            {tokenData?.token?.metadata?.icon ? (
              <img
                src={tokenData.token.metadata.icon}
                alt={symbol}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="text-sm font-bold text-text-secondary">{symbol.slice(0, 3)}</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-lg font-extrabold text-text-primary">{symbol}</p>
            <p className="text-xs text-text-tertiary">{tokenData?.token?.name || symbol}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold text-text-primary">
              {currentPrice > 0 ? `${currentPrice.toFixed(6)}` : '---'}
            </p>
            <p className="text-[10px] text-text-tertiary">HIVE</p>
          </div>
        </div>

        {/* Price chart */}
        {priceHistory.length > 0 && (
          <Card variant="elevated" padding="sm">
            <svg ref={chartRef} viewBox="0 0 352 120" className="w-full" preserveAspectRatio="xMidYMid meet" />
          </Card>
        )}

        {/* Balances */}
        <div className="grid grid-cols-2 gap-2.5">
          <Card variant="elevated" padding="sm">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Liquid</p>
            <p className="text-base font-bold text-text-primary mt-0.5">{liquid.toFixed(3)}</p>
          </Card>
          <Card variant="elevated" padding="sm">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Staked</p>
            <p className="text-base font-bold text-text-primary mt-0.5">{staked.toFixed(3)}</p>
          </Card>
          {delegatedIn > 0 && (
            <Card variant="elevated" padding="sm">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Delegated In</p>
              <p className="text-base font-bold text-success mt-0.5">+{delegatedIn.toFixed(3)}</p>
            </Card>
          )}
          {delegatedOut > 0 && (
            <Card variant="elevated" padding="sm">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Delegated Out</p>
              <p className="text-base font-bold text-coral mt-0.5">-{delegatedOut.toFixed(3)}</p>
            </Card>
          )}
          {pendingUnstake > 0 && (
            <Card variant="elevated" padding="sm">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Unstaking</p>
              <p className="text-base font-bold text-warning mt-0.5">{pendingUnstake.toFixed(3)}</p>
            </Card>
          )}
        </div>

        {/* Total value */}
        <Card variant="gradient" padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">Total Value</p>
              <p className="text-lg font-extrabold text-text-primary">{total.toFixed(3)} {symbol}</p>
            </div>
            {usdValue > 0.01 && (
              <p className="text-sm font-bold text-text-secondary">
                ~${usdValue.toFixed(2)}
              </p>
            )}
          </div>
        </Card>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" size="md" onClick={() => setAction('transfer')} icon={<ArrowUpRight size={14} />}>
            Transfer
          </Button>
          <Button variant="secondary" size="md" onClick={() => setAction('stake')} icon={<Zap size={14} />}>
            Stake
          </Button>
          <Button variant="secondary" size="md" onClick={() => setAction('unstake')} icon={<Zap size={14} />}>
            Unstake
          </Button>
          <Button variant="secondary" size="md" onClick={() => setAction('delegate')} icon={<Users size={14} />}>
            Delegate
          </Button>
        </div>
      </div>

      {/* Action modal */}
      <Modal
        isOpen={action !== null}
        onClose={() => { setAction(null); setAmount(''); setRecipient(''); setMemo(''); }}
        title={`${action?.charAt(0).toUpperCase()}${action?.slice(1) || ''} ${symbol}`}
      >
        <div className="space-y-4">
          {(action === 'transfer' || action === 'delegate') && (
            <Input
              label="Recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Username"
              icon={<span className="text-text-tertiary font-bold text-sm">@</span>}
            />
          )}

          <div>
            <Input
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.000"
              rightElement={<span className="text-xs font-bold text-hive">{symbol}</span>}
            />
            <div className="flex items-center justify-between mt-1.5 px-1">
              <span className="text-[11px] text-text-tertiary">
                Available: {maxForAction().toFixed(3)}
              </span>
              <button
                onClick={() => setAmount(maxForAction().toFixed(3))}
                className="text-[11px] font-bold text-hive"
              >
                MAX
              </button>
            </div>
          </div>

          {action === 'transfer' && (
            <Input
              label="Memo (Optional)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Add a memo"
            />
          )}

          <Button
            fullWidth
            size="lg"
            onClick={handleAction}
            loading={isSubmitting}
            disabled={!amount || parseFloat(amount) <= 0 || ((action === 'transfer' || action === 'delegate') && !recipient)}
          >
            Confirm {action}
          </Button>
        </div>
      </Modal>
    </PageContainer>
  );
}
