export function getReactEventLabel(type) {
  let label = null;
  switch (type) {
    case 'schedule-render':
      label = 'render scheduled';
      break;
    case 'schedule-state-update':
      label = 'state update scheduled';
      break;
    case 'schedule-force-update':
      label = 'force update scheduled';
      break;
    case 'suspense-suspend':
      label = 'suspended';
      break;
    case 'suspense-resolved':
      label = 'suspense resolved';
      break;
    case 'suspense-rejected':
      label = 'suspense rejected';
      break;
    default:
      break;
  }
  return label;
}
export function getReactMeasureLabel(type) {
  let label = null;
  switch (type) {
    case 'commit':
      label = 'commit';
      break;
    case 'render-idle':
      label = 'idle';
      break;
    case 'render':
      label = 'render';
      break;
    case 'layout-effects':
      label = 'layout effects';
      break;
    case 'passive-effects':
      label = 'passive effects';
      break;
    default:
      break;
  }
  return label;
}
