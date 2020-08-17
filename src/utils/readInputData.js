// @flow

import nullthrows from 'nullthrows';

export const readInputData = (file: File): Promise<string> => {
  if (!file.name.endsWith('.json')) {
    return Promise.reject(
      new Error(
        'Invalid file type. Only JSON performance profiles are supported',
      ),
    );
  }

  const fileReader = new FileReader();

  return new Promise((resolve, reject) => {
    fileReader.onload = () => {
      const result = nullthrows(fileReader.result);
      if (typeof result === 'string') {
        resolve(result);
      }
      reject(new Error('Input file was not read as a string'));
    };

    fileReader.onerror = () => reject(fileReader.error);

    fileReader.readAsText(file);
  });
};
