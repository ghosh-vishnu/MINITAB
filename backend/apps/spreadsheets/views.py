"""
Views for spreadsheets and cells.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import transaction

from .models import Spreadsheet, Cell
from .serializers import (
    SpreadsheetSerializer,
    SpreadsheetListSerializer,
    SpreadsheetCreateSerializer,
    CellSerializer,
    CellBulkUpdateSerializer
)
from .services import DataEngineService
from apps.rbac.utils import log_activity, get_client_ip, get_user_agent


class SpreadsheetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Spreadsheet CRUD operations.
    """
    queryset = Spreadsheet.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SpreadsheetListSerializer
        elif self.action == 'create':
            return SpreadsheetCreateSerializer
        return SpreadsheetSerializer
    
    def get_queryset(self):
        """
        Filter spreadsheets by current user.
        """
        user = self.request.user
        return Spreadsheet.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """
        Set the user when creating a spreadsheet.
        """
        spreadsheet = serializer.save(user=self.request.user)
        log_activity(
            user=self.request.user,
            action_type='create',
            model_name='Spreadsheet',
            description=f"Created spreadsheet: {spreadsheet.name}",
            object_id=spreadsheet.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
    
    def create(self, request, *args, **kwargs):
        """
        Override create to return full serializer with id.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Return full spreadsheet data including id
        full_serializer = SpreadsheetSerializer(serializer.instance)
        headers = self.get_success_headers(serializer.data)
        return Response(full_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_update(self, serializer):
        """
        Log activity when updating a spreadsheet.
        """
        instance = serializer.instance
        serializer.save()
        log_activity(
            user=self.request.user,
            action_type='update',
            model_name='Spreadsheet',
            description=f"Updated spreadsheet: {instance.name}",
            object_id=instance.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
    
    def perform_destroy(self, instance):
        """
        Log activity when deleting a spreadsheet.
        """
        log_activity(
            user=self.request.user,
            action_type='delete',
            model_name='Spreadsheet',
            description=f"Deleted spreadsheet: {instance.name}",
            object_id=instance.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
        instance.delete()
    
    @action(detail=True, methods=['get'])
    def cells(self, request, pk=None):
        """
        Get all cells for a spreadsheet.
        """
        spreadsheet = self.get_object()
        cells = spreadsheet.cells.all()
        serializer = CellSerializer(cells, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def save_worksheet_names(self, request, pk=None):
        """
        Save worksheet names for a spreadsheet.
        """
        spreadsheet = self.get_object()
        worksheet_names = request.data.get('worksheet_names', {})
        
        spreadsheet.worksheet_names = worksheet_names
        spreadsheet.save()
        
        log_activity(
            user=self.request.user,
            action_type='update',
            model_name='Spreadsheet',
            description=f"Updated worksheet names in spreadsheet: {spreadsheet.name}",
            object_id=spreadsheet.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
        
        serializer = SpreadsheetSerializer(spreadsheet)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def update_cells(self, request, pk=None):
        """
        Bulk update cells for a spreadsheet.
        """
        spreadsheet = self.get_object()
        serializer = CellBulkUpdateSerializer(
            data=request.data,
            context={'spreadsheet_id': spreadsheet.id}
        )
        
        if serializer.is_valid():
            with transaction.atomic():
                serializer.create(serializer.validated_data)
            
            # Log activity for bulk update
            cells_count = len(serializer.validated_data.get('cells', []))
            log_activity(
                user=self.request.user,
                action_type='update',
                model_name='Cell',
                description=f"Bulk updated {cells_count} cells in spreadsheet '{spreadsheet.name}'",
                related_object=spreadsheet,
                ip_address=get_client_ip(self.request),
                user_agent=get_user_agent(self.request),
                metadata={
                    'cells_count': cells_count,
                    'spreadsheet_id': str(spreadsheet.id)
                }
            )
            
            return Response(
                {'message': 'Cells updated successfully'},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def update_cell(self, request, pk=None):
        """
        Update a single cell.
        """
        spreadsheet = self.get_object()
        row_index = request.data.get('row_index')
        column_index = request.data.get('column_index')
        
        if row_index is None or column_index is None:
            return Response(
                {'error': 'row_index and column_index are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        cell, created = Cell.objects.update_or_create(
            spreadsheet=spreadsheet,
            row_index=row_index,
            column_index=column_index,
            defaults={
                'value': request.data.get('value'),
                'formula': request.data.get('formula'),
                'data_type': request.data.get('data_type', 'text'),
                'style': request.data.get('style'),
            }
        )
        
        # Log activity
        action = 'create' if created else 'update'
        log_activity(
            user=self.request.user,
            action_type=action,
            model_name='Cell',
            description=f"{'Created' if created else 'Updated'} cell at row {row_index}, column {column_index} in spreadsheet '{spreadsheet.name}'",
            object_id=cell.id,
            related_object=spreadsheet,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request),
            metadata={
                'row_index': row_index,
                'column_index': column_index,
                'value': request.data.get('value'),
                'spreadsheet_id': str(spreadsheet.id)
            }
        )
        
        serializer = CellSerializer(cell)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['delete'])
    def delete_cell(self, request, pk=None):
        """
        Delete a single cell.
        """
        spreadsheet = self.get_object()
        row_index = request.data.get('row_index')
        column_index = request.data.get('column_index')
        
        if row_index is None or column_index is None:
            return Response(
                {'error': 'row_index and column_index are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        cells = Cell.objects.filter(
            spreadsheet=spreadsheet,
            row_index=row_index,
            column_index=column_index
        )
        
        if cells.exists():
            cell = cells.first()
            log_activity(
                user=self.request.user,
                action_type='delete',
                model_name='Cell',
                description=f"Deleted cell at row {row_index}, column {column_index} in spreadsheet '{spreadsheet.name}'",
                object_id=cell.id,
                related_object=spreadsheet,
                ip_address=get_client_ip(self.request),
                user_agent=get_user_agent(self.request),
                metadata={
                    'row_index': row_index,
                    'column_index': column_index,
                    'spreadsheet_id': str(spreadsheet.id)
                }
            )
            cells.delete()
        
        return Response(
            {'message': 'Cell deleted successfully'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_csv(self, request, pk=None):
        """
        Import CSV file into spreadsheet.
        """
        spreadsheet = self.get_object()
        
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['file']
        
        try:
            # Read CSV into DataFrame
            df = DataEngineService.import_from_csv(file.read())
            
            # Convert DataFrame to cells
            cells_data = DataEngineService.dataframe_to_cells(df, str(spreadsheet.id))
            
            # Bulk create/update cells
            with transaction.atomic():
                for cell_data in cells_data:
                    Cell.objects.update_or_create(
                        spreadsheet=spreadsheet,
                        row_index=cell_data['row_index'],
                        column_index=cell_data['column_index'],
                        defaults={
                            'value': cell_data['value'],
                            'data_type': cell_data['data_type'],
                        }
                    )
            
            # Update spreadsheet dimensions
            if not df.empty:
                spreadsheet.row_count = len(df.index)
                spreadsheet.column_count = len(df.columns)
                spreadsheet.save()
            
            # Log activity
            log_activity(
                user=self.request.user,
                action_type='import',
                model_name='Spreadsheet',
                description=f"Imported CSV file into spreadsheet '{spreadsheet.name}' ({len(df.index)} rows, {len(df.columns)} columns)",
                object_id=spreadsheet.id,
                ip_address=get_client_ip(self.request),
                user_agent=get_user_agent(self.request),
                metadata={
                    'rows': len(df.index),
                    'columns': len(df.columns),
                    'file_type': 'CSV'
                }
            )
            
            return Response(
                {'message': 'CSV imported successfully', 'rows': len(df.index), 'columns': len(df.columns)},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_excel(self, request, pk=None):
        """
        Import Excel file into spreadsheet.
        """
        spreadsheet = self.get_object()
        
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file = request.FILES['file']
        sheet_name = request.data.get('sheet_name')
        
        try:
            # Read Excel into DataFrame
            df = DataEngineService.import_from_excel(file.read(), sheet_name)
            
            # Convert DataFrame to cells
            cells_data = DataEngineService.dataframe_to_cells(df, str(spreadsheet.id))
            
            # Bulk create/update cells
            with transaction.atomic():
                for cell_data in cells_data:
                    Cell.objects.update_or_create(
                        spreadsheet=spreadsheet,
                        row_index=cell_data['row_index'],
                        column_index=cell_data['column_index'],
                        defaults={
                            'value': cell_data['value'],
                            'data_type': cell_data['data_type'],
                        }
                    )
            
            # Update spreadsheet dimensions
            if not df.empty:
                spreadsheet.row_count = len(df.index)
                spreadsheet.column_count = len(df.columns)
                spreadsheet.save()
            
            # Log activity
            log_activity(
                user=self.request.user,
                action_type='import',
                model_name='Spreadsheet',
                description=f"Imported Excel file into spreadsheet '{spreadsheet.name}' ({len(df.index)} rows, {len(df.columns)} columns)",
                object_id=spreadsheet.id,
                ip_address=get_client_ip(self.request),
                user_agent=get_user_agent(self.request),
                metadata={
                    'rows': len(df.index),
                    'columns': len(df.columns),
                    'file_type': 'Excel',
                    'sheet_name': sheet_name
                }
            )
            
            return Response(
                {'message': 'Excel imported successfully', 'rows': len(df.index), 'columns': len(df.columns)},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def export_csv(self, request, pk=None):
        """
        Export spreadsheet to CSV.
        """
        spreadsheet = self.get_object()
        cells = spreadsheet.cells.all()
        
        # Convert cells to list of dicts
        cells_data = [
            {
                'row_index': cell.row_index,
                'column_index': cell.column_index,
                'value': cell.value or '',
            }
            for cell in cells
        ]
        
        # Convert to DataFrame
        df = DataEngineService.cells_to_dataframe(cells_data)
        
        # Export to CSV
        csv_content = DataEngineService.export_to_csv(df)
        
        # Log activity
        log_activity(
            user=self.request.user,
            action_type='export',
            model_name='Spreadsheet',
            description=f"Exported spreadsheet '{spreadsheet.name}' to CSV",
            object_id=spreadsheet.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request),
            metadata={'file_type': 'CSV'}
        )
        
        from django.http import HttpResponse
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{spreadsheet.name}.csv"'
        return response
    
    @action(detail=True, methods=['get'])
    def export_excel(self, request, pk=None):
        """
        Export spreadsheet to Excel.
        """
        spreadsheet = self.get_object()
        cells = spreadsheet.cells.all()
        
        # Convert cells to list of dicts
        cells_data = [
            {
                'row_index': cell.row_index,
                'column_index': cell.column_index,
                'value': cell.value or '',
            }
            for cell in cells
        ]
        
        # Convert to DataFrame
        df = DataEngineService.cells_to_dataframe(cells_data)
        
        # Export to Excel
        excel_content = DataEngineService.export_to_excel(df)
        
        # Log activity
        log_activity(
            user=self.request.user,
            action_type='export',
            model_name='Spreadsheet',
            description=f"Exported spreadsheet '{spreadsheet.name}' to Excel",
            object_id=spreadsheet.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request),
            metadata={'file_type': 'Excel'}
        )
        
        from django.http import HttpResponse
        response = HttpResponse(
            excel_content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{spreadsheet.name}.xlsx"'
        return response

