"""
Admin configuration for analysis app.
"""
from django.contrib import admin
from .models import Analysis


@admin.register(Analysis)
class AnalysisAdmin(admin.ModelAdmin):
    """
    Admin interface for Analysis model.
    """
    list_display = ('analysis_type', 'spreadsheet', 'user', 'created_at')
    list_filter = ('analysis_type', 'created_at')
    search_fields = ('spreadsheet__name', 'user__username')
    readonly_fields = ('id', 'created_at')


