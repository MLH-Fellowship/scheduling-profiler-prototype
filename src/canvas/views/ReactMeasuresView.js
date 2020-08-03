// @flow

import type {Interaction, HoverInteraction} from '../../useCanvasInteraction';
import type {ReactLane, ReactMeasure, ReactProfilerData} from '../../types';
import type {Rect, Size} from '../../layout';

import {
  durationToWidth,
  positioningScaleFactor,
  positionToTimestamp,
  timestampToPosition,
} from '../canvasUtils';
import {
  View,
  Surface,
  rectContainsPoint,
  rectIntersectsRect,
  rectIntersectionWithRect,
} from '../../layout';

import {COLORS, REACT_WORK_BORDER_SIZE, REACT_WORK_SIZE} from '../constants';
import {REACT_TOTAL_NUM_LANES} from '../../constants';

const REACT_LANE_HEIGHT = REACT_WORK_SIZE + REACT_WORK_BORDER_SIZE;

export class ReactMeasuresView extends View {
  _profilerData: ReactProfilerData;
  _intrinsicSize: Size;

  _lanesToRender: ReactLane[];
  _laneToMeasures: Map<ReactLane, ReactMeasure[]>;

  _hoveredMeasure: ReactMeasure | null = null;
  onHover: ((measure: ReactMeasure | null) => void) | null = null;

  constructor(surface: Surface, frame: Rect, profilerData: ReactProfilerData) {
    super(surface, frame);
    this._profilerData = profilerData;
    this._performPreflightComputations();
  }

  _performPreflightComputations() {
    this._lanesToRender = [];
    this._laneToMeasures = new Map<ReactLane, ReactMeasure[]>();

    for (let lane: ReactLane = 0; lane < REACT_TOTAL_NUM_LANES; lane++) {
      // Hide lanes without any measures
      const measuresForLane = this._profilerData.measures.filter(measure =>
        measure.lanes.includes(lane),
      );
      if (measuresForLane.length) {
        this._lanesToRender.push(lane);
        this._laneToMeasures.set(lane, measuresForLane);
      }
    }

    this._intrinsicSize = {
      width: this._profilerData.duration,
      height: this._lanesToRender.length * REACT_LANE_HEIGHT,
    };
  }

  desiredSize() {
    return this._intrinsicSize;
  }

  setHoveredMeasure(hoveredMeasure: ReactMeasure | null) {
    if (this._hoveredMeasure === hoveredMeasure) {
      return;
    }
    this._hoveredMeasure = hoveredMeasure;
    this.setNeedsDisplay();
  }

  /**
   * Draw a single `ReactMeasure` as a bar in the canvas.
   */
  _drawSingleReactMeasure(
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
    const {
      frame,
      _hoveredMeasure,
      _lanesToRender,
      _laneToMeasures,
      visibleArea,
    } = this;

    context.fillStyle = COLORS.PRIORITY_BACKGROUND;
    context.fillRect(
      visibleArea.origin.x,
      visibleArea.origin.y,
      visibleArea.size.width,
      visibleArea.size.height,
    );

    const scaleFactor = positioningScaleFactor(
      this._intrinsicSize.width,
      frame,
    );

    for (let i = 0; i < _lanesToRender.length; i++) {
      const lane = _lanesToRender[i];
      const baseY = frame.origin.y + i * REACT_LANE_HEIGHT;
      const measuresForLane = _laneToMeasures.get(lane);

      if (!measuresForLane) {
        throw new Error(
          'No measures found for a React lane! This is a bug in this profiler tool. Please file an issue.',
        );
      }

      // Draw measures
      for (let j = 0; j < measuresForLane.length; j++) {
        const measure = measuresForLane[j];
        const showHoverHighlight = _hoveredMeasure === measure;
        const showGroupHighlight =
          !!_hoveredMeasure && _hoveredMeasure.batchUID === measure.batchUID;

        this._drawSingleReactMeasure(
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

  /**
   * @private
   */
  _handleHover(interaction: HoverInteraction) {
    const {
      frame,
      _intrinsicSize,
      _lanesToRender,
      _laneToMeasures,
      onHover,
      visibleArea,
    } = this;
    if (!onHover) {
      return;
    }

    const {location} = interaction.payload;
    if (!rectContainsPoint(location, visibleArea)) {
      onHover(null);
      return;
    }

    // Identify the lane being hovered over
    const adjustedCanvasMouseY = location.y - frame.origin.y;
    const renderedLaneIndex = Math.floor(
      adjustedCanvasMouseY / REACT_LANE_HEIGHT,
    );
    if (renderedLaneIndex < 0 || renderedLaneIndex >= _lanesToRender.length) {
      onHover(null);
      return;
    }
    const lane = _lanesToRender[renderedLaneIndex];

    // Find the measure in `lane` being hovered over.
    //
    // Because data ranges may overlap, we want to find the last intersecting item.
    // This will always be the one on "top" (the one the user is hovering over).
    const scaleFactor = positioningScaleFactor(_intrinsicSize.width, frame);
    const hoverTimestamp = positionToTimestamp(location.x, scaleFactor, frame);
    const measures = _laneToMeasures.get(lane);
    if (!measures) {
      onHover(null);
      return;
    }

    for (let index = measures.length - 1; index >= 0; index--) {
      const measure = measures[index];
      const {duration, timestamp} = measure;

      if (
        hoverTimestamp >= timestamp &&
        hoverTimestamp <= timestamp + duration
      ) {
        onHover(measure);
        return;
      }
    }

    onHover(null);
  }

  handleInteraction(interaction: Interaction) {
    switch (interaction.type) {
      case 'hover':
        this._handleHover(interaction);
        break;
    }
  }
}
