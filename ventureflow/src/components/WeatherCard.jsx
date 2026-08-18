import { getStageInfo } from '../game/weather';

/** A fuller weather readout for the sidebar — the header's WeatherBadge
 * stays as a quick-glance pill, this shows the current stage's blurb too
 * (previously only visible as a tooltip) since the sidebar has the room. */
export default function WeatherCard({ weather }) {
  const info = getStageInfo(weather);
  return (
    <div className="vf-card vf-weather-card">
      <div className="vf-weather-card__icon">{info.icon}</div>
      <div className="vf-weather-card__body">
        <div className="vf-weather-card__name">{info.name}</div>
        <div className="vf-weather-card__blurb">{info.blurb}</div>
      </div>
    </div>
  );
}
