import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** 渲染层兜底：避免单个页面异常导致整站白屏 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('界面渲染异常', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page error-boundary">
        <h1>页面出了点问题</h1>
        <p>琴谱数据仍保存在本机，刷新后即可继续使用。</p>
        <code>{this.state.error.message}</code>
        <button className="primary-button" onClick={() => window.location.assign('/')}>返回首页</button>
      </div>
    );
  }
}
