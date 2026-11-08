import json
import re
import httpx
from typing import Dict, Any, Optional, List
from app.core.config import settings
from app.ai.prompts import (
    SYSTEM_PERSONA,
    build_first_question_prompt,
    build_answer_evaluation_and_followup_prompt,
    build_session_evaluation_prompt,
)

class OllamaError(Exception):
    pass

class OllamaUnavailableError(OllamaError):
    pass

def extract_json(raw_text: str) -> Dict[str, Any]:
    """Extracts valid JSON object from LLM response text."""
    clean = raw_text.strip()
    
    # Check if wrapped in markdown code fence
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', clean)
    if match:
        clean = match.group(1).strip()
    else:
        # Look for outermost JSON braces
        brace_match = re.search(r'(\{[\s\S]*\})', clean)
        if brace_match:
            clean = brace_match.group(1).strip()

    try:
        return json.loads(clean)
    except json.JSONDecodeError as e:
        raise OllamaError(f"Failed to parse structured JSON from model response: {e}. Raw text: {raw_text[:200]}")

class OllamaAIProvider:
    def __init__(
        self,
        base_url: str = settings.OLLAMA_BASE_URL,
        model_name: str = settings.OLLAMA_MODEL,
        timeout: float = settings.OLLAMA_TIMEOUT_SECONDS
    ):
        self.base_url = base_url.rstrip('/')
        self.model_name = model_name
        self.timeout = timeout

    async def check_health(self) -> Dict[str, Any]:
        """Checks if local Ollama server is responding and model is available."""
        url = f"{self.base_url}/api/tags"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url)
                if res.status_code != 200:
                    return {
                        "available": False,
                        "status": "Ollama server returned non-200 status",
                        "model": self.model_name,
                        "error": f"HTTP {res.status_code}"
                    }
                
                data = res.json()
                models = [m.get("name") for m in data.get("models", [])]
                
                # Check if configured model or model prefix is installed
                model_found = any(self.model_name in m for m in models)
                
                return {
                    "available": True,
                    "model_found": model_found,
                    "configured_model": self.model_name,
                    "available_models": models,
                    "status": "Operational" if model_found else f"Model '{self.model_name}' not in installed models"
                }
        except httpx.ConnectError:
            return {
                "available": False,
                "status": "Ollama service unavailable",
                "model": self.model_name,
                "error": f"Could not connect to Ollama at {self.base_url}. Ensure 'ollama serve' is active."
            }
        except Exception as e:
            return {
                "available": False,
                "status": "Error checking Ollama health",
                "model": self.model_name,
                "error": str(e)
            }

    async def _generate_json(self, prompt: str, system: str = SYSTEM_PERSONA) -> Dict[str, Any]:
        """Sends generation request to Ollama with format='json' and parses the output."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "format": "json",
            "options": {
                "num_gpu": settings.OLLAMA_NUM_GPU,
                "temperature": 0.4,
                "top_p": 0.9,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
                
            if response.status_code != 200:
                raise OllamaError(f"Ollama returned HTTP {response.status_code}: {response.text}")

            result = response.json()
            raw_response = result.get("response", "")
            if not raw_response:
                raise OllamaError("Ollama returned an empty response.")

            return extract_json(raw_response)

        except httpx.ConnectError:
            raise OllamaUnavailableError(
                f"Local Ollama service at {self.base_url} is unreachable. "
                "Ensure Ollama is started locally."
            )
        except httpx.TimeoutException:
            raise OllamaError(
                f"Ollama request timed out after {self.timeout}s while generating response."
            )
        except json.JSONDecodeError as e:
            raise OllamaError(f"Failed to parse response JSON: {e}")

    async def generate_first_question(
        self,
        topic: str,
        category: str,
        difficulty: str,
        subject: Optional[str] = None,
        document_context: Optional[str] = None,
        page_ref: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generates opening viva question."""
        prompt = build_first_question_prompt(
            topic=topic,
            category=category,
            difficulty=difficulty,
            subject=subject,
            document_context=document_context,
            page_ref=page_ref
        )
        return await self._generate_json(prompt)

    async def evaluate_answer_and_followup(
        self,
        topic: str,
        difficulty: str,
        question_text: str,
        candidate_answer: str,
        previous_exchanges: List[Dict[str, Any]],
        document_context: Optional[str] = None,
        page_ref: Optional[str] = None
    ) -> Dict[str, Any]:
        """Evaluates candidate response and generates the next contextual viva question."""
        prompt = build_answer_evaluation_and_followup_prompt(
            topic=topic,
            difficulty=difficulty,
            question_text=question_text,
            candidate_answer=candidate_answer,
            previous_exchanges=previous_exchanges,
            document_context=document_context,
            page_ref=page_ref
        )
        return await self._generate_json(prompt)

    async def generate_final_evaluation(
        self,
        topic: str,
        category: str,
        difficulty: str,
        duration_minutes: int,
        exchanges: List[Dict[str, Any]],
        has_document: bool
    ) -> Dict[str, Any]:
        """Generates 5-dimensional rubric scoring, strengths, and examiner feedback."""
        prompt = build_session_evaluation_prompt(
            topic=topic,
            category=category,
            difficulty=difficulty,
            duration_minutes=duration_minutes,
            exchanges=exchanges,
            has_document=has_document
        )
        return await self._generate_json(prompt)

# Global default instance
ollama_ai_provider = OllamaAIProvider()
