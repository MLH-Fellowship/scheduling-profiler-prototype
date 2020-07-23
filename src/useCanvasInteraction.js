// @flow

import {useEffect} from 'react';

export type VerticalPanStartInteraction = {|
  type: 'vertical-pan-start',
  payload: {|
    event: MouseEvent,
  |},
|};
export type VerticalPanMoveInteraction = {|
  type: 'vertical-pan-move',
  payload: {|
    event: MouseEvent,
  |},
|};
export type VerticalPanEndInteraction = {|
  type: 'vertical-pan-end',
  payload: {|
    event: MouseEvent,
  |},
|};
export type HorizontalPanStartInteraction = {|
  type: 'horizontal-pan-start',
  payload: {|
    event: MouseEvent,
  |},
|};
export type HorizontalPanMoveInteraction = {|
  type: 'horizontal-pan-move',
  payload: {|
    event: MouseEvent,
  |},
|};
export type HorizontalPanEndInteraction = {|
  type: 'horizontal-pan-end',
  payload: {|
    event: MouseEvent,
  |},
|};
export type HoverInteraction = {|
  type: 'hover',
  payload: {|
    event: MouseEvent,
  |},
|};
export type WheelInteraction = {|
  type: 'wheel',
  payload: {|
    event: WheelEvent,
  |},
|};

export type Interaction =
  | VerticalPanStartInteraction
  | VerticalPanMoveInteraction
  | VerticalPanEndInteraction
  | HorizontalPanStartInteraction
  | HorizontalPanMoveInteraction
  | HorizontalPanEndInteraction
  | HoverInteraction
  | WheelInteraction;

export function useCanvasInteraction(
  canvasRef: {|current: HTMLCanvasElement | null|},
  interactor: (interaction: Interaction) => void,
) {
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!(canvas instanceof HTMLCanvasElement)) {
      console.error('canvas is not a HTMLCanvasElement!', canvas);
      return;
    }

    const onCanvasMouseDown: MouseEventHandler = event => {
      interactor({type: 'horizontal-pan-start', payload: {event}});
      interactor({type: 'vertical-pan-start', payload: {event}});
    };

    const onCanvasMouseMove: MouseEventHandler = event => {
      interactor({type: 'horizontal-pan-move', payload: {event}});
      interactor({type: 'vertical-pan-move', payload: {event}});
      interactor({type: 'hover', payload: {event}});
    };

    const onDocumentMouseUp: MouseEventHandler = event => {
      interactor({type: 'horizontal-pan-end', payload: {event}});
      interactor({type: 'vertical-pan-end', payload: {event}});
    };

    const onCanvasWheel: WheelEventHandler = event => {
      event.preventDefault();
      event.stopPropagation();

      // TODO: Decide if this is a horizontal scroll, vertical scroll, or zoom,
      // and fire the appropriate action.

      return false;
    };

    document.addEventListener('mouseup', onDocumentMouseUp);

    canvas.addEventListener('wheel', onCanvasWheel);
    canvas.addEventListener('mousedown', onCanvasMouseDown);
    canvas.addEventListener('mousemove', onCanvasMouseMove);

    return () => {
      document.removeEventListener('mouseup', onDocumentMouseUp);

      canvas.removeEventListener('wheel', onCanvasWheel);
      canvas.removeEventListener('mousedown', onCanvasMouseDown);
      canvas.removeEventListener('mousemove', onCanvasMouseMove);
    };
  }, [canvasRef, interactor]);
}
