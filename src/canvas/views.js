// @flow

import type {
  FlamechartData,
  ReactEvent,
  ReactLane,
  ReactMeasure,
  ReactProfilerData,
} from '../types';
import type {Rect, Size} from '../layout';

import {
  View,
  Surface,
  rectIntersectsRect,
  rectIntersectionWithRect,
} from '../layout';

import {trimFlamegraphText} from './canvasUtils';

import {
  COLORS,
  EVENT_ROW_HEIGHT_FIXED,
  FLAMECHART_FONT_SIZE,
  FLAMECHART_FRAME_HEIGHT,
  FLAMECHART_TEXT_PADDING,
  HEADER_HEIGHT_FIXED,
  INTERVAL_TIMES,
  LABEL_FIXED_WIDTH,
  MARKER_FONT_SIZE,
  MARKER_HEIGHT,
  MARKER_TEXT_PADDING,
  MARKER_TICK_HEIGHT,
  MIN_INTERVAL_SIZE_PX,
  REACT_EVENT_ROW_PADDING,
  REACT_EVENT_SIZE,
  REACT_WORK_BORDER_SIZE,
  REACT_WORK_SIZE,
} from './constants';
import {REACT_TOTAL_NUM_LANES} from '../constants';

function positioningScaleFactor(intrinsicWidth: number, frame: Rect) {
  return frame.size.width / intrinsicWidth;
}

function timestampToPosition(
  timestamp: number,
  scaleFactor: number,
  frame: Rect,
) {
  return frame.origin.x + timestamp * scaleFactor;
}

function positionToTimestamp(
  position: number,
  scaleFactor: number,
  frame: Rect,
) {
  return (position - frame.origin.x) / scaleFactor;
}

function durationToWidth(duration: number, scaleFactor: number) {
  return duration * scaleFactor;
}

export class FlamegraphView extends View {
  flamechart: FlamechartData;
  profilerData: ReactProfilerData;
  intrinsicSize: Size;

  constructor(
    surface: Surface,
    frame: Rect,
    flamechart: FlamechartData,
    profilerData: ReactProfilerData,
  ) {
    super(surface, frame);
    this.flamechart = flamechart;
    this.profilerData = profilerData;
    this.intrinsicSize = {
      width: this.profilerData.duration,
      height: this.flamechart.layers.length * FLAMECHART_FRAME_HEIGHT,
    };
  }

  desiredSize() {
    return this.intrinsicSize;
  }

  drawRect(context: CanvasRenderingContext2D, rect: Rect) {
    context.fillStyle = COLORS.BACKGROUND;
    context.fillRect(
      rect.origin.x,
      rect.origin.y,
      rect.size.width,
      rect.size.height,
    );

    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.font = `${FLAMECHART_FONT_SIZE}px sans-serif`;
    const {frame, flamechart} = this;

    const scaleFactor = positioningScaleFactor(this.intrinsicSize.width, frame);

    for (let i = 0; i < flamechart.layers.length; i++) {
      const nodes = flamechart.layers[i];

      const layerY = Math.floor(frame.origin.y + i * FLAMECHART_FRAME_HEIGHT);
      if (
        layerY + FLAMECHART_FRAME_HEIGHT < rect.origin.y ||
        rect.origin.y + rect.size.height < layerY
      ) {
        continue; // Not in view
      }

      for (let j = 0; j < nodes.length; j++) {
        const {end, node, start} = nodes[j];
        const {name} = node.frame;

        const showHoverHighlight = false;
        // TODO: Hovering
        //   hoveredEvent && hoveredEvent.flamechartNode === nodes[j];

        const width = durationToWidth((end - start) / 1000, scaleFactor);
        if (width < 1) {
          continue; // Too small to render at this zoom level
        }

        const x = Math.floor(
          timestampToPosition(start / 1000, scaleFactor, frame),
        );
        if (x + width < rect.origin.x || rect.origin.x + rect.size.width < x) {
          continue; // Not in view
        }

        context.fillStyle = showHoverHighlight
          ? COLORS.FLAME_GRAPH_HOVER
          : COLORS.FLAME_GRAPH;

        context.fillRect(
          x,
          layerY,
          Math.floor(width - REACT_WORK_BORDER_SIZE),
          Math.floor(FLAMECHART_FRAME_HEIGHT - REACT_WORK_BORDER_SIZE),
        );

        if (width > FLAMECHART_TEXT_PADDING * 2) {
          const trimmedName = trimFlamegraphText(
            context,
            name,
            width - FLAMECHART_TEXT_PADDING * 2 + (x < 0 ? x : 0),
          );
          if (trimmedName !== null) {
            context.fillStyle = COLORS.PRIORITY_LABEL;
            context.fillText(
              trimmedName,
              x + FLAMECHART_TEXT_PADDING - (x < 0 ? x : 0),
              layerY + FLAMECHART_FRAME_HEIGHT / 2,
            );
          }
        }
      }
    }
  }
}

