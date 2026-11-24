#!/usr/bin/env python3
"""Loopback stand-in for the DashScope realtime websocket.

The local engine speaks the provider protocol. This process answers with a
short local reply so Chat does not call a cloud voice service. It accepts
the Mac itself and private addresses used by the local Kubernetes VM.
"""
import sys
sys.path.insert(0, "/Users/wendy/Downloads/cursor-workspace/tools/voice-packages")

import asyncio
import ipaddress
import base64
import hashlib
import json
import math
import os
import re
import struct
import subprocess
import threading
import uuid
import wave
from collections import deque
from urllib.parse import urlsplit

HOST = "0.0.0.0"
PORT = 18765
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MODEL_HOME = "/Users/wendy/Downloads/cursor-workspace/tools/models/huggingface"
WHISPER_REPO = "mlx-community/whisper-small-mlx"
CHAT_REPO = "mlx-community/Qwen2.5-3B-Instruct-4bit"
SPEECH_RMS = 90
MODELS = {"ready": False, "error": ""}
MAC_MIC = {"chunks": deque(), "seq": 0, "lock": threading.Lock()}
ACTIVE = {"state": None}
LAST_SPOKEN = {"text": ""}
MAC_MIC_BIN = "/Users/wendy/Downloads/cursor-workspace/tools/mac-mic"


def load_models():
    os.environ["HF_HOME"] = MODEL_HOME
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["HF_HUB_DISABLE_XET"] = "1"
    try:
        import mlx_whisper
        from mlx_lm import load
        model, tokenizer = load(CHAT_REPO)
        MODELS.update(whisper=mlx_whisper, model=model, tokenizer=tokenizer, ready=True, error="")
        print("local models ready", flush=True)
        warm_whisper(mlx_whisper)
    except Exception as error:
        MODELS["ready"] = False
        MODELS["error"] = str(error)
        print(f"local models failed: {error}", flush=True)


def warm_whisper(mlx_whisper):
    import numpy as np
    noise = np.random.default_rng(1).normal(0, 0.03, 16000).astype(np.float32)
    mlx_whisper.transcribe(
        noise,
        path_or_hf_repo=WHISPER_REPO,
        temperature=0.0,
        verbose=False,
    )
    print("local voice warmup ready", flush=True)


def pcm_rms(raw):
    count = len(raw) // 2
    if count <= 0:
        return 0
    total = 0
    samples = []
    for offset in range(0, count * 2, 2):
        sample = struct.unpack_from("<h", raw, offset)[0]
        samples.append(sample)
        total += sample
    mean = total / count
    energy = 0.0
    for sample in samples:
        delta = sample - mean
        energy += delta * delta
    return math.sqrt(energy / count)


