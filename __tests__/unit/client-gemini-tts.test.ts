import { applyGain, wrapPcmAsWav } from "@/lib/ai/client-gemini-tts";

describe("applyGain", () => {
  it("leaves samples unchanged at 0 dB", () => {
    const pcm = Buffer.alloc(4);
    pcm.writeInt16LE(1000, 0);
    pcm.writeInt16LE(-1000, 2);
    const out = applyGain(pcm, 0);
    expect(out.readInt16LE(0)).toBe(1000);
    expect(out.readInt16LE(2)).toBe(-1000);
  });

  it("scales samples down proportionally for a negative gain", () => {
    const pcm = Buffer.alloc(2);
    pcm.writeInt16LE(32767, 0);
    const out = applyGain(pcm, -6);
    const expected = Math.round(32767 * Math.pow(10, -6 / 20));
    expect(out.readInt16LE(0)).toBe(expected);
  });

  it("clamps to the Int16 range instead of wrapping around on a large positive gain", () => {
    const pcm = Buffer.alloc(4);
    pcm.writeInt16LE(20000, 0);
    pcm.writeInt16LE(-20000, 2);
    const out = applyGain(pcm, 20); // factor = 10, would overflow Int16 unclamped
    expect(out.readInt16LE(0)).toBe(32767);
    expect(out.readInt16LE(2)).toBe(-32768);
  });

  it("preserves buffer length", () => {
    const pcm = Buffer.alloc(10);
    expect(applyGain(pcm, -1.5).length).toBe(10);
  });
});

describe("wrapPcmAsWav", () => {
  it("produces a 44-byte RIFF/WAVE header followed by the untouched PCM payload", () => {
    const pcm = Buffer.from([1, 2, 3, 4, 5, 6]);
    const wav = wrapPcmAsWav(pcm, 24000);

    expect(wav.length).toBe(44 + pcm.length);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 12, 16)).toBe("fmt ");
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    expect(wav.subarray(44)).toEqual(pcm);
  });

  it("encodes RIFF chunk size, data size, sample rate and mono/16-bit format fields correctly", () => {
    const pcm = Buffer.alloc(100);
    const sampleRate = 24000;
    const wav = wrapPcmAsWav(pcm, sampleRate);

    expect(wav.readUInt32LE(4)).toBe(36 + pcm.length); // RIFF chunk size
    expect(wav.readUInt32LE(16)).toBe(16); // fmt chunk size (PCM)
    expect(wav.readUInt16LE(20)).toBe(1); // PCM format tag
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(sampleRate);
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
    expect(wav.readUInt32LE(40)).toBe(pcm.length); // data chunk size
  });

  it("derives byteRate and blockAlign from channels and bit depth", () => {
    const pcm = Buffer.alloc(8);
    const wav = wrapPcmAsWav(pcm, 24000, 2, 16);
    const blockAlign = 2 * (16 / 8);
    expect(wav.readUInt16LE(32)).toBe(blockAlign);
    expect(wav.readUInt32LE(28)).toBe(24000 * blockAlign); // byteRate
  });
});
