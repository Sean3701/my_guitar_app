import { useEffect, useState } from 'react';
import { getPageImages } from '../lib/storage';

/** 按页 id 读取原图并转换成可直接渲染的 blob URL，卸载或换页时自动释放 */
export function usePageImages(ids: string[]) {
  const key = ids.join(',');
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!key) {
      setUrls({});
      return;
    }
    let cancelled = false;
    const objectUrls: string[] = [];
    setUrls({});
    getPageImages(key.split(','))
      .then((blobs) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const [id, blob] of Object.entries(blobs)) {
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          next[id] = url;
        }
        setUrls(next);
      })
      .catch((error) => console.error('加载琴谱原图失败', error));
    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [key]);

  return urls;
}
