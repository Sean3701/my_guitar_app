import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';

/**
 * 可缩放的看谱容器。
 * 手机上一页六线谱铺满屏宽只有 350 多像素，谱面数字会小到 3~4px，
 * 所以这里接管手势：双指捏合 / 双击放大 / 放大后单指拖动平移，缩回 1× 后把手势还给页面滚动。
 */

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.6;
/** 超过这个位移就不算「点」了，避免拖动结束被误判成双击 */
const TAP_MAX_MOVE = 12;
const TAP_MAX_GAP = 300;
/** 单页模式下横向滑动翻页的最小位移 */
const SWIPE_MIN = 46;
/** 拖动到边界时允许超出的距离，松手回弹 */
const EDGE_ELASTIC = 56;
const ZOOMED_EPS = 1.02;

type Transform = { scale: number; x: number; y: number };
type Point = { x: number; y: number };

type Props = {
  src: string;
  alt: string;
  /** 单页模式传：在 1× 时左右滑动翻页 */
  onSwipe?: (direction: 1 | -1) => void;
  /** 首屏那页用 eager，其余懒加载，避免一次解码几十页 */
  eager?: boolean;
  /** 放大/还原时通知外层，用来切换「双击放大 / 双击还原」提示 */
  onZoomChange?: (zoomed: boolean) => void;
};

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const middle = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export default function ZoomableScore({ src, alt, onSwipe, eager, onZoomChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const transform = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const pinchRef = useRef<{ dist: number; mid: Point; start: Transform } | null>(null);
  const touchRef = useRef<{ start: Point; moved: boolean; axis: 'x' | 'y' | null } | null>(null);
  const lastTapRef = useRef<{ time: number; point: Point } | null>(null);
  const lastTouchRef = useRef(0);
  const swipeRef = useRef(onSwipe);
  const zoomChangeRef = useRef(onZoomChange);
  const zoomedRef = useRef(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => { swipeRef.current = onSwipe; }, [onSwipe]);
  useEffect(() => { zoomChangeRef.current = onZoomChange; }, [onZoomChange]);

  /** 把 transform 写到图片上；animating 时带过渡，用于放大/回弹 */
  const apply = useCallback((animating = false) => {
    const img = imgRef.current;
    if (!img) return;
    const { scale, x, y } = transform.current;
    img.style.transition = animating ? 'transform .26s cubic-bezier(.22,.61,.36,1)' : 'none';
    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  }, []);

  /** 把位移限制在图片边界内；elastic 时允许临时越界，松手再回弹 */
  const clamp = useCallback((next: Transform, elastic = false): Transform => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img || !img.offsetWidth) return next;
    const roomX = Math.min(0, wrap.clientWidth - img.offsetWidth * next.scale);
    const roomY = Math.min(0, wrap.clientHeight - img.offsetHeight * next.scale);
    const pad = elastic ? EDGE_ELASTIC : 0;
    const clampAxis = (value: number, min: number) => Math.max(min - pad, Math.min(pad, value));
    return { ...next, x: clampAxis(next.x, roomX), y: clampAxis(next.y, roomY) };
  }, []);

  /** 手势期间只在跨越 1× 时更新一次状态，避免每帧 re-render */
  const setTransform = useCallback((next: Transform, animating = false) => {
    transform.current = next;
    apply(animating);
    const isZoomed = next.scale > ZOOMED_EPS;
    if (isZoomed !== zoomedRef.current) {
      zoomedRef.current = isZoomed;
      setZoomed(isZoomed);
      zoomChangeRef.current?.(isZoomed);
    }
  }, [apply]);

  /** 双击：1× ↔ 2.6×，以点击处为锚点，避免放大后跑到别的地方 */
  const toggleZoom = useCallback((point: Point) => {
    const current = transform.current;
    if (current.scale > ZOOMED_EPS) {
      setTransform({ scale: 1, x: 0, y: 0 }, true);
      return;
    }
    const scale = DOUBLE_TAP_SCALE;
    const anchorX = (point.x - current.x) / current.scale;
    const anchorY = (point.y - current.y) / current.scale;
    setTransform(clamp({ scale, x: point.x - anchorX * scale, y: point.y - anchorY * scale }), true);
  }, [clamp, setTransform]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rectPoint = (clientX: number, clientY: number): Point => {
      const rect = wrap.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const onTouchStart = (event: TouchEvent) => {
      lastTouchRef.current = performance.now();
      if (event.touches.length >= 2) {
        const [a, b] = [event.touches[0], event.touches[1]];
        const pa = rectPoint(a.clientX, a.clientY);
        const pb = rectPoint(b.clientX, b.clientY);
        pinchRef.current = { dist: Math.max(1, distance(pa, pb)), mid: middle(pa, pb), start: { ...transform.current } };
        touchRef.current = null;
        return;
      }
      const touch = event.touches[0];
      touchRef.current = { start: rectPoint(touch.clientX, touch.clientY), moved: false, axis: null };
    };

    const onTouchMove = (event: TouchEvent) => {
      const rect = wrap.getBoundingClientRect();

      if (event.touches.length >= 2 && pinchRef.current) {
        // 双指期间必须吃掉默认行为：否则 iOS 会缩放整个页面、安卓会把页面滚走
        event.preventDefault();
        const [a, b] = [event.touches[0], event.touches[1]];
        const pa = { x: a.clientX - rect.left, y: a.clientY - rect.top };
        const pb = { x: b.clientX - rect.left, y: b.clientY - rect.top };
        const pinch = pinchRef.current;
        const mid = middle(pa, pb);
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinch.start.scale * (distance(pa, pb) / pinch.dist)));
        const ratio = scale / pinch.start.scale;
        setTransform(clamp({
          scale,
          x: mid.x - (pinch.mid.x - pinch.start.x) * ratio,
          y: mid.y - (pinch.mid.y - pinch.start.y) * ratio,
        }, true));
        return;
      }

      const touch = event.touches[0];
      const state = touchRef.current;
      if (!touch || !state) return;
      const point = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      if (!state.moved && Math.hypot(point.x - state.start.x, point.y - state.start.y) > TAP_MAX_MOVE) {
        state.moved = true;
        state.axis = Math.abs(point.x - state.start.x) > Math.abs(point.y - state.start.y) ? 'x' : 'y';
      }
      // 放大状态下单指拖动 = 平移看图，此时不能让页面跟着滚
      if (transform.current.scale > ZOOMED_EPS) {
        event.preventDefault();
        const dx = point.x - state.start.x;
        const dy = point.y - state.start.y;
        state.start = point;
        setTransform(clamp({ ...transform.current, x: transform.current.x + dx, y: transform.current.y + dy }, true));
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      lastTouchRef.current = performance.now();
      if (event.touches.length === 1 && transform.current.scale > ZOOMED_EPS) {
        // 双指撤走一根后继续拖动，需要重新取起点，否则会跳一下
        const touch = event.touches[0];
        pinchRef.current = null;
        touchRef.current = { start: rectPoint(touch.clientX, touch.clientY), moved: true, axis: null };
        return;
      }

      pinchRef.current = null;
      // 松手时把越界的位移收回可见范围
      if (transform.current.scale > ZOOMED_EPS) setTransform(clamp(transform.current), true);

      const state = touchRef.current;
      touchRef.current = null;
      if (!state || event.changedTouches.length === 0) return;

      const point = rectPoint(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
      if (state.moved) {
        const dx = point.x - state.start.x;
        if (transform.current.scale <= ZOOMED_EPS && swipeRef.current && state.axis === 'x' && Math.abs(dx) > SWIPE_MIN) {
          swipeRef.current(dx < 0 ? 1 : -1);
        }
        return;
      }

      // 未移动 → 当作点击，连续两次落在同一处则视为双击
      const now = performance.now();
      const last = lastTapRef.current;
      if (last && now - last.time < TAP_MAX_GAP && distance(point, last.point) < 30) {
        lastTapRef.current = null;
        toggleZoom(point);
        return;
      }
      lastTapRef.current = { time: now, point };
    };

    // iOS 会把双指手势升级成整页缩放，必须拦掉
    const onGesture = (event: Event) => event.preventDefault();

    wrap.addEventListener('touchstart', onTouchStart, { passive: false });
    wrap.addEventListener('touchmove', onTouchMove, { passive: false });
    wrap.addEventListener('touchend', onTouchEnd);
    wrap.addEventListener('touchcancel', onTouchEnd);
    wrap.addEventListener('gesturestart', onGesture, { passive: false });
    wrap.addEventListener('gesturechange', onGesture, { passive: false });
    return () => {
      wrap.removeEventListener('touchstart', onTouchStart);
      wrap.removeEventListener('touchmove', onTouchMove);
      wrap.removeEventListener('touchend', onTouchEnd);
      wrap.removeEventListener('touchcancel', onTouchEnd);
      wrap.removeEventListener('gesturestart', onGesture);
      wrap.removeEventListener('gesturechange', onGesture);
    };
  }, [clamp, setTransform, toggleZoom]);

  /** 桌面端用鼠标时也能双击；触摸后浏览器补发的 dblclick 要忽略，否则会放大又立刻还原 */
  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (performance.now() - lastTouchRef.current < 900) return;
    const rect = event.currentTarget.getBoundingClientRect();
    toggleZoom({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div ref={wrapRef} className={`zoomable ${zoomed ? 'zoomed' : ''}`} onDoubleClick={onDoubleClick}>
      <img ref={imgRef} src={src} alt={alt} draggable={false} decoding="async" loading={eager ? 'eager' : 'lazy'} />
    </div>
  );
}
