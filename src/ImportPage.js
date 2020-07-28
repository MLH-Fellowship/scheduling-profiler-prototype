// @flow

import type {TimelineEvent} from '@elg/speedscope';
import type {FlamechartData, ReactProfilerData} from './types';

import React, {useEffect, useCallback, useRef} from 'react';
import profilerBrowser from './assets/profilerBrowser.png';
import style from './ImportPage.css';

import preprocessData from './util/preprocessData';
import preprocessFlamechart from './util/preprocessFlamechart';
import {readInputData} from './util/readInputData';

// TODO: Use for dev only, switch to import file after
import JSON_PATH from 'url:../static/perfprofilev2.json';

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

  // DEV only: auto-import a demo profile on component mount (i.e. page load)
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    fetch(JSON_PATH)
      .then(res => res.json())
      .then(processTimeline);
  }, [processTimeline]);

  const handleProfilerInput = useCallback(
    async (event: File) => {
      const readFile = await readInputData(event.target.files[0]);
      processTimeline(JSON.parse(readFile));
    },
    [processTimeline],
  );

  const upload = useRef(null);

  return (
    <div className={style.App}>
      <div className={style.container}>
        <div className={style.card}>
          <div className={style.cardcontainer}>
            <div className={style.row}>
              <div className={style.column}>
                <img
                  src={profilerBrowser}
                  className={style.browserScreenshot}
                  alt="logo"
                />
              </div>
              <div className={style.columncontent}>
                <h2>React Concurrent Mode Profiler</h2>
                <hr />
                <p>
                  Import a captured{' '}
                  <a
                    className={style.link}
                    href="https://developers.google.com/web/tools/chrome-devtools/evaluate-performance">
                    performance profile
                  </a>{' '}
                  from Chrome Devtools.
                  <br />
                  Use <kbd>Ctrl + Scroll</kbd> or <kbd>Shift + Scroll</kbd> to
                  zoom.
                  <p className={style.legendKey}>
                    <svg height="20" width="20">
                      <circle cx="10" cy="10" r="5" fill="#ff718e" />
                    </svg>
                    State Update Scheduled
                    <br />
                    <svg height="20" width="20">
                      <circle cx="10" cy="10" r="5" fill="#9fc3f3" />
                    </svg>
                    State Update Scheduled
                    <br />
                    <svg height="20" width="20">
                      <circle cx="10" cy="10" r="5" fill="#a6e59f" />
                    </svg>
                    Suspended
                  </p>
                </p>

                <div className={style.buttongrp}>
                  <label htmlFor="upload">
                    <button
                      className={style.button}
                      onClick={e => upload.current.click()}>
                      Import
                    </button>
                    <input
                      type="file"
                      ref={upload}
                      className={style.inputbtn}
                      onChange={handleProfilerInput}
                      accept="application/json"
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
