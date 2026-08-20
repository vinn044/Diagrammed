from django.contrib.auth import views as auth_views
from django.urls import path

from . import views

urlpatterns = [
    path('', views.home, name = 'home'),
    path('login/', auth_views.LoginView.as_view(template_name='login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('register/', views.register, name='register'),
    path('prompts/', views.promptselection, name='promptselection'),
    path('prompts/<int:prompt_id>/start/', views.start_session, name='start_session'),
    path('session/<int:session_id>/', views.session, name='session'),
    path('session/<int:session_id>/save/', views.save_session, name='save_session'),
    path('session/<int:session_id>/answers/save/', views.save_session_answers, name='save_session_answers'),
]
