//@flow

export function getReactEventLabel(type: string) {
  switch (type) {
    case 'schedule-render':
      return 'render scheduled';
    case 'schedule-state-update':
      return 'state update scheduled';
    case 'schedule-force-update':
      return 'force update scheduled';
    case 'suspense-suspend':
      return 'suspended';
    case 'suspense-resolved':
      return 'suspense resolved';
    case 'suspense-rejected':
      return 'suspense rejected';
    default:
      return null;
  }
}

export function getReactMeasureLabel(type: string) {
  switch (type) {
    case 'commit':
      return 'commit';
    case 'render-idle':
      return 'idle';
    case 'render':
      return 'render';
    case 'layout-effects':
      return 'layout effects';
    case 'passive-effects':
      return 'passive effects';
    default:
      return null;
  }
}
