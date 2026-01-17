#!/usr/bin/env python
"""
Script to migrate existing cells to worksheets
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.spreadsheets.models import Spreadsheet, Worksheet

for spreadsheet in Spreadsheet.objects.all():
    if not spreadsheet.worksheets.exists():
        worksheet = Worksheet.objects.create(
            spreadsheet=spreadsheet,
            name='Sheet1',
            position=1,
            is_active=True
        )
        print(f"Created default worksheet for {spreadsheet.name}")
        cells_count = spreadsheet.cells.all().update(worksheet=worksheet)
        print(f"Migrated {cells_count} cells to worksheet")
    else:
        worksheets = list(spreadsheet.worksheets.values_list('name', flat=True))
        print(f"Spreadsheet {spreadsheet.name} already has worksheets: {worksheets}")

print("Migration complete!")
