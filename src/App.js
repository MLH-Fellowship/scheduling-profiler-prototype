// @flow

import type { TimelineEvent } from './speedscope/import/chrome';
import type { PanAndZoomState } from './util/usePanAndZoom';

import { copy } from 'clipboard-js';
import React, {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import memoize from 'memoize-one';
import usePanAndZoom, {
  durationToWidth,
  positionToTimestamp,
  timestampToPosition,
} from './util/usePanAndZoom';

import {
  getCanvasContext,
  getTimeTickInterval,
  cachedFlamegraphTextWidths,
  trimFlamegraphText,
  getHoveredEvent,
  getPriorityHeight,
} from './canvas/canvasUtils';
import { renderCanvas, renderReact } from './canvas/renderCanvas';

import prettyMilliseconds from 'pretty-ms';
import { getBatchRange } from './util/utils';
import useInteractiveEvents from './util/useInteractiveEvents';
import EventTooltip from './EventTooltip';
import preprocessData from './util/preprocessData';
import preprocessFlamechart from './util/preprocessFlamechart';
import styles from './App.css';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  BAR_SPACER_SIZE,
  BAR_HEIGHT,
  COLORS,
  SECTION_GUTTER_SIZE,
  EVENT_SIZE,
  INTERVAL_TIMES,
  LABEL_SIZE,
  LABEL_FONT_SIZE,
  MARKER_GUTTER_SIZE,
  MARKER_FONT_SIZE,
  MAX_INTERVAL_SIZE_PX,
  MARKER_TEXT_PADDING,
  MARKER_HEIGHT,
  MARKER_TICK_HEIGHT,
  REACT_PRIORITIES,
  ROW_CSS_PIXELS_HEIGHT,
  TEXT_CSS_PIXELS_OFFSET_START,
  TEXT_CSS_PIXELS_OFFSET_TOP,
  FONT_SIZE,
  BORDER_OPACITY,
  REACT_GUTTER_SIZE,
  REACT_EVENT_SIZE,
  REACT_WORK_SIZE,
  REACT_EVENT_BORDER_SIZE,
  REACT_PRIORITY_BORDER_SIZE,
  FLAMECHART_FONT_SIZE,
  FLAMECHART_FRAME_HEIGHT,
  FLAMECHART_TEXT_PADDING,
  LABEL_FIXED_WIDTH,
  HEADER_HEIGHT_FIXED,
} from './constants';

import { ContextMenu, ContextMenuItem, useContextMenu } from './context';

// TODO: Add import button but keep a static path until canvas layout is ready
import JSON_PATH from 'url:../static/small-devtools.json';

const CONTEXT_MENU_ID = 'canvas';

import type {
  FlamechartData,
  ReactEvent,
  ReactHoverContextInfo,
  ReactMeasure,
  ReactPriority,
  ReactProfilerData,
} from './types';

type ContextMenuContextData = {|
  data: ReactProfilerData | null,
  flamechart: FlamechartData | null,
  hoveredEvent: ReactHoverContextInfo | null,
  state: PanAndZoomState,
|};

function App() {
  const [data, setData] = useState<ReactProfilerData | null>(null);
  const [flamechart, setFlamechart] = useState<FlamechartData | null>(null);
  const [schedulerCanvasHeight, setSchedulerCanvasHeight] = useState<number>(0);

  useEffect(() => {
    fetch(JSON_PATH)
      .then(data => data.json())
      .then((data: TimelineEvent[]) => {
        // Filter null entries and sort by timestamp.
        // I would not expect to have to do either of this,
        // but some of the data being passed in requires it.
        data = data.filter(Boolean).sort((a, b) => (a.ts > b.ts ? 1 : -1));

        if (data.length > 0) {
          unstable_batchedUpdates(() => {
            const processedData = preprocessData(data);
            setData(processedData);

            const flamechart = preprocessFlamechart(data);
            setFlamechart(flamechart);

            let height = 0;

            REACT_PRIORITIES.forEach(priority => {
              height += getPriorityHeight(processedData, priority);
            });

            setSchedulerCanvasHeight(height);
          });
        }
      });
  }, []);

  return (
    <div className={styles.App} style={{ backgroundColor: COLORS.PAGE_BG }}>
      <AutoSizer>
        {({ height, width }: { height: number, width: number }) => (
          <AutoSizedCanvas
            data={data}
            flamechart={flamechart}
            height={height}
            schedulerCanvasHeight={schedulerCanvasHeight}
            width={width}
          />
        )}
      </AutoSizer>
    </div>
  );
}

