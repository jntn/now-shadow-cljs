/* eslint-disable import/no-unresolved */
/* eslint-disable no-param-reassign */
/* eslint-disable no-console */

const { createLambda } = require('@now/build-utils/lambda.js');
const download = require('@now/build-utils/fs/download.js');
const FileBlob = require('@now/build-utils/file-blob.js');
const FileFsRef = require('@now/build-utils/file-fs-ref.js');
const glob = require('@now/build-utils/fs/glob.js');
const { runNpmInstall } = require('@now/build-utils/fs/run-user-scripts.js');
const nodeBridge = require('@now/node-bridge');

const fs = require('fs-extra');
const execa = require('execa');
const path = require('path');
const tar = require('tar');
const fetch = require('node-fetch');

const parseConfigFile = require('./parse-config-file');

const javaUrl = 'https://d2znqt9b1bc64u.cloudfront.net/amazon-corretto-8.202.08.2-linux-x64.tar.gz';

async function installJava() {
  console.log('Downloading java...');
  const res = await fetch(javaUrl);

  if (!res.ok) {
    throw new Error(`Failed to download: ${javaUrl}`);
  }

  const { HOME } = process.env;
  return new Promise((resolve, reject) => {
    res.body
      .on('error', reject)
      .pipe(tar.extract({ gzip: true, cwd: HOME }))
      .on('finish', () => resolve());
  });
}

async function installDependencies(files, workPath) {
  const hasPkgJSON = Boolean(files['package.json']);
  if (hasPkgJSON) {
    console.log('Installing dependencies...');
    await runNpmInstall(workPath, ['--prefer-offline']);
  } else {
    throw new Error('Missing package.json');
  }
}

async function downloadFiles(files, entrypoint, workPath) {
  console.log('Downloading files...');
  const downloadedFiles = await download(files, workPath);
  const entryPath = downloadedFiles[entrypoint].fsPath;

  return { files: downloadedFiles, entryPath };
}

async function createLambdaForNode(buildConfig, lambdas, workPath) {
  console.log(`Creating lambda for ${buildConfig.name} (${buildConfig.target})`);

  const launcherPath = path.join(__dirname, 'launcher.js');
  let launcherData = await fs.readFile(launcherPath, 'utf8');

  launcherData = launcherData.replace(
    '// PLACEHOLDER',
    [
      `listener = require('./index.js');`,
      'if (listener.default) listener = listener.default;'
    ].join(' ')
  );

  const preparedFiles = {
    'launcher.js': new FileBlob({ data: launcherData }),
    'bridge.js': new FileFsRef({ fsPath: nodeBridge }),
    'index.js': new FileFsRef({
      fsPath: require.resolve(path.join(workPath, buildConfig.outputTo))
    })
  };

  const lambda = await createLambda({
    files: { ...preparedFiles },
    handler: 'launcher.launcher',
    runtime: 'nodejs12.x'
  });

  lambdas[buildConfig.outputTo] = lambda;
}

async function createLambdaForStatic(buildConfig, lambdas, workPath) {
  console.log(`Creating lambda for ${buildConfig.name} (${buildConfig.target})`);

  // Try to compute folder to serve.
  const outputPath = buildConfig.outputDir.replace(buildConfig.assetPath, '');

  const files = await glob(path.join(outputPath, '**'), workPath);

  Object.assign(lambdas, files);
}

const lambdaBuilders = {
  browser: createLambdaForStatic,
  'node-library': createLambdaForNode
};

exports.build = async ({ files, entrypoint, workPath } = {}) => {
  const { HOME, PATH } = process.env;

  const { files: downloadedFiles } = await downloadFiles(files, entrypoint, workPath);

  const { stdout } = await execa('ls', ['-a'], {
    cwd: workPath,
    stdio: 'inherit'
  });

  console.log(stdout);

  await installJava();
  await installDependencies(downloadedFiles, workPath);

  const input = downloadedFiles[entrypoint].fsPath;
  const buildConfigs = await parseConfigFile(input);

  try {
    await execa('npx', ['shadow-cljs', 'release', ...buildConfigs.map(b => b.name)], {
      env: {
        JAVA_HOME: `${HOME}/amazon-corretto-8.202.08.2-linux-x64`,
        PATH: `${PATH}:${HOME}/amazon-corretto-8.202.08.2-linux-x64/bin`,
        M2: `${workPath}.m2`
      },
      cwd: workPath,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('Failed to `npx shadow-cljs release ...`');
    throw err;
  }

  const lambdas = {};

  await Promise.all(
    buildConfigs.map(async buildConfig =>
      lambdaBuilders[buildConfig.target](buildConfig, lambdas, workPath)
    )
  );

  return lambdas;
};

exports.prepareCache = async ({ cachePath, workPath }) => {
  console.log('Preparing cache...');
  ['.m2', '.shadow-cljs', 'node_modules'].forEach(folder => {
    const p = path.join(workPath, folder);
    const cp = path.join(cachePath, folder);

    if (fs.existsSync(p)) {
      console.log(`Caching ${folder} folder`);
      fs.removeSync(cp);
      fs.renameSync(p, cp);
    }
  });

  return {
    ...(await glob('.m2/**', cachePath)),
    ...(await glob('.shadow-cljs/**', cachePath)),
    ...(await glob('node_modules/**', cachePath))
  };
};