export class TimeAxisMarkersView extends View {
  totalDuration: number;
  intrinsicSize: Size;

  constructor(surface: Surface, frame: Rect, totalDuration: number) {
    super(surface, frame);
    this.totalDuration = totalDuration;
    this.intrinsicSize = {
      width: this.totalDuration,
      height: HEADER_HEIGHT_FIXED,
    };
  }

  desiredSize() {
    return this.intrinsicSize;
  }

  // Time mark intervals vary based on the current zoom range and the time it represents.
  // In Chrome, these seem to range from 70-140 pixels wide.
  // Time wise, they represent intervals of e.g. 1s, 500ms, 200ms, 100ms, 50ms, 20ms.
  // Based on zoom, we should determine which amount to actually show.
  getTimeTickInterval(scaleFactor: number): number {
    for (let i = 0; i < INTERVAL_TIMES.length; i++) {
      const currentInterval = INTERVAL_TIMES[i];
      const intervalWidth = durationToWidth(currentInterval, scaleFactor);
      if (intervalWidth > MIN_INTERVAL_SIZE_PX) {
        return currentInterval;
      }
    }
    return INTERVAL_TIMES[0];
  }

  drawRect(context: CanvasRenderingContext2D, rect: Rect) {
    const clippedFrame = {
      origin: this.frame.origin,
      size: {
        width: this.frame.size.width,
        height: this.intrinsicSize.height,
      },
    };
    const drawableRect = rectIntersectionWithRect(clippedFrame, rect);

    // Clear background
    context.fillStyle = COLORS.BACKGROUND;
    context.fillRect(
      drawableRect.origin.x,
      drawableRect.origin.y,
      drawableRect.size.width,
      drawableRect.size.height,
    );

    const scaleFactor = positioningScaleFactor(
      this.intrinsicSize.width,
      clippedFrame,
    );
    const interval = this.getTimeTickInterval(scaleFactor);
    const firstIntervalTimestamp =
      Math.ceil(
        positionToTimestamp(
          drawableRect.origin.x - LABEL_FIXED_WIDTH,
          scaleFactor,
          clippedFrame,
        ) / interval,
      ) * interval;

    for (
      let markerTimestamp = firstIntervalTimestamp;
      true;
      markerTimestamp += interval
    ) {
      if (markerTimestamp <= 0) {
        continue; // Timestamps < are probably a bug; markers at 0 are ugly.
      }

      const x = timestampToPosition(markerTimestamp, scaleFactor, clippedFrame);
      if (x > drawableRect.origin.x + drawableRect.size.width) {
        break; // Not in view
      }

      const markerLabel = Math.round(markerTimestamp);

      context.fillStyle = COLORS.PRIORITY_BORDER;
      context.fillRect(
        x,
        drawableRect.origin.y + MARKER_HEIGHT - MARKER_TICK_HEIGHT,
        REACT_WORK_BORDER_SIZE,
        MARKER_TICK_HEIGHT,
      );

      context.fillStyle = COLORS.TIME_MARKER_LABEL;
      context.textAlign = 'right';
      context.textBaseline = 'middle';
      context.font = `${MARKER_FONT_SIZE}px sans-serif`;
      context.fillText(
        `${markerLabel}ms`,
        x - MARKER_TEXT_PADDING,
        MARKER_HEIGHT / 2,
      );
    }

    // Render bottom border.
    // Propose border rect, check if intersects with `rect`, draw intersection.
    const borderFrame: Rect = {
      origin: {
        x: clippedFrame.origin.x,
        y:
          clippedFrame.origin.y +
          clippedFrame.size.height -
          REACT_WORK_BORDER_SIZE,
      },
      size: {
        width: clippedFrame.size.width,
        height: REACT_WORK_BORDER_SIZE,
      },
    };
    if (rectIntersectsRect(borderFrame, rect)) {
      const borderDrawableRect = rectIntersectionWithRect(borderFrame, rect);
      context.fillStyle = COLORS.PRIORITY_BORDER;
      context.fillRect(
        borderDrawableRect.origin.x,
        borderDrawableRect.origin.y,
        borderDrawableRect.size.width,
        borderDrawableRect.size.height,
      );
    }
  }
}

