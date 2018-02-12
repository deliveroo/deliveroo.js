const Determinator = require('./determinator.js');
const FileRetrieval = require('./file_retrieval.js');

const path = require('path');
const fs = require('fs');

function loadExamples(testPath, matchingVersion) {
  const version = fs.readFileSync(path.join(testPath, 'VERSION'));
  // TODO: check version
  const sections = JSON.parse(fs.readFileSync(path.join(testPath, 'examples.json')));

  return sections;
}

describe('Determinator', () => {

  describe('determinate()', () => {
    const sections = loadExamples('standard-tests', '0.1.0');
    const retrieval = new FileRetrieval('standard-tests');
    const determinator = new Determinator(retrieval);

    sections.forEach((section) => {
      describe(section.section, () => {
        section.examples.forEach((example) => {
          it(example.why, () => {
            const execute = () => {
              return determinator.determinate(
                example.feature,
                example.id,
                example.guid,
                example.properties,
              );
            };

            if (example.hasOwnProperty('returns')) {
              expect(execute()).toBe(example.returns);
              if (example.error) {
                // TODO: Raises non-blocking error
              }
            } else {
              expect(execute).toThrow();
            }
          });
        });
      });
    });
  });

});