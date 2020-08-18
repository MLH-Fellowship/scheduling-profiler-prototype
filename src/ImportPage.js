// @flow

import type {TimelineEvent} from '@elg/speedscope';
import type {ReactProfilerData} from './types';

import React, {useEffect, useState, useCallback, useRef} from 'react';
// Imported assets use suffix 'Img'
import profilerBrowserImg from './assets/profilerBrowser.png';
import lanesImg from './assets/lanes.png';
import flamechartImg from './assets/flamechart.png';
import style from './ImportPage.css';

import preprocessData from './utils/preprocessData';
import {readInputData} from './utils/readInputData';

// Used in DEV only
// $FlowFixMe Flow cannot read this url path
import JSON_PATH from 'url:../static/sample-chrome-profile.json';

type Props = {|
  onDataImported: (profilerData: ReactProfilerData) => void,
|};

export default function ImportPage({onDataImported}: Props) {
  const processTimeline = useCallback(
    (events: TimelineEvent[]) => {
      if (events.length > 0) {
        onDataImported(preprocessData(events));
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
    async (event: SyntheticInputEvent<HTMLInputElement>) => {
      setShowSpinner(true);
      const readFile = await readInputData(event.target.files[0]);
      processTimeline(JSON.parse(readFile));
    },
    [processTimeline],
  );

  const upload = useRef(null);
  const [showSpinner, setShowSpinner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const toggleModal = () => {
    setShowModal(!showModal);
  };

  return (
    <div className={style.App}>
      <div className={style.container}>
        <div className={style.card}>
          <div className={style.cardcontainer}>
            <div className={style.row}>
              <div className={style.column}>
                {showSpinner ? (
                  <>
                    <div className={style.loader}>Loading...</div>
                    <p className={style.subtext}>
                      (Loading profile, it may seem like the page is frozen)
                    </p>
                  </>
                ) : (
                  <img
                    src={profilerBrowserImg}
                    className={style.browserScreenshot}
                    alt="logo"
                  />
                )}
              </div>
              <div className={style.columncontent}>
                <h2>
                  <span className={style.header}>
                    React Concurrent Mode Profiler
                  </span>
                  <a
                    target="_blank"
                    href="https://github.com/MLH-Fellowship/scheduling-profiler-prototype">
                    <svg width="24" height="24" viewBox="0 0 16 16">
                      <path
                        fillRule="evenodd"
                        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
                      />
                    </svg>
                  </a>
                </h2>
                <hr />
                <p>
                  Analyze and improve React application performance in the new
                  cooperative mode called Concurrent Mode.
                  <br />
                  <br />
                  Import a captured{' '}
                  <a
                    className={style.link}
                    href="https://developers.google.com/web/tools/chrome-devtools/evaluate-performance">
                    performance profile
                  </a>{' '}
                  from Chrome Devtools.
                </p>

                <div className={style.buttongrp}>
                  <label htmlFor="upload">
                    <button
                      className={style.button}
                      onClick={() => upload.current && upload.current.click()}>
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
                  <a onClick={toggleModal}>
                    <button className={style.btndoc}>
                      <span>How-to </span>
                    </button>
                  </a>
                </div>
                <div
                  className={`${style.modalOverlay} ${
                    showModal ? style.active : ''
                  }`}>
                  <div
                    className={`${style.modal}  ${
                      showModal ? style.active : ''
                    }`}>
                    <a onClick={toggleModal} className={style.closeModal}>
                      <svg viewBox="0 0 20 20">
                        <path
                          fill="#000000"
                          d="M15.898,4.045c-0.271-0.272-0.713-0.272-0.986,0l-4.71,4.711L5.493,4.045c-0.272-0.272-0.714-0.272-0.986,0s-0.272,0.714,0,0.986l4.709,4.711l-4.71,4.711c-0.272,0.271-0.272,0.713,0,0.986c0.136,0.136,0.314,0.203,0.492,0.203c0.179,0,0.357-0.067,0.493-0.203l4.711-4.711l4.71,4.711c0.137,0.136,0.314,0.203,0.494,0.203c0.178,0,0.355-0.067,0.492-0.203c0.273-0.273,0.273-0.715,0-0.986l-4.711-4.711l4.711-4.711C16.172,4.759,16.172,4.317,15.898,4.045z"
                        />
                      </svg>
                    </a>
                    {/* Modal Content */}
                    <div className={style.modalContent}>
                      <div className={style.cardcontainer}>
                        <div className={style.columncontent}>
                          <h1>Getting Started</h1>

                          <div className={style.modalRow}>
                            <div className={style.modalColumn}>
                              The event row displays React events and custom
                              timing marks. The gray bars show the lanes React
                              was working in. Hover over different measures to
                              get more information.
                            </div>
                            <div className={style.modalColumn}>
                              <img
                                src={lanesImg}
                                className={style.modalImg}
                                alt="logo"
                              />
                            </div>
                          </div>
                          <div className={style.modalRow}>
                            <div className={style.modalColumn}>
                              Hover over the flamechart to get information about
                              an individual flame cell. Similar colored
                              flamecells represent work done from the same URL.
                            </div>
                            <div className={style.modalColumn}>
                              <img
                                src={flamechartImg}
                                className={style.modalImg}
                                alt="logo"
                              />
                            </div>
                          </div>
                          <div className={style.modalRow}>
                            <div className={style.modalColumn}>
                              <p>
                                Scroll while holding down <kbd>Ctrl</kbd> or{' '}
                                <kbd>Shift</kbd> to zoom. Drag the grey bar
                                above the flamechart to vertically resize
                                sections.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
