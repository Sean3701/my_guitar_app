import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sean.shipu',
  appName: '拾谱',
  webDir: 'dist',
  android: {
    // 允许 WebView 里的麦克风（调音器）和文件选择（导入琴谱图片）
    allowMixedContent: false,
  },
};

export default config;
