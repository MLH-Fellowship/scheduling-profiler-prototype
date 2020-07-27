// @flow

import type {FlamechartData, ReactProfilerData} from '../../types';
import type {Rect, Size} from '../../layout';

import {View, Surface} from '../../layout';
import {
  durationToWidth,
  positioningScaleFactor,
  timestampToPosition,
  trimFlamegraphText,
} from '../canvasUtils';
import {
  COLORS,
  FLAMECHART_FONT_SIZE,
  FLAMECHART_FRAME_HEIGHT,
  FLAMECHART_TEXT_PADDING,
  REACT_WORK_BORDER_SIZE,
} from '../constants';

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

  draw(context: CanvasRenderingContext2D) {
    const {frame, flamechart, intrinsicSize, visibleArea} = this;

    context.fillStyle = COLORS.BACKGROUND;
    context.fillRect(
      visibleArea.origin.x,
      visibleArea.origin.y,
      visibleArea.size.width,
      visibleArea.size.height,
    );

    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.font = `${FLAMECHART_FONT_SIZE}px sans-serif`;

    const scaleFactor = positioningScaleFactor(intrinsicSize.width, frame);

    for (let i = 0; i < flamechart.layers.length; i++) {
      const nodes = flamechart.layers[i];

      const layerY = Math.floor(frame.origin.y + i * FLAMECHART_FRAME_HEIGHT);
      if (
        layerY + FLAMECHART_FRAME_HEIGHT < visibleArea.origin.y ||
        visibleArea.origin.y + visibleArea.size.height < layerY
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
        if (
          x + width < visibleArea.origin.x ||
          visibleArea.origin.x + visibleArea.size.width < x
        ) {
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