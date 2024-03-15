// Inform the background page that
// this tab should have a page-action.
/*chrome.runtime.sendMessage({
  from: "content",
  subject: "showPageAction",
});

// Listen for messages from the popup.
chrome.runtime.onMessage.addListener((msg, sender, response) => {
  // First, validate the message's structure.
  if (msg.from === "popup" && msg.subject === "DOMInfo") {
    // Collect the necessary data.
    // (For your specific requirements `document.querySelectorAll(...)`
    //  should be equivalent to jquery's `$(...)`.)
    var domInfo = {
      total: document.querySelectorAll("*").length,
      inputs: document.querySelectorAll("input").length,
      buttons: document.querySelectorAll("button").length,
    };

    // Directly respond to the sender (popup),
    // through the specified callback.
    response(domInfo);
  }
});
*/

function main() {
  try {
    let errors = [];
    const ws = new WebSocket("ws://localhost:8999");

    function sendErrors() {
      console.log("Sending errors", ws);
      if (!errors.length) {
        return;
      }

      const payload = JSON.stringify({
        type: "errors",
        errors,
      });

      errors = [];

      try {
        ws.send(payload);
      } catch {}
    }

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          type: "loaded",
        })
      );
      sendErrors();
    });

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
      console.log("Async error", error.stack, error);
      errors.push({
        message: error.message,
        stack: error.stack,
      });
      sendErrors();
    });
    console.log("CONNECETED!!!");
  } catch (error) {
    console.log("ERROR!!!", error);
  }
}

main();
