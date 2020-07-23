// @flow

import type {PanAndZoomState} from './util/usePanAndZoom';
import type {Interaction} from './useCanvasInteraction';

import {copy} from 'clipboard-js';
import React, {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import usePanAndZoom from './util/usePanAndZoom';

import {getHoveredEvent} from './canvas/getHoveredEvent';
import {renderCanvas} from './canvas/renderCanvas';

import {
  HorizontalPanAndZoomView,
  Surface,
  StaticLayoutView,
  layeredLayout,
  zeroPoint,
} from './layout';

import prettyMilliseconds from 'pretty-ms';
import {getBatchRange} from './util/getBatchRange';
import EventTooltip from './EventTooltip';
import styles from './CanvasPage.css';
import AutoSizer from 'react-virtualized-auto-sizer';
import {
  COLORS,
  FLAMECHART_FRAME_HEIGHT,
  LABEL_FIXED_WIDTH,
  HEADER_HEIGHT_FIXED,
} from './canvas/constants';

import {ContextMenu, ContextMenuItem, useContextMenu} from './context';

const CONTEXT_MENU_ID = 'canvas';

import type {
  FlamechartData,
  ReactHoverContextInfo,
  ReactProfilerData,
} from './types';
import {useCanvasInteraction} from './useCanvasInteraction';
import {FlamegraphView} from './canvas/views';

type ContextMenuContextData = {|
  data: ReactProfilerData,
  flamechart: FlamechartData,
  hoveredEvent: ReactHoverContextInfo | null,
  state: PanAndZoomState,
|};

type Props = {|
  profilerData: ReactProfilerData,
  flamechart: FlamechartData,
  schedulerCanvasHeight: number,
|};

function CanvasPage({profilerData, flamechart, schedulerCanvasHeight}: Props) {
  return (
    <div
      className={styles.CanvasPage}
      style={{backgroundColor: COLORS.PAGE_BG}}>
      <AutoSizer>
        {({height, width}: {height: number, width: number}) => (
          <AutoSizedCanvas
            data={profilerData}
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

const copySummary = (data, measure) => {
  const {batchUID, duration, timestamp, type} = measure;

  const [startTime, stopTime] = getBatchRange(batchUID, data);

  copy(
    JSON.stringify({
      type,
      timestamp: prettyMilliseconds(timestamp),
      duration: prettyMilliseconds(duration),
      batchDuration: prettyMilliseconds(stopTime - startTime),
    }),
  );
};

const zoomToBatch = (data, measure, state) => {
  const {zoomTo} = state;
  if (!zoomTo) {
    return;
  }
  const {batchUID} = measure;
  const [startTime, stopTime] = getBatchRange(batchUID, data);
  zoomTo(startTime, stopTime);
};

type AutoSizedCanvasProps = {|
  data: ReactProfilerData,
  flamechart: FlamechartData,
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

  // const state = usePanAndZoom({
  //   canvasRef,
  //   canvasHeight: height,
  //   canvasWidth: width,
  //   fixedColumnWidth: LABEL_FIXED_WIDTH,
  //   fixedHeaderHeight: HEADER_HEIGHT_FIXED,
  //   unscaledContentWidth: data.duration,
  //   unscaledContentHeight:
  //     schedulerCanvasHeight +
  //     flamechart.layers.length * FLAMECHART_FRAME_HEIGHT,
  // });

  const surfaceRef = useRef(new Surface());
  const flamegraphView = useRef(null);
  // const ticksView = useRef(null);
  // const reactEventsView = useRef(null);
  // const reactMeasuresView = useRef(null);
  const rootViewRef = useRef(null);

  useLayoutEffect(() => {
    // TODO: Build more of the heirarchy
    flamegraphView.current = new FlamegraphView(
      surfaceRef.current,
      {origin: zeroPoint, size: {width, height}},
      flamechart,
      data,
    );

    const flamegraphZoomWrapper = new HorizontalPanAndZoomView(
      surfaceRef.current,
      {origin: zeroPoint, size: {width, height}},
      flamegraphView.current,
      flamegraphView.current.intrinsicSize.width,
    );

    rootViewRef.current = new StaticLayoutView(
      surfaceRef.current,
      {origin: zeroPoint, size: {width, height}},
      layeredLayout,
      [flamegraphZoomWrapper],
    );

    surfaceRef.current.rootView = rootViewRef.current;
  }, [data, flamechart]);

  // TODO: Sync scrolls with state

  useLayoutEffect(() => {
    if (canvasRef.current) {
      // TODO: Resize views too.
      surfaceRef.current.setCanvas(canvasRef.current, {width, height});
    }
  }, [surfaceRef, canvasRef, width, height]);

  const interactor = useCallback(
    interaction => {
      if (canvasRef.current === null) {
        return;
      }
      surfaceRef.current.handleInteraction(interaction);
      surfaceRef.current.displayIfNeeded();
    },
    [surfaceRef],
  );

  useCanvasInteraction(canvasRef, interactor);

  // const hoveredEvent = getHoveredEvent(
  //   schedulerCanvasHeight,
  //   data,
  //   flamechart,
  //   state,
  // );
  // const [isContextMenuShown, setIsContextMenuShown] = useState<boolean>(false);

  // useContextMenu<ContextMenuContextData>({
  //   data: {
  //     data,
  //     flamechart,
  //     hoveredEvent,
  //     state,
  //   },
  //   id: CONTEXT_MENU_ID,
  //   onChange: setIsContextMenuShown,
  //   ref: canvasRef,
  // });

  // When React component renders, rerender surface.
  // TODO: See if displaying on rAF would make more sense since we're somewhat
  // decoupled from React and we don't want to render canvas multiple times per
  // frame.
  useLayoutEffect(() => {
    surfaceRef.current.displayIfNeeded();
    // renderCanvas(
    //   data,
    //   flamechart,
    //   canvasRef.current,
    //   width,
    //   height,
    //   state,
    //   hoveredEvent,
    // );
  });

  return <canvas ref={canvasRef} height={height} width={width} />;

  // return (
  //   <Fragment>
  //     <canvas ref={canvasRef} height={height} width={width} />
  //     <ContextMenu id={CONTEXT_MENU_ID}>
  //       {(contextData: ContextMenuContextData) => {
  //         if (contextData.hoveredEvent == null) {
  //           return null;
  //         }
  //         const {event, flamechartNode, measure} = contextData.hoveredEvent;
  //         return (
  //           <Fragment>
  //             {event !== null && (
  //               <ContextMenuItem
  //                 onClick={() => copy(event.componentName)}
  //                 title="Copy component name">
  //                 Copy component name
  //               </ContextMenuItem>
  //             )}
  //             {event !== null && (
  //               <ContextMenuItem
  //                 onClick={() => copy(event.componentStack)}
  //                 title="Copy component stack">
  //                 Copy component stack
  //               </ContextMenuItem>
  //             )}
  //             {measure !== null && (
  //               <ContextMenuItem
  //                 onClick={() => zoomToBatch(contextData.data, measure, state)}
  //                 title="Zoom to batch">
  //                 Zoom to batch
  //               </ContextMenuItem>
  //             )}
  //             {measure !== null && (
  //               <ContextMenuItem
  //                 onClick={() => copySummary(contextData.data, measure)}
  //                 title="Copy summary">
  //                 Copy summary
  //               </ContextMenuItem>
  //             )}
  //             {flamechartNode !== null && (
  //               <ContextMenuItem
  //                 onClick={() => copy(flamechartNode.node.frame.file)}
  //                 title="Copy file path">
  //                 Copy file path
  //               </ContextMenuItem>
  //             )}
  //             {flamechartNode !== null && (
  //               <ContextMenuItem
  //                 onClick={() =>
  //                   copy(
  //                     `line ${flamechartNode.node.frame.line}, column ${flamechartNode.node.frame.col}`,
  //                   )
  //                 }
  //                 title="Copy location">
  //                 Copy location
  //               </ContextMenuItem>
  //             )}
  //           </Fragment>
  //         );
  //       }}
  //     </ContextMenu>
  //     {!isContextMenuShown && (
  //       <EventTooltip data={data} hoveredEvent={hoveredEvent} state={state} />
  //     )}
  //   </Fragment>
  // );
}

export default CanvasPage;
