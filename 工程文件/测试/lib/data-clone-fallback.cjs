'use strict';
// Test the card's fallback in every CommonJS consumer; fixture construction keeps Node's native API.
const Clone=require('../../卡片源码/共享/data-clone.js');
Clone.clone=Clone.create(undefined);
