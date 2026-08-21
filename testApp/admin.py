from django.contrib import admin

from .models import PracticeSession, Prompt


@admin.register(Prompt)
class PromptAdmin(admin.ModelAdmin):
    list_display = ("title", "difficulty", "is_active", "updated_at")
    list_filter = ("difficulty", "is_active")
    search_fields = ("title", "description")


@admin.register(PracticeSession)
class PracticeSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "prompt", "status", "started_at", "completed_at")
    list_filter = ("status", "prompt")
    search_fields = ("user__username", "prompt__title")
    readonly_fields = ("started_at", "updated_at", "graded_at")
