"""
Models for spreadsheets and cells.
"""
import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Spreadsheet(models.Model):
    """
    Spreadsheet model representing a workbook.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='spreadsheets',
        db_index=True
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    row_count = models.IntegerField(default=100)
    column_count = models.IntegerField(default=26)
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'spreadsheets'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class Cell(models.Model):
    """
    Cell model representing individual spreadsheet cells.
    """
    DATA_TYPE_CHOICES = [
        ('text', 'Text'),
        ('number', 'Number'),
        ('date', 'Date'),
        ('formula', 'Formula'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    spreadsheet = models.ForeignKey(
        Spreadsheet,
        on_delete=models.CASCADE,
        related_name='cells',
        db_index=True
    )
    row_index = models.IntegerField()
    column_index = models.IntegerField()
    value = models.TextField(blank=True, null=True)
    formula = models.TextField(blank=True, null=True)
    data_type = models.CharField(
        max_length=20,
        choices=DATA_TYPE_CHOICES,
        default='text'
    )
    style = models.JSONField(blank=True, null=True)  # Cell formatting
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cells'
        unique_together = [['spreadsheet', 'row_index', 'column_index']]
        indexes = [
            models.Index(fields=['spreadsheet', 'row_index', 'column_index']),
        ]

    def __str__(self):
        return f"Cell({self.row_index}, {self.column_index}) in {self.spreadsheet.name}"



