import json

from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from .models import PracticeSession, Prompt

from .services import evaluate_answer

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
        'feedbackUrl': reverse('get_ai_feedback', args=[practice_session.id])
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

def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('login')
    else:
        form = UserCreationForm()
    return render(request, 'register.html', {'form': form})

@login_required
@require_POST
def get_ai_feedback(request, session_id):
    practice_session = get_object_or_404(
        PracticeSession.objects.select_related('prompt'),
        id=session_id,
        user=request.user,
    )
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    question = payload.get('question')
    answer = payload.get('answer')
    if not isinstance(question, str) or not isinstance(answer, str):
        return JsonResponse({'error': 'question and answer must be strings.'}, status=400)

    feedback = evaluate_answer(practice_session.prompt.title, question, answer)
    return JsonResponse({'feedback': feedback})
