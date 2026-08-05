import json

from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

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
        'diagramData': practice_session.diagram_data,
        'saveUrl': reverse('save_session', args=[practice_session.id]),
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

def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('login')
    else:
        form = UserCreationForm()
    return render(request, 'register.html', {'form': form})
