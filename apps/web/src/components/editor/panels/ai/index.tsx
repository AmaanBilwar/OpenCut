"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect, useState } from "react";
import { SendIcon, CircleIcon } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { EditorCore } from "@/core";
import { generateUUID } from "@/utils/id";
import type { CreateTextElement } from "@/lib/timeline";

type AddElementInput = {
  type: "text" | "video" | "image" | "audio" | "sticker" | "graphic";
  content?: string;
  startTime: number;
  duration?: number;
  trackId?: string;
};

type UpdateElementInput = {
  trackId: string;
  elementId: string;
  properties: {
    startTime?: number;
    duration?: number;
    trimStart?: number;
    trimEnd?: number;
    opacity?: number;
    scale?: number;
    positionX?: number;
    positionY?: number;
    content?: string;
    fontSize?: number;
    color?: string;
  };
};

type DeleteElementsInput = {
  elements: { trackId: string; elementId: string }[];
};

type PlaybackInput = {
  action: "play" | "pause" | "toggle" | "seek" | "stop";
  time?: number;
};

export function AIPanel() {
  const { messages, sendMessage, status, stop, addToolOutput } = useChat({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return;

      const editor = EditorCore.getInstance();

      if (toolCall.toolName === "getState") {
        const what = (toolCall.input as { what?: string })?.what ?? "all";

        let output: object;
        switch (what) {
          case "tracks": {
            output = { tracks: editor.scenes.getActiveSceneOrNull()?.tracks };
            break;
          }
          case "selection": {
            output = {
              elements: editor.selection.getSelectedElements(),
              keyframes: editor.selection.getSelectedKeyframes(),
            };
            break;
          }
          case "playback": {
            output = {
              currentTime: editor.playback.getCurrentTime(),
              isPlaying: editor.playback.getIsPlaying(),
              volume: editor.playback.getVolume(),
              muted: editor.playback.isMuted(),
              duration: editor.timeline.getTotalDuration(),
            };
            break;
          }
          case "all":
          default: {
            output = {
              tracks: editor.scenes.getActiveSceneOrNull()?.tracks,
              selection: {
                elements: editor.selection.getSelectedElements(),
                keyframes: editor.selection.getSelectedKeyframes(),
              },
              playback: {
                currentTime: editor.playback.getCurrentTime(),
                isPlaying: editor.playback.getIsPlaying(),
                duration: editor.timeline.getTotalDuration(),
              },
            };
            break;
          }
        }

        addToolOutput({
          tool: "getState",
          toolCallId: toolCall.toolCallId,
          output,
        });
      }

      if (toolCall.toolName === "addElement") {
        const input = toolCall.input as AddElementInput;
        const duration = input.duration ?? 5;

        let element: CreateTextElement;

        switch (input.type) {
          case "text": {
            element = {
              name: input.content ?? "Text",
              type: "text",
              content: input.content ?? "New Text",
              startTime: input.startTime,
              duration,
              trimStart: 0,
              trimEnd: duration,
              fontSize: 72,
              fontFamily: "Inter",
              color: "#FFFFFF",
              background: { enabled: false, color: "#000000" },
              textAlign: "center" as const,
              fontWeight: "normal" as const,
              fontStyle: "normal" as const,
              textDecoration: "none" as const,
              transform: {
                scaleX: 1,
                scaleY: 1,
                position: { x: 0, y: 0 },
                rotate: 0,
              },
              opacity: 1,
              effects: [],
            };
            break;
          }
          case "video":
          case "image":
          case "audio":
          case "sticker":
          case "graphic": {
            addToolOutput({
              tool: "addElement",
              toolCallId: toolCall.toolCallId,
              state: "output-error",
              errorText: `${input.type} elements require a media source. Please import media first, then use the selection to add effects or modify existing elements.`,
            });
            return;
          }
          default: {
            addToolOutput({
              tool: "addElement",
              toolCallId: toolCall.toolCallId,
              state: "output-error",
              errorText: `Unknown element type: ${input.type}`,
            });
            return;
          }
        }

        const placement = input.trackId
          ? { mode: "explicit" as const, trackId: input.trackId }
          : { mode: "auto" as const };

        editor.timeline.insertElement({ element, placement });

        addToolOutput({
          tool: "addElement",
          toolCallId: toolCall.toolCallId,
          output: { success: true, type: input.type, startTime: input.startTime, duration },
        });
      }

      if (toolCall.toolName === "updateElement") {
        const input = toolCall.input as UpdateElementInput;
        const { trackId, elementId, properties } = input;

        editor.timeline.updateElements({
          updates: [{ trackId, elementId, patch: properties }],
        });

        addToolOutput({
          tool: "updateElement",
          toolCallId: toolCall.toolCallId,
          output: { success: true },
        });
      }

      if (toolCall.toolName === "deleteElements") {
        const input = toolCall.input as DeleteElementsInput;
        const { elements } = input;

        editor.timeline.deleteElements({ elements });

        addToolOutput({
          tool: "deleteElements",
          toolCallId: toolCall.toolCallId,
          output: { success: true, deletedCount: elements.length },
        });
      }

      if (toolCall.toolName === "playback") {
        const input = toolCall.input as PlaybackInput;
        const { action, time } = input;

        switch (action) {
          case "play":
            editor.playback.play();
            break;
          case "pause":
            editor.playback.pause();
            break;
          case "toggle":
            editor.playback.toggle();
            break;
          case "seek":
            if (time !== undefined) {
              editor.playback.seek({ time });
            }
            break;
          case "stop":
            editor.playback.pause();
            editor.playback.seek({ time: 0 });
            break;
        }

        addToolOutput({
          tool: "playback",
          toolCallId: toolCall.toolCallId,
          output: {
            success: true,
            action,
            currentTime: editor.playback.getCurrentTime(),
            isPlaying: editor.playback.getIsPlaying(),
          },
        });
      }
    },
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="panel flex h-full flex-col overflow-hidden rounded-sm border bg-background">
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground">Ask me anything...</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-4 ${
                msg.role === "user" ? "text-right" : "text-left"
              }`}
            >
              {msg.role === "user" ? (
                <div className="inline-block max-w-[80%] rounded-lg bg-primary px-4 py-2 text-primary-foreground">
                  {msg.parts
                    ?.filter((p) => p.type === "text")
                    .map((p) => p.text)
                    .join("")}
                </div>
              ) : (
                <div className="inline-block max-w-[80%] rounded-lg bg-muted px-4 py-2">
                  <Markdown>
                    {msg.parts
                      ?.filter((p) => p.type === "text")
                      .map((p) => p.text)
                      .join("")}
                  </Markdown>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
        {status === "streaming" || status === "submitted" ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-md bg-destructive px-3 py-2 text-destructive-foreground"
          >
            <CircleIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-2 text-primary-foreground"
            disabled={!input.trim()}
          >
            <SendIcon className="h-4 w-4" />
          </button>
        )}
      </form>
    </div>
  );
}