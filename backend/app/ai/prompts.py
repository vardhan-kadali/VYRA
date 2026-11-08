import json
from typing import List, Dict, Any, Optional

SYSTEM_PERSONA = (
    "You are Dr. Prabhat Sharma, Senior Academic Viva Examiner and Technical Interview Chair at VYRA. "
    "Your objective is to conduct an authentic, rigorous, articulate, and structured oral viva examination. "
    "You speak in professional Indian English. Your questions are direct, conceptual, and test fundamental understanding, "
    "theoretical correctness, and practical edge cases. "
    "Do not use generic conversational filler. Always respond in valid JSON when requested."
)

def build_first_question_prompt(
    topic: str,
    category: str,
    difficulty: str,
    subject: Optional[str] = None,
    document_context: Optional[str] = None,
    page_ref: Optional[str] = None
) -> str:
    category_label = "Academic Viva" if category == "viva" else "Job Interview" if category == "job" else "Technical Interview"
    
    if document_context:
        prompt = f"""You are opening an {category_label} examination for the topic: "{topic}".
Difficulty Level: {difficulty}

STRICT SYLLABUS GROUNDING REQUIREMENT:
The candidate has provided an official syllabus/study material. You MUST ask a question that is grounded STRICTLY and EXCLUSIVELY in the provided document excerpt below.
DO NOT introduce any concepts, terms, or topics not found in this document excerpt.
Cite the supporting page reference.

DOCUMENT EXCERPT:
{document_context}

Return ONLY a valid JSON object with exactly these keys:
{{
  "question": "Your opening viva question grounded in the text above",
  "page_ref": "{page_ref or 'Page 1'}"
}}
"""
    else:
        subject_info = f" (Subject: {subject})" if subject else ""
        prompt = f"""You are opening an {category_label} examination for the topic: "{topic}"{subject_info}.
Difficulty Level: {difficulty}

Formulate an authoritative, clear, and foundational opening viva question testing the core principles of this topic.

Return ONLY a valid JSON object with exactly these keys:
{{
  "question": "Your opening viva question",
  "page_ref": null
}}
"""
    return prompt

def build_answer_evaluation_and_followup_prompt(
    topic: str,
    difficulty: str,
    question_text: str,
    candidate_answer: str,
    previous_exchanges: List[Dict[str, Any]],
    document_context: Optional[str] = None,
    page_ref: Optional[str] = None
) -> str:
    history_summary = ""
    for ex in previous_exchanges:
        history_summary += f"Q{ex.get('question_number')}: {ex.get('question_text')}\nAnswer: {ex.get('candidate_answer')}\n\n"

    if document_context:
        prompt = f"""You are evaluating a candidate's answer and formulating the next follow-up question for: "{topic}" ({difficulty}).

PREVIOUS INTERVIEW EXCHANGES:
{history_summary or 'None (This is the first response).'}

CURRENT QUESTION:
{question_text}

CANDIDATE'S SUBMITTED ANSWER:
"{candidate_answer}"

DOCUMENT EXCERPT (SOURCE OF TRUTH):
{document_context}

STRICT GROUNDING INSTRUCTIONS:
1. Evaluate the candidate's answer STRICTLY against the provided document excerpt.
2. Assign an answer score between 0 and 100 based on factual correctness, depth, and precision according to the text.
3. Provide concise examiner feedback (1-2 sentences).
4. Formulate the next follow-up question based STRICTLY on the document excerpt. Do not ask about outside knowledge.

Return ONLY a valid JSON object with exactly these keys:
{{
  "answer_score": 85.0,
  "feedback": "Concise evaluation of the answer",
  "next_question": "Next viva question grounded in the document",
  "page_ref": "{page_ref or 'Page 1'}"
}}
"""
    else:
        prompt = f"""You are evaluating a candidate's answer and formulating the next follow-up question for: "{topic}" ({difficulty}).

PREVIOUS INTERVIEW EXCHANGES:
{history_summary or 'None (This is the first response).'}

CURRENT QUESTION:
{question_text}

CANDIDATE'S SUBMITTED ANSWER:
"{candidate_answer}"

INSTRUCTIONS:
1. Evaluate the candidate's answer for technical accuracy, conceptual clarity, and completeness.
2. Assign an answer score between 0 and 100.
3. Provide concise examiner feedback (1-2 sentences).
4. Formulate the next logical follow-up viva question testing deeper understanding or edge cases.

Return ONLY a valid JSON object with exactly these keys:
{{
  "answer_score": 85.0,
  "feedback": "Concise evaluation of the answer",
  "next_question": "Next viva question",
  "page_ref": null
}}
"""
    return prompt

def build_session_evaluation_prompt(
    topic: str,
    category: str,
    difficulty: str,
    duration_minutes: int,
    exchanges: List[Dict[str, Any]],
    has_document: bool
) -> str:
    conversation_transcript = ""
    for ex in exchanges:
        conversation_transcript += (
            f"Question {ex.get('question_number')}: {ex.get('question_text')}\n"
            f"Candidate Answer: {ex.get('candidate_answer', '[No answer provided]')}\n"
            f"Question Score: {ex.get('answer_score', 'N/A')}\n"
            f"Examiner Note: {ex.get('answer_feedback', '')}\n\n"
        )

    prompt = f"""You are Dr. Prabhat Sharma conducting the final comprehensive performance evaluation for an {category} viva on "{topic}" ({difficulty}, scheduled {duration_minutes} mins).

COMPLETE INTERVIEW SESSION TRANSCRIPT:
{conversation_transcript}

EVALUATE the candidate across these 5 dimensions (each scored 0 to 100):
1. subject_knowledge: Mastery of core concepts and principles.
2. technical_vocabulary: Appropriate use of formal technical terminology.
3. communication: Clarity, structure, and conciseness.
4. code_application: Ability to relate theory to implementation and edge cases.
5. syllabus_grounding: {'Adherence to the document syllabus' if has_document else 'Breadth of topic coverage'}.

Also determine:
- overall_score: Weighted composite (0 to 100).
- grade: Letter grade (A+, A, B, C, or D).
- strengths: List of 3 specific candidate strengths demonstrated in this session.
- improvement_areas: List of 2-3 specific topics or skills the candidate should revise.
- examiner_feedback: Formal closing commentary in the voice of Dr. Prabhat Sharma (3-4 sentences).

Return ONLY a valid JSON object with exactly these keys:
{{
  "overall_score": 88,
  "grade": "A",
  "subject_knowledge": 90,
  "technical_vocabulary": 88,
  "communication": 85,
  "code_application": 82,
  "syllabus_grounding": 94,
  "strengths": [
    "Clear verbal explanation of virtual methods and memory layout",
    "Precise recall of stack vs heap lifetimes",
    "Strong understanding of RAII principles"
  ],
  "improvement_areas": [
    "Review cyclic reference prevention using std::weak_ptr",
    "Elaborate on custom memory allocator performance trade-offs"
  ],
  "examiner_feedback": "The candidate demonstrated solid theoretical mastery and structured reasoning throughout the viva session. Explanations were articulate and disciplined. Well prepared for academic oral vivas and technical screening."
}}
"""
    return prompt
