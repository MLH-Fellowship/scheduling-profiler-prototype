// @flow

import type {FlamechartData, ReactEvent, ReactProfilerData} from '../types';
import {
  Rect,
  Size,
  rectIntersectsRect,
  rectIntersectionWithRect,
} from '../layout';

import {View, Surface} from '../layout';

import {trimFlamegraphText, getLaneHeight} from './canvasUtils';

import {
  COLORS,
  MARKER_FONT_SIZE,
  MARKER_TEXT_PADDING,
  MARKER_HEIGHT,
  MARKER_TICK_HEIGHT,
  REACT_GUTTER_SIZE,
  REACT_WORK_SIZE,
  REACT_WORK_BORDER_SIZE,
  FLAMECHART_FONT_SIZE,
  FLAMECHART_FRAME_HEIGHT,
  FLAMECHART_TEXT_PADDING,
  LABEL_FIXED_WIDTH,
  HEADER_HEIGHT_FIXED,
  REACT_EVENT_SIZE,
  REACT_EVENT_ROW_PADDING,
  EVENT_ROW_HEIGHT_FIXED,
  INTERVAL_TIMES,
  MIN_INTERVAL_SIZE_PX,
} from './constants';

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

// TODO Account for fixed label width
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

// class ReactMeasuresView extends View {}
