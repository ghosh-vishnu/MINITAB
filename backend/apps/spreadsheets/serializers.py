"""
Serializers for spreadsheets and cells.
"""
from rest_framework import serializers
from .models import Spreadsheet, Cell, Worksheet


class CellSerializer(serializers.ModelSerializer):
    """
    Serializer for Cell model.
    """
    class Meta:
        model = Cell
        fields = (
            'id', 'row_index', 'column_index', 'value', 'formula',
            'data_type', 'style', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class WorksheetSerializer(serializers.ModelSerializer):
    """
    Serializer for Worksheet model.
    """
    cells = CellSerializer(many=True, read_only=True)
    
    class Meta:
        model = Worksheet
        fields = (
            'id', 'name', 'position', 'is_active', 'cells', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class SpreadsheetSerializer(serializers.ModelSerializer):
    """
    Serializer for Spreadsheet model.
    """
    cells = CellSerializer(many=True, read_only=True)
    worksheets = WorksheetSerializer(many=True, read_only=True)
    user = serializers.StringRelatedField(read_only=True)
    
    class Meta:
        model = Spreadsheet
        fields = (
            'id', 'name', 'description', 'row_count', 'column_count',
            'is_public', 'user', 'cells', 'worksheets', 'worksheet_names', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'user', 'created_at', 'updated_at')


class SpreadsheetListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for spreadsheet list view.
    """
    class Meta:
        model = Spreadsheet
        fields = (
            'id', 'name', 'description', 'row_count', 'column_count',
            'is_public', 'worksheet_names', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class CellBulkUpdateSerializer(serializers.Serializer):
    """
    Serializer for bulk cell updates.
    """
    cells = CellSerializer(many=True)
    
    def create(self, validated_data):
        spreadsheet_id = self.context['spreadsheet_id']
        cells_data = validated_data['cells']
        
        created_cells = []
        for cell_data in cells_data:
            cell_data['spreadsheet_id'] = spreadsheet_id
            cell, created = Cell.objects.update_or_create(
                spreadsheet_id=spreadsheet_id,
                row_index=cell_data['row_index'],
                column_index=cell_data['column_index'],
                defaults=cell_data
            )
            created_cells.append(cell)
        
        return {'cells': created_cells}


class SpreadsheetCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating a new spreadsheet.
    """
    class Meta:
        model = Spreadsheet
        fields = ('id', 'name', 'description', 'row_count', 'column_count', 'is_public', 'worksheet_names')
        read_only_fields = ('id',)

