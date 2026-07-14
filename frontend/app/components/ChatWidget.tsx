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
  const OPEN_ANIMATION_MS = 360;
  const deploymentName = process.env.NEXT_PUBLIC_CHAT_DEPLOYMENT;
  const chatTitle = process.env.NEXT_PUBLIC_CHAT_TITLE || "Support Agent";
  const messengerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [chatReady, setChatReady] = useState(false);
  const [isFolded, setIsFolded] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(true);

  useEffect(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    if (isFolded) {
      setIsContentVisible(false);
      return;
    }

    openTimerRef.current = setTimeout(() => {
      setIsContentVisible(true);
      openTimerRef.current = null;
    }, OPEN_ANIMATION_MS);

    return () => {
      if (openTimerRef.current) {
        clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
    };
  }, [isFolded]);

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

  // Intercept window.fetch to capture the true session ID
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const [resource] = args;
      const url =
        typeof resource === "string" ? resource : (resource as any)?.url;

      if (
        url &&
        (url.includes(":runSession") ||
          url.includes(":converseConversation") ||
          url.includes(":detectIntent"))
      ) {
        try {
          const match = url.match(/\/sessions\/([^:]+):/);
          if (match && match[1]) {
            const agentSessionId = match[1];

            if (sessionStorage.getItem("agent-session-id") !== agentSessionId) {
              sessionStorage.setItem("agent-session-id", agentSessionId);
              console.debug(
                "[ChatWidget] Intercepted agent session ID from URL:",
                agentSessionId,
              );

              window.dispatchEvent(new Event("hazel-session-changed"));

              const storedStr = sessionStorage.getItem("hazel-session");
              if (storedStr) {
                const stored = JSON.parse(storedStr);
                if (stored.name) {
                  await createSession({
                    sessionId: agentSessionId,
                    name: stored.name,
                    phone: stored.phone,
                    location: stored.location,
                  }).catch((e) =>
                    console.warn(
                      "[ChatWidget] Failed to sync session to Python backend",
                      e,
                    ),
                  );
                }
              }
            }
          }
        } catch {
          // Ignore errors
        }
      }

      return originalFetch(...args);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Boot the chat messenger SDK once we have a session
  useEffect(() => {
    if (!deploymentName || !chatReady || !session) return;

    if (messengerRef.current) {
      messengerRef.current.setAttribute("url-allowlist", "*");
    }
    if (containerRef.current) {
      containerRef.current.setAttribute("chat-title", chatTitle);
      containerRef.current.setAttribute(
        "chat-title-icon",
        "https://gstatic.com/dialogflow-console/common/assets/ccai-favicons/conversational_agents.png",
      );
      containerRef.current.setAttribute("enable-file-upload", "true");
    }

    if (messengerRef.current && session) {
      messengerRef.current.setAttribute(
        "parameters",
        JSON.stringify({
          sessionId: session.sessionId,
          customerName: session.name,
          customerPhone: session.phone,
          customerLocation: session.location,
        }),
      );
    }

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
            enableWelcomeEvent: true,
          }),
        );
      }

      injectShadowStyles();
    };

    const injectShadowStyles = () => {
      const el = messengerRef.current;
      if (!el) return;

      const tryInject = () => {
        const shadow = el.shadowRoot;
        if (!shadow) return false;
        if (shadow.querySelector("#hazel-market-styles")) return true;

        const style = document.createElement("style");
        style.id = "hazel-market-styles";
        style.textContent = `
          /* ── Injecting Documentation Tokens directly to Shadow Host ── */
          :host, * {
            --chat-messenger-font-family: 'Google Sans', sans-serif !important;
            
            /* Containers / Surfaces */
            --chat-messenger-color--surface: #eeeae6 !important;
            --chat-messenger-color--surface-container: #eeeae6 !important;
            --chat-messenger-color--surface-container-high: #e0dbd6 !important;
            
            /* Brand / Accent */
            --chat-messenger-color--primary: #4a3b32 !important;
            --chat-messenger-color--primary-container: #c4a898 !important;
            --chat-messenger-color--secondary: #927b70 !important;
            
            /* Text & Icons */
            --chat-messenger-color--on-surface: #38414c !important;
            --chat-messenger-color--on-surface-variant: #6b7280 !important;
            --chat-messenger-color--on-primary: #ffffff !important;
            --chat-messenger-color--on-primary-container: #3d2b22 !important;
            --chat-messenger-color--on-secondary: #ffffff !important;
            
            /* Utility */
            --chat-messenger-color--outline: #d6cfc9 !important;
            --chat-messenger-color--outline-variant: #e8e4e1 !important;
            --chat-messenger-color--link: #4a3b32 !important;
            
            /* Shape & Structural Configuration */
            --chat-messenger-shape--corner-value-extra-large: 16px !important;
          }

          /* Structural Deep Overrides if internal component code locks out host tokens */
          .titlebar, [class*="titlebar"], chat-messenger-titlebar {
            background-color: #4a3b32 !important;
            color: #ffffff !important;
            padding-left: 48px !important;
          }

          button[class*="send"], [class*="send-button"] {
            background-color: #4a3b32 !important;
            color: #ffffff !important;
          }

          input, textarea {
            color: #38414c !important;
          }
        `;
        shadow.appendChild(style);
        return true;
      };

      if (!tryInject()) {
        const observer = new MutationObserver(() => {
          if (tryInject()) observer.disconnect();
        });
        observer.observe(el, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 10000);
      }
    };

    if ((window as any).chatSdk) {
      handleLoaded();
    } else {
      window.addEventListener("chat-messenger-loaded", handleLoaded);
    }

    return () => {
      window.removeEventListener("chat-messenger-loaded", handleLoaded);
    };
  }, [deploymentName, chatReady, session, chatTitle]);

  const handleFormComplete = (newSession: Session) => {
    setSession(newSession);
    setChatReady(true);
  };

  // Sync CES titlebar close action with local fold state.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContainerClick = (event: Event) => {
      const path =
        typeof event.composedPath === "function" ? event.composedPath() : [];
      const clickedCloseButton = path.some((node) => {
        return (
          node instanceof HTMLElement &&
          node.tagName.toLowerCase() === "chat-messenger-close-button"
        );
      });

      if (clickedCloseButton) {
        setIsFolded(true);
      }
    };

    container.addEventListener("click", handleContainerClick, true);
    return () => {
      container.removeEventListener("click", handleContainerClick, true);
    };
  }, [chatReady]);

  if (!deploymentName) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        zIndex: 99999,
        width: isFolded ? "56px" : "min(400px, calc(100vw - 24px))",
        height: isFolded ? "56px" : "500px",
        maxHeight: isFolded ? "56px" : "500px",
        overflow: "hidden",
        background: "#eeeae6",
        borderRadius: isFolded ? "9999px" : "28px",
        transformOrigin: "bottom right",
        boxShadow: isFolded
          ? "0 4px 12px rgba(74,59,50,0.15)"
          : "0 8px 32px rgba(74,59,50,0.18)",
        transition:
          "width 0.36s cubic-bezier(0.25, 0.8, 0.25, 1), height 0.36s cubic-bezier(0.25, 0.8, 0.25, 1), border-radius 0.18s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.36s cubic-bezier(0.25, 0.8, 0.25, 1)",
      }}
    >
      <div className="relative">
        <button
          onClick={() => setIsFolded(!isFolded)}
          style={{
            position: "absolute",
            left: isFolded ? "16px" : "0px",
            top: isFolded ? "16px" : "22px",
            zIndex: 100000,
            background: isFolded
              ? "rgba(255, 255, 255, 0.15)"
              : "rgba(255, 255, 255, 0.15)",
            border: "none",
            borderRadius: "6px",
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: isFolded ? "#4a3b32" : "#898989",
            transition: "background 0.2s, transform 0.9s",
          }}
          title={isFolded ? "Expand Agent" : "Collapse Agent"}
          aria-label={isFolded ? "Expand Agent" : "Collapse Agent"}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isFolded ? "none" : "rotate(0deg)",
              transition: "transform 0.3s",
            }}
          >
            {isFolded ? (
              <>
                <path d="M21 11.5C21 16.19 16.97 20 12 20C10.61 20 9.28 19.7 8.1 19.15L4 20L4.9 16.49C3.72 15.09 3 13.36 3 11.5C3 6.81 7.03 3 12 3C16.97 3 21 6.81 21 11.5Z" />
                <circle
                  cx="9"
                  cy="11.5"
                  r="0.7"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="12"
                  cy="11.5"
                  r="0.7"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="15"
                  cy="11.5"
                  r="0.7"
                  fill="currentColor"
                  stroke="none"
                />
              </>
            ) : (
              <polyline className="" points="8,11 12,15 16,11"></polyline>
            )}
          </svg>
        </button>
      </div>

      <div
        style={{
          width: "100%",
          height: "100%",
          opacity: isContentVisible ? 1 : 0,
          visibility: isContentVisible ? "visible" : "hidden",
          pointerEvents: isContentVisible ? "auto" : "none",
          transition: "opacity 0.18s ease",
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
              transform: "none",
              display: "block",
              position: "relative",
              inset: "auto",
              clipPath: "none",
            }}
          >
            <div></div>
            <chat-messenger-container ref={containerRef}>
              <chat-reset-session-button
                slot="titlebar-actions"
                title-text="Start new chat"
              ></chat-reset-session-button>
              <chat-messenger-close-button
                slot="titlebar-actions"
                title-text="Close"
              ></chat-messenger-close-button>
              <div>
                
              </div>
            </chat-messenger-container>
          </chat-messenger>
        )}
      </div>
    </div>
  );
}
