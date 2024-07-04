#!/usr/bin/env tsx

import { ScreenShotServer } from './ScreenshotServer';

const photoDir = process.argv[2] || '/media/ipad/DCIM/100APPLE';

if (!photoDir) {
  console.log(`The directory (${photoDir}) is not found.`);
  process.exit(1);
}

const server = new ScreenShotServer(photoDir);
server.startWatching();
