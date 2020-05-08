/* eslint-disable no-console */

const fs = require('fs-extra');
const edn = require('jsedn');

const supportedBuildTypes = [':browser', ':node-library'];

// Handle/ignore shadow/env tagged value
edn.setTagAction(new edn.Tag('shadow', 'env'), (obj) => {
  return obj;
});

function keywordToString(kw) {
  return kw && kw.replace(':', '');
}

async function parseAndFilterShadowCljsBuilds(input) {
  console.log('Reading shadow-cljs config...');
  const entrypointFile = await fs.readFile(input, 'utf8');

  // Parse edn to js
  const shadowCljsConfig = edn.toJS(edn.parse(entrypointFile));

  // Filter builds that are supported by this builder
  const supportedBuildConfigs = Object.entries(shadowCljsConfig[':builds']).filter(([, config]) =>
    supportedBuildTypes.includes(config[':target'])
  );

  return supportedBuildConfigs.map(([name, config]) => ({
    name: keywordToString(name),
    target: keywordToString(config[':target']),
    assetPath: config[':asset-path'],
    outputDir: config[':output-dir'],
    outputTo: config[':output-to'],
  }));
}

module.exports = parseAndFilterShadowCljsBuilds;
