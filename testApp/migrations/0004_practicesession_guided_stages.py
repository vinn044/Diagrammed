from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('testApp', '0003_practicesession_ai_feedback'),
    ]

    operations = [
        migrations.AddField(
            model_name='practicesession',
            name='current_stage',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='practicesession',
            name='stage_feedback',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
