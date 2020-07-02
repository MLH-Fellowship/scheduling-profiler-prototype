// @flow

import type {TimelineEvent} from './speedscope/import/chrome';
import type {
  FlamechartData,
  ReactProfilerData,
  ReactProfilerDataV2,
} from './types';

import React, {useEffect} from 'react';
import logo from "./logo.svg";
import "./ImportPage.css";

import preprocessData from './util/preprocessData';
import preprocessDataV2 from './util/preprocessDataV2';
import preprocessFlamechart from './util/preprocessFlamechart';

// TODO: Add import button but keep a static path until canvas layout is ready
import JSON_PATH from 'url:../static/small-devtools.json';
import JSON_PATHV2 from 'url:../static/Profile-20200625T133129.json';

type Props = {|
  onDataImported: (
    profilerData: ReactProfilerData,
    flamechart: FlamechartData,
  ) => void,
  onDataImportedV2: (
    profilerData: ReactProfilerDataV2,
    flamechart: FlamechartData,
  ) => void,
|};

export default function ImportPage({onDataImported, onDataImportedV2}: Props) {
  useEffect(() => {
    fetch(JSON_PATH)
      .then(res => res.json())
      .then((events: TimelineEvent[]) => {
        // Filter null entries and sort by timestamp.
        // I would not expect to have to do either of this,
        // but some of the data being passed in requires it.
        events = events.filter(Boolean).sort((a, b) => (a.ts > b.ts ? 1 : -1));

        if (events.length > 0) {
          const processedData = preprocessData(events);
          const processedFlamechart = preprocessFlamechart(events);
          onDataImported(processedData, processedFlamechart);
        }
      });
  }, []);

  useEffect(() => {
    fetch(JSON_PATHV2)
      .then(res => res.json())
      .then((events: TimelineEvent[]) => {
        // Filter null entries and sort by timestamp.
        // I would not expect to have to do either of this,
        // but some of the data being passed in requires it.
        events = events.filter(Boolean).sort((a, b) => (a.ts > b.ts ? 1 : -1));

        if (events.length > 0) {
          const processedData = preprocessDataV2(events);
          const processedFlamechart = preprocessFlamechart(events);
          onDataImportedV2(processedData, processedFlamechart);
        }
      });
  }, []);

  return (
    <div className="App">
      <div className="container">
        <div class="card">
          <div class="card-container">
            <div class="row">
              
              <div class="column">
                <img src={logo} className="react-logo" alt="logo" />
              </div>
              <div class="column column-content">
                <h2>React Concurrent Mode Profiler</h2>
                <hr />
                <p>To use the scheduler-profiler, load a pre-captured <a className="Link" href="https://developers.google.com/web/tools/chrome-devtools/evaluate-performance">performance profile</a> from 
                browser devtools.</p>

                <div className="button-grp">
                  <a href="#"><button class="button">Import</button></a>
                  <a href="#"><button class="btn-doc button"><span>Source </span></button></a>
                </div>
              </div>
            
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
