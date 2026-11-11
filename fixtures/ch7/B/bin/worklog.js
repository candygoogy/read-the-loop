#!/usr/bin/env node
'use strict';

const { main } = require('../lib/commands');

process.exitCode = main(process.argv.slice(2));
