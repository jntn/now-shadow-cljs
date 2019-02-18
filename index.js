const { createLambda } = require('@now/build-utils/lambda.js');
const download = require('@now/build-utils/fs/download.js');
const FileBlob = require('@now/build-utils/file-blob.js');
const FileFsRef = require('@now/build-utils/file-fs-ref.js');
const fs = require('fs-extra');
const glob = require('@now/build-utils/fs/glob.js');

const execa = require('execa');
const path = require('path');
const tar = require('tar');
const fetch = require('node-fetch');
const { runNpmInstall } = require('@now/build-utils/fs/run-user-scripts.js');

const javaUrl =
  'https://d2znqt9b1bc64u.cloudfront.net/amazon-corretto-8.202.08.2-linux-x64.tar.gz';

async function installJava() {
  console.log('downloading java');
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

exports.build = async ({ files, entrypoint, workPath } = {}) => {
  const { HOME, PATH } = process.env;
  console.log(process.env);
  const { files: downloadedFiles, entryPath } = await downloadFiles(
    files,
    entrypoint,
    workPath
  );
  await installJava();
  await installDependencies(downloadedFiles, workPath);

  const entrypointDirname = path.dirname(downloadedFiles[entrypoint].fsPath);

  try {
    await execa('npx', ['shadow-cljs', 'release', 'haikus'], {
      env: {
        JAVA_HOME: HOME + '/amazon-corretto-8.202.08.2-linux-x64',
        PATH: PATH + ':' + HOME + '/amazon-corretto-8.202.08.2-linux-x64/bin'
      },
      cwd: entrypointDirname,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('failed to `npx shadow-cljs release haikus`'); // TODO: read from edn
    throw err;
  }

  const { stdout } = await execa('ls', {
    cwd: entrypointDirname,
    stdio: 'inherit'
  });

  console.log(stdout);

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
    'bridge.js': new FileFsRef({ fsPath: require('@now/node-bridge') }),
    'index.js': new FileFsRef({
      fsPath: require.resolve(
        path.join(entrypointDirname, 'api/haikus/index.js')
      ) // TODO: read from edn
    })
  };

  const lambda = await createLambda({
    files: { ...preparedFiles },
    handler: 'launcher.launcher',
    runtime: 'nodejs8.10'
  });

  return { [entrypoint]: lambda };
};