export class ReactEventsView extends View {
  profilerData: ReactProfilerData;
  intrinsicSize: Size;

  constructor(surface: Surface, frame: Rect, profilerData: ReactProfilerData) {
    super(surface, frame);
    this.profilerData = profilerData;
    this.intrinsicSize = {
      width: this.profilerData.duration,
      height: EVENT_ROW_HEIGHT_FIXED,
    };
  }

  desiredSize() {
    return this.intrinsicSize;
  }

  /**
   * Draw a single `ReactEvent` as a circle in the canvas.
   */
  drawSingleReactEvent(
    context: CanvasRenderingContext2D,
    rect: Rect,
    event: ReactEvent,
    baseY: number,
    scaleFactor: number,
    showHoverHighlight: boolean,
  ) {
    const {frame} = this;
    const {timestamp, type} = event;

    const x = timestampToPosition(timestamp, scaleFactor, frame);
    const radius = REACT_EVENT_SIZE / 2;
    const eventRect: Rect = {
      origin: {
        x: x - radius,
        y: baseY,
      },
      size: {width: REACT_EVENT_SIZE, height: REACT_EVENT_SIZE},
    };
    if (!rectIntersectsRect(eventRect, rect)) {
      return; // Not in view
    }

    let fillStyle = null;

    switch (type) {
      case 'schedule-render':
      case 'schedule-state-update':
      case 'schedule-force-update':
        if (event.isCascading) {
          fillStyle = showHoverHighlight
            ? COLORS.REACT_SCHEDULE_CASCADING_HOVER
            : COLORS.REACT_SCHEDULE_CASCADING;
        } else {
          fillStyle = showHoverHighlight
            ? COLORS.REACT_SCHEDULE_HOVER
            : COLORS.REACT_SCHEDULE;
        }
        break;
      case 'suspense-suspend':
      case 'suspense-resolved':
      case 'suspense-rejected':
        fillStyle = showHoverHighlight
          ? COLORS.REACT_SUSPEND_HOVER
          : COLORS.REACT_SUSPEND;
        break;
      default:
        console.warn(`Unexpected event type "${type}"`);
        break;
    }

    if (fillStyle !== null) {
      const y = eventRect.origin.y + radius;

      context.beginPath();
      context.fillStyle = fillStyle;
      context.arc(x, y, radius, 0, 2 * Math.PI);
      context.fill();
    }
  }

