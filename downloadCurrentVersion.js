#!/usr/bin/env node

// This is used to download the correct binary version
// as part of the prepublish step.

const pkg = require('./package.json');
const fs = require('fs');
const https = require('https');

const headers = {
  'user-agent': 'solcjs'
};

async function getVersionList() {
  console.log('fetch available version list...');

  return new Promise((resolve, reject) => {
    const req = https.get(
      'https://api.github.com/repos/vitelabs/soliditypp/releases',
      {
        headers
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error('failed to get version list: ' + res.statusCode));
          return;
        }
        res.setEncoding('utf-8');
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(JSON.parse(data));
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

async function download(url, file) {
  // Remove if existing
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }

  return new Promise((resolve, reject) => {
    const _download = (_url) => {
      const req = https.get(
        _url,
        {
          headers
        },
        (res) => {
          if (/3[0-9]{2}/.test(res.statusCode)) {
            console.log('redirect to ', res.headers['location']);
            _download(res.headers['location']);
            return;
          }

          if (res.statusCode !== 200) {
            console.log('failed to download file: ' + res.statusCode);
            reject(new Error('failed to download file: ' + res.statusCode));
            return;
          }

          const ws = fs.createWriteStream(file, { encoding: 'binary' });
          res.pipe(ws);
          ws.on('finish', () => {
            ws.close(() => {
              resolve();
              console.log('done.');
            });
          });
          res.on('error', reject);
        }
      );

      req.on('error', reject);
    };

    _download(url);
  });
}

getVersionList().then((list) => {
  if (list.length === 0) {
    console.error('no releases');
    return;
  }

  const wantedVersion = pkg.version.match(/^(\d+\.\d+\.\d+)$/)[1];

  let wantedRelease = list.find(
    (version) => version.tag_name === wantedVersion
  );

  if (!wantedRelease) {
    wantedRelease = list.find((version) => version.tag_name === 'latest');
    if (!wantedRelease) {
      wantedRelease = list[0];
    }
    console.warn(
      `failed to find version ${wantedVersion}, fallback to ${wantedRelease.tag_name}`
    );
  }

  const name = 'soljson.js';

  const solcjson = wantedRelease.assets.find((ast) => ast.name === name);

  if (!solcjson) {
    console.error(`no solcjson.js`);
    return;
  }

  const url = solcjson.browser_download_url;

  download(url, name);
});