def write_wav(path, pcm, rate=16000):
    with wave.open(path, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(pcm)


def transcribe_pcm(pcm):
    if not MODELS.get("ready"):
        return ""
    try:
        import numpy as np
        raw = bytes(pcm)
        raw = raw[: len(raw) // 2 * 2]
        if len(raw) < 3200:
            return ""
        samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        samples = samples - float(samples.mean())
        frame = 320
        if len(samples) > frame * 4:
            hops = samples[: len(samples) // frame * frame].reshape(-1, frame)
            levels = np.sqrt(np.mean(hops * hops, axis=1))
            variation = float(levels.std() / (levels.mean() + 1e-6))
            if variation < 0.18:
                print(f"local voice ignored a steady tone variation={variation:.2f}", flush=True)
                return ""
        result = MODELS["whisper"].transcribe(
            samples,
            path_or_hf_repo=WHISPER_REPO,
            temperature=0.0,
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
            logprob_threshold=-0.6,
            compression_ratio_threshold=2.0,
            verbose=False,
        )
        text = (result.get("text") or "").strip()
        language = str(result.get("language") or "").lower()
        if language not in {"en", "zh", "english", "chinese"}:
            print(f"local voice ignored language={language or 'unknown'} text={text!r}", flush=True)
            return ""
        accepted = spoken_transcript(text)
        if accepted and echo_of_reply(accepted):
            print(f"local voice ignored echo: {accepted}", flush=True)
            return ""
        return accepted
    except Exception as error:
        print(f"local voice transcription failed: {error}", flush=True)
        return ""


# Whisper invents these on silence or speaker noise.
CHINESE_FILLER_ONLY = re.compile(
    r"^(谢谢观看|感谢观看|谢谢收看|感谢收看|请订阅|请点赞|下集再见|拜拜)[。！!，,.\s]*$"
)
CHINESE_SUBTITLE_CREDIT = re.compile(r"字幕(由|提供|制作|志愿者)|明镜与点点|请不吝点赞")


def spoken_transcript(text):
    cleaned = (text or "").strip()
    if not cleaned:
        return ""
    if any("\u4e00" <= char <= "\u9fff" for char in cleaned):
        if CHINESE_FILLER_ONLY.match(cleaned) or CHINESE_SUBTITLE_CREDIT.search(cleaned):
            return ""
        return cleaned
    words = [word.strip(".,!?;:\"'").lower() for word in cleaned.split()]
    words = [word for word in words if word]
    blocked = {
        "you", "thank", "thanks", "bye", "goodbye", "subscribe",
        "yeah", "yes", "ok", "okay", "hmm", "uh", "um",
    }
    if not words or all(word in blocked for word in words):
        return ""
    if len(words) >= 4 and words.count(max(set(words), key=words.count)) >= len(words) - 1:
        return ""
    return cleaned


def transcript_pieces(text):
    words = {word.strip(".,!?;:\"'").lower() for word in text.split() if word.strip(".,!?;:\"'")}
    chinese = "".join(char for char in text if "\u4e00" <= char <= "\u9fff")
    pieces = set(words)
    if len(chinese) == 1:
        pieces.add(chinese)
    pieces.update(chinese[index:index + 2] for index in range(len(chinese) - 1))
    return pieces


def _chinese(text):
    return "".join(char for char in text or "" if "\u4e00" <= char <= "\u9fff")


def echo_of_reply(text):
    """Drop a playback of the last reply, not a question that borrows its words.

    Chinese counts as an echo only when the heard text is the reply, or a long
    stretch copied out of it. Adding 吗 keeps the turn.
    """
    heard_zh = _chinese(text)
    said_zh = _chinese(LAST_SPOKEN["text"])
    if heard_zh or said_zh:
        if heard_zh and heard_zh == said_zh:
            return True
        if len(heard_zh) < 8 or len(said_zh) < 8:
            return False
        return heard_zh in said_zh
    heard = {word.strip(".,!?;:\"'").lower() for word in (text or "").split() if word.strip(".,!?;:\"'")}
    said = {word.strip(".,!?;:\"'").lower() for word in LAST_SPOKEN["text"].split() if word.strip(".,!?;:\"'")}
    if len(heard) < 4 or not said:
        return False
    if heard == said:
        return True
    overlap = len(heard & said) / len(heard)
    ratio = len(heard) / len(said)
    return overlap >= 0.9 and 0.85 <= ratio <= 1.15


def start_mac_mic():
    def run():
        proc = subprocess.Popen(
            [MAC_MIC_BIN],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        assert proc.stdout is not None and proc.stderr is not None
        while True:
            raw = proc.stdout.read(3200)
            if not raw:
                message = proc.stderr.read().decode("utf-8", "replace").strip()
                print(f"mac mic stopped {message}", flush=True)
                return
            with MAC_MIC["lock"]:
                MAC_MIC["seq"] += 1
                MAC_MIC["chunks"].append((MAC_MIC["seq"], raw))
                while len(MAC_MIC["chunks"]) > 200:
                    MAC_MIC["chunks"].popleft()
    threading.Thread(target=run, daemon=True).start()


def take_mac_audio(since):
    with MAC_MIC["lock"]:
        fresh = [item for item in MAC_MIC["chunks"] if item[0] > since]
        return MAC_MIC["seq"], fresh


def usable_question(text):
    cleaned = (text or "").strip()
    if not cleaned or len(cleaned) > 180:
        return ""
    if "开场" in cleaned or "opening" in cleaned.lower():
        return ""
    return cleaned


def answer_question(question):
    if not MODELS.get("ready"):
        return "The local model is still loading. Ask me again in a moment."
    try:
        from mlx_lm import generate
        prompt = MODELS["tokenizer"].apply_chat_template(
            [
                {
                    "role": "system",
                    "content": (
                        "You are Mindy, a spoken learning companion. "
                        "Answer in one or two short sentences that can be read aloud. "
                        "Use the same language as the user."
                    ),
                },
                {"role": "user", "content": question},
            ],
            tokenize=False,
            add_generation_prompt=True,
        )
        spoken = generate(
            MODELS["model"], MODELS["tokenizer"], prompt=prompt, max_tokens=80, verbose=False
        )
        spoken = " ".join(spoken.split())
        LAST_SPOKEN["text"] = spoken
        return spoken[:400] or "Could you ask that once more?"
    except Exception as error:
        print(f"local voice answer failed: {error}", flush=True)
        return "I heard you, but I could not finish an answer. Please ask again."


def fallback_tone():
    rate = 24000
    frames = int(rate * 1.2)
    data = bytearray()
    for index in range(frames):
        sample = int(12000 * math.sin(2 * math.pi * 440 * index / rate))
        data += struct.pack("<h", sample)
    return bytes(data)


def synthesize(text):
    voice = "Tingting" if any("\u4e00" <= char <= "\u9fff" for char in text) else "Samantha"
    path = f"/tmp/mindy-say-{uuid.uuid4().hex}.wav"
    try:
        subprocess.run(
            ["say", "-v", voice, "-o", path, "--file-format=WAVE", "--data-format=LEI16@24000", text],
            check=True,
            timeout=20,
        )
        with wave.open(path) as spoken:
            if spoken.getnchannels() != 1 or spoken.getsampwidth() != 2 or spoken.getframerate() != 24000:
                raise RuntimeError("unexpected speech format")
            pcm = spoken.readframes(spoken.getnframes())
        if len(pcm) < 4800:
            raise RuntimeError("speech was empty")
        return pcm
    except Exception as error:
        print(f"local voice speech failed: {error}", flush=True)
        return fallback_tone()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def frame(text):
    payload = text.encode()
    header = bytearray([0x81])
    length = len(payload)
    if length < 126:
        header.append(length)
    elif length < 65536:
        header.append(126)
        header += struct.pack("!H", length)
    else:
        header.append(127)
        header += struct.pack("!Q", length)
    return bytes(header) + payload


async def send_json(lock, writer, payload):
    data = frame(json.dumps(payload, ensure_ascii=False))
    async with lock:
        writer.write(data)
        await writer.drain()


async def read_exact(reader, size):
    data = b""
    while len(data) < size:
        chunk = await reader.read(size - len(data))
        if not chunk:
            raise ConnectionError("closed")
        data += chunk
    return data


async def read_message(reader):
    while True:
        header = await read_exact(reader, 2)
        opcode = header[0] & 0x0F
        masked = header[1] & 0x80
        length = header[1] & 0x7F
        if length == 126:
            length = struct.unpack("!H", await read_exact(reader, 2))[0]
        elif length == 127:
            length = struct.unpack("!Q", await read_exact(reader, 8))[0]
        mask = await read_exact(reader, 4) if masked else b""
        payload = await read_exact(reader, length) if length else b""
        if mask:
            payload = bytes(byte ^ mask[index % 4] for index, byte in enumerate(payload))
        if opcode == 0x8:
            raise ConnectionError("closed")
        if opcode == 0x9:
            return ("ping", payload)
        if opcode == 0x1:
            return ("text", payload.decode())


def user_text(message):
    item = message.get("item") or {}
    parts = item.get("content") or []
    texts = []
    for part in parts:
        if isinstance(part, dict) and part.get("text"):
            texts.append(str(part["text"]))
    return " ".join(texts).strip()


async def reply(writer, text, state):
    response_id = "local-" + uuid.uuid4().hex
    state["answers"] += 1
    question = usable_question(text)
    if question:
        spoken = await asyncio.to_thread(answer_question, question)
    else:
        spoken = "Hi, ask me something in English or Chinese."
    LAST_SPOKEN["text"] = spoken
    # Ignore the simulator tone while this sentence is being spoken, then allow
    # the next question. A speech_started event during playback is treated as an
    # interruption and drops the audio.
    state["cancel"] = False
    state["ignore_until"] = asyncio.get_running_loop().time() + 30
    state["audio_ms"] = 0
    state["audio_started"] = 0
    pcm = await asyncio.to_thread(synthesize, spoken)
    duration = len(pcm) / (24000 * 2)
    state["cancel"] = False
    # The phone only keeps about 1.5s of audio queued. Sending the whole
    # sentence at once makes it cancel the reply mid-word.
    await send_json(state["lock"], writer, {"type": "response.created", "response": {"id": response_id}})
    await send_json(state["lock"], writer, {
        "type": "response.audio_transcript.delta",
        "response_id": response_id,
        "delta": spoken,
    })
    await send_json(state["lock"], writer, {
        "type": "response.audio_transcript.done",
        "response_id": response_id,
        "transcript": spoken,
    })
    sent = 0
    for offset in range(0, len(pcm), 4800):
        if state["closed"] or state["cancel"]:
            break
        await send_json(state["lock"], writer, {
            "type": "response.audio.delta",
            "response_id": response_id,
            "delta": base64.b64encode(pcm[offset:offset + 4800]).decode(),
        })
        sent += 4800
        if sent >= 24000 * 2 * 3 // 10:
            await asyncio.sleep(0.1)
    await send_json(state["lock"], writer, {"type": "response.audio.done", "response_id": response_id})
    await send_json(state["lock"], writer, {
        "type": "response.done",
        "response_id": response_id,
        "response": {"id": response_id, "status": "completed", "usage": {"input_tokens": 1, "output_tokens": 1}},
    })
    # The page already holds the microphone until its own playback estimate
    # ends, plus a short tail. This only covers frames that arrive late.
    state["ignore_until"] = asyncio.get_running_loop().time() + 0.8
    print(f"local voice spoke {duration:.1f}s reply={state['answers']}", flush=True)


def client_stream_is_synthetic(state, level):
    levels = state.setdefault("client_levels", [])
    levels.append(level)
    del levels[:-20]
    if len(levels) < 8:
        state["synthetic_mic"] = False
        return False
    recent = levels[-12:]
    average = sum(recent) / len(recent)
    variance = sum((item - average) ** 2 for item in recent) / len(recent)
    state["synthetic_mic"] = average > 800 and variance < 6400
    return state["synthetic_mic"]


def remember_mic_frame(state, raw, now):
    state["pcm"].extend(raw)
    level = pcm_rms(raw)
    noise = state.get("noise")
    if noise is None:
        noise = level
    elif level < noise:
        noise = noise * 0.7 + level * 0.3
    else:
        noise = noise * 0.995 + level * 0.005
    state["noise"] = noise
    heard = level >= max(SPEECH_RMS, noise + 35) and level >= noise * 1.7
    state["mic_peak"] = max(state.get("mic_peak", 0), level)
    if now - state.get("mic_log", 0) >= 2:
        state["mic_log"] = now
        print(
            f"voice input rms={level:.0f} noise={noise:.0f} peak={state['mic_peak']:.0f}",
            flush=True,
        )
    if heard:
        if not state["audio_started"]:
            state["audio_started"] = now
        state["last_audio"] = now
        state["speech_ms"] += (len(raw) // 2) / 16.0
    elif not state["audio_started"] and len(state["pcm"]) > 16000 * 2:
        del state["pcm"][: len(state["pcm"]) - 16000]
    if len(state["pcm"]) > 16000 * 2 * 45:
        del state["pcm"][: len(state["pcm"]) - 16000 * 2 * 45]


async def answer_microphone(writer, state):
    seen = 0
    while not state["closed"]:
        await asyncio.sleep(0.1)
        if state["closed"] or state["busy"] or not state["ready"]:
            continue
        if ACTIVE.get("state") is not state:
            continue
        if state["queued"]:
            if asyncio.get_running_loop().time() < state["ignore_until"]:
                continue
            asked = state["queued"].pop(0)
            state["busy"] = True
            try:
                await reply(writer, asked, state)
            except (ConnectionError, asyncio.IncompleteReadError):
                state["closed"] = True
            except Exception as error:
                print(f"local voice reply failed: {error}", flush=True)
            state["busy"] = False
            continue
        now = asyncio.get_running_loop().time()
        seen, fresh = take_mac_audio(seen)
        if not state.get("synthetic_mic"):
            fresh = []
        if now < state["ignore_until"]:
            state["pcm"].clear()
            state["audio_started"] = 0
            state["speech_ms"] = 0
            continue
        for _, raw in fresh:
            remember_mic_frame(state, raw, now)
        if not state["audio_started"] or state["speech_ms"] < 280:
            continue
        # A brief pause inside a sentence is not the end of the turn.
        if now - state["last_audio"] < 1.4:
            continue
        heard = bytes(state["pcm"])
        heard_ms = state["speech_ms"]
        state["pcm"].clear()
        state["audio_started"] = 0
        state["speech_ms"] = 0
        state["busy"] = True
        item_id = "mic-" + uuid.uuid4().hex[:12]
        try:
            transcript = await asyncio.to_thread(transcribe_pcm, heard)
            if not transcript:
                print("local voice ignored quiet audio", flush=True)
            else:
                await send_json(state["lock"], writer, {"type": "input_audio_buffer.speech_started", "item_id": item_id})
                await send_json(state["lock"], writer, {"type": "input_audio_buffer.speech_stopped", "item_id": item_id})
                await send_json(state["lock"], writer, {"type": "input_audio_buffer.committed", "item_id": item_id})
                await send_json(state["lock"], writer, {
                    "type": "conversation.item.input_audio_transcription.completed",
                    "item_id": item_id,
                    "transcript": transcript,
                })
                await reply(writer, transcript, state)
                pause_ms = (now - state["last_audio"]) * 1000
                print(
                    f"local voice answered speech_ms={heard_ms:.0f} pause_ms={pause_ms:.0f}: {transcript}",
                    flush=True,
                )
        except (ConnectionError, asyncio.IncompleteReadError):
            state["closed"] = True
        except Exception as error:
            print(f"local voice microphone answer failed: {error}", flush=True)
        state["busy"] = False


def local_voice_peer(address):
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private


async def connection(reader, writer):
    peer = writer.get_extra_info("peername")
    request = b""
    while b"\r\n\r\n" not in request:
        chunk = await reader.read(4096)
        if not chunk:
            writer.close()
            return
        request += chunk
        if len(request) > 65536:
            writer.close()
            return
    head, _, _ = request.partition(b"\r\n\r\n")
    lines = head.decode("latin1").split("\r\n")
    path = urlsplit(lines[0].split(" ")[1]).path
    headers = {}
    for line in lines[1:]:
        if ":" in line:
            name, value = line.split(":", 1)
            headers[name.strip().lower()] = value.strip()
    if not local_voice_peer(peer[0]) or headers.get("upgrade", "").lower() != "websocket":
        print(f"local voice refused peer={peer[0]} upgrade={headers.get('upgrade', '')}", flush=True)
        writer.write(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n")
        await writer.drain()
        writer.close()
        return
    accept = base64.b64encode(hashlib.sha1((headers["sec-websocket-key"] + GUID).encode()).digest()).decode()
    writer.write((
        "HTTP/1.1 101 Switching Protocols\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Accept: {accept}\r\n\r\n"
    ).encode())
    await writer.drain()
    print(f"local voice connected path={path}", flush=True)
    pending = ""
    state = {
        "closed": False,
        "busy": False,
        "ready": False,
        "audio_started": 0,
        "last_audio": 0,
        "speech_ms": 0,
        "pcm": bytearray(),
        "answers": 0,
        "ignore_until": 0,
        "queued": [],
        "cancel": False,
        "lock": asyncio.Lock(),
    }
    ACTIVE["state"] = state
    await send_json(state["lock"], writer, {"type": "session.created", "session": {"id": "local-mac"}})
    watcher = asyncio.create_task(answer_microphone(writer, state))
    try:
        while True:
            kind, payload = await read_message(reader)
            if kind == "ping":
                writer.write(bytes([0x8A, len(payload)]) + payload)
                await writer.drain()
                continue
            try:
                message = json.loads(payload)
            except json.JSONDecodeError:
                print("local voice ignored a non-json frame", flush=True)
                continue
            event_type = message.get("type")
            if event_type != "input_audio_buffer.append":
                print(f"local voice event {event_type}", flush=True)
            if event_type == "session.update":
                await send_json(state["lock"], writer, {"type": "session.updated", "session": {"id": "local-mac"}})
                state["ready"] = True
                print("local voice session ready", flush=True)
            elif event_type == "input_audio_buffer.append":
                if state["busy"] or asyncio.get_running_loop().time() < state["ignore_until"]:
                    continue
                raw = base64.b64decode(message.get("audio") or "")
                now = asyncio.get_running_loop().time()
                if client_stream_is_synthetic(state, pcm_rms(raw)):
                    if not state.get("logged_synthetic"):
                        state["logged_synthetic"] = True
                        print("local voice phone stream is a steady tone; using the Mac microphone", flush=True)
                    continue
                remember_mic_frame(state, raw, now)
            elif event_type == "conversation.item.create":
                item = message.get("item") if isinstance(message.get("item"), dict) else {}
                pending = user_text(message) or pending
                # The engine waits for this echo before it will accept typed chat.
                # Without the same item id it closes the call about ten seconds later.
                await send_json(state["lock"], writer, {"type": "conversation.item.created", "item": item})
            elif event_type == "response.create":
                # Spoken by the watcher so microphone audio can keep being read.
                state["queued"].append(pending)
                pending = ""
            elif event_type == "response.cancel":
                state["cancel"] = True
                pending = ""
            elif event_type == "input_audio_buffer.clear":
                pending = ""
    except (ConnectionError, asyncio.IncompleteReadError) as error:
        print(f"local voice closed reason={error}", flush=True)
    finally:
        state["closed"] = True
        watcher.cancel()
        if ACTIVE.get("state") is state:
            ACTIVE["state"] = None
        writer.close()


async def main():
    start_mac_mic()
    asyncio.get_running_loop().run_in_executor(None, load_models)
    server = await asyncio.start_server(connection, HOST, PORT)
    print(f"local voice listening on ws://{HOST}:{PORT}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
