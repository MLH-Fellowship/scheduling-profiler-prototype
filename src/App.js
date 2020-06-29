// @flow

import type {TimelineEvent} from './speedscope/import/chrome';
import type {FlamechartData, ReactProfilerData} from './types';

import React, {useEffect, useState} from 'react';
import {unstable_batchedUpdates} from 'react-dom';
import CanvasPage from './CanvasPage';

import {REACT_PRIORITIES} from './canvas/constants';
import {getPriorityHeight} from './canvas/canvasUtils';
import preprocessData from './util/preprocessData';
import preprocessFlamechart from './util/preprocessFlamechart';

// TODO: Add import button but keep a static path until canvas layout is ready
import JSON_PATH from 'url:../static/small-devtools.json';

export default function App() {
  const [data, setData] = useState<ReactProfilerData | null>(null);
  const [flamechart, setFlamechart] = useState<FlamechartData | null>(null);
  const [schedulerCanvasHeight, setSchedulerCanvasHeight] = useState<number>(0);

  useEffect(() => {
    fetch(JSON_PATH)
      .then(res => res.json())
      .then((events: TimelineEvent[]) => {
        // Filter null entries and sort by timestamp.
        // I would not expect to have to do either of this,
        // but some of the data being passed in requires it.
        events = events.filter(Boolean).sort((a, b) => (a.ts > b.ts ? 1 : -1));

        if (events.length > 0) {
          unstable_batchedUpdates(() => {
            const processedData = preprocessData(events);
            setData(processedData);

            setFlamechart(preprocessFlamechart(events));

            let height = 0;

            REACT_PRIORITIES.forEach(priority => {
              height += getPriorityHeight(processedData, priority);
            });

            setSchedulerCanvasHeight(height);
          });
        }
      });
  }, []);

  if (data && flamechart) {
    return (
      <CanvasPage
        profilerData={data}
        flamechart={flamechart}
        schedulerCanvasHeight={schedulerCanvasHeight}
      />
    );
  } else {
    return <div>Loading</div>;
  }
}
