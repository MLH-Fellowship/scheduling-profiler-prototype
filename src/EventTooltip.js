// @flow

import type {Point} from './layout';
import type {
  FlamechartStackFrame,
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
  origin: Point,
|};

function formatTimestamp(ms) {
  return ms.toLocaleString(undefined, {minimumFractionDigits: 2}) + 'ms';
}

function formatDuration(ms) {
  return prettyMilliseconds(ms, {millisecondsDecimalDigits: 3});
}

function trimComponentName(name) {
  if (name.length > 128) {
    return name.substring(0, 127) + '...';
  }
  return name;
}

function getReactEventLabel(type) {
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

function getReactMeasureLabel(type: string) {
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

export default function EventTooltip({data, hoveredEvent, origin}: Props) {
  const tooltipRef = useSmartTooltip({
    mouseX: origin.x,
    mouseY: origin.y,
  });

  if (hoveredEvent === null) {
    return null;
  }

  const {event, flamechartStackFrame, measure} = hoveredEvent;

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
  } else if (flamechartStackFrame !== null) {
    return (
      <TooltipFlamechartNode
        stackFrame={flamechartStackFrame}
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
  stackFrame,
  tooltipRef,
}: {
  stackFrame: FlamechartStackFrame,
  tooltipRef: Return<typeof useRef>,
}) => {
  const {
    name,
    timestamp,
    duration,
    scriptUrl,
    locationLine,
    locationColumn,
  } = stackFrame;
  return (
    <div
      className={styles.Tooltip}
      style={{
        backgroundColor: COLORS.TOOLTIP_BG,
        color: COLORS.TOOLTIP,
      }}
      ref={tooltipRef}>
      {formatDuration(duration)} {trimComponentName(name)}
      <div className={styles.DetailsGrid}>
        <div className={styles.DetailsGridLabel}>Timestamp:</div>
        <div>{formatTimestamp(timestamp)}</div>
        {scriptUrl && (
          <>
            <div className={styles.DetailsGridLabel}>Script URL:</div>
            <div className={styles.DetailsGridURL}>{scriptUrl}</div>
          </>
        )}
        {(locationLine !== undefined || locationColumn !== undefined) && (
          <>
            <div className={styles.DetailsGridLabel}>Location:</div>
            <div>
              line {locationLine}, column {locationColumn}
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
  const label = getReactEventLabel(type);

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
  const label = getReactMeasureLabel(type);
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
