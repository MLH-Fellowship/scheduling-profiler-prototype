// @flow

import type {Point} from './layout';

import {useEffect} from 'react';

export type VerticalPanStartInteraction = {|
  type: 'vertical-pan-start',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type VerticalPanMoveInteraction = {|
  type: 'vertical-pan-move',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type VerticalPanEndInteraction = {|
  type: 'vertical-pan-end',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type HorizontalPanStartInteraction = {|
  type: 'horizontal-pan-start',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type HorizontalPanMoveInteraction = {|
  type: 'horizontal-pan-move',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type HorizontalPanEndInteraction = {|
  type: 'horizontal-pan-end',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type HoverInteraction = {|
  type: 'hover',
  payload: {|
    event: MouseEvent,
    location: Point,
  |},
|};
export type WheelInteraction = {|
  type: 'wheel',
  payload: {|
    event: WheelEvent,
    location: Point,
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

    function localToCanvasCoordinates(localCoordinates: Point): Point {
      if (!canvas) {
        return localCoordinates;
      }
      const canvasRect = canvas.getBoundingClientRect();
      return {
        x: localCoordinates.x - canvasRect.left,
        y: localCoordinates.y - canvasRect.top,
      };
    }

    if (!(canvas instanceof HTMLCanvasElement)) {
      console.error('canvas is not a HTMLCanvasElement!', canvas);
      return;
    }

    const onCanvasMouseDown: MouseEventHandler = event => {
      interactor({
        type: 'horizontal-pan-start',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
      interactor({
        type: 'vertical-pan-start',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
    };

    const onCanvasMouseMove: MouseEventHandler = event => {
      interactor({
        type: 'horizontal-pan-move',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
      interactor({
        type: 'vertical-pan-move',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
      interactor({
        type: 'hover',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
    };

    const onDocumentMouseUp: MouseEventHandler = event => {
      interactor({
        type: 'horizontal-pan-end',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
      interactor({
        type: 'vertical-pan-end',
        payload: {
          event,
          location: localToCanvasCoordinates({x: event.x, y: event.y}),
        },
      });
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
