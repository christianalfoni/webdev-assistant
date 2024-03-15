// Inform the background page that
// this tab should have a page-action.
chrome.runtime.sendMessage({
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

function main() {
  try {
    let errors = [];
    const ws = new WebSocket("http://localhost:8999");

    function sendErrors() {
      if (!errors.length) {
        return;
      }

      const payload = JSON.stringify(errors);

      errors = [];

      ws.send(payload);
    }

    ws.addEventListener("open", sendErrors);

    window.addEventListener("error", (error) => {
      errors.push({
        message: error.message,
        stack: error.stack,
      });
    });
    window.addEventListener("unhandledrejection", function (error) {
      errors.push({
        message: error.message,
        stack: error.stack,
      });
    });
  } catch {}
}

main();
