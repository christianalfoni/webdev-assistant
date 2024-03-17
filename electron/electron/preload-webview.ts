// @ts-ignore
let errors = [];
// const ws = new WebSocket("ws://localhost:8999");

function sendErrors() {
  // @ts-ignore
  console.log(errors);
  if (!errors.length) {
    return;
  }

  const payload = JSON.stringify({
    type: "errors",
    // @ts-ignore
    errors,
  });

  errors = [];

  try {
    // @ts-ignore
    console.log(errors);
    //ws.send(payload);
  } catch {}
}

try {
  /*
  ws.addEventListener("open", () => {
    ws.send(
      JSON.stringify({
        type: "loaded",
      })
    );
    sendErrors();
  });
  */

  const originParse = window.JSON.parse;
  window.JSON.parse = (...args) => {
    try {
      return originParse.apply(window.JSON, args);
    } catch (error) {
      console.log("HEYHEY", error);
      errors.push({
        message: error.message,
        stack: error.stack,
      });
      sendErrors();
      throw error;
    }
  };

  const originFetch = window.fetch;
  window.fetch = (...args) => {
    // @ts-ignore
    return originFetch.apply(window, args).then((response) => {
      return new Proxy(response, {
        get(target, prop) {
          if (prop === "json") {
            // @ts-ignore
            return (...args) => {
              // @ts-ignore
              return target[prop](...args).catch((error) => {
                errors.push({
                  message: error.message,
                  stack: error.stack,
                });
                sendErrors();
                throw error;
              });
            };
          }

          return target[prop];
        },
      });
    });
  };

  const originOnError = window.onerror;
  window.onerror = (...args) => {
    try {
      errors.push({
        message: args[4].message,
        stack: args[4].stack,
      });
      sendErrors();
    } catch {
      // Invalid browser environment
    }

    originOnError && originOnError.apply(window, args);
  };

  window.addEventListener("unhandledrejection", function (error) {
    errors.push({
      // @ts-ignore
      message: error.message,
      // @ts-ignore
      stack: error.stack,
    });
    sendErrors();
  });
} catch (error) {
  console.log("ERROR!!!", error);
}
