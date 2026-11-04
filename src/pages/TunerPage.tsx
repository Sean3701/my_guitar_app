import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Mic, MicOff, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GUITAR_STRINGS, nearestString, pitchName, useTuner } from '../hooks/useTuner';
import { playGuitarTone } from '../lib/guitarTone';

export default function TunerPage() {
  const navigate = useNavigate();
  const { listening, frequency, error, engineStatus, start, stop } = useTuner();
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manualIndex, setManualIndex] = useState(5);
  const detectedIndex = frequency ? nearestString(frequency) : null;
  const activeIndex = mode === 'manual' ? manualIndex : detectedIndex;
  const target = activeIndex === null ? null : GUITAR_STRINGS[activeIndex];
  const cents = frequency && target ? 1200 * Math.log2(frequency / target.frequency) : 0;
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const inTune = !!frequency && Math.abs(cents) <= 5;
  const status = useMemo(() => {
    if (engineStatus === 'loading') return '正在加载 FastTune 调音引擎…';
    if (engineStatus === 'error') return '调音引擎加载失败';
    if (!listening) return '开启麦克风，开始调音';
    if (!frequency || !target) return '请拨动琴弦进行调音';
    if (inTune) return '音准刚刚好';
    return cents < 0 ? '偏低，请稍微拧紧琴弦' : '偏高，请稍微放松琴弦';
  }, [listening, frequency, target, inTune, cents, engineStatus]);

  const selectString = (index: number) => { setMode('manual'); setManualIndex(index); };
  const playReference = async (index: number) => {
    try { await playGuitarTone(index); } catch (cause) { console.error('Guitar reference playback failed', cause); }
  };

  const stringButton = (index: number) => {
    const string = GUITAR_STRINGS[index];
    const active = activeIndex === index;
    return <button key={`${string.label}-${index}`} className={`fasttune-string ${active ? 'active' : ''} ${inTune && active ? 'in-tune' : ''}`} onClick={() => selectString(index)} aria-label={`选择${string.label} ${string.name}${string.octave}`}><b>{string.name}</b></button>;
  };

  return (
    <div className="page tuner-page fasttune-page">
      <header className="sub-header fasttune-header"><button className="icon-button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={22} /></button><div><h1>民谣吉他标准调音</h1></div><div className="fasttune-auto"><span>Auto</span><button role="switch" aria-label="自动识别琴弦" aria-checked={mode === 'auto'} className={mode === 'auto' ? 'on' : ''} onClick={() => setMode(mode === 'auto' ? 'manual' : 'auto')}><i /></button></div></header>

      <section className={`fasttune-stage ${inTune ? 'in-tune' : ''}`}>

        <div className="fasttune-pitch-track" aria-label={`音分偏差 ${frequency ? Math.round(clampedCents) : '未知'}`}>
          <i />
          <span>{frequency ? `${clampedCents > 0 ? '+' : ''}${Math.round(clampedCents)}` : '--'}</span>
          <small>CENTS</small>
        </div>
        <div className="fasttune-frequency">{frequency ? <><b>{pitchName(frequency)}</b><span>{frequency.toFixed(1)} Hz</span></> : <span>等待拨弦</span>}</div>

        <div className="fasttune-headstock-area">
          <div className="fasttune-string-list left">{[2, 1, 0].map(stringButton)}</div>
          <div className="fasttune-headstock"><img src={`${import.meta.env.BASE_URL}images/guitar-headstock.webp`} alt="半写实、对称的木吉他琴头" draggable="false" /></div>
          <div className="fasttune-string-list right">{[3, 4, 5].map(stringButton)}</div>
        </div>
      </section>

      <div className={`fasttune-status ${inTune ? 'success' : ''}`}>{inTune && <Check size={16} />}<span>{status}</span>{frequency && target && <small>目标 {target.name}{target.octave}</small>}</div>
      <div className="fasttune-actions">
        <button className={`fasttune-mic ${listening ? 'listening' : ''}`} disabled={engineStatus === 'loading'} onClick={() => listening ? stop() : start()}>{listening ? <MicOff size={18} /> : <Mic size={18} />}{engineStatus === 'loading' ? '正在加载引擎…' : listening ? '停止调音' : '开启麦克风'}</button>
        <button className="fasttune-reference" onClick={() => playReference(activeIndex ?? manualIndex)}><Volume2 size={18} />听当前弦标准音</button>
      </div>
      {error && <div className="fasttune-error">{error}</div>}
    </div>
  );
}
