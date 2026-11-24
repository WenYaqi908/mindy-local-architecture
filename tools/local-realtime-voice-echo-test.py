"""Checks that a short Chinese follow-up is not treated as an echo."""
import importlib.util
from pathlib import Path

path = Path(__file__).with_name("local-realtime-voice.py")
spec = importlib.util.spec_from_file_location("local_realtime_voice", path)
voice = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voice)

SAID = "今天天气不错，适合出门。"


def expect(heard, dropped):
    voice.LAST_SPOKEN["text"] = SAID
    assert voice.echo_of_reply(heard) is dropped, heard


expect("适合出门吗", False)
expect("今天天气", False)
expect("天气", False)
expect("今天天气不错，适合出门吗", False)
expect(SAID, True)
expect("今天天气不错适合出门", True)

voice.LAST_SPOKEN["text"] = "How do you cook eggs with tomatoes today"
assert voice.echo_of_reply("How do you cook eggs with tomatoes today") is True
assert voice.echo_of_reply("How do you cook eggs") is False
print("echo checks ok")
