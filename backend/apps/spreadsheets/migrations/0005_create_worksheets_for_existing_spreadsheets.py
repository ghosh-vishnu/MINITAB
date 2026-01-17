# Generated migration to create default worksheets for existing spreadsheets

from django.db import migrations


def create_worksheets_for_existing_spreadsheets(apps, schema_editor):
    """
    Create default worksheets for spreadsheets that don't have any.
    """
    Spreadsheet = apps.get_model('spreadsheets', 'Spreadsheet')
    Worksheet = apps.get_model('spreadsheets', 'Worksheet')
    Cell = apps.get_model('spreadsheets', 'Cell')
    
    for spreadsheet in Spreadsheet.objects.all():
        # Check if this spreadsheet already has worksheets
        if not spreadsheet.worksheets.exists():
            # Create a default "Sheet1"
            worksheet = Worksheet.objects.create(
                spreadsheet=spreadsheet,
                name='Sheet1',
                position=1,
                is_active=True
            )
            
            # Migrate existing cells to this worksheet
            spreadsheet.cells.all().update(worksheet=worksheet)


def reverse_migration(apps, schema_editor):
    """
    Reverse the migration - remove all worksheets and cells relationship.
    """
    Worksheet = apps.get_model('spreadsheets', 'Worksheet')
    Cell = apps.get_model('spreadsheets', 'Cell')
    
    # Clear worksheet references from cells
    Cell.objects.all().update(worksheet=None)
    
    # Delete all worksheets
    Worksheet.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('spreadsheets', '0004_worksheet'),
    ]

    operations = [
        migrations.RunPython(create_worksheets_for_existing_spreadsheets, reverse_migration),
    ]

