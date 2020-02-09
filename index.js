"use strict";

var redis = require("redis");
var bunyan = require("bunyan");
var _ = require("lodash");

var logger = bunyan.createLogger({ name: "wing" });

var UPDATE_CHANNEL = "wing:update:";

var WingServer = function WingServer(socketIo, redisOpts) {
  if (!(this instanceof WingServer)) {
    return new WingServer(socketIo, redisOpts);
  }

  redisOpts = redisOpts || {};
  redisOpts.port = redisOpts.port || 6379;
  redisOpts.host = redisOpts.host || "127.0.0.1";

  //
  // Create 2 redis connections, one to subscribe and the other to publish messages
  //
  this.pubClient = redis.createClient(
    redisOpts.port,
    redisOpts.host,
    redisOpts
  );
  var subClient = redis.createClient(redisOpts.port, redisOpts.host, redisOpts);

  socketIo.on("connection", function(socket) {
    logger.info("Socket %s connected.", socket.id);

    // socket.on('observe', (keyPath: string[], cb:(err?: Error) => void) => {
    socket.on("observe", function(keyPath, cb) {
      logger.info("Socket %s start observing keypath %s", socket.id, keyPath);

      if (!Array.isArray(keyPath)) {
        var err = Error("keyPath must be a string[]");
        logger.error(err);
        cb && cb(err);
      } else {
        var id = makeId(keyPath);

        //
        // Here we could call a middleware to see if this particular socket.id has rights
        // to observe this keypath.
        // checkRights(socket.id, keyPath);
        //
        if (true) {
          socket.join(id);
          logger.info(
            "Socket %s started synchronization for id:%s",
            socket.id,
            keyPath
          );
        }
        cb && cb(err);
      }
    });

    socket.on("unobserve", function(keyPath, cb) {
      var id = makeId(keyPath);
      socket.leave(id);
      logger.info("Socket %s stopped synchronization for id:%s", socket.id, id);
      cb && cb();
    });

    socket.emit("ready");
  });

  subClient.subscribe(UPDATE_CHANNEL);

  subClient.on("message", function(channel, msg) {
    var args;
    try {
      args = JSON.parse(msg);
    } catch (err) {
      logger.error(err);
    }

    if (!_.isArray(args.keyPath)) {
      logger.error("Error: keyPath must be an array:", args.keyPath);
      return;
    }

    var id = makeId(args.keyPath);
    var clientId = args.clientId;

    //var room = sio.in(id).except(args.clientId);
    logger.info("About to emit: ", channel, args);
    switch (channel) {
      case UPDATE_CHANNEL:
        emitExcept(socketIo, id, clientId, "update:", args.keyPath, args.doc);

        //this.emit('update', _.initial(args.keyPath), args.keyPath, args.doc);
        break;
      default:
        logger.error("Invalid channel %", channel);
    }
  });
};

/**
  Sends an update notification to all relevant observers.
    
  @method update
  @param clientId {String} clientId performing the update (use null if not
      relevant)
  @param keyPath {String[]} key path pointing to the document that was updated.
  @param doc {Object} Plain object with the changed values for the given properties.
*/
WingServer.prototype.update = function(clientId, keyPath, doc) {
  var args = {
    keyPath: keyPath,
    doc: doc,
    clientId: clientId
  };

  this.pubClient.publish(UPDATE_CHANNEL, JSON.stringify(args));
};

var makeId = function(keyPath) {
  return keyPath.join(":");
};

var makeEvent = function(evt, keyPath) {
  var arr = [evt];
  arr.concat(keyPath);
  return makeId(arr);
};

//
// Workaround since socket.io does not support "except" anymore.
// https://github.com/Automattic/socket.io/issues/1595
//
function emitExcept(ns, room, socketId) {
  var socket;

  var args = _.drop(arguments, 3);

  //ns.emit.apply(ns, args);

  if (socketId) {
    socket = ns.connected[socketId];
  }
  // io.to('some room').emit('some event'):

  if (socket) {
    socket.leave(room, function() {
      var emitter = ns.in(room);
      emitter.emit.apply(emitter, args);
      socket.join(room);
    });
  } else {
    var emitter = ns.in(room);
    emitter.emit.apply(emitter, args);
  }
}

module.exports = WingServer;
