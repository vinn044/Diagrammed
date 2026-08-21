import json

from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST
from openai import OpenAIError

from .grading import grade_practice_session, review_practice_stage
from .models import PracticeSession, Prompt

def home(request):
    return render(request, 'home.html', {})

@login_required
def promptselection(request):
    prompts = Prompt.objects.filter(is_active=True)
    return render(request, 'promptselection.html', {'prompts': prompts})


@login_required
@require_POST
def start_session(request, prompt_id):
    prompt = get_object_or_404(Prompt, id=prompt_id, is_active=True)
    practice_session = PracticeSession.objects.create(
        user=request.user,
        prompt=prompt,
    )
    return redirect('session', session_id=practice_session.id)


@login_required
def session(request, session_id):
    practice_session = get_object_or_404(
        PracticeSession.objects.select_related('prompt'),
        id=session_id,
        user=request.user,
    )
    session_config = {
        'id': practice_session.id,
        'promptTitle': practice_session.prompt.title,
        'promptDescription': practice_session.prompt.description,
        'promptInstructions': practice_session.prompt.instructions,
        'clarifyingQuestions': practice_session.prompt.clarifying_questions,
        'clarificationAnswers': practice_session.clarification_answers,
        'diagramData': practice_session.diagram_data,
        'saveUrl': reverse('save_session', args=[practice_session.id]),
        'answerSaveUrl': reverse('save_session_answers', args=[practice_session.id]),
        'gradeUrl': reverse('grade_session', args=[practice_session.id]),
        'feedback': practice_session.ai_feedback,
        'currentStage': practice_session.current_stage,
        'stageFeedback': practice_session.stage_feedback,
        'reviewStageUrl': reverse('review_session_stage', args=[practice_session.id]),
        'advanceStageUrl': reverse('advance_session_stage', args=[practice_session.id]),
    }
    return render(
        request,
        'session.html',
        {'practice_session': practice_session, 'session_config': session_config},
    )


@login_required
@require_POST
def save_session(request, session_id):
    practice_session = get_object_or_404(
        PracticeSession,
        id=session_id,
        user=request.user,
    )
    try:
        diagram_data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    if not isinstance(diagram_data, dict):
        return JsonResponse({'error': 'Diagram data must be an object.'}, status=400)
    if not isinstance(diagram_data.get('nodes'), list):
        return JsonResponse({'error': 'Diagram nodes must be a list.'}, status=400)
    if not isinstance(diagram_data.get('edges'), list):
        return JsonResponse({'error': 'Diagram edges must be a list.'}, status=400)

    practice_session.diagram_data = diagram_data
    practice_session.save(update_fields=['diagram_data', 'updated_at'])
    return JsonResponse({'saved': True})


@login_required
@require_POST
def save_session_answers(request, session_id):
    practice_session = get_object_or_404(
        PracticeSession,
        id=session_id,
        user=request.user,
    )
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    answers = payload.get('answers') if isinstance(payload, dict) else None
    if not isinstance(answers, dict):
        return JsonResponse({'error': 'Answers must be an object.'}, status=400)
    if not all(isinstance(key, str) and isinstance(value, str) for key, value in answers.items()):
        return JsonResponse({'error': 'Answer keys and values must be strings.'}, status=400)

    practice_session.clarification_answers = answers
    practice_session.save(update_fields=['clarification_answers', 'updated_at'])
    return JsonResponse({'saved': True})


@login_required
@require_POST
def grade_session(request, session_id):
    practice_session = get_object_or_404(
        PracticeSession.objects.select_related('prompt'),
        id=session_id,
        user=request.user,
    )
    if request.body:
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON.'}, status=400)
        diagram = payload.get('diagram') if isinstance(payload, dict) else None
        answers = payload.get('answers') if isinstance(payload, dict) else None
        if not isinstance(diagram, dict) or not isinstance(diagram.get('nodes'), list) or not isinstance(diagram.get('edges'), list):
            return JsonResponse({'error': 'A valid diagram is required.'}, status=400)
        if not isinstance(answers, dict) or not all(
            isinstance(key, str) and isinstance(value, str) for key, value in answers.items()
        ):
            return JsonResponse({'error': 'Valid answers are required.'}, status=400)
        practice_session.diagram_data = diagram
        practice_session.clarification_answers = answers
        practice_session.save(update_fields=['diagram_data', 'clarification_answers', 'updated_at'])

    if not practice_session.diagram_data.get('nodes'):
        return JsonResponse({'error': 'Save a diagram before requesting feedback.'}, status=400)

    try:
        feedback = grade_practice_session(practice_session)
    except KeyError:
        return JsonResponse({'error': 'OpenAI API key is not configured.'}, status=503)
    except (OpenAIError, json.JSONDecodeError):
        return JsonResponse({'error': 'AI grading is temporarily unavailable.'}, status=502)

    now = timezone.now()
    practice_session.ai_feedback = feedback
    practice_session.graded_at = now
    practice_session.status = PracticeSession.Status.COMPLETED
    practice_session.completed_at = now
    practice_session.save(update_fields=[
        'ai_feedback', 'graded_at', 'status', 'completed_at', 'updated_at',
    ])
    return JsonResponse({'feedback': feedback})


@login_required
@require_POST
def review_session_stage(request, session_id):
    practice_session = get_object_or_404(
        PracticeSession.objects.select_related('prompt'),
        id=session_id,
        user=request.user,
    )
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    stage_index = payload.get('stageIndex')
    stage = payload.get('stage')
    diagram = payload.get('diagram')
    if not isinstance(stage_index, int) or not 0 <= stage_index <= 4 or not isinstance(stage, dict):
        return JsonResponse({'error': 'Invalid stage.'}, status=400)
    if not isinstance(diagram, dict) or not isinstance(diagram.get('nodes'), list) or not isinstance(diagram.get('edges'), list):
        return JsonResponse({'error': 'A valid diagram is required.'}, status=400)

    practice_session.diagram_data = diagram
    try:
        review = review_practice_stage(practice_session, stage)
    except KeyError:
        return JsonResponse({'error': 'OpenAI API key is not configured.'}, status=503)
    except (OpenAIError, json.JSONDecodeError):
        return JsonResponse({'error': 'Stage review is temporarily unavailable.'}, status=502)

    stage_feedback = {**practice_session.stage_feedback, str(stage_index): review}
    practice_session.stage_feedback = stage_feedback
    practice_session.current_stage = stage_index
    practice_session.save(update_fields=['diagram_data', 'stage_feedback', 'current_stage', 'updated_at'])
    return JsonResponse({'review': review})


@login_required
@require_POST
def advance_session_stage(request, session_id):
    practice_session = get_object_or_404(PracticeSession, id=session_id, user=request.user)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)
    next_stage = payload.get('stage')
    if not isinstance(next_stage, int) or not 0 <= next_stage <= 5:
        return JsonResponse({'error': 'Invalid stage.'}, status=400)
    practice_session.current_stage = next_stage
    practice_session.save(update_fields=['current_stage', 'updated_at'])
    return JsonResponse({'stage': next_stage})

def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('login')
    else:
        form = UserCreationForm()
    return render(request, 'register.html', {'form': form})
