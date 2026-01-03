"""
Models for data analysis.
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from apps.spreadsheets.models import Spreadsheet

User = get_user_model()


class Analysis(models.Model):
    """
    Analysis model for storing statistical analysis results.
    """
    ANALYSIS_TYPE_CHOICES = [
        ('summary_stats', 'Summary Statistics'),
        ('correlation', 'Correlation'),
        ('regression', 'Linear Regression'),
        ('custom', 'Custom Analysis'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spreadsheet = models.ForeignKey(
        Spreadsheet,
        on_delete=models.CASCADE,
        related_name='analyses',
        db_index=True
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='analyses',
        db_index=True
    )
    analysis_type = models.CharField(
        max_length=50,
        choices=ANALYSIS_TYPE_CHOICES
    )
    selected_columns = models.JSONField()  # List of column indices
    parameters = models.JSONField(default=dict, blank=True)  # Analysis-specific parameters
    results = models.JSONField()  # Analysis results
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analyses'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['spreadsheet', '-created_at']),
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"{self.analysis_type} on {self.spreadsheet.name}"


