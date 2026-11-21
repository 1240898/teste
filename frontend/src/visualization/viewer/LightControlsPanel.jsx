import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useLocale } from '../../shared/locale/localeContext.js';
import {
  MAX_CUTOFF_DEGREES,
  MAX_INTENSITY_MULTIPLIER,
  MIN_CUTOFF_DEGREES,
} from '../scene/modules/LightControlsModule.js';

function Slider({ label, value, display, min, max, step, disabled, onEdit }) {
  const id = useId();
  return (
    <div className="light-controls__field">
      <label htmlFor={id}>{label}</label>
      <span aria-hidden="true">{display}</span>
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-valuetext={display}
        disabled={disabled}
        onChange={(event) => onEdit(event.target.valueAsNumber)}
      />
    </div>
  );
}

function SourceFolder({ source, edit }) {
  const { t, locale } = useLocale();
  const { id, kind, enabled, colour, intensityMultiplier } = source;
  const cutoff = Number(source.cutoffDegrees?.toFixed(2));
  const intensity = Math.round(intensityMultiplier * 100);
  return (
    <details open>
      <summary>{t(kind === 'spot' ? 'lightKey' : 'lightAmbient')}</summary>
      <label className="light-controls__switch">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => edit(id, 'enabled', event.target.checked)}
        />
        {t('lightEnabled')}
      </label>
      <label className="light-controls__colour">
        {t('lightColour')}
        <input
          type="color"
          value={colour}
          disabled={!enabled}
          onChange={(event) => edit(id, 'colour', event.target.value)}
        />
      </label>
      <Slider
        label={t('lightIntensity')}
        value={intensity}
        display={intensity + '%'}
        min={0}
        max={100 * MAX_INTENSITY_MULTIPLIER}
        step={1}
        disabled={!enabled}
        onEdit={(percent) => edit(id, 'intensityMultiplier', percent / 100)}
      />
      {kind === 'spot' && (
        <>
          <Slider
            label={t('lightCutoff')}
            value={cutoff}
            display={cutoff.toLocaleString(locale) + '°'}
            min={MIN_CUTOFF_DEGREES}
            max={MAX_CUTOFF_DEGREES}
            step={0.01}
            disabled={!enabled}
            onEdit={(degrees) => edit(id, 'cutoffDegrees', degrees)}
          />
          <Slider
            label={t('lightPenumbra')}
            value={source.penumbra}
            display={Math.round(source.penumbra * 100) + '%'}
            min={0}
            max={1}
            step={0.01}
            disabled={!enabled}
            onEdit={(value) => edit(id, 'penumbra', value)}
          />
        </>
      )}
    </details>
  );
}

function LightControlsPanel({ controls, reloadButton }) {
  const { t } = useLocale();
  const title = useId();
  const panel = useRef(null);
  const active = useRef(false);
  const [sources, setSources] = useState(() => controls.getSources());
  useLayoutEffect(() => {
    active.current = true;
    const element = panel.current;
    return () => {
      active.current = false;
      if (element.contains(element.ownerDocument.activeElement))
        reloadButton.current?.focus();
    };
  }, [reloadButton]);
  function edit(id, field, value) {
    if (!active.current) return;
    controls.apply(id, { field, value });
    setSources(controls.getSources());
  }
  return (
    <section ref={panel} className="light-controls" aria-labelledby={title}>
      <h2 id={title}>{t('lightControls')}</h2>
      <div className="light-controls__folders">
        {sources.map((source) => (
          <SourceFolder key={source.id} source={source} edit={edit} />
        ))}
      </div>
    </section>
  );
}

/** Mounted only for a Manager after a successful first paint. */
export default function ManagerLightControls({ controls, reloadButton }) {
  const { t } = useLocale();
  const [available, setAvailable] = useState(null);
  useEffect(() => {
    try {
      setAvailable(controls.bind());
    } catch {
      setAvailable(false);
    }
  }, [controls]);
  if (available === null) return null;
  return available ? (
    <LightControlsPanel controls={controls} reloadButton={reloadButton} />
  ) : (
    <p role="status">{t('lightUnavailable')}</p>
  );
}
