// @flow

import type {Interaction} from '../useCanvasInteraction';
import type {Size} from './geometry';

import {getCanvasContext} from '../canvas/canvasUtils';

import {View} from './View';
import {zeroPoint} from './geometry';

export class Surface {
  rootView: ?View;
  context: ?CanvasRenderingContext2D;
  canvasSize: ?Size;

  setCanvas(canvas: HTMLCanvasElement, canvasSize: Size) {
    this.context = getCanvasContext(
      canvas,
      canvasSize.height,
      canvasSize.width,
    );
    this.canvasSize = canvasSize;

    if (this.rootView) {
      this.rootView.setNeedsDisplay();
    }
  }

  displayIfNeeded() {
    if (!this.rootView || !this.context || !this.canvasSize) {
      return;
    }
    this.rootView.displayIfNeeded(this.context, {
      origin: zeroPoint,
      size: this.canvasSize,
    });
  }

  handleInteraction(interaction: Interaction) {
    if (!this.rootView) {
      return;
    }
    const responder = this.rootView.hitTest(interaction.payload.location);
    if (responder) {
      responder.handleInteractionOrBubbleUp(interaction);
    }
  }
}
