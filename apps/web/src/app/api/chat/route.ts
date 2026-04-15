import { streamText, UIMessage, convertToModelMessages, tool } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const systemPrompt = `You are an expert video editing assistant. Keep responses super short and concise.

## Available Tools

You MUST use these tools to accomplish tasks. Never guess or ask for information you can get via tools.

1. **getState** - Get editor state. ALWAYS call this first when:
   - You need to know track IDs, element IDs, or current selection
   - You need the video duration (available in "playback" mode)
   - You need to know what elements exist

2. **addElement** - Add new elements to timeline

3. **updateElement** - Modify existing elements (requires trackId + elementId from getState)

4. **deleteElements** - Remove elements

5. **playback** - Control playback

## Rules
- ALWAYS call getState to find track/element IDs before updating anything
- ALWAYS call getState to get video duration before setting element duration
- NEVER ask the user for info you can get from getState
- Confirm each change before making it`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-2.0-flash"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      // Get current editor state
      getState: tool({
        description: "Get the current state of the editor (tracks, selection, playback)",
        inputSchema: z.object({
          what: z
            .enum(["all", "tracks", "selection", "playback"])
            .default("all")
            .describe("What aspect of state to retrieve"),
        }),
      }),

      // Add a new element to the timeline
      addElement: tool({
        description: "Add a new element (text, video, image, audio, sticker) to the timeline",
        inputSchema: z.object({
          type: z
            .enum(["text", "video", "image", "audio", "sticker", "graphic"])
            .describe("Type of element to add"),
          content: z.string().optional().describe("Text content for text elements"),
          startTime: z.number().describe("Start time in seconds"),
          duration: z.number().optional().describe("Duration in seconds (default: 5)"),
          trackId: z.string().optional().describe("Specific track ID (auto-detected if not provided)"),
        }),
      }),

      // Update element properties
      updateElement: tool({
        description: "Update properties of an existing element",
        inputSchema: z.object({
          trackId: z.string().describe("Track ID containing the element"),
          elementId: z.string().describe("ID of the element to update"),
          properties: z
            .object({
              startTime: z.number().optional(),
              duration: z.number().optional(),
              trimStart: z.number().optional(),
              trimEnd: z.number().optional(),
              opacity: z.number().optional(),
              scale: z.number().optional(),
              positionX: z.number().optional(),
              positionY: z.number().optional(),
              // For text elements
              content: z.string().optional(),
              fontSize: z.number().optional(),
              color: z.string().optional(),
            })
            .describe("Properties to update"),
        }),
      }),

      // Delete elements
      deleteElements: tool({
        description: "Delete one or more elements from the timeline",
        inputSchema: z.object({
          elements: z
            .array(
              z.object({
                trackId: z.string(),
                elementId: z.string(),
              }),
            )
            .describe("Array of element references to delete"),
        }),
      }),

      // Playback control
      playback: tool({
        description: "Control playback (play, pause, seek, stop)",
        inputSchema: z.object({
          action: z
            .enum(["play", "pause", "toggle", "seek", "stop"])
            .describe("Playback action"),
          time: z.number().optional().describe("Time to seek to (in seconds)"),
        }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
