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
  const skipNextAssistantMessageRef = useRef(false);
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

    const tryArmSkipFromBody = (bodyValue: unknown) => {
      if (!bodyValue || typeof bodyValue !== "string") return;
      if (bodyValue.toLowerCase().includes("view cart total")) {
        skipNextAssistantMessageRef.current = true;
      }
    };

    const skipFirstAssistantText = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return payload;

      const mutable = payload as Record<string, unknown>;
      let skipped = false;

      const outputs = Array.isArray(mutable.outputs) ? (mutable.outputs as Record<string, unknown>[]) : [];
      for (const output of outputs) {
        if (skipped) break;
        if (typeof output.text === "string" && output.text.trim()) {
          output.text = "";
          skipped = true;
        }
      }

      if (!skipped) {
        const diagnosticInfo = mutable.diagnosticInfo;
        if (diagnosticInfo && typeof diagnosticInfo === "object") {
          const messages = Array.isArray((diagnosticInfo as Record<string, unknown>).messages)
            ? ((diagnosticInfo as Record<string, unknown>).messages as Record<string, unknown>[])
            : [];

          for (const message of messages) {
            if (skipped) break;
            const role = typeof message.role === "string" ? message.role.toLowerCase() : "";
            if (!role.includes("agent")) continue;

            const chunks = Array.isArray(message.chunks) ? (message.chunks as Record<string, unknown>[]) : [];
            for (const chunk of chunks) {
              if (typeof chunk.text === "string" && chunk.text.trim()) {
                chunk.text = "";
                skipped = true;
                break;
              }
            }
          }
        }
      }

      return mutable;
    };

    window.fetch = async (...args) => {
      const [resource, options] = args;
      const url = typeof resource === "string" ? resource : (resource as any)?.url;

      if (url && (url.includes(":runSession") || url.includes(":converseConversation") || url.includes(":detectIntent"))) {
        try {
          const match = url.match(/\/sessions\/([^:]+):/);
          if (match && match[1]) {
            const agentSessionId = match[1];

            if (sessionStorage.getItem("agent-session-id") !== agentSessionId) {
              sessionStorage.setItem("agent-session-id", agentSessionId);
              console.debug("[ChatWidget] Intercepted agent session ID from URL:", agentSessionId);

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
                  }).catch(e => console.warn("[ChatWidget] Failed to sync session to Python backend", e));
                }
              }
            }
          }
        } catch {
          // Ignore errors
        }
      }

      const isCesRunSession =
        typeof url === "string" &&
        url.includes("ces.googleapis.com") &&
        (url.includes(":runSession") || url.includes(":converseConversation") || url.includes(":detectIntent"));

      if (isCesRunSession) {
        try {
          if (typeof options?.body === "string") {
            tryArmSkipFromBody(options.body);
          }

          if (typeof Request !== "undefined" && resource instanceof Request) {
            const requestBody = await resource.clone().text();
            tryArmSkipFromBody(requestBody);
          }
        } catch {
          // Ignore request body read errors
        }
      }

      const response = await originalFetch(...args);

      if (!isCesRunSession) {
        return response;
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/json")) {
        return response;
      }

      try {
        const payload = await response.clone().json();
        const shouldSkip = skipNextAssistantMessageRef.current;
        if (shouldSkip) {
          skipNextAssistantMessageRef.current = false;
        }

        const sanitized = shouldSkip ? skipFirstAssistantText(payload) : payload;

        return new Response(JSON.stringify(sanitized), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        return response;
      }
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
        "https://gstatic.com/dialogflow-console/common/assets/ccai-favicons/conversational_agents.png"
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
        })
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
          })
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

  if (!deploymentName) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        zIndex: 99999,
        width: isFolded ? "56px" : "min(400px, calc(100vw - 24px))",
        height: isFolded ? "56px" : "min(560px, calc(100vh - 24px))",
        maxHeight: isFolded ? "56px" : "min(560px, calc(100vh - 24px))",
        overflow: "hidden",
        background: "#eeeae6",
        borderRadius: isFolded ? "9999px" : "28px",
        transformOrigin: "bottom right",
        boxShadow: isFolded ? "0 4px 12px rgba(74,59,50,0.15)" : "0 8px 32px rgba(74,59,50,0.18)",
        transition: "width 0.36s cubic-bezier(0.25, 0.8, 0.25, 1), height 0.36s cubic-bezier(0.25, 0.8, 0.25, 1), border-radius 0.18s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.36s cubic-bezier(0.25, 0.8, 0.25, 1)",
      }}
    >
      <button
        onClick={() => setIsFolded(!isFolded)}
        style={{
          position: "absolute",
          left: isFolded ? "16px" : "14px",
          top: isFolded ? "16px" : "13px",
          zIndex: 100000,
          background: isFolded ? "rgba(74, 59, 50, 0.08)" : "rgba(255, 255, 255, 0.15)",
          border: "none",
          borderRadius: "6px",
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: isFolded ? "#4a3b32" : "#898989",
          transition: "background 0.2s, transform 0.3s",
        }}
        title={isFolded ? "Expand Agent" : "Collapse Agent"}
        aria-label={isFolded ? "Expand Agent" : "Collapse Agent"}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isFolded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s",
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

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
              display: "block",
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
    </div>
  );
}