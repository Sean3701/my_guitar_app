import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, Check, Mic, MicOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GUITAR_STRINGS, nearestString, pitchName, useTuner } from '../hooks/useTuner';
import { playGuitarTone, preloadGuitarTones, stopGuitarTone } from '../lib/guitarTone';

/** 音分偏差映射到圆标的水平位移：偏低向左、偏高向右，±50 音分对应最大位移 */
const MAX_SHIFT = 44;
const IN_TUNE_CENTS = 5;

export default function TunerPage() {
  const navigate = useNavigate();
  const { listening, frequency, level, error, engineStatus, devices, deviceId, selectDevice, start, stop } = useTuner();
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manualIndex, setManualIndex] = useState(5);
  /** 正在试听标准音的弦下标，用来给按钮加一点发声反馈 */
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const playToken = useRef(0);
  const detectedIndex = frequency ? nearestString(frequency) : null;
  const activeIndex = mode === 'manual' ? manualIndex : detectedIndex;
  const target = activeIndex === null ? null : GUITAR_STRINGS[activeIndex];
  const cents = frequency && target ? 1200 * Math.log2(frequency / target.frequency) : 0;
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const inTune = !!frequency && Math.abs(cents) <= IN_TUNE_CENTS;
  const shift = frequency ? (clampedCents / 50) * MAX_SHIFT : 0;
  /** 麦克风电平：-75dB（数字静音附近）到 -6dB（很响）映射成 0~1 */
  const levelRatio = useMemo(() => {
    if (!listening || level <= 0) return 0;
    const decibel = 20 * Math.log10(level);
    return Math.max(0, Math.min(1, (decibel + 75) / 69));
  }, [listening, level]);
  const status = useMemo(() => {
    if (engineStatus === 'loading') return '正在准备调音引擎…';
    if (engineStatus === 'error') return '调音引擎初始化失败';
    if (!listening) return '开启麦克风开始调音，点弦可听标准音';
    if (!frequency || !target) {
      if (levelRatio < 0.07) return '几乎收不到声音：请检查麦克风输入';
      if (levelRatio < 0.2) return '声音偏小：请靠近麦克风或调高输入音量';
      return '请拨动单根琴弦进行调音';
    }
    if (inTune) return '音准刚刚好';
    return cents < 0 ? `音调偏低，请将${target.label}拧紧` : `音调偏高，请将${target.label}放松`;
  }, [listening, frequency, target, inTune, cents, engineStatus, levelRatio]);

  // 进页面就把六段采样预加载好，点弦按钮时立刻出声
  useEffect(() => {
    preloadGuitarTones();
    // 离开调音页时收声，别让标准音跟着跑到别的页面
    return () => stopGuitarTone();
  }, []);

  /** 点琴头上的弦 = 选中这根弦 + 立刻听一遍它的标准音 */
  const selectString = (index: number) => {
    setMode('manual');
    setManualIndex(index);
    // 每次点击领一个号；只有「最后一次点击」的那次播放结束时才清掉发声标记
    const token = ++playToken.current;
    setPlayingIndex(index);
    playGuitarTone(index)
      .catch((cause) => { console.error('Guitar reference playback failed', cause); })
      .finally(() => { if (playToken.current === token) setPlayingIndex(null); });
  };

  const stringButton = (index: number) => {
    const string = GUITAR_STRINGS[index];
    const active = activeIndex === index;
    const playing = playingIndex === index;
    return <button key={`${string.label}-${index}`} className={`fasttune-string ${active ? 'active' : ''} ${inTune && active ? 'in-tune' : ''} ${playing ? 'playing' : ''}`} onClick={() => selectString(index)} aria-label={`选择${string.label} ${string.name}${string.octave}，并试听标准音`} aria-pressed={active}><b>{string.name}</b></button>;
  };

  return (
    <div className="page tuner-page fasttune-page">
      <header className="sub-header fasttune-header"><button className="icon-button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={22} /></button><div><h1>民谣吉他标准调音</h1></div><div className="fasttune-auto"><span>Auto</span><button role="switch" aria-label="自动识别琴弦" aria-checked={mode === 'auto'} className={mode === 'auto' ? 'on' : ''} onClick={() => setMode(mode === 'auto' ? 'manual' : 'auto')}><i /></button></div></header>

      <section className={`fasttune-stage ${inTune ? 'in-tune' : ''}`}>

        <div className="fasttune-pitch-track" role="meter" aria-valuemin={-50} aria-valuemax={50} aria-valuenow={frequency ? Math.round(clampedCents) : 0} aria-label="音分偏差" style={{ '--shift': `${shift}px` } as CSSProperties}>
          <i />
          <span className={`fasttune-cents-badge ${frequency ? (inTune ? 'in-tune' : cents < 0 ? 'flat' : 'sharp') : 'idle'}`}>
            {frequency ? (inTune ? <Check size={22} /> : `${Math.round(clampedCents) > 0 ? '+' : ''}${Math.round(clampedCents)}`) : '--'}
          </span>
          <small className="fasttune-hint">{frequency ? (inTune ? '准了' : cents < 0 ? '调高' : '调低') : ''}</small>
          <em className="fasttune-flat">♭</em>
          <em className="fasttune-sharp">♯</em>
        </div>
        <div className="fasttune-frequency">{frequency ? <><b>{pitchName(frequency)}</b><span>{frequency.toFixed(1)} Hz</span></> : <span>等待拨弦</span>}</div>

        <div className="fasttune-headstock-area">
          <div className="fasttune-string-list left">{[2, 1, 0].map(stringButton)}</div>
          <div className="fasttune-headstock"><img src={`${import.meta.env.BASE_URL}images/guitar-headstock.webp`} alt="半写实、对称的木吉他琴头" draggable="false" /></div>
          <div className="fasttune-string-list right">{[3, 4, 5].map(stringButton)}</div>
        </div>
      </section>

      <div className={`fasttune-status ${inTune ? 'success' : ''}`}>{inTune && <Check size={16} />}<span>{status}</span>{frequency && target && <small>目标 {target.name}{target.octave}</small>}<i className={`fasttune-level ${listening ? 'on' : ''}`} style={{ '--level': levelRatio } as CSSProperties} aria-hidden="true" /></div>
      <div className={`fasttune-actions ${devices.length > 1 ? 'with-device' : ''}`}>
        <button className={`fasttune-mic ${listening ? 'listening' : ''}`} disabled={engineStatus === 'loading'} onClick={() => listening ? stop() : start()}>{listening ? <MicOff size={18} /> : <Mic size={18} />}{engineStatus === 'loading' ? '正在加载引擎…' : listening ? '停止调音' : '开启麦克风'}</button>
        {devices.length > 1 && (
          <label className="fasttune-device">
            <span>麦克风</span>
            <select value={deviceId} onChange={(event) => selectDevice(event.target.value)} aria-label="选择麦克风设备">
              <option value="">系统默认</option>
              {devices.map((device, index) => <option key={device.deviceId || `input-${index}`} value={device.deviceId}>{device.label}</option>)}
            </select>
          </label>
        )}
      </div>
      {error && <div className="fasttune-error">{error}</div>}
    </div>
  );
}
