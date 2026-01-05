"""
Views for charts.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Chart
from .serializers import ChartSerializer, ChartDataSerializer
from apps.spreadsheets.models import Spreadsheet
from apps.spreadsheets.services import DataEngineService


class ChartViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Chart operations.
    """
    queryset = Chart.objects.all()
    serializer_class = ChartSerializer
    
    def get_queryset(self):
        """
        Filter charts by current user.
        """
        user = self.request.user
        return Chart.objects.filter(user=user)
    
    def perform_create(self, serializer):
        """
        Set the user when creating a chart.
        """
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['get'])
    def data(self, request, pk=None):
        """
        Get chart data for rendering.
        """
        chart = self.get_object()
        spreadsheet = chart.spreadsheet
        
        # Get cells and convert to DataFrame
        cells = spreadsheet.cells.all()
        cells_data = [
            {
                'row_index': cell.row_index,
                'column_index': cell.column_index,
                'value': cell.value or '',
            }
            for cell in cells
        ]
        
        df = DataEngineService.cells_to_dataframe(cells_data)
        
        if df.empty:
            return Response(
                {'error': 'Spreadsheet is empty'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract data based on chart configuration
        x_col = chart.x_axis_column
        y_cols = chart.y_axis_columns
        
        if x_col not in df.columns:
            return Response(
                {'error': f'X-axis column {x_col} not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get labels from x-axis column
        labels = []
        x_data = df[x_col]
        for idx in x_data.index:
            val = x_data.at[idx]
            labels.append(str(val) if val else '')
        
        # Get datasets from y-axis columns
        datasets = []
        for y_col in y_cols:
            if y_col not in df.columns:
                continue
            
            y_data = df[y_col]
            data = []
            for idx in y_data.index:
                val = y_data.at[idx]
                try:
                    num_val = float(val) if val else 0
                    data.append(num_val)
                except (ValueError, TypeError):
                    data.append(0)
            
            datasets.append({
                'label': f'Column {y_col}',
                'data': data,
            })
        
        chart_data = {
            'labels': labels,
            'datasets': datasets,
        }
        
        serializer = ChartDataSerializer(chart_data)
        return Response(serializer.data)