  drawRect(context: CanvasRenderingContext2D, rect: Rect) {
    context.fillStyle = COLORS.BACKGROUND;
    context.fillRect(
      rect.origin.x,
      rect.origin.y,
      rect.size.width,
      rect.size.height,
    );

    // Draw events
    const {
      frame,
      profilerData: {events},
    } = this;
    const baseY = frame.origin.y + REACT_EVENT_ROW_PADDING;
    const scaleFactor = positioningScaleFactor(this.intrinsicSize.width, frame);

    events.forEach(event => {
      // TODO: Hovering
      // const showHoverHighlight = hoveredEvent && hoveredEvent.event === event;
      const showHoverHighlight = false;

      this.drawSingleReactEvent(
        context,
        rect,
        event,
        baseY,
        scaleFactor,
        showHoverHighlight,
      );
    });

    // Draw the hovered and/or selected items on top so they stand out.
    // This is helpful if there are multiple (overlapping) items close to each other.
    // if (hoveredEvent !== null && hoveredEvent.event !== null) {
    //   this.drawSingleReactEvent(
    //     context,
    //     rect,
    //     hoveredEvent.event,
    //     baseY,
    //     scaleFactor,
    //     true,
    //   );
    // }

    // Render bottom border.
    // Propose border rect, check if intersects with `rect`, draw intersection.
    const borderFrame: Rect = {
      origin: {
        x: frame.origin.x,
        y: frame.origin.y + EVENT_ROW_HEIGHT_FIXED - REACT_WORK_BORDER_SIZE,
      },
      size: {
        width: frame.size.width,
        height: REACT_WORK_BORDER_SIZE,
      },
    };
    if (rectIntersectsRect(borderFrame, rect)) {
      const borderDrawableRect = rectIntersectionWithRect(borderFrame, rect);
      context.fillStyle = COLORS.PRIORITY_BORDER;
      context.fillRect(
        borderDrawableRect.origin.x,
        borderDrawableRect.origin.y,
        borderDrawableRect.size.width,
        borderDrawableRect.size.height,
      );
    }
  }
}

const REACT_LANE_HEIGHT = REACT_WORK_SIZE + REACT_WORK_BORDER_SIZE;

export class ReactMeasuresView extends View {
  profilerData: ReactProfilerData;
  intrinsicSize: Size;

  lanesToRender: ReactLane[];
  laneToMeasures: Map<ReactLane, ReactMeasure[]>;

  constructor(surface: Surface, frame: Rect, profilerData: ReactProfilerData) {
    super(surface, frame);
    this.profilerData = profilerData;
    this.performPreflightComputations();
  }

  performPreflightComputations() {
    this.lanesToRender = [];
    this.laneToMeasures = new Map<ReactLane, ReactMeasure[]>();

    for (let lane: ReactLane = 0; lane < REACT_TOTAL_NUM_LANES; lane++) {
      // Hide lanes without any measures
      const measuresForLane = this.profilerData.measures.filter(measure =>
        measure.lanes.includes(lane),
      );
      if (measuresForLane.length) {
        this.lanesToRender.push(lane);
        this.laneToMeasures.set(lane, measuresForLane);
      }
    }

    this.intrinsicSize = {
      width: this.profilerData.duration,
      height: this.lanesToRender.length * REACT_LANE_HEIGHT,
    };
  }

  desiredSize() {
    return this.intrinsicSize;
  }

