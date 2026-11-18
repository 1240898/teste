import { Component } from 'react';

export default class ModuleErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.renderFailure(this.props.onRetry);
  }
}
