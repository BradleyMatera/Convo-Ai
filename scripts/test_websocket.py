"""Quick WebSocket test against the running Convo-AI server."""
import asyncio
import json
import websockets


async def main():
    uri = "ws://localhost:8765/ws"
    async with websockets.connect(uri, ping_timeout=60, max_size=8388608) as ws:
        await ws.send(json.dumps({"text": "Tell me a short joke, Jarvis."}))
        print("Sent text, waiting for response...")
        response = await ws.recv()
        data = json.loads(response)
        print(f"\nUser text: {data.get('text')}")
        print(f"Response:  {data.get('response')}")
        print(f"Mood:      {data.get('mood')}")
        print(f"Audio:     {'yes' if data.get('audio') else 'no'} ({len(data.get('audio',''))} chars b64)")


asyncio.run(main())