  /**
   * Draw a single `ReactMeasure` as a bar in the canvas.
   */
  drawSingleReactMeasure(
    context: CanvasRenderingContext2D,
    rect: Rect,
    measure: ReactMeasure,
    baseY: number,
    scaleFactor: number,
    showGroupHighlight: boolean,
    showHoverHighlight: boolean,
  ) {
    const {frame} = this;
    const {timestamp, type, duration} = measure;

    let fillStyle = null;
    let hoveredFillStyle = null;
    let groupSelectedFillStyle = null;

    // We could change the max to 0 and just skip over rendering anything that small,
    // but this has the effect of making the chart look very empty when zoomed out.
    // So long as perf is okay- it might be best to err on the side of showing things.
    const width = durationToWidth(duration, scaleFactor);
    if (width <= 0) {
      return; // Too small to render at this zoom level
    }

    const x = timestampToPosition(timestamp, scaleFactor, frame);
    const measureRect: Rect = {
      origin: {x, y: baseY},
      size: {width, height: REACT_WORK_SIZE},
    };
    if (!rectIntersectsRect(measureRect, rect)) {
      return; // Not in view
    }

    switch (type) {
      case 'commit':
        fillStyle = COLORS.REACT_COMMIT;
        hoveredFillStyle = COLORS.REACT_COMMIT_HOVER;
        groupSelectedFillStyle = COLORS.REACT_COMMIT_SELECTED;
        break;
      case 'render-idle':
        // We could render idle time as diagonal hashes.
        // This looks nicer when zoomed in, but not so nice when zoomed out.
        // color = context.createPattern(getIdlePattern(), 'repeat');
        fillStyle = COLORS.REACT_IDLE;
        hoveredFillStyle = COLORS.REACT_IDLE_HOVER;
        groupSelectedFillStyle = COLORS.REACT_IDLE_SELECTED;
        break;
      case 'render':
        fillStyle = COLORS.REACT_RENDER;
        hoveredFillStyle = COLORS.REACT_RENDER_HOVER;
        groupSelectedFillStyle = COLORS.REACT_RENDER_SELECTED;
        break;
      case 'layout-effects':
        fillStyle = COLORS.REACT_LAYOUT_EFFECTS;
        hoveredFillStyle = COLORS.REACT_LAYOUT_EFFECTS_HOVER;
        groupSelectedFillStyle = COLORS.REACT_LAYOUT_EFFECTS_SELECTED;
        break;
      case 'passive-effects':
        fillStyle = COLORS.REACT_PASSIVE_EFFECTS;
        hoveredFillStyle = COLORS.REACT_PASSIVE_EFFECTS_HOVER;
        groupSelectedFillStyle = COLORS.REACT_PASSIVE_EFFECTS_SELECTED;
        break;
      default:
        throw new Error(`Unexpected measure type "${type}"`);
    }

    const drawableRect = rectIntersectionWithRect(measureRect, rect);
    context.fillStyle = showHoverHighlight
      ? hoveredFillStyle
      : showGroupHighlight
      ? groupSelectedFillStyle
      : fillStyle;
    context.fillRect(
      drawableRect.origin.x,
      drawableRect.origin.y,
      drawableRect.size.width,
      drawableRect.size.height,
    );
  }

  drawRect(context: CanvasRenderingContext2D, rect: Rect) {
    context.fillStyle = COLORS.PRIORITY_BACKGROUND;
    context.fillRect(
      rect.origin.x,
      rect.origin.y,
      rect.size.width,
      rect.size.height,
    );

    const {frame, lanesToRender, laneToMeasures} = this;
    const scaleFactor = positioningScaleFactor(this.intrinsicSize.width, frame);

    for (let i = 0; i < lanesToRender.length; i++) {
      const lane = lanesToRender[i];
      const baseY = frame.origin.y + i * REACT_LANE_HEIGHT;
      const measuresForLane = laneToMeasures.get(lane);

      if (!measuresForLane) {
        throw new Error(
          'No measures found for a React lane! This is a bug in this profiler tool. Please file an issue.',
        );
      }

      // Draw measures
      for (let j = 0; j < measuresForLane.length; j++) {
        const measure = measuresForLane[j];
        // TODO: Hovers
        // const showHoverHighlight =
        //   hoveredEvent && hoveredEvent.measure === measure;
        // const showGroupHighlight =
        //   hoveredEvent &&
        //   hoveredEvent.measure &&
        //   hoveredEvent.measure.batchUID === measure.batchUID;
        const showHoverHighlight = false;
        const showGroupHighlight = false;

        this.drawSingleReactMeasure(
          context,
          rect,
          measure,
          baseY,
          scaleFactor,
          showGroupHighlight,
          showHoverHighlight,
        );
      }

      // Render bottom border
      const borderFrame: Rect = {
        origin: {
          x: frame.origin.x,
          y:
            frame.origin.y +
            (i + 1) * REACT_LANE_HEIGHT -
            REACT_WORK_BORDER_SIZE,
        },
        size: {
          width: frame.size.width,
          height: REACT_WORK_BORDER_SIZE,
        },
      };
      if (rectIntersectsRect(borderFrame, rect)) {
        const borderDrawableRect = rectIntersectionWithRect(borderFrame, rect);
        context.fillStyle = COLORS.PRIORITY_BORDER;
        context.fillRect(
          borderDrawableRect.origin.x,
          borderDrawableRect.origin.y,
          borderDrawableRect.size.width,
          borderDrawableRect.size.height,
        );
      }
    }
  }
}
