"use strict";

var bunyan = require('bunyan'),
    bunyantcp = require('../lib/logstash');

var log = bunyan.createLogger({
    name: 'example',
    streams: [{
        level: 'debug',
        stream: process.stdout
    },{
        level: 'debug',
        type: "raw",
        stream: bunyantcp.createStream({
            host: '127.0.0.1',
            port: 9998
        }).on('connect', function() {
            console.log('connect to tcp');
        }).on('close', function() { 
            console.log("Closed connection to tcp"); 
        }).on('error', console.log )
    }],
    level: 'debug'
});

log.debug('test');
log.error('error test');
