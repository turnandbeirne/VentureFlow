import { useCallback } from 'react';
import { ASSETS, RENT_OVERSUPPLY_FREE_UNITS, WEATHER_STAGES, getAssetIncomeRange } from '../data/gameConfig';
import { effectiveRentPerUnit, perUnitIncome, totalUnitsOwned, interestRateFor, isInterestBonusMonth } from '../game/players';
import { useHoldRepeat } from '../hooks/useHoldRepeat';

/** A quick 1-4 dot risk meter from an asset's volatility, paired with its
 * existing riskLabel text (gameConfig.js) — teaches the risk/reward
 * vocabulary right where the buy decision actually happens, instead of only
 * implicitly through how the asset behaves over time. */
function riskDots(volatility) {
  if (volatility <= 0.03) return 1;
  if (volatility <= 0.1) return 2;
  if (volatility <= 0.2) return 3;
  return 4;
}

/** A plain-language read on how crowded a rent-bearing asset's market is
 * right now — the same totalOwned number that drives effectiveRentPerUnit
 * in game/players.js, just translated into words instead of a formula. */
function crowdingLabel(totalOwned) {
  if (totalOwned <= RENT_OVERSUPPLY_FREE_UNITS) return null;
  if (totalOwned <= RENT_OVERSUPPLY_FREE_UNITS + 4) return 'Market: getting crowded';
  return 'Market: very crowded';
}

function AssetCard({ asset, price, previousPrice, owned, cash, totalOwned, weather, weatherIncomeAmounts, onBuy, onSell, disabled }) {
  const trendUp = price >= previousPrice;
  const trendPct = previousPrice ? Math.round(((price - previousPrice) / previousPrice) * 100) : 0;
  const canBuy = !disabled && cash >= price;
  const canSell = !disabled && owned > 0;

  // Buy/Sell support press-and-hold: hold past a second and it starts
  // auto-repeating, accelerating the longer it's held, so scooping up (or
  // unwinding) a big stack isn't a wall of individual taps. canBuy/canSell
  // are read fresh on every repeat tick via these callbacks so it stops the
  // instant cash or holdings run out, rather than hammering a no-op.
  const canBuyRef = useCallback(() => canBuy, [canBuy]);
  const canSellRef = useCallback(() => canSell, [canSell]);
  const buyHold = useHoldRepeat(onBuy, canBuyRef);
  const sellHold = useHoldRepeat(onSell, canSellRef);

  // Interest-bearing assets (Piggy Bank) show this month's rate rather than
  // a dollar figure, since the payout scales with the live price — see
  // game/players.js's perUnitIncome/interestRateFor.
  const interestRate = interestRateFor(asset, weatherIncomeAmounts);
  const bonusMonth = isInterestBonusMonth(asset, weatherIncomeAmounts);

  return (
    <div className="vf-card vf-asset-card">
      <span className="vf-asset-card__icon">{asset.icon}</span>
      <span className="vf-asset-card__name">{asset.name}</span>
      <span className="vf-asset-card__tagline">{asset.tagline}</span>
      <span className="vf-asset-card__risk" title={`Volatility: how much the price can swing in one month`}>
        <span className="vf-asset-card__risk-dots" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className={`vf-risk-dot ${i < riskDots(asset.volatility) ? 'vf-risk-dot--on' : ''}`} />
          ))}
        </span>
        {asset.riskLabel}
      </span>
      <span className="vf-asset-card__price">${price.toFixed(0)}</span>
      {previousPrice ? (
        <span className={`vf-asset-card__trend ${trendUp ? 'vf-asset-card__trend--up' : 'vf-asset-card__trend--down'}`}>
          {trendUp ? '▲' : '▼'} {Math.abs(trendPct)}%
        </span>
      ) : (
        <span className="vf-asset-card__trend">—</span>
      )}
      {asset.rentPerMonth > 0 ? (
        <span className="vf-asset-card__rent" title="Rent scales with price, and drops a bit the more of this the whole table owns — see the Tree House lesson.">
          +${effectiveRentPerUnit(asset, price, totalOwned).toFixed(0)}/mo each
          {crowdingLabel(totalOwned) && <span className="vf-asset-card__crowding"> · {crowdingLabel(totalOwned)}</span>}
        </span>
      ) : asset.weatherIncomeRange ? (
        <span
          className="vf-asset-card__weather-income"
          title="Income per unit is rolled fresh every month based on the current weather, plus a bump (or hit) from fortune cards."
        >
          +${perUnitIncome(asset, { weatherIncomeAmounts }).toFixed(0)}/mo each right now
          {weather && WEATHER_STAGES[weather.stageId] && ` (${WEATHER_STAGES[weather.stageId].icon} ${WEATHER_STAGES[weather.stageId].name})`}
          {(() => {
            const range = getAssetIncomeRange(asset);
            return range ? (
              <span className="vf-asset-card__income-range"> · Range: ${range[0]}–${range[1]}/mo each</span>
            ) : null;
          })()}
        </span>
      ) : asset.interestBearing ? (
        <span
          className={`vf-asset-card__interest ${bonusMonth ? 'vf-asset-card__interest--bonus' : ''}`}
          title="Savings earn a small amount of interest every month. The rate is set by the bank, not by you — and once in a while it's better than usual."
        >
          {bonusMonth ? '🎉 ' : '🏦 '}
          {(interestRate * 100).toFixed(2)}%/mo interest{bonusMonth && ' — bonus rate!'}
          <span className="vf-asset-card__income-range"> · +${(price * interestRate).toFixed(2)}/mo each</span>
        </span>
      ) : (
        <span className="vf-asset-card__no-income">💵 Price only — no monthly income</span>
      )}
      <span className="vf-asset-card__owned">You have: {owned}</span>
      <div className="vf-asset-card__actions">
        <button type="button" className="vf-btn vf-btn--go" disabled={!canBuy} {...buyHold}>
          Buy
        </button>
        <button type="button" className="vf-btn vf-btn--danger" disabled={!canSell} {...sellHold}>
          Sell
        </button>
      </div>
    </div>
  );
}

export default function AssetShop({ prices, previousPrices, player, allPlayers, weather, weatherIncomeAmounts, disabled, onBuy, onSell }) {
  return (
    <div>
      <div className="vf-section-title">
        <span>🛒</span>
        <span>Buy things that grow</span>
        <span className="vf-section-title__hint">Hold Buy/Sell to go faster</span>
      </div>
      <div className="vf-shop-grid">
        {ASSETS.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            price={prices[asset.id]}
            previousPrice={previousPrices?.[asset.id]}
            owned={player.holdings[asset.id] || 0}
            cash={player.cash}
            totalOwned={totalUnitsOwned(allPlayers, asset.id)}
            weather={weather}
            weatherIncomeAmounts={weatherIncomeAmounts}
            disabled={disabled}
            onBuy={() => onBuy(asset.id)}
            onSell={() => onSell(asset.id)}
          />
        ))}
      </div>
    </div>
  );
}
