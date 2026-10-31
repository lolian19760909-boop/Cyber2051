'use strict';
// Keep the process-local candidate overlay alive until the isolated test process ends.
const {overlay}=require('./ui-motion-overlay.cjs');
void overlay(()=>new Promise(resolve=>process.once('beforeExit',resolve)));
