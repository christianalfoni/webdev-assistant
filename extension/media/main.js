function el(tag, className) {
  const htmlEl = document.createElement(tag);

  if (className) {
    htmlEl.className = className;
  }

  return htmlEl;
}

function chatMessages() {
  const chatMessagesEl = el("div", "chat-messages");
  const pusherEl = el("div", "chat-messages-pusher");

  chatMessagesEl.appendChild(pusherEl);

  return chatMessagesEl;
}

function chatMessage(role, message) {
  const wrapperEl = el("div", "chat-message-wrapper");
  const avatarEl = el("div", "chat-message-avatar");
  const iconEl = el("img");

  iconEl.src =
    role === "assistant"
      ? "https://avatars.githubusercontent.com/u/4183342?s=96&v=4"
      : "https://avatars.githubusercontent.com/u/3956929?v=4";

  wrapperEl.appendChild(avatarEl);
  avatarEl.appendChild(iconEl);

  const textEl = el("div", "chat-message-text");
  textEl.innerHTML = message;

  wrapperEl.appendChild(textEl);

  return wrapperEl;
}

function newChatMessage(onSendMessage) {
  const wrapperEl = el("div", "chat-message-wrapper");
  const avatarEl = el("div", "chat-message-avatar");
  const iconEl = el("img");

  iconEl.src = "https://avatars.githubusercontent.com/u/3956929?v=4";

  wrapperEl.appendChild(avatarEl);
  avatarEl.appendChild(iconEl);

  const newChatMessageEl = el("textarea", "new-chat-message");

  newChatMessageEl.placeholder = "Please ask something...";
  newChatMessageEl.addEventListener("keydown", (event) => {
    if (event.metaKey && event.key === "Enter") {
      const messageValue = newChatMessageEl.value;

      newChatMessageEl.value = "";
      onSendMessage(messageValue);
    }
  });

  wrapperEl.appendChild(newChatMessageEl);

  return wrapperEl;
}

const root = document.getElementById("root");
const chatMessagesEl = chatMessages();
const newChatMessageEl = newChatMessage((message) => {
  chatMessagesEl.insertBefore(chatMessage("user", message), newChatMessageEl);
  vscode.postMessage({
    command: "assistant_request",
    text: message,
  });
});

chatMessagesEl.appendChild(chatMessage("assistant", "What can I do for you?"));

root.appendChild(chatMessagesEl);
chatMessagesEl.appendChild(newChatMessageEl);

// Handle messages sent from the extension to the webview
window.addEventListener("message", (event) => {
  const message = event.data; // The json data that the extension sent
  switch (message.type) {
    case "assistant_response":
      break;
    case "tool_request":
      break;
  }
});
