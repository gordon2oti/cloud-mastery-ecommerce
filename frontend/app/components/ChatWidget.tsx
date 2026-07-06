// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import OnboardingForm from "./OnboardingForm";
import { createSession } from "../api";

interface Session {
  sessionId: string;
  name: string;
  phone: string;
  location: string;
}

export default function ChatWidget() {
  const deploymentName = process.env.NEXT_PUBLIC_CHAT_DEPLOYMENT;
  const chatTitle = process.env.NEXT_PUBLIC_CHAT_TITLE || "Support Agent";
  const messengerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [chatReady, setChatReady] = useState(false);

  // Restore session from sessionStorage on page load
  useEffect(() => {
    const stored = sessionStorage.getItem("hazel-session");
    if (stored) {
      try {
        setSession(JSON.parse(stored));
        setChatReady(true);
      } catch {
        sessionStorage.removeItem("hazel-session");
      }
    }
  }, []);

  // Boot the chat messenger SDK once we have a session
  useEffect(() => {
    if (!deploymentName || !chatReady || !session) return;

    // Fix #3: Set attributes imperatively so TSX never silently drops them
    if (messengerRef.current) {
      messengerRef.current.setAttribute("url-allowlist", "*");
    }
    if (containerRef.current) {
      containerRef.current.setAttribute("chat-title", chatTitle);
      containerRef.current.setAttribute(
        "chat-title-icon",
        "https://gstatic.com/dialogflow-console/common/assets/ccai-favicons/conversational_agents.png"
      );
      containerRef.current.setAttribute("enable-file-upload", "true");
    }

    // Set session parameters as a JSON attribute directly on the element.
    // This is an alternative path the SDK reads BEFORE the JS API parameters key.
    if (messengerRef.current && session) {
      messengerRef.current.setAttribute(
        "parameters",
        JSON.stringify({
          sessionId: session.sessionId,
          customerName: session.name,
          customerPhone: session.phone,
          customerLocation: session.location,
        })
      );
    }

    // Register SDK context with session parameters so the agent knows who the user is
    const handleLoaded = () => {
      const chatSdk = (window as any).chatSdk;
      if (chatSdk) {
        chatSdk.registerContext(
          chatSdk.prebuilts.ces.createContext({
            deploymentName,
            tokenBroker: {
              enableTokenBroker: true,
              enableRecaptcha: false,
            },
            parameters: {
              sessionId: session.sessionId,
              customerName: session.name,
              customerPhone: session.phone,
              customerLocation: session.location,
            },
            enableWelcomeEvent: true,
          })
        );
      }

      // Shadow DOM style injection — the only reliable way to style inside a closed shadow root.
      // We watch for the shadow root to be populated then inject our brand stylesheet directly.
      injectShadowStyles();
    };

    const injectShadowStyles = () => {
      const el = messengerRef.current;
      if (!el) return;

      const tryInject = () => {
        const shadow = el.shadowRoot;
        if (!shadow) return false;

        // Avoid double-injecting
        if (shadow.querySelector("#hazel-market-styles")) return true;

        const style = document.createElement("style");
        style.id = "hazel-market-styles";
        style.textContent = `
          /* ── Hazel Market brand overrides injected into shadow root ── */

          /* Titlebar */
          .titlebar, [class*="titlebar"], chat-messenger-titlebar,
          .chat-header, [class*="header"] {
            background-color: #9a7a66ff !important;
            color: #ffffff !important;
          }

          /* Primary button / send button */
          button[class*="send"], button[class*="submit"],
          [class*="send-button"], [class*="primary-button"] {
            background-color: #4a3b32 !important;
            color: #ffffff !important;
            border-color: #a67455ff !important;
          }

          /* User message bubbles */
          [class*="user-message"], [class*="human-message"],
          [class*="outgoing"] {
            background-color: #5a7054 !important;
            color: #ffffff !important;
          }

          /* Bot message bubbles */
          [class*="bot-message"], [class*="agent-message"],
          [class*="incoming"], [class*="model-message"] {
            background-color: #f5f1ee !important;
            color: #38414cff !important;
          }

          /* Input area */
          [class*="input-area"], [class*="input-container"],
          [class*="composer"] {
            border-top-color: #d6cfc9 !important;
          }

          input, textarea {
            color: #1f2937 !important;
          }

          /* Active/focus accents */
          [class*="active"], *:focus {
            outline-color: #4a3b32 !important;
          }
        `;
        shadow.appendChild(style);
        return true;
      };

      // Try immediately, then watch for shadow root population via MutationObserver
      if (!tryInject()) {
        const observer = new MutationObserver(() => {
          if (tryInject()) observer.disconnect();
        });
        observer.observe(el, { childList: true, subtree: true });
        // Clean up after 10 s to avoid leaks if shadow never populates
        setTimeout(() => observer.disconnect(), 10000);
      }
    };

    // ── df-response-received: capture the agent's Dialogflow CX session ID ──────
    // The first (and every) agent response carries the full session resource path:
    //   "projects/.../sessions/<sessionId>"
    // We extract the short ID and use it as the cart key in the Python service
    // (matching what the agent passes as $context.session_id to its tool calls).
    const handleAgentResponse = async (event: CustomEvent) => {
      // Already linked — skip
      if (sessionStorage.getItem("agent-session-id")) return;

      // Try both the element event and bubbled window event shapes
      const sessionPath =
        event.detail?.response?.session ||
        event.detail?.response?.queryResult?.diagnosticInfo?.session;
      if (!sessionPath) return;

      // Extract "abc123" from "projects/.../sessions/abc123"
      const agentSessionId = sessionPath.split("/sessions/").pop();
      if (!agentSessionId) return;

      sessionStorage.setItem("agent-session-id", agentSessionId);
      console.debug("[ChatWidget] Agent session ID captured:", agentSessionId);

      // Re-register form data under the agent session ID so the Python service
      // can return name/phone/location when the agent calls GET /session/{id}
      if (session) {
        try {
          await createSession({
            sessionId: agentSessionId,
            name: session.name,
            phone: session.phone,
            location: session.location,
          });
        } catch (e) {
          console.warn("[ChatWidget] Failed to link session data:", e);
        }
      }
    };

    const el = messengerRef.current;
    if (el) el.addEventListener("df-response-received", handleAgentResponse);
    window.addEventListener("df-response-received", handleAgentResponse);

    // Race-condition guard: if script already loaded before this effect ran
    if ((window as any).chatSdk) {
      handleLoaded();
    } else {
      window.addEventListener("chat-messenger-loaded", handleLoaded);
    }

    return () => {
      window.removeEventListener("chat-messenger-loaded", handleLoaded);
      if (el) el.removeEventListener("df-response-received", handleAgentResponse);
      window.removeEventListener("df-response-received", handleAgentResponse);
    };
  }, [deploymentName, chatReady, session]);

  // Handler called by OnboardingForm on successful submit
  const handleFormComplete = (newSession: Session) => {
    setSession(newSession);
    setChatReady(true);
  };

  // Widget is invisible until deployment name is set in .env
  if (!deploymentName) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 99999,
        width: "400px",
        height: "560px",
        maxHeight: "560px",
        overflow: "hidden",
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(74,59,50,0.18)",
      }}
    >
      {!chatReady ? (
        <OnboardingForm onComplete={handleFormComplete} />
      ) : (
        <chat-messenger
          ref={messengerRef}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            "--chat-messenger-color--primary": "#4a3b32",
            "--chat-messenger-color--on-primary": "#ffffff",
            "--chat-messenger-color--primary-container": "#c4a898",
            "--chat-messenger-color--on-primary-container": "#3d2b22",
            "--chat-messenger-color--secondary": "#927b70",
            "--chat-messenger-color--on-secondary": "#ffffff",
            "--chat-messenger-color--surface": "#eeeae6",
            "--chat-messenger-color--surface-container": "#eeeae6",
            "--chat-messenger-color--surface-container-high": "#e0dbd6",
            "--chat-messenger-color--on-surface": "#38414c",
            "--chat-messenger-color--on-surface-variant": "#6b7280",
            "--chat-messenger-color--outline": "#d6cfc9",
            "--chat-messenger-color--outline-variant": "#e8e4e1",
            "--chat-messenger-color--link": "#4a3b32",
            "--chat-messenger-internal-chat-window-width": "400px",
            "--chat-messenger-internal-chat-window-height": "560px",
          }}
        >
          <chat-messenger-container ref={containerRef}>
            <chat-reset-session-button
              slot="titlebar-actions"
              title-text="Start new chat"
            ></chat-reset-session-button>
            <chat-messenger-close-button
              slot="titlebar-actions"
              title-text="Close"
            ></chat-messenger-close-button>
          </chat-messenger-container>
        </chat-messenger>
      )}
    </div>
  );
}
