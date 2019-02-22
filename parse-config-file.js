const fs = require('fs-extra');
const edn = require('jsedn');

const supportedBuildTypes = [':browser', ':node-library'];

function keywordToString(kw) {
  return kw && kw.replace(':', '');
}

async function parseAndFilterShadowCljsBuilds(input) {
  console.log('Reading shadow-cljs config...');
  console.log('input', input);
  const entrypointFile = await fs.readFile(input, 'utf8');

  console.log('entrypointFile', entrypointFile);

  // Parse edn to js
  const shadowCljsConfig = edn.toJS(edn.parse(entrypointFile));

  // Filter builds that are supported by this builder
  const supportedBuildConfigs = Object.entries(
    shadowCljsConfig[':builds']
  ).filter(([_, config]) => supportedBuildTypes.includes(config[':target']));

  console.log(supportedBuildConfigs);

  return supportedBuildConfigs.map(([name, config]) => ({
    name: keywordToString(name),
    target: keywordToString(config[':target']),
    outputDir: config[':output-dir'],
    outputTo: config[':output-to']
  }));
}

module.exports = parseAndFilterShadowCljsBuilds;
