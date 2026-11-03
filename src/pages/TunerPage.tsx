import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Mic, MicOff, Music2, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GUITAR_STRINGS, nearestString, pitchName, useTuner } from '../hooks/useTuner';

export default function TunerPage() {
  const navigate = useNavigate();
  const { listening, frequency, error, start, stop } = useTuner();
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manualIndex, setManualIndex] = useState(5);
  const toneContext = useRef<AudioContext | null>(null);
  const detectedIndex = frequency ? nearestString(frequency) : null;
  const activeIndex = mode === 'manual' ? manualIndex : detectedIndex;
  const target = activeIndex === null ? null : GUITAR_STRINGS[activeIndex];
  const cents = frequency && target ? 1200 * Math.log2(frequency / target.frequency) : 0;
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const inTune = !!frequency && Math.abs(cents) <= 5;
  const status = useMemo(() => {
    if (!listening) return '开启麦克风，开始调音';
    if (!frequency || !target) return '请拨动琴弦进行调音';
    if (inTune) return '音准刚刚好';
    return cents < 0 ? '偏低，请稍微拧紧琴弦' : '偏高，请稍微放松琴弦';
  }, [listening, frequency, target, inTune, cents]);

  const selectString = (index: number) => { setMode('manual'); setManualIndex(index); };
  const playReference = async (index: number) => {
    const context = toneContext.current || new AudioContext();
    toneContext.current = context;
    await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = GUITAR_STRINGS[index].frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.5);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 1.55);
  };

  const stringButton = (index: number) => {
    const string = GUITAR_STRINGS[index];
    const active = activeIndex === index;
    return <div className="tuner-string-control" key={`${string.label}-${index}`}><button className={`string-note ${active ? 'active' : ''} ${inTune && active ? 'in-tune' : ''}`} onClick={() => selectString(index)}><b>{string.name}</b><small>{string.octave}</small></button><span>{string.label}</span><button className="reference-tone" onClick={() => playReference(index)} aria-label={`播放${string.label}标准音`}><Volume2 size={13} /></button></div>;
  };

  return (
    <div className="page tuner-page">
      <header className="sub-header"><button className="icon-button" onClick={() => navigate(-1)}><ArrowLeft size={21} /></button><div><h1>调音器</h1><p>民谣吉他 · 标准调音</p></div><span className="standard-badge">EADGBE</span></header>
      <div className="tuner-mode"><button className={mode === 'auto' ? 'active' : ''} onClick={() => setMode('auto')}>自动识别</button><button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>手动选弦</button></div>

      <section className={`tuning-gauge ${inTune ? 'in-tune' : ''}`}>
        <div className="gauge-labels"><span>♭</span><span>♯</span></div>
        <svg viewBox="0 0 320 174" aria-hidden="true">
          <path d="M42 147 A126 126 0 0 1 278 147" className="gauge-track" />
          <path d="M142 27 A126 126 0 0 1 178 27" className="gauge-sweetspot" />
          {Array.from({ length: 21 }, (_, index) => {
            const angle = -90 + index * 9;
            const rad = angle * Math.PI / 180;
            const x1 = 160 + Math.sin(rad) * 112, y1 = 147 - Math.cos(rad) * 112;
            const x2 = 160 + Math.sin(rad) * (index % 5 === 0 ? 101 : 106), y2 = 147 - Math.cos(rad) * (index % 5 === 0 ? 101 : 106);
            return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} className="gauge-tick" />;
          })}
          <g className="gauge-needle" style={{ transform: `rotate(${clampedCents * 0.9}deg)`, transformOrigin: '160px 147px' }}><line x1="160" y1="147" x2="160" y2="48" /><circle cx="160" cy="147" r="10" /></g>
        </svg>
        <div className="pitch-readout">{frequency ? <><strong>{pitchName(frequency)}</strong><span>{frequency.toFixed(1)} Hz</span></> : <><Music2 size={34} /><span>-- Hz</span></>}</div>
        <div className={`tuning-status ${inTune ? 'success' : ''}`}>{inTune && <Check size={17} />}{status}</div>
        {frequency && target && <div className="cents-readout">{cents > 0 ? '+' : ''}{cents.toFixed(0)} cents · 目标 {target.name}{target.octave}</div>}
      </section>

      <section className="guitar-tuner">
        <div className="tuner-strings left">{[2, 1, 0].map(stringButton)}</div>
        <div className="guitar-headstock"><div className="headstock-brand">拾 谱</div><div className="peg-row"><i /><i /></div><div className="peg-row"><i /><i /></div><div className="peg-row"><i /><i /></div><div className="headstock-strings">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div><div className="headstock-nut" /></div>
        <div className="tuner-strings right">{[3, 4, 5].map(stringButton)}</div>
      </section>

      <div className="tuner-actions"><button className={`primary-button ${listening ? 'listening' : ''}`} onClick={() => listening ? stop() : start()}>{listening ? <MicOff size={18} /> : <Mic size={18} />}{listening ? '停止调音' : '开启麦克风'}</button><p>麦克风仅用于实时测音，不会录音或上传</p></div>
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
