# Generated by Django 3.0.3 on 2020-04-13 19:36

import django.contrib.postgres.fields.jsonb
from django.db import migrations, models
import django.db.models.deletion
from posthog.constants import TREND_FILTER_TYPE_ACTIONS, TREND_FILTER_TYPE_EVENTS


def move_funnel_steps(apps, schema_editor):
    Funnel = apps.get_model("posthog", "Funnel")
    for funnel in Funnel.objects.all():
        funnel.filters = {
            "actions": [
                {"id": step.action_id, "order": step.order, "type": TREND_FILTER_TYPE_ACTIONS,}
                for step in funnel.steps.all()
            ]
        }
        funnel.save()


def revert_funnel_steps(apps, schema_editor):
    pass
    # Funnel = apps.get_model('posthog', 'Funnel')
    # for funnel in Funnel.objects.filter(steps):
    #     for step in funnel.steps:
    #         if step['type'] == TREND_FILTER_TYPE_ACTIONS:
    #             FunnelStep.objects.create(funnel=funnel, action_id=step['id'], order=step.get('order'))


class Migration(migrations.Migration):

    dependencies = [
        ("posthog", "0043_slack_webhooks"),
    ]

    operations = [
        migrations.AddField(
            model_name="funnel", name="filters", field=django.contrib.postgres.fields.jsonb.JSONField(default=dict),
        ),
        migrations.RunPython(move_funnel_steps, revert_funnel_steps),
    ]
