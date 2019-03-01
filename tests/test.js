/* eslint-disable no-undef */
/* eslint-disable no-console */

const path = require('path');
const parseConfigFile = require('../parse-config-file');

test('read shadow-cljs config file', async () => {
  const config = await parseConfigFile(path.resolve(__dirname, './shadow-cljs.edn'));

  console.log(config);

  expect(config.length).toBe(2);

  expect(config[0].target).toBe('node-library');
  expect(config[0].name).toBe('haikus');
  expect(config[1].target).toBe('browser');
});
