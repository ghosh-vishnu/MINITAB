"""
Models for charts.
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model
from apps.spreadsheets.models import Spreadsheet

User = get_user_model()


class Chart(models.Model):
    """
    Chart model for storing chart configurations.
    """
    CHART_TYPE_CHOICES = [
        ('bar', 'Bar Chart'),
        ('line', 'Line Chart'),
        ('histogram', 'Histogram'),
        ('scatter', 'Scatter Plot'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spreadsheet = models.ForeignKey(
        Spreadsheet,
        on_delete=models.CASCADE,
        related_name='charts',
        db_index=True
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='charts',
        db_index=True
    )
    chart_type = models.CharField(
        max_length=50,
        choices=CHART_TYPE_CHOICES
    )
    title = models.CharField(max_length=255)
    x_axis_column = models.IntegerField()
    y_axis_columns = models.JSONField()  # List of column indices
    config = models.JSONField(default=dict, blank=True)  # Chart configuration
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'charts'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['spreadsheet', '-updated_at']),
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return f"{self.chart_type} - {self.title}"

