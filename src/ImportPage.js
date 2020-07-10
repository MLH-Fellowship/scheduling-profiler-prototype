// @flow

import type {TimelineEvent} from '@elg/speedscope';
import type {FlamechartData, ReactProfilerData} from './types';

import React, {useEffect, useCallback} from 'react';
import logo from './reactlogo.svg';
import style from './ImportPage.css';

import preprocessData from './util/preprocessData';
import preprocessFlamechart from './util/preprocessFlamechart';
import {readInputData} from './util/readInputData';

// TODO: Use for dev only, switch to import file after
import JSON_PATH from 'url:../static/Profile-20200625T133129.json';

type Props = {|
  onDataImported: (
    profilerData: ReactProfilerData,
    flamechart: FlamechartData,
  ) => void,
|};

export default function ImportPage({onDataImported}: Props) {
  const processTimeline = useCallback(
    (events: TimelineEvent[]) => {
      // Filter null entries and sort by timestamp.
      // I would not expect to have to do either of this,
      // but some of the data being passed in requires it.
      events = events.filter(Boolean).sort((a, b) => (a.ts > b.ts ? 1 : -1));

      if (events.length > 0) {
        const processedData = preprocessData(events);
        const processedFlamechart = preprocessFlamechart(events);
        onDataImported(processedData, processedFlamechart);
      }
    },
    [onDataImported],
  );

  // ImportPage is show in production build only
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    fetch(JSON_PATH)
      .then(res => res.json())
      .then(processTimeline);
  }, [onDataImported, processTimeline]);

  const inputProfilerData = useCallback(async event => {
    const regex = /^.*\.json$/g;
    const inputFile = event.target.files[0];
    if (!inputFile.name.match(regex)) {
      console.error(
        'Invalid file type, insert a captured performance profile JSON',
      );
      return;
    }

    const readFile = await readInputData(inputFile);
    processTimeline(JSON.parse(readFile)); // json read successfully
  });

  return (
    <div className={style.App}>
      <div className={style.container}>
        <div className={style.card}>
          <div className={style.cardcontainer}>
            <div className={style.row}>
              <div className={style.column}>
                <img src={logo} className={style.reactlogo} alt="logo" />
              </div>
              <div className={style.columncontent}>
                <h2>React Concurrent Mode Profiler</h2>
                <hr />
                <p>
                  To use the scheduler-profiler, load a pre-captured{' '}
                  <a
                    className={style.Link}
                    href="https://developers.google.com/web/tools/chrome-devtools/evaluate-performance">
                    performance profile
                  </a>{' '}
                  from browser devtools.
                </p>

                <div className={style.buttongrp}>
                  <label htmlFor="upload">
                    <button
                      className={style.button}
                      onClick={e => document.getElementById('upload').click()}>
                      Import
                    </button>
                    <input
                      type="file"
                      id="upload"
                      className={style.inputbtn}
                      onChange={inputProfilerData}
                      accept="application/JSON"
                    />
                  </label>
                  <a href="https://github.com/MLH-Fellowship/scheduling-profiler-prototype">
                    <button className={style.btndoc}>
                      <span>Source </span>
                    </button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
