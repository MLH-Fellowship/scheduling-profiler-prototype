// @flow

import type {ReactEvent, ReactProfilerData} from '../../types';
import type {Rect, Size} from '../../layout';

import {positioningScaleFactor, timestampToPosition} from '../canvasUtils';
import {
  View,
  Surface,
  rectIntersectsRect,
  rectIntersectionWithRect,
} from '../../layout';
import {
  COLORS,
  EVENT_ROW_HEIGHT_FIXED,
  REACT_EVENT_ROW_PADDING,
  REACT_EVENT_SIZE,
  REACT_WORK_BORDER_SIZE,
} from '../constants';

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
