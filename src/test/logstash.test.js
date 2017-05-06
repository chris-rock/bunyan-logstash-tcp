const os = require('os');
const fs = require('fs');
const net = require('net');
const sinon = require('sinon');
const tls = require('tls');

const CBuffer = require('CBuffer');
const { expect } = require('chai');

const { createStream } = require('../lib/logstash');

const EventEmitter = require('events').EventEmitter;

class MockSocket {
  constructor() {
    this.listeners = {};
    this.unrefCalled = false;
    this.destroyCalled = false;
    this.encoding = null;
    this.host = null;
    this.port = null;
    this.content = '';
  }

  connect(host, port, callback) {
    this.host = host;
    this.port = port;
    setTimeout(callback);
  }

  on(event, callback) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(callback);
  }

  unref() {
    this.unrefCalled = true;
  }

  destroy() {
    this.destroyCalled = true;
  }

  setEncoding(encoding) {
    this.encoding = encoding;
  }

  write(text) {
    this.content += text;
  }

  dispatchEvent(event, ...params) {
    (this.listeners[event] || []).forEach(callback => callback(...params));
  }
}

describe('logstash', () => {
  const sandbox = sinon.sandbox.create();

  beforeEach(() => {
    sandbox.stub(net, 'Socket').callsFake(() => new MockSocket());
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createStream', () => {
    it('Should call EventEmitter.call()', () => {
      const callSpy = sandbox.spy(EventEmitter, 'call');

      const stream = createStream();

      expect(callSpy.calledWith(stream));
    });

    it('Should call apply default options when no options are provided', () => {
      const stream = createStream();

      expect(stream).to.have.property('name', 'bunyan');
      expect(stream).to.have.property('level', 'info');
      expect(stream).to.have.property('server', os.hostname());
      expect(stream).to.have.property('host', '127.0.0.1');
      expect(stream).to.have.property('port', 9999);
      expect(stream).to.have.property('application', process.title);
      expect(stream).to.have.property('pid', process.pid);
      expect(stream).to.have.property('tags').eql(['bunyan']);
      expect(stream).to.have.property('type', undefined);
      expect(stream).to.have.property('client', null);
      expect(stream).to.have.property('ssl_enable', false);
      expect(stream).to.have.property('ssl_key', '');
      expect(stream).to.have.property('ssl_cert', '');
      expect(stream).to.have.property('ca', '');
      expect(stream).to.have.property('ssl_passphrase', '');
      expect(stream).to.have.property('cbuffer_size', 10);
      expect(stream).to.have.property('log_queue').instanceOf(CBuffer).deep.property('data.length', 10);
      expect(stream).to.have.property('connected', false);

      expect(stream).to.have.property('socket').instanceOf(MockSocket);
      expect(stream).to.have.property('retries', 0);
      expect(stream).to.have.property('max_connect_retries', 4);
      expect(stream).to.have.property('retry_interval', 100);
    });

    it('Should use the level option value', () => {
      const stream = createStream({ level: 'debug' });

      expect(stream).to.have.property('level', 'debug');
    });

    it('Should use the server option value', () => {
      const stream = createStream({ server: 'myServer.com' });

      expect(stream).to.have.property('server', 'myServer.com');
    });

    it('Should use the host option value', () => {
      const stream = createStream({ host: 'host1' });

      expect(stream).to.have.property('host', 'host1');
    });

    it('Should use the port option value', () => {
      const stream = createStream({ port: 12345 });

      expect(stream).to.have.property('port', 12345);
    });

    it('Should use the appName option value', () => {
      const stream = createStream({ appName: 'my app' });

      expect(stream).to.have.property('application', 'my app');
    });

    it('Should use the pid option value', () => {
      const stream = createStream({ pid: 123456 });

      expect(stream).to.have.property('pid', 123456);
    });

    it('Should use the tags option value', () => {
      const stream = createStream({ tags: ['tag1', 'tag2'] });

      expect(stream).to.have.property('tags').eql(['tag1', 'tag2']);
    });

    it('Should use the type option value', () => {
      const stream = createStream({ type: 'alpha' });

      expect(stream).to.have.property('type', 'alpha');
    });

    it('Should use the ssl_enable option value', () => {
      sandbox.stub(tls, 'connect').callsFake(() => new MockSocket());

      const stream = createStream({ ssl_enable: true });

      expect(stream).to.have.property('ssl_enable', true);
    });

    it('Should use the ssl_key option value', () => {
      const stream = createStream({ ssl_key: 'myKey' });

      expect(stream).to.have.property('ssl_key', 'myKey');
    });

    it('Should use the ssl_cert option value', () => {
      const stream = createStream({ ssl_cert: 'myCert' });

      expect(stream).to.have.property('ssl_cert', 'myCert');
    });

    it('Should use the ca option value', () => {
      const stream = createStream({ ca: 'caaaa' });

      expect(stream).to.have.property('ca', 'caaaa');
    });

    it('Should use the ssl_passphrase option value', () => {
      const stream = createStream({ ssl_passphrase: 'pass' });

      expect(stream).to.have.property('ssl_passphrase', 'pass');
    });

    it('Should use the cbuffer_size option value', () => {
      const stream = createStream({ cbuffer_size: 14 });

      expect(stream).to.have.property('cbuffer_size', 14);
      expect(stream).to.have.property('log_queue').instanceOf(CBuffer).deep.property('data.length', 14);
    });

    it('Should use the numeric max_connect_retries option value', () => {
      const stream = createStream({ max_connect_retries: 12 });

      expect(stream).to.have.property('max_connect_retries', 12);
    });

    it('Should ignore the non numeric max_connect_retries option value', () => {
      const stream = createStream({ max_connect_retries: '12' });

      expect(stream).to.have.property('max_connect_retries', 4);
    });

    it('Should use the retry_interval option value', () => {
      const stream = createStream({ retry_interval: 200 });

      expect(stream).to.have.property('retry_interval', 200);
    });

    it('Should inherit EventEmitter', () => {
      const stream = createStream();
      expect(stream).to.be.instanceOf(EventEmitter);
    });
  });

  describe('LogstashStream', () => {
    describe('write', () => {
      it('Should call the send method', () => {
        const stream = createStream({
          tags: ['tag1', 'tag2'],
          server: 'myServer.com',
          appName: 'myApp',
          pid: 12345
        });

        const sendStub = sandbox.stub(stream, 'send');

        stream.write({
          time: '2017-05-06T16:48:19.763Z'
        });

        expect(sendStub.callCount).to.eql(1);
        const args = sendStub.getCall(0).args;
        expect(args).to.have.length(1);

        const payload = JSON.parse(args[0]);
        expect(payload).to.have.property('@timestamp', '2017-05-06T16:48:19.763Z');
        expect(payload).to.have.property('tags').eql(['tag1', 'tag2']);
        expect(payload).to.have.property('source', 'myServer.com/myApp');
        expect(payload).to.have.property('pid', 12345);
      });

      it('Should override the default message fields with the entry fields', () => {
        const stream = createStream({
          tags: ['tag1', 'tag2'],
          server: 'myServer.com',
          appName: 'myApp',
          pid: 12345
        });

        const sendStub = sandbox.stub(stream, 'send');

        stream.write({
          time: '2017-05-06T16:48:19.763Z',
          '@timestamp': 'overriden timestamp',
          msg: 'my message',
          tags: ['overriden tag'],
          source: 'overriden source',
          level: 'debug',
          myKey: 'myValue'
        });

        expect(sendStub.callCount).to.eql(1);
        const args = sendStub.getCall(0).args;
        expect(args).to.have.length(1);

        const payload = JSON.parse(args[0]);
        expect(payload).to.have.property('@timestamp', 'overriden timestamp');
        expect(payload).to.have.property('tags').eql(['overriden tag']);
        expect(payload).to.have.property('source', 'overriden source');
        expect(payload).to.have.property('myKey', 'myValue');
        expect(payload).to.have.property('pid', 12345);
        expect(payload).to.have.property('level', 'debug');
        expect(payload).to.have.property('message', 'my message');
      });

      it('Should accept a string containing valid JSON', () => {
        const stream = createStream({});

        const sendStub = sandbox.stub(stream, 'send');

        stream.write('{"time":"2017-05-06T16:48:19.763Z"}');

        expect(sendStub.callCount).to.eql(1);
        const args = sendStub.getCall(0).args;
        expect(args).to.have.length(1);
        const payload = JSON.parse(args[0]);
        expect(payload).to.have.property('@timestamp', '2017-05-06T16:48:19.763Z');
      });

      it('Should transform valid numeric levels into their string version', () => {
        const stream = createStream({});

        const sendStub = sandbox.stub(stream, 'send');

        stream.write({ time: '2017-05-06T16:48:19.763Z', level: 50 });

        expect(sendStub.callCount).to.eql(1);
        const args = sendStub.getCall(0).args;
        expect(args).to.have.length(1);
        const payload = JSON.parse(args[0]);
        expect(payload).to.have.property('level', 'error');
      });

      it('Should keep unknown numeric levels as is', () => {
        const stream = createStream({});

        const sendStub = sandbox.stub(stream, 'send');

        stream.write({ time: '2017-05-06T16:48:19.763Z', level: 51 });

        expect(sendStub.callCount).to.eql(1);
        const args = sendStub.getCall(0).args;
        expect(args).to.have.length(1);
        const payload = JSON.parse(args[0]);
        expect(payload).to.have.property('level', 51);
      });

      it('Should include string stream type in the message', () => {
        const stream = createStream({ type: 'alpha' });

        const sendStub = sandbox.stub(stream, 'send');

        stream.write({ time: '2017-05-06T16:48:19.763Z', level: 51 });

        expect(sendStub.callCount).to.eql(1);
        const args = sendStub.getCall(0).args;
        expect(args).to.have.length(1);
        const payload = JSON.parse(args[0]);
        expect(payload).to.have.property('type', 'alpha');
      });

      it('Should not include non string stream type in the message', () => {
        const stream = createStream({ type: 42 });

        const sendStub = sandbox.stub(stream, 'send');

        stream.write({ time: '2017-05-06T16:48:19.763Z', level: 51 });

        expect(sendStub.callCount).to.eql(1);
        const args = sendStub.getCall(0).args;
        expect(args).to.have.length(1);
        const payload = JSON.parse(args[0]);
        expect(payload).to.not.have.property('type');
      });

      it('Should not override stream pid with entry pid if any', () => {
        const stream = createStream({ pid: 42 });

        const sendStub = sandbox.stub(stream, 'send');

        stream.write({ time: '2017-05-06T16:48:19.763Z', pid: 43 });

        expect(sendStub.callCount).to.eql(1);
        const args = sendStub.getCall(0).args;
        expect(args).to.have.length(1);
        const payload = JSON.parse(args[0]);
        expect(payload).to.have.property('pid', 42);
      });
    });

    describe('connect', () => {
      it('Should create non tls socket when ssl_enable is false', () => {
        const tlsConnectSpy = sandbox.spy(tls, 'connect');

        createStream();

        expect(tlsConnectSpy.callCount).to.eql(0);
      });

      it('Should create tls socket when ssl_enable is true', () => {
        const tlsConnectStub = sandbox.stub(tls, 'connect').callsFake(() => new MockSocket());
        sandbox.stub(fs, 'readFileSync').callsFake(path => `content of ${path}`);

        const stream = createStream({
          ssl_enable: true,
          ssl_key: 'path/to/key',
          ssl_cert: 'path/to/cert',
          ssl_passphrase: 'passphrase',
          ca: ['path/to/ca1', 'path/to/ca2'],
          port: 12345,
          host: 'sslhost'
        });

        expect(tlsConnectStub.callCount).to.eql(1);
        const args = tlsConnectStub.getCall(0).args;
        expect(args).to.have.length(4);
        expect(args[0]).to.eql(12345);
        expect(args[1]).to.eql('sslhost');
        expect(args[2]).to.eql({
          key: 'content of path/to/key',
          cert: 'content of path/to/cert',
          passphrase: 'passphrase',
          ca: ['content of path/to/ca1', 'content of path/to/ca2']
        });
        const connectedCallback = args[3];

        expect(stream).to.have.property('connecting', true);
        expect(stream).to.have.property('connected', false);

        connectedCallback();

        expect(stream).to.have.property('connecting', false);
        expect(stream).to.have.deep.property('socket.encoding', 'UTF-8');
        expect(stream).to.have.property('connected', true);
      });

      it('Should hanlde socket errors', () => {
        sandbox.stub(tls, 'connect').callsFake(
          (port, host, options, callback) => {
            setTimeout(callback);
            return new MockSocket();
          }
        );
        const stream = createStream({ ssl_enable: true });
        const streamEmitStub = sandbox.stub(stream, 'emit');
        const socket = stream.socket;
        stream.socket.dispatchEvent('error', 'test error');
        expect(stream).to.have.property('connecting', false);
        expect(stream).to.have.property('connected', false);
        expect(socket).to.have.property('destroyCalled', true);
        expect(stream).to.have.property('socket', null);
        expect(streamEmitStub.withArgs('error', 'test error').callCount).to.equal(1);
      });

      it('Should hanlde socket timeouts', () => {
        sandbox.stub(tls, 'connect').callsFake(
          (port, host, options, callback) => {
            setTimeout(callback);
            return new MockSocket();
          }
        );
        const stream = createStream({ ssl_enable: true });
        const streamEmitStub = sandbox.stub(stream, 'emit');
        const socket = stream.socket;
        stream.socket.dispatchEvent('timeout');
        expect(socket).to.have.property('destroyCalled', true);
        expect(streamEmitStub.withArgs('timeout').callCount).to.equal(1);
      });

      it('Should hanlde socket timeouts with readyState still "open"', () => {
        sandbox.stub(tls, 'connect').callsFake(
          (port, host, options, callback) => {
            setTimeout(callback);
            return new MockSocket();
          }
        );
        const stream = createStream({ ssl_enable: true });
        stream.socket.readyState = 'open';
        const streamEmitStub = sandbox.stub(stream, 'emit');
        const socket = stream.socket;
        stream.socket.dispatchEvent('timeout');
        expect(socket).to.have.property('destroyCalled', false);
        expect(streamEmitStub.withArgs('timeout').callCount).to.equal(1);
      });

      it('Should hanlde connect event', () => {
        sandbox.stub(tls, 'connect').callsFake(
          (port, host, options, callback) => {
            setTimeout(callback);
            return new MockSocket();
          }
        );
        const stream = createStream({ ssl_enable: true });
        const streamEmitStub = sandbox.stub(stream, 'emit');
        stream.socket.dispatchEvent('connect');
        expect(stream).to.have.property('retries', 0);
        expect(streamEmitStub.withArgs('connect').callCount).to.equal(1);
      });

      it('Should hanlde close event when retries are still possible', done => {
        sandbox.stub(tls, 'connect').callsFake(
          (port, host, options, callback) => {
            setTimeout(callback);
            return new MockSocket();
          }
        );
        const stream = createStream({
          ssl_enable: true,
          max_connect_retries: 1,
          retry_interval: 1
        });

        const streamEmitStub = sandbox.stub(stream, 'emit');
        stream.connecting = false;
        stream.retries = 0;
        stream.socket.dispatchEvent('close');
        expect(streamEmitStub.withArgs('close').callCount).to.equal(1);
        expect(stream).to.not.have.property('silent');

        sandbox.stub(stream, 'connect').callsFake(done);
      });

      it('Should hanlde close event when retries are still possible but it\'s already connecting', done => {
        sandbox.stub(tls, 'connect').callsFake(
          (port, host, options, callback) => {
            setTimeout(callback);
            return new MockSocket();
          }
        );
        const stream = createStream({
          ssl_enable: true,
          max_connect_retries: 1,
          retry_interval: 1
        });

        const streamEmitStub = sandbox.stub(stream, 'emit');
        stream.connecting = true;
        stream.retries = 0;
        stream.socket.dispatchEvent('close');
        expect(streamEmitStub.withArgs('close').callCount).to.equal(1);
        expect(stream).to.not.have.property('silent');
        const connectStub = sandbox.stub(stream, 'connect');
        setTimeout(() => {
          expect(connectStub.callCount).to.equal(0);
          done();
        }, 10);
      });

      it('Should hanlde close event when no more retries are available', () => {
        sandbox.stub(tls, 'connect').callsFake(
          (port, host, options, callback) => {
            setTimeout(callback);
            return new MockSocket();
          }
        );
        const stream = createStream({
          ssl_enable: true,
          max_connect_retries: 1,
          retry_interval: 0
        });

        const streamEmitStub = sandbox.stub(stream, 'emit');
        stream.connecting = false;
        stream.retries = 1;

        const oldLogQueue = stream.log_queue;

        stream.socket.dispatchEvent('close');
        expect(streamEmitStub.withArgs('close').callCount).to.equal(1);

        expect(stream.log_queue !== oldLogQueue);
        expect(stream).to.have.property('silent', true);
      });
    });
    describe('flush', () => {
      it('Should send all messages and leave queue empty', () => {
        const stream = createStream();
        stream.log_queue.push({ message: 'a' });
        stream.log_queue.push({ message: 'b' });
        const sendStub = sandbox.stub(stream, 'sendLog');
        stream.flush();
        expect(sendStub.callCount).to.equal(2);
        expect(sendStub.withArgs('a').callCount).to.equal(1);
        expect(sendStub.withArgs('b').callCount).to.equal(1);
        expect(stream.log_queue).to.have.property('size', 0);
      });
    });
    describe('sendLog', () => {
      it('Should write log to the socket', () => {
        const stream = createStream();
        stream.sendLog('hello');
        expect(stream.socket.content).to.equal('hello\n');
      });
    });
    describe('send', () => {
      it('Should write log to the socket when connected', () => {
        const stream = createStream();
        stream.connected = true;
        const sendLogStub = sandbox.stub(stream, 'sendLog');
        stream.send('hello');
        expect(sendLogStub.callCount).to.equal(1);
        expect(sendLogStub.withArgs('hello').callCount).to.equal(1);
      });
    });
    describe('send', () => {
      it('Should store log in the queue when not connected', () => {
        const stream = createStream();
        stream.connected = false;
        const sendLogStub = sandbox.stub(stream, 'sendLog');
        stream.send('hello');
        expect(sendLogStub.callCount).to.equal(0);
        expect(stream.log_queue.pop()).to.eql({ message: 'hello' });
      });
    });
  });
});

