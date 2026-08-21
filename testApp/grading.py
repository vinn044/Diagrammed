import json
import os

from openai import OpenAI


FEEDBACK_SCHEMA = {
    "type": "object",
    "properties": {
        "category_scores": {
            "type": "object",
            "properties": {
                "requirements": {"type": "integer", "minimum": 0, "maximum": 100},
                "architecture": {"type": "integer", "minimum": 0, "maximum": 100},
                "scalability": {"type": "integer", "minimum": 0, "maximum": 100},
                "reliability": {"type": "integer", "minimum": 0, "maximum": 100},
                "communication": {"type": "integer", "minimum": 0, "maximum": 100},
            },
            "required": ["requirements", "architecture", "scalability", "reliability", "communication"],
            "additionalProperties": False,
        },
        "summary": {"type": "string"},
        "strengths": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
            "maxItems": 5,
        },
        "improvements": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
            "maxItems": 5,
        },
        "next_step": {"type": "string"},
    },
    "required": ["category_scores", "summary", "strengths", "improvements", "next_step"],
    "additionalProperties": False,
}

STAGE_REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "summary": {"type": "string"},
        "strengths": {"type": "array", "items": {"type": "string"}, "maxItems": 3},
        "improvements": {"type": "array", "items": {"type": "string"}, "maxItems": 3},
        "ready_to_continue": {"type": "boolean"},
    },
    "required": ["score", "summary", "strengths", "improvements", "ready_to_continue"],
    "additionalProperties": False,
}


def _submission_for(practice_session):
    prompt = practice_session.prompt
    return {
        "prompt": {
            "title": prompt.title,
            "description": prompt.description,
            "instructions": prompt.instructions,
        },
        "rubric": prompt.grading_rubric or {
            "requirements": "Addresses the prompt and stated constraints",
            "architecture": "Components have clear responsibilities and data flow",
            "scalability": "Identifies bottlenecks and appropriate scaling approaches",
            "reliability": "Considers failures, availability, and recovery",
            "communication": "Explains assumptions and tradeoffs clearly",
        },
        "diagram": practice_session.diagram_data,
    }


def review_practice_stage(practice_session, stage):
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.responses.create(
        model=os.environ.get("OPENAI_MODEL", "gpt-5.6-luna"),
        reasoning={"effort": "low"},
        instructions=(
            "You are reviewing one stage of a system-design exercise. Evaluate only whether "
            "the canvas contains a meaningful attempt at the requested stage. Give that stage "
            "a score from 0 to 100 based only on the requested work. Be concise and specific. "
            "Set ready_to_continue true when the user has enough substance to move "
            "forward, even if improvements remain. Reject jokes, irrelevant text, or empty work."
        ),
        input=json.dumps({"stage": stage, "submission": _submission_for(practice_session)}),
        text={
            "format": {
                "type": "json_schema",
                "name": "stage_review",
                "strict": True,
                "schema": STAGE_REVIEW_SCHEMA,
            }
        },
    )
    return json.loads(response.output_text)


def grade_practice_session(practice_session):
    submission = _submission_for(practice_session)

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.responses.create(
        model=os.environ.get("OPENAI_MODEL", "gpt-5.6-luna"),
        reasoning={"effort": "low"},
        instructions=(
            "You are a fair system-design interview evaluator. Grade only the submitted "
            "work against the supplied prompt and rubric. Do not require one canonical "
            "architecture. Reward sound reasoning and explicitly identify missing evidence. "
            "Score each category independently from 0 to 100. Give full partial credit for "
            "correct work in one category even when other categories are missing. A category "
            "with no relevant evidence should score 0, but missing architecture must not erase "
            "credit earned for requirements or communication. "
            "Keep feedback specific, concise, and educational."
            "If the submission isn't genuine, satirical, or is clearly a joke, be honest and call it out. If the submission is incomplete, provide feedback on what is missing. "
        ),
        input=json.dumps(submission),
        text={
            "format": {
                "type": "json_schema",
                "name": "design_feedback",
                "strict": True,
                "schema": FEEDBACK_SCHEMA,
            }
        },
    )
    feedback = json.loads(response.output_text)
    category_scores = feedback["category_scores"]
    feedback["score"] = round(sum(category_scores.values()) / len(category_scores))
    return feedback
