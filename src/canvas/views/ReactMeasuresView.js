// @flow

import type {ReactLane, ReactMeasure, ReactProfilerData} from '../../types';
import type {Rect, Size} from '../../layout';

import {
  durationToWidth,
  positioningScaleFactor,
  timestampToPosition,
} from '../canvasUtils';
import {
  View,
  Surface,
  rectIntersectsRect,
  rectIntersectionWithRect,
} from '../../layout';

import {COLORS, REACT_WORK_BORDER_SIZE, REACT_WORK_SIZE} from '../constants';
import {REACT_TOTAL_NUM_LANES} from '../../constants';

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

  draw(context: CanvasRenderingContext2D) {
    const {frame, lanesToRender, laneToMeasures, visibleArea} = this;

    context.fillStyle = COLORS.PRIORITY_BACKGROUND;
    context.fillRect(
      visibleArea.origin.x,
      visibleArea.origin.y,
      visibleArea.size.width,
      visibleArea.size.height,
    );

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
          visibleArea,
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
      if (rectIntersectsRect(borderFrame, visibleArea)) {
        const borderDrawableRect = rectIntersectionWithRect(
          borderFrame,
          visibleArea,
        );
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
