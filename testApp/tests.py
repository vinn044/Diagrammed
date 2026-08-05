import json

from django.contrib.auth import get_user_model
from django.db.models import ProtectedError
from django.test import TestCase
from django.urls import reverse

from .models import PracticeSession, Prompt


class PromptModelTests(TestCase):
    def test_prompt_defaults_and_display_name(self):
        prompt = Prompt.objects.create(
            title="Design a Test Service",
            description="Create short, shareable URLs.",
        )

        self.assertEqual(str(prompt), "Design a Test Service")
        self.assertEqual(prompt.difficulty, Prompt.Difficulty.BEGINNER)
        self.assertTrue(prompt.is_active)
        self.assertEqual(prompt.clarifying_questions, [])
        self.assertEqual(prompt.grading_rubric, {})


class PracticeSessionModelTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="diagrammer",
            password="test-password",
        )
        self.prompt = Prompt.objects.create(
            title="Design a Test Chat Application",
            description="Design real-time messaging.",
            difficulty=Prompt.Difficulty.INTERMEDIATE,
        )

    def test_session_belongs_to_user_and_prompt(self):
        practice_session = PracticeSession.objects.create(
            user=self.user,
            prompt=self.prompt,
            diagram_data={"nodes": [], "edges": []},
        )

        self.assertEqual(practice_session.status, PracticeSession.Status.IN_PROGRESS)
        self.assertEqual(self.user.practice_sessions.get(), practice_session)
        self.assertEqual(self.prompt.practice_sessions.get(), practice_session)
        self.assertEqual(
            str(practice_session),
            "diagrammer — Design a Test Chat Application",
        )

    def test_prompt_with_sessions_cannot_be_deleted(self):
        PracticeSession.objects.create(user=self.user, prompt=self.prompt)

        with self.assertRaises(ProtectedError):
            self.prompt.delete()


class PracticeSessionViewTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="session-owner",
            password="test-password",
        )
        self.other_user = get_user_model().objects.create_user(
            username="different-user",
            password="test-password",
        )
        self.prompt = Prompt.objects.create(
            title="Design a Test Photo Feed",
            description="Create a personalized photo feed.",
        )

    def test_prompt_selection_requires_login(self):
        response = self.client.get(reverse("promptselection"))

        self.assertRedirects(
            response,
            f"{reverse('login')}?next={reverse('promptselection')}",
        )

    def test_start_session_creates_attempt_for_current_user(self):
        self.client.force_login(self.user)

        response = self.client.post(reverse("start_session", args=[self.prompt.id]))

        practice_session = PracticeSession.objects.get()
        self.assertEqual(practice_session.user, self.user)
        self.assertEqual(practice_session.prompt, self.prompt)
        self.assertRedirects(
            response,
            reverse("session", args=[practice_session.id]),
        )

    def test_user_cannot_open_another_users_session(self):
        practice_session = PracticeSession.objects.create(
            user=self.user,
            prompt=self.prompt,
        )
        self.client.force_login(self.other_user)

        response = self.client.get(reverse("session", args=[practice_session.id]))

        self.assertEqual(response.status_code, 404)

    def test_save_session_stores_diagram_data(self):
        practice_session = PracticeSession.objects.create(
            user=self.user,
            prompt=self.prompt,
        )
        diagram = {
            "nodes": [{"id": "api", "data": {"label": "API"}}],
            "edges": [],
        }
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("save_session", args=[practice_session.id]),
            data=json.dumps(diagram),
            content_type="application/json",
        )

        practice_session.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(practice_session.diagram_data, diagram)

    def test_user_cannot_save_another_users_session(self):
        practice_session = PracticeSession.objects.create(
            user=self.user,
            prompt=self.prompt,
        )
        self.client.force_login(self.other_user)

        response = self.client.post(
            reverse("save_session", args=[practice_session.id]),
            data=json.dumps({"nodes": [], "edges": []}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)
