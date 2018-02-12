const path = require('path');
const fs = require('fs');

class FileRetrieval {
  constructor(rootPath) {
    this.rootPath = rootPath;
  }

  retrieve(featureId) {
    const featurePath = path.join(this.rootPath, featureId);
    const raw = fs.readFileSync(featurePath);
    return JSON.parse(raw);
  }
}

module.exports = FileRetrieval;
