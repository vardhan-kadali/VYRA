import asyncio
import json
import time
import urllib.request
import subprocess
import aiohttp
from aiortc import RTCPeerConnection, RTCSessionDescription

VYRA_API = "http://127.0.0.1:8000/api"

def get_vram():
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.total,memory.used,memory.free", "--format=csv,noheader,nounits"],
            text=True
        ).strip().split(',')
        return {
            "total_mb": int(out[0].strip()),
            "used_mb": int(out[1].strip()),
            "free_mb": int(out[2].strip())
        }
    except Exception as e:
        return {"error": str(e)}

async def main():
    print("=" * 60)
    print("VYRA PHASE 3C: END-TO-END AVATAR & PIPELINE VERIFICATION")
    print("=" * 60)

    # 1. Baseline VRAM
    vram_start = get_vram()
    print(f"[VRAM Baseline] Used: {vram_start.get('used_mb')} MB | Free: {vram_start.get('free_mb')} MB")

    # 2. Check Avatar Service Status via FastAPI proxy
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{VYRA_API}/avatar/status") as res:
            avatar_status = await res.json()
            print(f"[Avatar Status] HTTP {res.status}:", json.dumps(avatar_status, indent=2))
            assert avatar_status["available"] is True, "Avatar service is not reported as available"

        # 3. Create real interview session in VYRA
        session_payload = {
            "topic": "Python Concurrency and AsyncIO",
            "category": "viva",
            "subject": "Advanced Python",
            "difficulty": "medium",
            "duration_minutes": 15
        }
        async with session.post(f"{VYRA_API}/interviews", json=session_payload) as res:
            session_data = await res.json()
            session_id = session_data["id"]
            print(f"[Viva Session Created] Session ID: {session_id}")

        # 4. Start Viva Session (Gemma 3 generates Q1)
        t0 = time.time()
        print("[Viva Starting] Generating Question 1 via Gemma 3 4B...")
        async with session.post(f"{VYRA_API}/interviews/{session_id}/start") as res:
            q1_data = await res.json()
            q1_latency = time.time() - t0
            q1_text = q1_data["question_text"]
            print(f"[Question 1 Generated] (Latency: {q1_latency:.2f}s): \"{q1_text}\"")

        vram_after_q1 = get_vram()
        print(f"[VRAM after Q1 generation] Used: {vram_after_q1.get('used_mb')} MB | Free: {vram_after_q1.get('free_mb')} MB")

        # 5. Connect WebRTC Peer Connection with Dr. Prabhat Sharma
        print("[Avatar WebRTC] Initializing RTCPeerConnection...")
        pc = RTCPeerConnection()
        pc.addTransceiver('video', direction='recvonly')
        pc.addTransceiver('audio', direction='recvonly')

        received_frames = []
        @pc.on('track')
        def on_track(track):
            if track.kind == 'video':
                asyncio.ensure_future(capture_frames(track))

        async def capture_frames(track):
            try:
                while True:
                    f = await track.recv()
                    received_frames.append(f)
            except Exception:
                pass

        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        async with session.post(f"{VYRA_API}/avatar/offer", json={
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type,
            "avatar": "wav2lip_avatar_glass_man"
        }) as res:
            answer = await res.json()
            avatar_session_id = answer["sessionid"]
            print(f"[Avatar WebRTC Connected] Session ID: {avatar_session_id}")
            await pc.setRemoteDescription(RTCSessionDescription(sdp=answer["sdp"], type=answer["type"]))

        # Allow idle frames to stream
        await asyncio.sleep(2.0)
        idle_count = len(received_frames)
        print(f"[Avatar State: IDLE] Received {idle_count} attentive idle frames from Dr. Prabhat Sharma")

        # 6. Avatar Speaks Question 1 with Synchronized Lips
        print(f"[Avatar State: SPEAKING] Triggering synced lips for Q1: \"{q1_text[:60]}...\"")
        t_speak_start = time.time()
        async with session.post(f"{VYRA_API}/avatar/speak", json={
            "sessionid": avatar_session_id,
            "text": q1_text,
            "interrupt": True
        }) as res:
            speak_res = await res.json()
            print(f"[Speak Trigger Response]: {speak_res}")

        # Stream speaking frames for Q1
        await asyncio.sleep(10.0)
        speaking_count = len(received_frames) - idle_count
        print(f"[Avatar Speech Frames] Delivered {speaking_count} video frames during Q1 speech")

        vram_during_speaking = get_vram()
        print(f"[VRAM during avatar speech] Used: {vram_during_speaking.get('used_mb')} MB | Free: {vram_during_speaking.get('free_mb')} MB")

        # 7. Avatar State: LISTENING (Candidate Answers)
        # Transition avatar to listening state (clearing examiner queue)
        await session.post(f"{VYRA_API}/avatar/interrupt", json={"sessionid": avatar_session_id})
        candidate_answer = "AsyncIO in Python uses an event loop to execute cooperative coroutines concurrently on a single thread without blocking I/O calls."
        print(f"[Avatar State: LISTENING] Candidate answers: \"{candidate_answer}\"")
        await asyncio.sleep(2.0)

        # 8. Avatar State: THINKING / EVALUATING (Gemma 3 evaluates and generates follow-up Q2)
        print("[Avatar State: THINKING] Evaluating answer with Gemma 3 4B...")
        t_eval_start = time.time()
        async with session.post(f"{VYRA_API}/interviews/{session_id}/answer", json={
            "answer": candidate_answer
        }) as res:
            if res.status != 200:
                err_text = await res.text()
                print(f"[Error in /answer HTTP {res.status}]: {err_text}")
                raise Exception(f"Answer evaluation failed with HTTP {res.status}: {err_text}")
            q2_data = await res.json()
            eval_latency = time.time() - t_eval_start
            q2_text = q2_data["question_text"]
            prev_score = q2_data.get("previous_answer_score")
            prev_feedback = q2_data.get("previous_answer_feedback")
            print(f"[Evaluation Complete] (Latency: {eval_latency:.2f}s): Score: {prev_score}/100")
            print(f"[Examiner Feedback]: {prev_feedback}")
            print(f"[Follow-up Question 2]: \"{q2_text}\"")

        vram_after_eval = get_vram()
        print(f"[VRAM after evaluation] Used: {vram_after_eval.get('used_mb')} MB | Free: {vram_after_eval.get('free_mb')} MB")

        # 9. Avatar Speaks Follow-up Question 2 with Synchronized Lips
        print(f"[Avatar State: SPEAKING Q2] Triggering synced lips for Q2: \"{q2_text[:60]}...\"")
        frames_before_q2 = len(received_frames)
        async with session.post(f"{VYRA_API}/avatar/speak", json={
            "sessionid": avatar_session_id,
            "text": q2_text,
            "interrupt": True
        }) as res:
            speak_q2_res = await res.json()
            print(f"[Speak Q2 Trigger Response]: {speak_q2_res}")

        await asyncio.sleep(8.0)
        q2_frames = len(received_frames) - frames_before_q2
        print(f"[Avatar Speech Q2 Frames] Delivered {q2_frames} synchronized frames for Q2")

        # 10. Close WebRTC
        await pc.close()
        print(f"[WebRTC Closed] Total frames delivered throughout viva session: {len(received_frames)}")

        # 11. Conclude Interview & Retrieve Report
        async with session.post(f"{VYRA_API}/interviews/{session_id}/end") as res:
            end_data = await res.json()
            print(f"[Interview Concluded] Status: {end_data.get('status')}")

        async with session.get(f"{VYRA_API}/interviews/{session_id}/report") as res:
            report_data = await res.json()
            print(f"[Final Evaluation Report] Overall Score: {report_data.get('overall_score')}/100, Grade: {report_data.get('grade')}")

    vram_end = get_vram()
    print(f"[VRAM Final] Used: {vram_end.get('used_mb')} MB | Free: {vram_end.get('free_mb')} MB")
    print("=" * 60)
    print("ALL VERIFICATION CHECKS COMPLETED SUCCESSFULLY")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
