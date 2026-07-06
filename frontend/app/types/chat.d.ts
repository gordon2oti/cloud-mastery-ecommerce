export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "chat-messenger": any;
      "chat-messenger-container": any;
      "chat-reset-session-button": any;
      "chat-messenger-close-button": any;
    }
  }
}
