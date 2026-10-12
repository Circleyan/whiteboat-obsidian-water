import { describe, expect, it } from "vitest";
import {
  appendIdeaSpeechTranscript,
  extractFinalIdeaSpeechTranscript,
  getIdeaSpeechRecognitionConstructor,
} from "../src/features/idea-speech-input";

describe("shared speech-to-draft semantics", () => {
  it("detects standard and prefixed recognition constructors", () => {
    class Recognition {}
    expect(getIdeaSpeechRecognitionConstructor({ SpeechRecognition: Recognition })).toBe(Recognition);
    expect(getIdeaSpeechRecognitionConstructor({ webkitSpeechRecognition: Recognition })).toBe(Recognition);
    expect(getIdeaSpeechRecognitionConstructor({})).toBeNull();
  });

  it("appends final recognition text without submitting it", () => {
    const transcript = extractFinalIdeaSpeechTranscript({
      resultIndex: 0,
      results: [
        { 0: { transcript: "继续" }, isFinal: false },
        { 0: { transcript: "从水面开始" }, isFinal: true },
      ],
    });

    expect(transcript).toBe("从水面开始");
    expect(appendIdeaSpeechTranscript("今天", transcript)).toBe("今天从水面开始");
  });
});
