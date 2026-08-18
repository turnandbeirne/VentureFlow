import { getStageInfo } from '../game/weather';

export default function WeatherBadge({ weather }) {
  const info = getStageInfo(weather);
  return (
    <div className="vf-weather-badge" title={info.blurb}>
      <span className="vf-weather-badge__icon">{info.icon}</span>
      <span>{info.name}</span>
    </div>
  );
}