const copySummary = (data: ReactProfilerData | null, measure: ReactMeasure) => {
  const { batchUID, duration, priority, timestamp, type } = measure;

  const [startTime, stopTime] = getBatchRange(batchUID, priority, data);

  copy(
    JSON.stringify({
      type,
      timestamp: prettyMilliseconds(timestamp),
      duration: prettyMilliseconds(duration),
      batchDuration: prettyMilliseconds(stopTime - startTime),
    })
  );
};

const zoomToBatch = (
  data: ReactProfilerData | null,
  measure: ReactMeasure,
  state: PanAndZoomState
) => {
  const { zoomTo } = state;
  if (!data || !zoomTo) {
    return;
  }
  const { batchUID, priority } = measure;
  const [startTime, stopTime] = getBatchRange(batchUID, priority, data);
  zoomTo(startTime, stopTime);
};

type AutoSizedCanvasProps = {|
  data: ReactProfilerData | null,
  flamechart: FlamechartData | null,
  height: number,
  schedulerCanvasHeight: number,
  width: number,
|};

function AutoSizedCanvas({
  data,
  flamechart,
  height,
  schedulerCanvasHeight,
  width,
}: AutoSizedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const state = usePanAndZoom({
    canvasRef,
    canvasHeight: height,
    canvasWidth: width,
    fixedColumnWidth: LABEL_FIXED_WIDTH,
    fixedHeaderHeight: HEADER_HEIGHT_FIXED,
    unscaledContentWidth: data != null ? data.duration : 0,
    unscaledContentHeight:
      data != null
        ? schedulerCanvasHeight +
          flamechart.layers.length * FLAMECHART_FRAME_HEIGHT
        : 0,
  });

  const hoveredEvent = getHoveredEvent(
    schedulerCanvasHeight,
    data,
    flamechart,
    state
  );
  const [isContextMenuShown, setIsContextMenuShown] = useState<boolean>(false);

  useContextMenu<ContextMenuContextData>({
    data: {
      data,
      flamechart,
      hoveredEvent,
      state,
    },
    id: CONTEXT_MENU_ID,
    onChange: setIsContextMenuShown,
    ref: canvasRef,
  });

  useLayoutEffect(() => {
    if (data !== null) {
      renderCanvas(
        data,
        flamechart,
        canvasRef.current,
        width,
        height,
        schedulerCanvasHeight,
        state,
        hoveredEvent
      );
    }
  });

  return (
    <Fragment>
      <canvas
        ref={canvasRef}
        className={styles.Canvas}
        height={height}
        width={width}
      />
      <ContextMenu id={CONTEXT_MENU_ID}>
        {({ data, hoveredEvent }: ContextMenuContextData) => {
          if (hoveredEvent == null) {
            return null;
          }
          const { event, flamechartNode, measure } = hoveredEvent;
          return (
            <Fragment>
              {event !== null && (
                <ContextMenuItem
                  onClick={() => copy(event.componentName)}
                  title="Copy component name"
                >
                  Copy component name
                </ContextMenuItem>
              )}
              {event !== null && (
                <ContextMenuItem
                  onClick={() => copy(event.componentStack)}
                  title="Copy component stack"
                >
                  Copy component stack
                </ContextMenuItem>
              )}
              {measure !== null && (
                <ContextMenuItem
                  onClick={() => zoomToBatch(data, measure, state)}
                  title="Zoom to batch"
                >
                  Zoom to batch
                </ContextMenuItem>
              )}
              {measure !== null && (
                <ContextMenuItem
                  onClick={() => copySummary(data, measure)}
                  title="Copy summary"
                >
                  Copy summary
                </ContextMenuItem>
              )}
              {flamechartNode !== null && (
                <ContextMenuItem
                  onClick={() => copy(flamechartNode.node.frame.file)}
                  title="Copy file path"
                >
                  Copy file path
                </ContextMenuItem>
              )}
              {flamechartNode !== null && (
                <ContextMenuItem
                  onClick={() =>
                    copy(
                      `line ${flamechartNode.node.frame.line}, column ${flamechartNode.node.frame.col}`
                    )
                  }
                  title="Copy location"
                >
                  Copy location
                </ContextMenuItem>
              )}
            </Fragment>
          );
        }}
      </ContextMenu>
      {!isContextMenuShown && (
        <EventTooltip data={data} hoveredEvent={hoveredEvent} state={state} />
      )}
    </Fragment>
  );
}

export default App;
