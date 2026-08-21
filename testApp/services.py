from django.conf import settings
from openai import OpenAI

client = OpenAI()

def evaluate_answer(prompt_title: str, question: str, answer: str) -> str:
    messages = [
        {
            "role": "system",
            "content": (
                "You are a system design interviewer. Give brief, constructive "
                "feedback (2-3 sentences) on the candidate's answer to this "
                "clarifying question."
            )
        },
        {
            "role": "user",
            "content": f"Design prompt: {prompt_title}\nQuestion: {question}\nCandidate's answer: {answer}"
        }
    ]
    response = client.chat.completions.create(
        model="gpt-5-mini",
        messages=messages
    )
    return response.choices[0].message.content