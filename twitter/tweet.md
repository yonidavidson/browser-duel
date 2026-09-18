# Tweet drafts

## Main tweet (single post)

Three small AI experiments, measured:

🔤 subtext — pub/sub in plain English
📡 radio-vision — modulation from raw IQ, live receiver curve
⚔️ browser-duel — Jev vs GPT-5.6: $0.00012 & 0.4s vs $0.0035 & 4.7s per decision

github.com/yonidavidson

## Thread version

**1/**
Everyone is giving LLMs a browser. So I ran the experiment: same page, same 60 links, one click
at a time — TypeSafe's Jev vs GPT-5.6, racing from "Coffee" to "Albert Einstein" on Wikipedia.

**2/**
Easy task (Coffee → Sanaa): all three models solved it in 2 clicks. Jev took ~1s and
$0.0002; gpt-5.6-sol took 5.2s and $0.0041.

**3/**
Hard task (Coffee → Einstein): Jev gave up after wandering into Wikipedia/Wikidata. luna
reached it in 8 clicks (caffeine → stimulant → cognition → thought experiment → physics →
relativity). sol did it in 5 (Avicenna → history of physics → modern physics).

**4/**
The trade-off: Jev is ~30× cheaper and ~6× faster per decision and always answers with a
valid typed option. LLMs bring world knowledge and plan multi-hop routes. The hybrid
(Jev everywhere, escalate when unsure) is the obvious next build — including its failure
modes: I measured those too.

**5/**
Two more experiments in the same repo set:
🔤 subtext — semantic pub/sub in plain English
📡 radio-vision — classify radio modulations from raw IQ, with a measured accuracy-vs-SNR curve

All local: github.com/yonidavidson

## Link list

- https://github.com/yonidavidson/browser-duel
- https://github.com/yonidavidson/subtext
- https://github.com/yonidavidson/radio-vision
