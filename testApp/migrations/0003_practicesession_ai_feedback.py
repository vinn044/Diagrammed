from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('testApp', '0002_seed_prompts'),
    ]

    operations = [
        migrations.AddField(
            model_name='practicesession',
            name='ai_feedback',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='practicesession',
            name='graded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
