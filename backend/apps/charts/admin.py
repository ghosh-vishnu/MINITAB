"""
Admin configuration for charts app.
"""
from django.contrib import admin
from .models import Chart


@admin.register(Chart)
class ChartAdmin(admin.ModelAdmin):
    """
    Admin interface for Chart model.
    """
    list_display = ('title', 'chart_type', 'spreadsheet', 'user', 'created_at')
    list_filter = ('chart_type', 'created_at')
    search_fields = ('title', 'spreadsheet__name', 'user__username')
    readonly_fields = ('id', 'created_at', 'updated_at')



