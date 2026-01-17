"""
Views for spreadsheets and cells.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import transaction

from .models import Spreadsheet, Cell, Worksheet
from .serializers import (
    SpreadsheetSerializer,
    SpreadsheetListSerializer,
    SpreadsheetCreateSerializer,
    CellSerializer,
    WorksheetSerializer,
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
    
    @action(detail=True, methods=['post'])
    def toggle_favorite(self, request, pk=None):
        """
        Toggle favorite status of a spreadsheet.
        """
        spreadsheet = self.get_object()
        spreadsheet.is_favorite = not spreadsheet.is_favorite
        spreadsheet.save()
        
        log_activity(
            user=self.request.user,
            action_type='update',
            model_name='Spreadsheet',
            description=f"{'Marked' if spreadsheet.is_favorite else 'Unmarked'} spreadsheet '{spreadsheet.name}' as favorite",
            object_id=spreadsheet.id,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
        
        serializer = SpreadsheetSerializer(spreadsheet)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def recent(self, request):
        """
        Get recently viewed/modified spreadsheets.
        """
        user = request.user
        spreadsheets = Spreadsheet.objects.filter(user=user).order_by('-updated_at')[:10]
        serializer = SpreadsheetListSerializer(spreadsheets, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def favorites(self, request):
        """
        Get favorite spreadsheets.
        """
        user = request.user
        spreadsheets = Spreadsheet.objects.filter(user=user, is_favorite=True).order_by('-updated_at')
        serializer = SpreadsheetListSerializer(spreadsheets, many=True)
        return Response(serializer.data)
    
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
        Supports both worksheet-based and spreadsheet-based cells.
        """
        spreadsheet = self.get_object()
        row_index = request.data.get('row_index')
        column_index = request.data.get('column_index')
        worksheet_id = request.data.get('worksheet_id')
        
        if row_index is None or column_index is None:
            return Response(
                {'error': 'row_index and column_index are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # If worksheet_id is provided, use worksheet-based cell
        if worksheet_id:
            try:
                worksheet = Worksheet.objects.get(id=worksheet_id, spreadsheet=spreadsheet)
                cell, created = Cell.objects.update_or_create(
                    spreadsheet=spreadsheet,
                    worksheet=worksheet,
                    row_index=row_index,
                    column_index=column_index,
                    defaults={
                        'value': request.data.get('value'),
                        'formula': request.data.get('formula'),
                        'data_type': request.data.get('data_type', 'text'),
                        'style': request.data.get('style'),
                    }
                )
            except Worksheet.DoesNotExist:
                return Response(
                    {'error': 'Worksheet not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Fallback to spreadsheet-based cell (legacy support)
            cell, created = Cell.objects.update_or_create(
                spreadsheet=spreadsheet,
                worksheet=None,
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
        
        # Validate file size (max 50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        if file.size > max_size:
            return Response(
                {'error': f'File size exceeds {max_size / 1024 / 1024}MB limit'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file extension
        if not file.name.lower().endswith('.csv'):
            return Response(
                {'error': 'Invalid file format. Only CSV files are supported.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Read file content
            file_content = file.read()
            
            if len(file_content) == 0:
                return Response(
                    {'error': 'File is empty'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Read CSV into DataFrame
            df = DataEngineService.import_from_csv(file_content)
            
            if df.empty:
                return Response(
                    {'error': 'CSV file contains no data'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Convert DataFrame to cells
            cells_data = DataEngineService.dataframe_to_cells(df, str(spreadsheet.id))
            
            if not cells_data:
                return Response(
                    {'error': 'No data could be extracted from CSV file'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get or create default worksheet
            worksheet, _ = Worksheet.objects.get_or_create(
                spreadsheet=spreadsheet,
                name='Sheet 1',
                defaults={'position': 0, 'is_active': True}
            )
            
            # Bulk create/update cells with worksheet association
            with transaction.atomic():
                # Clear existing cells in worksheet (optional - comment out if you want to append)
                # worksheet.cells.all().delete()
                
                for cell_data in cells_data:
                    Cell.objects.update_or_create(
                        spreadsheet=spreadsheet,
                        worksheet=worksheet,
                        row_index=cell_data['row_index'],
                        column_index=cell_data['column_index'],
                        defaults={
                            'value': cell_data['value'],
                            'data_type': cell_data['data_type'],
                        }
                    )
            
            # Update spreadsheet dimensions
            spreadsheet.row_count = max(spreadsheet.row_count, len(df.index) + 1)  # +1 for header
            spreadsheet.column_count = max(spreadsheet.column_count, len(df.columns))
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
                    'file_type': 'CSV',
                    'file_name': file.name
                }
            )
            
            return Response(
                {'message': 'CSV imported successfully', 'rows': len(df.index), 'columns': len(df.columns)},
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            # Handle validation errors
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import traceback
            error_msg = str(e)
            print(f"[IMPORT CSV ERROR] {error_msg}")
            traceback.print_exc()
            return Response(
                {'error': f'Failed to import CSV: {error_msg}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        
        # Validate file size (max 50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        if file.size > max_size:
            return Response(
                {'error': f'File size exceeds {max_size / 1024 / 1024}MB limit'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file extension
        file_ext = file.name.lower()
        if not (file_ext.endswith('.xlsx') or file_ext.endswith('.xls')):
            return Response(
                {'error': 'Invalid file format. Only Excel files (.xlsx, .xls) are supported.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Convert empty string to None
        if not sheet_name or sheet_name == 'None':
            sheet_name = None
        
        try:
            # Read file content
            file_content = file.read()
            
            if len(file_content) == 0:
                return Response(
                    {'error': 'File is empty'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Read Excel into DataFrame
            df = DataEngineService.import_from_excel(file_content, sheet_name)
            
            if df.empty:
                return Response(
                    {'error': 'Excel file contains no data'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Convert DataFrame to cells
            cells_data = DataEngineService.dataframe_to_cells(df, str(spreadsheet.id))
            
            if not cells_data:
                return Response(
                    {'error': 'No data could be extracted from Excel file'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get or create worksheet with the sheet name
            worksheet_name = sheet_name or 'Sheet 1'
            worksheet, created = Worksheet.objects.get_or_create(
                spreadsheet=spreadsheet,
                name=worksheet_name,
                defaults={'position': 0, 'is_active': True}
            )
            
            # Bulk create/update cells with worksheet association
            with transaction.atomic():
                # Clear existing cells in worksheet (optional - comment out if you want to append)
                # worksheet.cells.all().delete()
                
                for cell_data in cells_data:
                    Cell.objects.update_or_create(
                        spreadsheet=spreadsheet,
                        worksheet=worksheet,
                        row_index=cell_data['row_index'],
                        column_index=cell_data['column_index'],
                        defaults={
                            'value': cell_data['value'],
                            'data_type': cell_data['data_type'],
                        }
                    )
            
            # Update spreadsheet dimensions
            spreadsheet.row_count = max(spreadsheet.row_count, len(df.index) + 1)  # +1 for header
            spreadsheet.column_count = max(spreadsheet.column_count, len(df.columns))
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
                    'sheet_name': sheet_name,
                    'file_name': file.name
                }
            )
            
            return Response(
                {'message': 'Excel imported successfully', 'rows': len(df.index), 'columns': len(df.columns)},
                status=status.HTTP_200_OK
            )
        except ValueError as e:
            # Handle validation errors
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import traceback
            error_msg = str(e)
            print(f"[IMPORT EXCEL ERROR] {error_msg}")
            traceback.print_exc()
            return Response(
                {'error': f'Failed to import Excel: {error_msg}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
    def worksheets(self, request, pk=None):
        """
        Get all worksheets for a spreadsheet.
        Auto-create default worksheet if none exist.
        """
        spreadsheet = self.get_object()
        worksheets = spreadsheet.worksheets.all()
        
        # Auto-create default worksheet if none exist
        if not worksheets.exists():
            Worksheet.objects.create(
                spreadsheet=spreadsheet,
                name='Sheet1',
                position=1,
                is_active=True
            )
            worksheets = spreadsheet.worksheets.all()
        
        serializer = WorksheetSerializer(worksheets, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def create_worksheet(self, request, pk=None):
        """
        Create a new worksheet in a spreadsheet.
        """
        spreadsheet = self.get_object()
        name = request.data.get('name', f'Sheet{spreadsheet.worksheets.count() + 1}')
        
        # Get the next position
        next_position = spreadsheet.worksheets.count() + 1
        
        worksheet = Worksheet.objects.create(
            spreadsheet=spreadsheet,
            name=name,
            position=next_position,
            is_active=False  # Don't auto-activate new sheets
        )
        
        log_activity(
            user=self.request.user,
            action_type='create',
            model_name='Worksheet',
            description=f"Created worksheet '{name}' in spreadsheet '{spreadsheet.name}'",
            object_id=worksheet.id,
            related_object=spreadsheet,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
        
        serializer = WorksheetSerializer(worksheet)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def rename_worksheet(self, request, pk=None):
        """
        Rename a worksheet.
        """
        spreadsheet = self.get_object()
        worksheet_id = request.data.get('worksheet_id')
        new_name = request.data.get('name')
        
        if not worksheet_id or not new_name:
            return Response(
                {'error': 'worksheet_id and name are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        worksheet = get_object_or_404(Worksheet, id=worksheet_id, spreadsheet=spreadsheet)
        old_name = worksheet.name
        worksheet.name = new_name
        worksheet.save()
        
        log_activity(
            user=self.request.user,
            action_type='update',
            model_name='Worksheet',
            description=f"Renamed worksheet from '{old_name}' to '{new_name}' in spreadsheet '{spreadsheet.name}'",
            object_id=worksheet.id,
            related_object=spreadsheet,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
        
        serializer = WorksheetSerializer(worksheet)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def set_active_worksheet(self, request, pk=None):
        """
        Set the active worksheet.
        """
        spreadsheet = self.get_object()
        worksheet_id = request.data.get('worksheet_id')
        
        if not worksheet_id:
            return Response(
                {'error': 'worksheet_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Deactivate all worksheets
        spreadsheet.worksheets.all().update(is_active=False)
        
        # Activate the selected worksheet
        worksheet = get_object_or_404(Worksheet, id=worksheet_id, spreadsheet=spreadsheet)
        worksheet.is_active = True
        worksheet.save()
        
        log_activity(
            user=self.request.user,
            action_type='update',
            model_name='Worksheet',
            description=f"Activated worksheet '{worksheet.name}' in spreadsheet '{spreadsheet.name}'",
            object_id=worksheet.id,
            related_object=spreadsheet,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
        
        serializer = WorksheetSerializer(worksheet)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['delete'])
    def delete_worksheet(self, request, pk=None):
        """
        Delete a worksheet.
        """
        spreadsheet = self.get_object()
        worksheet_id = request.data.get('worksheet_id')
        
        if not worksheet_id:
            return Response(
                {'error': 'worksheet_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if it's the only worksheet
        if spreadsheet.worksheets.count() <= 1:
            return Response(
                {'error': 'Cannot delete the last worksheet'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        worksheet = get_object_or_404(Worksheet, id=worksheet_id, spreadsheet=spreadsheet)
        worksheet_name = worksheet.name
        worksheet.delete()
        
        log_activity(
            user=self.request.user,
            action_type='delete',
            model_name='Worksheet',
            description=f"Deleted worksheet '{worksheet_name}' in spreadsheet '{spreadsheet.name}'",
            object_id=str(worksheet_id),
            related_object=spreadsheet,
            ip_address=get_client_ip(self.request),
            user_agent=get_user_agent(self.request)
        )
        
        return Response(
            {'message': 'Worksheet deleted successfully'},
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['post'])
    def update_worksheet_cells(self, request, pk=None):
        """
        Update cells for a specific worksheet.
        """
        spreadsheet = self.get_object()
        worksheet_id = request.data.get('worksheet_id')
        cells_data = request.data.get('cells', [])
        
        if not worksheet_id:
            return Response(
                {'error': 'worksheet_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        worksheet = get_object_or_404(Worksheet, id=worksheet_id, spreadsheet=spreadsheet)
        
        try:
            with transaction.atomic():
                for cell_data in cells_data:
                    Cell.objects.update_or_create(
                        worksheet=worksheet,
                        row_index=cell_data['row_index'],
                        column_index=cell_data['column_index'],
                        defaults={
                            'spreadsheet': spreadsheet,
                            'value': cell_data.get('value'),
                            'formula': cell_data.get('formula'),
                            'data_type': cell_data.get('data_type', 'text'),
                            'style': cell_data.get('style'),
                        }
                    )
            
            return Response(
                {'message': 'Cells updated successfully'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def worksheet_cells(self, request, pk=None):
        """
        Get all cells for a specific worksheet.
        """
        spreadsheet = self.get_object()
        worksheet_id = request.query_params.get('worksheet_id')
        
        if not worksheet_id:
            return Response(
                {'error': 'worksheet_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        worksheet = get_object_or_404(Worksheet, id=worksheet_id, spreadsheet=spreadsheet)
        cells = worksheet.cells.all()
        serializer = CellSerializer(cells, many=True)
        return Response(serializer.data)
    
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

