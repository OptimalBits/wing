Wing
====

Socket.io with wings.

Provides the observe pattern for distributed clients and services.
Wraps socket.io and redis pub/sub for super easy usage with built
in authentication, session support and  middleware for express
and angular directives.

Best way to explain its use is with an example:

```javascript
//
// Client
// Observe document 1234 on collection medias.
wing.observe('/medias/1234').on('change', function(keypath, doc))
  
}).on('error', function(err){
  console.log(err);
})

//
// update will trigger all observers but the one updating.
//
wing.update('/medias/1234', {name: "my super name"});

wing.unobserve('/medias/1234');

//
// Server
//
var wing = Wing(socketIo, redisOpts);

//
// Make a keypath observable (needed?, maybe for having rights on it.)
//
wing.observable('/medias/:id', function(session, keyPath){
  
  // This callback is called when a client request to observe the given resource.
  return true;
});

wing.observable('/campaigns/:id');
wing.observable('/funds/:id');


//
// update will trigger all observers but the one updating.
//
wing.update('/medias/1234', {progress: 30});


//
// API.
//
wing.uuid(); // Generates a global unique uuid that can be used by clients or servers.
```
