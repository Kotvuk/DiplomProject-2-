const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

router.get('/', (req, res) => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.attachment('KotvukAI.zip');
  archive.pipe(res);
  archive.directory(path.join(__dirname, '..', '..', 'frontend', 'src'), 'KotvukAI/frontend/src');
  archive.directory(path.join(__dirname, '..'), 'KotvukAI/backend');
  archive.file(path.join(__dirname, '..', '..', 'frontend', 'package.json'), { name: 'KotvukAI/frontend/package.json' });
  archive.file(path.join(__dirname, '..', '..', 'frontend', 'vite.config.mjs'), { name: 'KotvukAI/frontend/vite.config.mjs' });
  archive.file(path.join(__dirname, '..', '..', 'frontend', 'index.html'), { name: 'KotvukAI/frontend/index.html' });
  if (fs.existsSync(path.join(__dirname, '..', '..', 'start.bat'))) {
    archive.file(path.join(__dirname, '..', '..', 'start.bat'), { name: 'KotvukAI/start.bat' });
  }
  if (fs.existsSync(path.join(__dirname, '..', '..', 'database', 'init.sql'))) {
    archive.file(path.join(__dirname, '..', '..', 'database', 'init.sql'), { name: 'KotvukAI/database/init.sql' });
  }
  archive.finalize();
});

module.exports = router;
