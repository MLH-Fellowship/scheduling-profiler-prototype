// @flow

import type {PanAndZoomState} from './util/usePanAndZoom';
import type {FlamechartFrame} from '@elg/speedscope';
import type {
  ReactEvent,
  ReactMeasure,
  ReactProfilerData,
  ReactHoverContextInfo,
  Return,
} from './types';

import prettyMilliseconds from 'pretty-ms';
import React, {Fragment, useRef} from 'react';
import {COLORS} from './canvas/constants';
import {getBatchRange} from './util/getBatchRange';
import useSmartTooltip from './util/useSmartTooltip';
import styles from './EventTooltip.css';

type Props = {|
  data: ReactProfilerData,
  hoveredEvent: ReactHoverContextInfo | null,
  state: PanAndZoomState,
|};

function formatTimestamp(ms) {
  return ms.toLocaleString(undefined, {minimumFractionDigits: 2}) + 'ms';
}

function formatDuration(ms) {
  return prettyMilliseconds(ms, {millisecondsDecimalDigits: 3});
}

function trimComponentName(name) {
  if (name.length > 32) {
    return name.substring(0, 31) + '...';
  }
  return name;
}

function trimURL(label) {
  if (label.length > 64) {
    return label.substring(0, 63) + '...';
  }
  return label;
}

export default function EventTooltip({data, hoveredEvent, state}: Props) {
  const {canvasMouseY, canvasMouseX} = state;

  const tooltipRef = useSmartTooltip({
    mouseX: canvasMouseX,
    mouseY: canvasMouseY,
  });

  if (hoveredEvent === null) {
    return null;
  }

  const {event, flamechartNode, measure} = hoveredEvent;

  if (event !== null) {
    switch (event.type) {
      case 'schedule-render':
        return (
          <TooltipReactEvent
            color={COLORS.REACT_SCHEDULE_HOVER}
            data={data}
            event={event}
            tooltipRef={tooltipRef}
          />
        );
      case 'schedule-state-update': // eslint-disable-line no-case-declarations
      case 'schedule-force-update':
        const color = event.isCascading
          ? COLORS.REACT_SCHEDULE_CASCADING_HOVER
          : COLORS.REACT_SCHEDULE_HOVER;
        return (
          <TooltipReactEvent
            color={color}
            data={data}
            event={event}
            tooltipRef={tooltipRef}
          />
        );
      case 'suspense-suspend':
      case 'suspense-resolved':
      case 'suspense-rejected':
        return (
          <TooltipReactEvent
            color={COLORS.REACT_SUSPEND_HOVER}
            data={data}
            event={event}
            tooltipRef={tooltipRef}
          />
        );
      default:
        console.warn(`Unexpected event type "${event.type}"`);
        break;
    }
  } else if (measure !== null) {
    switch (measure.type) {
      case 'commit':
      case 'render-idle':
      case 'render':
      case 'layout-effects':
      case 'passive-effects':
        return (
          <TooltipReactMeasure
            data={data}
            measure={measure}
            tooltipRef={tooltipRef}
          />
        );
      default:
        console.warn(`Unexpected measure type "${measure.type}"`);
        break;
    }
  } else if (flamechartNode !== null) {
    return (
      <TooltipFlamechartNode
        flamechartNode={flamechartNode}
        tooltipRef={tooltipRef}
      />
    );
  }
  return null;
}

function formatComponentStack(componentStack: string): string {
  const lines = componentStack.split('\n').map(line => line.trim());
  lines.shift();

  if (lines.length > 5) {
    return lines.slice(0, 5).join('\n') + '\n...';
  }
  return lines.join('\n');
}

const TooltipFlamechartNode = ({
  flamechartNode,
  tooltipRef,
}: {
  flamechartNode: FlamechartFrame,
  tooltipRef: Return<typeof useRef>,
}) => {
  const {end, node, start} = flamechartNode;
  const {col, file, line, name} = node.frame;
  return (
    <div
      className={styles.Tooltip}
      style={{
        backgroundColor: COLORS.TOOLTIP_BG,
        color: COLORS.TOOLTIP,
      }}
      ref={tooltipRef}>
      {formatDuration((end - start) / 1000)} {trimComponentName(name)}
      <div className={styles.DetailsGrid}>
        <div className={styles.DetailsGridLabel}>Timestamp:</div>
        <div>{formatTimestamp(start / 1000)}</div>
        {file && (
          <>
            <div className={styles.DetailsGridLabel}>Script URL:</div>
            <div>{trimURL(file)}</div>
          </>
        )}
        {(line !== undefined || col !== undefined) && (
          <>
            <div className={styles.DetailsGridLabel}>Location:</div>
            <div>
              line {line}, column {col}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const TooltipReactEvent = ({
  color,
  event,
  tooltipRef,
}: {
  color: string,
  event: ReactEvent,
  tooltipRef: Return<typeof useRef>,
}) => {
  const {componentName, componentStack, timestamp, type} = event;

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

  return (
    <div
      className={styles.Tooltip}
      style={{
        backgroundColor: COLORS.TOOLTIP_BG,
        color: COLORS.TOOLTIP,
      }}
      ref={tooltipRef}>
      {componentName && (
        <span className={styles.ComponentName} style={{color}}>
          {trimComponentName(componentName)}
        </span>
      )}{' '}
      {label}
      <div className={styles.Divider} />
      <div className={styles.DetailsGrid}>
        <div className={styles.DetailsGridLabel}>Timestamp:</div>
        <div>{formatTimestamp(timestamp)}</div>
        {componentStack && (
          <Fragment>
            <div className={styles.DetailsGridLabel}>Component stack:</div>
            <pre className={styles.ComponentStack}>
              {formatComponentStack(componentStack)}
            </pre>
          </Fragment>
        )}
      </div>
    </div>
  );
};

const TooltipReactMeasure = ({
  data,
  measure,
  tooltipRef,
}: {
  data: ReactProfilerData,
  measure: ReactMeasure,
  tooltipRef: Return<typeof useRef>,
}) => {
  const {batchUID, duration, timestamp, type, lanes} = measure;

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

  const [startTime, stopTime] = getBatchRange(batchUID, data);

  return (
    <div
      className={styles.Tooltip}
      style={{
        position: 'absolute',
        backgroundColor: COLORS.TOOLTIP_BG,
        color: COLORS.TOOLTIP,
      }}
      ref={tooltipRef}>
      {formatDuration(duration)} {label}
      <div className={styles.Divider} />
      <div className={styles.DetailsGrid}>
        <div className={styles.DetailsGridLabel}>Timestamp:</div>
        <div>{formatTimestamp(timestamp)}</div>
        <div className={styles.DetailsGridLabel}>Batch duration:</div>
        <div>{formatDuration(stopTime - startTime)}</div>
        <div className={styles.DetailsGridLabel}>
          Lane{lanes.length === 1 ? '' : 's'}:
        </div>
        <div>{lanes.join(', ')}</div>
      </div>
    </div>
  );
};
