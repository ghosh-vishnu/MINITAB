"""
Admin configuration for spreadsheets app.
"""
from django.contrib import admin
from .models import Spreadsheet, Cell


@admin.register(Spreadsheet)
class SpreadsheetAdmin(admin.ModelAdmin):
    """
    Admin interface for Spreadsheet model.
    """
    list_display = ('name', 'user', 'row_count', 'column_count', 'is_public', 'created_at')
    list_filter = ('is_public', 'created_at')
    search_fields = ('name', 'user__username')
    readonly_fields = ('id', 'created_at', 'updated_at')


@admin.register(Cell)
class CellAdmin(admin.ModelAdmin):
    """
    Admin interface for Cell model.
    """
    list_display = ('spreadsheet', 'row_index', 'column_index', 'value', 'data_type', 'updated_at')
    list_filter = ('data_type', 'updated_at')
    search_fields = ('spreadsheet__name', 'value')
    readonly_fields = ('id', 'created_at', 'updated_at')



