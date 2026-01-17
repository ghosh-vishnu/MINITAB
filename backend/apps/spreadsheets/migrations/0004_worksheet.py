# Generated migration for Worksheet model

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('spreadsheets', '0003_remove_spreadsheet_worksheet_count_and_more'),
    ]

    operations = [
        # Create Worksheet model first
        migrations.CreateModel(
            name='Worksheet',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(default='Sheet1', max_length=255)),
                ('position', models.IntegerField(default=1)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('spreadsheet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='worksheets', to='spreadsheets.spreadsheet')),
            ],
            options={
                'db_table': 'worksheets',
                'ordering': ['position'],
            },
        ),
        # Make spreadsheet nullable for backward compatibility
        migrations.AlterField(
            model_name='cell',
            name='spreadsheet',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='cells', to='spreadsheets.spreadsheet'),
        ),
        # Add worksheet field to cell
        migrations.AddField(
            model_name='cell',
            name='worksheet',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='cells', to='spreadsheets.worksheet'),
        ),
        # Add indexes
        migrations.AddIndex(
            model_name='worksheet',
            index=models.Index(fields=['spreadsheet', 'position'], name='worksheets_spreads_3bec3e_idx'),
        ),
        migrations.AddIndex(
            model_name='cell',
            index=models.Index(fields=['worksheet', 'row_index', 'column_index'], name='cells_workshe_e1b63f_idx'),
        ),
        migrations.AddIndex(
            model_name='cell',
            index=models.Index(fields=['spreadsheet', 'row_index', 'column_index'], name='cells_spreads_idx'),
        ),
    ]

