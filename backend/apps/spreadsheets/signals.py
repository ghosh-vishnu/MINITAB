"""
Signal handlers for spreadsheets app.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Spreadsheet, Worksheet


@receiver(post_save, sender=Spreadsheet)
def create_default_worksheet(sender, instance, created, **kwargs):
    """
    Create a default worksheet when a spreadsheet is created.
    """
    if created:
        # Check if a default worksheet already exists
        if not instance.worksheets.exists():
            Worksheet.objects.create(
                spreadsheet=instance,
                name='Sheet1',
                position=1,
                is_active=True
            )
