"use strict";

var bunyan = require('bunyan'),
    bunyantcp = require('../lib/logstash');

var net = require('net'),
    should = require('should');

suite('EventEmitter', function() {

    var server;
    var serverPort;

    suiteSetup(function(done){
        server = net.createServer();
        server.listen(function() {
            serverPort = server.address().port;
            done();
        });
    });
 
    test('should emit a connect event', function(done){
        bunyan.createLogger({ name: 'example', streams: [ { level: 'debug', type: 'raw', stream: bunyantcp.createStream({
            host: '127.0.0.1',
            port: serverPort
        }).on('connect', done)}]});
    });

    test('should emit a close event', function(done){
        var tcps = bunyantcp.createStream({
            host: '127.0.0.1',
            port: serverPort
        });
        bunyan.createLogger({ name: 'example', streams: [ { level: 'debug', type: 'raw', stream: tcps }]});
        tcps.on('connect', function() {
            tcps.socket.end();
        }).on('close', done)
    });

    test('should emit an error event', function(done){
        bunyan.createLogger({ name: 'example', streams: [ { level: 'debug', type: 'raw', stream: bunyantcp.createStream({
            host: '127.0.0.1',
            port: 12
        }).on('error', function(err) { 
            err.should.be.an.instanceof(Error);
            done(); 
        })}]});
    });
});